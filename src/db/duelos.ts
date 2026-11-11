// Partidas 1x1 do Simulador (supabase/migrations/20261110000000_duelos.sql). A sala guarda os decks,
// a semente e as versões; cada resposta dada no duelo vira uma linha numerada em duelo_respostas.
// Os dois aparelhos rodam o motor com a mesma semente e aplicam as mesmas respostas, na mesma ordem.
import { supabase } from "./supabase";
import { t } from "../i18n";
import type { DeckSim, Jogada, Partida } from "../sim/regras";

export interface Duelo {
  id: string;
  /** código de 6 dígitos para entrar sem o link (ausente antes da migração do código) */
  codigo?: string;
  criador: string;
  convidado: string | null;
  /** lugar do criador no motor (o jogador 0 começa) */
  criador_jogador: 0 | 1;
  semente: [string, string, string, string];
  deck_criador: DeckSim;
  deck_convidado: DeckSim | null;
  versao_motor: string;
  versao_app: string;
  estado: "aguardando" | "em-andamento" | "encerrado";
  vencedor: 0 | 1 | null;
  /** "Escolher Cartas na Mão" (migração 20261110030000): cada um grava a mão antes do duelo */
  escolher_mao?: boolean;
  /** mão escolhida (vazia = aleatória); nula enquanto o jogador não deu "Pronto" */
  mao_criador?: number[] | null;
  mao_convidado?: number[] | null;
}

// todas as colunas: funciona com ou sem a coluna "codigo" (migração 20261110020000)
const COLUNAS = "*";

/** Erro do banco em texto para o jogador (sem a migração das partidas, as tabelas não existem) */
function falha(error: { message: string; code?: string }): Error {
  if (error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42P01") return new Error(t("As partidas com amigos ainda não foram ativadas no servidor do app."));
  return new Error(error.message);
}

function cliente() {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  return sb;
}

// as respostas do motor têm bigint (ex.: Tipos declarados), que o JSON não guarda
const codificar = (r: Jogada) => JSON.parse(JSON.stringify(r, (_, v) => (typeof v === "bigint" ? { $big: String(v) } : v))) as object;
const decodificar = (j: unknown): Jogada => JSON.parse(JSON.stringify(j), (_, v) => (v && typeof v === "object" && "$big" in v ? BigInt(v.$big) : v)) as Jogada;

/** Lugar de quem está jogando neste aparelho (0 ou 1) */
export const meuJogador = (d: Duelo, contaId: string): 0 | 1 => (d.criador === contaId ? d.criador_jogador : ((1 - d.criador_jogador) as 0 | 1));

/** Os dois decks na ordem do motor */
export const decksDoDuelo = (d: Duelo): [DeckSim, DeckSim] => {
  const outro = d.deck_convidado ?? { main: [], extra: [] };
  return d.criador_jogador === 0 ? [d.deck_criador, outro] : [outro, d.deck_criador];
};

/** Com a escolha das mãos ligada, falta alguém dar "Pronto" (o duelo ainda não começa) */
export const faltaMao = (d: Duelo) => !!d.escolher_mao && (!d.mao_criador || !d.mao_convidado);

/** A mão que este aparelho já gravou (null: ainda não deu "Pronto") */
export const minhaMao = (d: Duelo, contaId: string) => (d.criador === contaId ? d.mao_criador : d.mao_convidado) ?? null;

/** Decks, semente e (com a escolha ligada) as mãos, na ordem do motor */
export function partidaDoDuelo(d: Duelo): Partida {
  const partida: Partida = { decks: decksDoDuelo(d), semente: d.semente };
  if (!d.escolher_mao) return partida;
  const criador = d.mao_criador ?? [];
  const convidado = d.mao_convidado ?? [];
  return { ...partida, maos: d.criador_jogador === 0 ? [criador, convidado] : [convidado, criador] };
}

/** O servidor já tem as partidas 1x1 (a migração das salas foi aplicada) */
export async function partidasAtivas(): Promise<boolean> {
  const { error } = await cliente().from("duelos").select("id", { head: true, count: "exact" }).limit(1);
  return !error || !["PGRST205", "42P01"].includes(error.code ?? "");
}

/** Erro da escolha das mãos: sem a migração dela, a coluna e a função não existem */
function falhaMao(error: { message: string; code?: string }): Error {
  if (error.code === "PGRST204" || error.code === "PGRST202" || error.code === "42703") return new Error(t("A escolha das mãos ainda não foi ativada no servidor do app."));
  return falha(error);
}

/** Cria a sala; o lugar de cada um e a semente são sorteados aqui */
export async function criarDuelo(deck: DeckSim, versaoMotor: string, versaoApp: string, escolherMao = false): Promise<Duelo> {
  const semente = Array.from(crypto.getRandomValues(new Uint32Array(4)), String);
  const criador_jogador = crypto.getRandomValues(new Uint8Array(1))[0] % 2;
  const { data, error } = await cliente()
    .from("duelos")
    // sem a escolha das mãos, a coluna fica fora (a sala funciona antes da migração dela)
    .insert({ criador_jogador, semente, deck_criador: deck, versao_motor: versaoMotor, versao_app: versaoApp, ...(escolherMao ? { escolher_mao: true } : {}) })
    .select(COLUNAS)
    .single();
  if (error) throw escolherMao ? falhaMao(error) : falha(error);
  return data as Duelo;
}

export async function obterDuelo(id: string): Promise<Duelo | null> {
  const { data, error } = await cliente().from("duelos").select(COLUNAS).eq("id", id).maybeSingle();
  if (error) throw falha(error);
  return (data as Duelo | null) ?? null;
}

/** Partidas 1x1 recentes de que a conta participou (as salas valem por 4 horas) */
export async function meusDuelos(contaId: string): Promise<Duelo[]> {
  const { data, error } = await cliente().from("duelos").select(COLUNAS).or(`criador.eq.${contaId},convidado.eq.${contaId}`).neq("estado", "aguardando").order("criado_em", { ascending: false }).limit(10);
  if (error) throw falha(error);
  return (data ?? []) as Duelo[];
}

/** Sala aguardando oponente pelo código de 6 dígitos */
export async function obterDueloPorCodigo(codigo: string): Promise<Duelo | null> {
  const { data, error } = await cliente().from("duelos").select(COLUNAS).eq("codigo", codigo).eq("estado", "aguardando").maybeSingle();
  if (error) throw falha(error);
  return (data as Duelo | null) ?? null;
}

/** Entra na sala (o banco confere se as versões do app e do motor batem com as do criador) */
export async function entrarDuelo(id: string, deck: DeckSim, versaoMotor: string, versaoApp: string): Promise<Duelo> {
  const { data, error } = await cliente().rpc("entrar_duelo", { p_duelo: id, p_deck: deck, p_versao_motor: versaoMotor, p_versao_app: versaoApp });
  if (error) throw falha(error);
  return data as Duelo;
}

/** "Pronto" da escolha das mãos: grava a mão deste jogador (vazia = aleatória) */
export async function definirMao(id: string, mao: number[]): Promise<Duelo> {
  const { data, error } = await cliente().rpc("definir_mao_duelo", { p_duelo: id, p_mao: mao });
  if (error) throw falhaMao(error);
  return data as Duelo;
}

/** Fim do duelo, desistência (vencedor = o outro) ou sala cancelada (null); repetir não muda nada */
export async function encerrarDuelo(id: string, vencedor: 0 | 1 | null) {
  const { error } = await cliente().rpc("encerrar_duelo", { p_duelo: id, p_vencedor: vencedor });
  if (error) throw falha(error);
}

/** Envia uma resposta deste aparelho (tenta de novo se a rede falhar; a repetida já gravada vale) */
export async function enviarResposta(id: string, n: number, jogador: 0 | 1, resp: Jogada) {
  let erro = "";
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const { error } = await cliente().from("duelo_respostas").insert({ duelo: id, n, jogador, resposta: codificar(resp) });
    if (!error || error.code === "23505") return;
    erro = falha(error).message;
    await new Promise((r) => setTimeout(r, 600 * (tentativa + 1)));
  }
  throw new Error(erro);
}

/** Respostas do duelo depois da posição `depois`, em ordem (todas, para entrar ou voltar a um duelo) */
export async function respostasDoDuelo(id: string, depois = -1): Promise<{ n: number; jogador: 0 | 1; resp: Jogada }[]> {
  const { data, error } = await cliente().from("duelo_respostas").select("n, jogador, resposta").eq("duelo", id).gt("n", depois).order("n");
  if (error) throw falha(error);
  return (data ?? []).map((r) => ({ n: r.n as number, jogador: r.jogador as 0 | 1, resp: decodificar(r.resposta) }));
}

/** Nomes de usuário (perfis públicos) */
export async function nomesDeUsuarios(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await cliente().from("perfis").select("id, usuario").in("id", ids);
  return Object.fromEntries((data ?? []).map((p) => [p.id as string, p.usuario as string]));
}

/** Acompanha a sala e as respostas em tempo real; devolve a função que para de acompanhar */
export function assinarDuelo(
  id: string,
  ao: { duelo?: (d: Duelo) => void; resposta?: (n: number, jogador: 0 | 1, resp: Jogada) => void; chat?: (jogador: 0 | 1, texto: string) => void },
): () => void {
  const sb = cliente();
  const canal = sb
    .channel(`duelo-${id}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duelos", filter: `id=eq.${id}` }, (p) => ao.duelo?.(p.new as Duelo))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "duelo_respostas", filter: `duelo=eq.${id}` }, (p) => {
      const r = p.new as { n: number; jogador: 0 | 1; resposta: unknown };
      ao.resposta?.(r.n, r.jogador, decodificar(r.resposta));
    })
    // chat da partida: mensagens de passagem (broadcast), sem gravar no banco
    .on("broadcast", { event: "chat" }, ({ payload }) => {
      const m = payload as { jogador?: unknown; texto?: unknown };
      if ((m.jogador === 0 || m.jogador === 1) && typeof m.texto === "string") ao.chat?.(m.jogador, m.texto.slice(0, MAX_CHAT));
    })
    .subscribe();
  return () => void sb.removeChannel(canal);
}

/** tamanho máximo de uma mensagem do chat da partida */
export const MAX_CHAT = 300;

/** Manda uma mensagem no chat da partida (pelo canal aberto em `assinarDuelo`); false se o canal não está aberto */
export async function enviarChat(id: string, jogador: 0 | 1, texto: string): Promise<boolean> {
  const canal = cliente()
    .getChannels()
    .find((c) => c.topic === `realtime:duelo-${id}`);
  if (!canal) return false;
  const r = await canal.send({ type: "broadcast", event: "chat", payload: { jogador, texto: texto.slice(0, MAX_CHAT) } });
  return r === "ok";
}

/** Código de 6 dígitos digitado (com ou sem espaços) */
export const codigoDaSala = (texto: string) => (/^\s*\d{3}\s?\d{3}\s*$/.test(texto) ? texto.replace(/\s/g, "") : null);

/** Id da sala num link colado */
export const idDaSala = (texto: string) => texto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]?.toLowerCase() ?? null;
