import { supabase } from "./supabase";
import type { GameFormat } from "./legality";
import { t } from "../i18n";

// Eventos: resultados de torneio compartilhados pelos jogadores, com a decklist (tabela
// resultados_eventos, supabase/migrations/20261108010000_eventos.sql). Conceito e Local são
// publicados na hora; Meta passa pela Análise de resultados (administradores) antes de aparecer.

export type CategoriaEvento = "meta" | "conceito" | "local";
export type SituacaoResultado = "pendente" | "aprovado" | "recusado";

export const CATEGORIAS: { id: CategoriaEvento; label: string; hint: string }[] = [
  { id: "meta", label: t("Meta"), hint: t("Torneio competitivo com deck do meta. Passa por avaliação antes de ser publicado.") },
  { id: "conceito", label: t("Conceito"), hint: t("Ideia de deck, sem resultado de torneio.") },
  { id: "local", label: t("Local"), hint: t("Resultado em torneio, publicado na hora.") },
];

/** Tipos de torneio: os principais oficiais da Konami e o torneio local */
export const TIPOS_TORNEIO: { id: string; label: string }[] = [
  { id: "wcs", label: t("Campeonato Mundial (World Championship)") },
  { id: "wcq_continental", label: t("WCQ Continental (ex.: NAWCQ, EUWCQ, LATAM WCQ)") },
  { id: "wcq_nacional", label: t("WCQ Nacional (Campeonato Nacional)") },
  { id: "ycs", label: t("YCS (Yu-Gi-Oh! Championship Series)") },
  { id: "regional", label: t("Regional Qualifier") },
  { id: "ots", label: t("OTS Championship") },
  { id: "remote_duel", label: t("Remote Duel (YCS / Invitational)") },
  { id: "asia_ocg", label: t("Campeonato da Ásia / Japão (OCG)") },
  { id: "local", label: t("Torneio Local") },
];

export const rotuloTorneio = (id: string | null) => TIPOS_TORNEIO.find((x) => x.id === id)?.label ?? "";
export const rotuloCategoria = (id: CategoriaEvento) => CATEGORIAS.find((c) => c.id === id)?.label ?? id;

export interface ResultadoEvento {
  id: string;
  autor_id: string;
  jogador: string;
  nome_deck: string;
  formato: GameFormat;
  categoria: CategoriaEvento;
  tipo_torneio: string | null;
  nome_evento: string | null;
  data_evento: string | null;
  posicao: number | null;
  jogadores: number | null;
  main: number[];
  extra: number[];
  side: number[];
  observacoes: string | null;
  status: SituacaoResultado;
  motivo_recusa: string | null;
  criado_em: string;
  /** usuário de quem enviou */
  perfis?: { usuario: string } | null;
}

export type NovoResultado = Pick<ResultadoEvento, "jogador" | "nome_deck" | "formato" | "categoria" | "tipo_torneio" | "nome_evento" | "data_evento" | "posicao" | "jogadores" | "main" | "extra" | "side" | "observacoes">;

const COLS = "id, autor_id, jogador, nome_deck, formato, categoria, tipo_torneio, nome_evento, data_evento, posicao, jogadores, main, extra, side, observacoes, status, motivo_recusa, criado_em, perfis(usuario)";

/** Leitura de Eventos; `indisponivel`: a migração dos eventos ainda não foi aplicada */
export type LeituraEventos<T> = { ok: true; dados: T } | { ok: false; indisponivel: boolean; erro: string };

const faltaTabela = (e: { code?: string; message?: string }) => e.code === "PGRST205" || e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "");

/** Resultados publicados (e os do próprio usuário, mesmo em avaliação), dos mais recentes */
export async function listarResultados(filtro: { formato: GameFormat; categoria: CategoriaEvento | "todas" }, limite = 200): Promise<LeituraEventos<ResultadoEvento[]>> {
  const sb = supabase();
  if (!sb) return { ok: false, indisponivel: true, erro: t("Contas ainda não configuradas neste app.") };
  let q = sb.from("resultados_eventos").select(COLS).eq("formato", filtro.formato).neq("status", "recusado");
  if (filtro.categoria !== "todas") q = q.eq("categoria", filtro.categoria);
  const { data, error } = await q.order("data_evento", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false }).limit(limite);
  if (error) return { ok: false, indisponivel: faltaTabela(error), erro: error.message };
  return { ok: true, dados: (data ?? []) as unknown as ResultadoEvento[] };
}

/** Um resultado pelo id (link compartilhado) */
export async function resultadoPorId(id: string): Promise<ResultadoEvento | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from("resultados_eventos").select(COLS).eq("id", id).maybeSingle();
  return (data as unknown as ResultadoEvento | null) ?? null;
}

/** Compartilha um resultado (precisa de login). Meta volta "pendente"; Conceito e Local, "aprovado". */
export async function compartilharResultado(r: NovoResultado): Promise<ResultadoEvento> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const conceito = r.categoria === "conceito";
  const { data, error } = await sb
    .from("resultados_eventos")
    .insert({
      jogador: r.jogador.trim().slice(0, 60),
      nome_deck: r.nome_deck.trim().slice(0, 80),
      formato: r.formato,
      categoria: r.categoria,
      tipo_torneio: conceito ? null : r.tipo_torneio,
      nome_evento: r.nome_evento?.trim().slice(0, 120) || null,
      data_evento: r.data_evento || null,
      posicao: conceito ? null : r.posicao,
      jogadores: conceito ? null : r.jogadores,
      main: r.main.slice(0, 60),
      extra: r.extra.slice(0, 15),
      side: r.side.slice(0, 15),
      observacoes: r.observacoes?.trim().slice(0, 1000) || null,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(faltaTabela(error) ? t("Os Eventos ainda não estão ativos neste servidor (falta aplicar a atualização do banco).") : t("Compartilhar resultado: {0}", [error.message]));
  return data as unknown as ResultadoEvento;
}

/** Apaga um resultado (o autor apaga os seus; o administrador, qualquer um) */
export async function excluirResultado(id: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const { error, count } = await sb.from("resultados_eventos").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(t("Excluir resultado: {0}", [error.message]));
  if (!count) throw new Error(t("Excluir resultado: só quem enviou (ou um administrador) pode excluir."));
}

// ---------------------------------------------------------------- análise (administradores)

/** Resultados para a Análise: os pendentes, ou os já analisados (aprovados e recusados) */
export async function resultadosParaAnalise(pendentes: boolean): Promise<LeituraEventos<ResultadoEvento[]>> {
  const sb = supabase();
  if (!sb) return { ok: false, indisponivel: true, erro: t("Contas ainda não configuradas neste app.") };
  let q = sb.from("resultados_eventos").select(COLS);
  q = pendentes ? q.eq("status", "pendente").order("criado_em", { ascending: true }) : q.neq("status", "pendente").order("criado_em", { ascending: false });
  const { data, error } = await q.limit(200);
  if (error) return { ok: false, indisponivel: faltaTabela(error), erro: error.message };
  return { ok: true, dados: (data ?? []) as unknown as ResultadoEvento[] };
}

/** Aprova (publica) ou recusa um resultado */
export async function analisarResultado(id: string, aprovar: boolean, motivo?: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const { error } = await sb.rpc("analisar_resultado", { resultado: id, aprovar, motivo: motivo?.trim() || null });
  if (error) throw new Error(t("Análise: {0}", [error.message]));
}

/** Carta de capa do deck: a mais repetida do Main (na ordem da lista, em caso de empate) */
export function cartaDeCapa(main: number[]): number | undefined {
  const n = new Map<number, number>();
  for (const id of main) n.set(id, (n.get(id) ?? 0) + 1);
  let melhor: number | undefined;
  for (const [id, q] of n) if (melhor === undefined || q > n.get(melhor)!) melhor = id;
  return melhor;
}
