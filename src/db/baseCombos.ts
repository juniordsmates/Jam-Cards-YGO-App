import { supabase } from "./supabase";
import { copiasPermitidas } from "./decks";
import type { GameFormat } from "./legality";
import type { CampoFinal, Passo } from "./motor";
import type { SugestaoIA } from "./ia";
import type { Card } from "./types";
import { t } from "../i18n";

// Base de combos no Supabase (tabela combos): um JSON por combo, encontrado pelos índices
// arquétipo, iniciais (starters), finais e cartas. Origem: app, comunidade ou ia.

export type OrigemCombo = "app" | "comunidade" | "ia";

export interface DadosCombo {
  qualquer?: number;
  passos: Passo[];
  campo: CampoFinal;
  observacoes?: string;
  fontes?: { nome: string; url: string }[];
  modelo?: string;
  /** cópias de cada carta (id) que o combo usa; gravado pelo "Criar combo" do Teste de Jogo */
  copias?: Record<string, number>;
  /** combo criado no Teste de Jogo (passos anotados das ações do jogador) */
  teste?: boolean;
}

export interface ComboBase {
  id: string;
  origem: OrigemCombo;
  /** conta de quem criou (só o autor pode editar ou excluir um Combo da Comunidade) */
  autor_id: string | null;
  autor_nome: string | null;
  titulo: string;
  arquetipos: string[];
  iniciais: number[];
  finais: number[];
  dados: DadosCombo;
  conferido_em: string | null;
  criado_em: string;
  /** compartilhado com todos (aba Combos); sem compartilhar, só o autor vê */
  publico: boolean;
}

const COLS = "id, origem, autor_id, autor_nome, titulo, arquetipos, iniciais, finais, dados, conferido_em, criado_em, publico";

// ---------------------------------------------------------------- validade na banlist atual

/** Cópias de cada carta que o combo usa (sem o registro: cada inicial conta, as demais 1 cópia) */
export function copiasDoCombo(combo: Pick<ComboBase, "iniciais" | "finais" | "dados">): Map<number, number> {
  if (combo.dados.copias) return new Map(Object.entries(combo.dados.copias).map(([id, n]) => [Number(id), n]));
  const m = new Map<number, number>();
  for (const id of combo.iniciais) m.set(id, (m.get(id) ?? 0) + 1);
  const outras = [...combo.finais, ...combo.dados.passos.flatMap((p) => ("c" in p ? (Array.isArray(p.c) ? p.c : [p.c]) : []))];
  for (const id of outras) if (id > 0 && !m.has(id)) m.set(id, 1);
  return m;
}

/**
 * O combo vale no formato com a banlist atual: nenhuma carta proibida ou não lançada nele e, de
 * cada carta, no máximo as cópias permitidas (limitada 1, semi-limitada 2, demais 3).
 */
export function validadeNoFormato(copias: Map<number, number>, byId: Map<number, Card>, formato: GameFormat): { valido: boolean; problemas: string[] } {
  const problemas: string[] = [];
  for (const [id, n] of copias) {
    const c = byId.get(id);
    if (!c || c.frame === "token") continue;
    const max = copiasPermitidas(c, formato);
    const nome = c.namePt ?? c.name;
    if (max === 0) problemas.push(t("{0}: proibida ou não lançada no {1}", [nome, formato]));
    else if (n > max) problemas.push(t("{0}: usa {1} cópias (máximo {2} no {3})", [nome, n, max, formato]));
  }
  return { valido: !problemas.length, problemas };
}

/** Arquétipos (nomes oficiais em inglês) das cartas do combo */
export const arquetiposDe = (cards: Card[]) => [...new Set(cards.map((c) => c.archetype).filter((a): a is string => !!a))];

/** Máximo de arquétipos vinculados a um combo */
export const MAX_ARQUETIPOS = 5;

/**
 * Arquétipos vinculados que o combo não justifica: nenhuma carta dele é do arquétipo (o arquétipo
 * da carta ou o nome dele no nome da carta, como "Kewl Tune" em JJ "Kewl Tune"). `ids`: as cartas do
 * combo (copiasDoCombo). Compartilhar com
 * um desses é bloqueado: o combo apareceria na aba Comunidade de um deck que ele não usa.
 */
export function arquetiposSemCartas(arquetipos: string[], ids: Iterable<number>, byId: Map<number, Card>): string[] {
  const cartas = [...ids].map((id) => byId.get(id)).filter((c): c is Card => !!c);
  return arquetipos.filter((a) => {
    const alvo = a.toLowerCase();
    return !cartas.some((c) => c.archetype?.toLowerCase() === alvo || c.name.toLowerCase().includes(alvo));
  });
}

/** Mensagem do bloqueio (com os arquétipos sem cartas) */
export const avisoSemCartas = (faltam: string[]) => `${t("Esse combo não possui cartas do arquétipo selecionado")} (${faltam.join(", ")}).`;

/** Combos da base com todas as iniciais na mão e todas as finais em algum ponto do combo */
export async function buscarNaBase(iniciais: number[], finais: number[]): Promise<ComboBase[]> {
  const sb = supabase();
  if (!sb || iniciais.length + finais.length === 0) return [];
  let q = sb.from("combos").select(COLS);
  if (iniciais.length) q = q.contains("iniciais", iniciais);
  if (finais.length) q = q.contains("cartas", finais);
  const { data, error } = await q.order("conferido_em", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false }).limit(40);
  if (error) throw new Error(t("Base de combos: {0}", [error.message]));
  return (data ?? []) as ComboBase[];
}

/**
 * Grava a busca e, logo em seguida, cada combo sugerido pela IA na base (origem "ia"),
 * antes de o usuário decidir publicar algum como Combo da Comunidade.
 */
export async function gravarBuscaIA(
  params: { iniciais: number[]; finais: number[]; formato: GameFormat; modelo: string },
  sugestoes: SugestaoIA[],
  cardsDe: (ids: number[]) => Card[],
): Promise<ComboBase[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data: busca, error: e1 } = await sb.from("buscas").insert(params).select("id").single();
  if (e1) throw new Error(t("Gravar busca: {0}", [e1.message]));
  const validas = sugestoes.filter((s) => s.iniciais.length + s.finais.length > 0);
  if (!validas.length) return [];
  const rows = validas.map((s) => ({
    origem: "ia" as const,
    titulo: s.titulo.slice(0, 120) || t("Combo sugerido"),
    arquetipos: arquetiposDe(cardsDe([...s.iniciais, ...s.finais])),
    iniciais: s.iniciais.slice(0, 10),
    finais: s.finais.slice(0, 20),
    dados: { passos: s.passos, campo: s.campo, observacoes: s.observacoes, fontes: s.fontes, modelo: params.modelo } satisfies DadosCombo,
    busca_id: busca.id,
  }));
  const { data, error } = await sb.from("combos").insert(rows).select(COLS);
  if (error) throw new Error(t("Gravar combos: {0}", [error.message]));
  return (data ?? []) as ComboBase[];
}

/** Publica um combo (sugerido pela IA ou da base) como Combo da Comunidade, com o nome do autor */
export async function salvarComoComunidade(
  origem: ComboBase,
  campos: { autorNome: string; titulo: string; observacoes: string; arquetipos?: string[] },
): Promise<ComboBase> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const { data, error } = await sb
    .from("combos")
    .insert({
      origem: "comunidade",
      autor_nome: campos.autorNome.trim().slice(0, 60),
      titulo: campos.titulo.trim().slice(0, 120),
      arquetipos: (campos.arquetipos ?? origem.arquetipos).slice(0, MAX_ARQUETIPOS),
      iniciais: origem.iniciais,
      finais: origem.finais,
      dados: { ...origem.dados, observacoes: campos.observacoes.trim().slice(0, 2000), modelo: undefined },
      // sugestão ainda não gravada (sem login na hora da busca) não tem id na base
      copiado_de: /^[0-9a-f-]{36}$/.test(origem.id) ? origem.id : null,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(t("Salvar combo: {0}", [error.message]));
  return data as ComboBase;
}

/**
 * Grava um combo criado no Teste de Jogo (origem "comunidade", com o nome de usuário do autor).
 * Compartilhado, aparece para todos na aba Combos; sem compartilhar, só para o autor.
 */
export async function criarComboDoTeste(
  campos: { autorNome: string; titulo: string; observacoes: string; compartilhar: boolean },
  combo: { iniciais: number[]; dados: DadosCombo; arquetipos: string[] },
): Promise<ComboBase> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const { data, error } = await sb
    .from("combos")
    .insert({
      origem: "comunidade",
      autor_nome: campos.autorNome.trim().slice(0, 60),
      titulo: campos.titulo.trim().slice(0, 120),
      arquetipos: combo.arquetipos.slice(0, MAX_ARQUETIPOS),
      iniciais: combo.iniciais.slice(0, 10),
      dados: { ...combo.dados, observacoes: campos.observacoes.trim().slice(0, 2000) || undefined, teste: true },
      publico: campos.compartilhar,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(t("Criar combo: {0}", [error.message]));
  return data as ComboBase;
}

/**
 * Exporta para a base um combo que estava só no aparelho (combos locais do Usuário Padrão):
 * entra como Combo da Comunidade do usuário, compartilhado ou não, com a data original nas observações.
 */
export async function exportarParaBase(combo: ComboBase, compartilhar: boolean): Promise<ComboBase> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const { data, error } = await sb
    .from("combos")
    .insert({
      origem: "comunidade",
      autor_nome: (combo.autor_nome ?? "").trim().slice(0, 60) || t("autor"),
      titulo: combo.titulo.trim().slice(0, 120),
      arquetipos: combo.arquetipos,
      iniciais: combo.iniciais.slice(0, 10),
      finais: combo.finais.slice(0, 20),
      dados: combo.dados,
      publico: compartilhar,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(t("Exportar combo: {0}", [error.message]));
  return data as ComboBase;
}

/** Um combo pelo id (link compartilhado): só aparece se for público ou do próprio usuário */
export async function comboPorId(id: string): Promise<ComboBase | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.from("combos").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ComboBase | null) ?? null;
}

/**
 * Combos da Comunidade para a aba Combos: os que começam com todas as cartas da mão escolhida
 * (ou, sem mão, os mais recentes). Os compartilhados aparecem para todos; os não compartilhados,
 * só para o autor (regra do banco).
 */
export async function combosDaComunidade(mao: number[], limite = 20): Promise<ComboBase[]> {
  const sb = supabase();
  if (!sb) return [];
  let q = sb.from("combos").select(COLS).eq("origem", "comunidade");
  if (mao.length) q = q.contains("iniciais", mao);
  const { data, error } = await q.order("criado_em", { ascending: false }).limit(limite);
  if (error) throw new Error(t("Combos da Comunidade: {0}", [error.message]));
  return (data ?? []) as ComboBase[];
}

/**
 * Edita um Combo da Comunidade do próprio usuário: título, observações, passos e se fica
 * compartilhado (o banco só deixa o autor alterar os combos dele).
 */
export async function editarCombo(
  combo: ComboBase,
  campos: { titulo: string; observacoes: string; compartilhar: boolean; passos: DadosCombo["passos"]; arquetipos?: string[] },
): Promise<ComboBase> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const { data, error } = await sb
    .from("combos")
    .update({
      titulo: campos.titulo.trim().slice(0, 120),
      publico: campos.compartilhar,
      arquetipos: (campos.arquetipos ?? combo.arquetipos).slice(0, MAX_ARQUETIPOS),
      dados: { ...combo.dados, passos: campos.passos, observacoes: campos.observacoes.trim().slice(0, 2000) || undefined },
    })
    .eq("id", combo.id)
    .select(COLS)
    .single();
  if (error) throw new Error(t("Editar combo: {0}", [error.message]));
  return data as ComboBase;
}

/** Exclui um Combo da Comunidade do próprio usuário (o banco só deixa o autor apagar) */
export async function excluirCombo(id: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const { error, count } = await sb.from("combos").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(t("Excluir combo: {0}", [error.message]));
  if (!count) throw new Error(t("Excluir combo: só quem criou o combo pode excluí-lo."));
}

/** Combos da Comunidade de um arquétipo (Guia de Deck → Combos), dos mais recentes */
export async function combosDoArquetipo(arquetipo: string, limite = 20): Promise<ComboBase[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("combos")
    .select(COLS)
    .eq("origem", "comunidade")
    .contains("arquetipos", [arquetipo])
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw new Error(t("Combos do arquétipo: {0}", [error.message]));
  return (data ?? []) as ComboBase[];
}
