import { supabase } from "./supabase";
import { t } from "../i18n";

// Conquistas (por enquanto, só pontos) e Rank dos duelistas. Os pontos vêm do banco (visões
// ranking_duelistas e ranking_arquetipos, supabase/migrations/20261103000000_conquistas.sql),
// calculados dos combos compartilhados: o app só lê, não grava pontos.

/** Pontos por combo compartilhado (o valor que vale é o de regras_pontos no banco) */
export const PONTOS_POR_COMBO = 5;

export interface Duelista {
  usuario_id: string;
  usuario: string;
  pontos: number;
  combos_compartilhados: number;
}

/** Resultado de uma leitura do Rank; `indisponivel`: a migração das conquistas ainda não foi aplicada */
export type Leitura<T> = { ok: true; dados: T } | { ok: false; indisponivel: boolean; erro: string };

// visão ainda não criada no banco (migração pendente): PostgREST responde PGRST205 / 42P01
const faltaVisao = (e: { code?: string; message?: string }) => e.code === "PGRST205" || e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "");

async function ler<T>(consulta: () => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<Leitura<T>> {
  if (!supabase()) return { ok: false, indisponivel: true, erro: t("Contas ainda não configuradas neste app.") };
  const { data, error } = await consulta();
  if (error) return { ok: false, indisponivel: faltaVisao(error), erro: error.message };
  return { ok: true, dados: data as T };
}

/** Os duelistas com mais pontos */
export function rankingDuelistas(limite = 100): Promise<Leitura<Duelista[]>> {
  return ler(() =>
    supabase()!
      .from("ranking_duelistas")
      .select("usuario_id, usuario, pontos, combos_compartilhados")
      .order("pontos", { ascending: false })
      .order("ultimo_combo", { ascending: true })
      .limit(limite),
  );
}

/** Pontos de uma conta (0 se ainda não compartilhou nada) e a posição dela no Rank */
export async function meusPontos(usuarioId: string): Promise<Leitura<{ pontos: number; combos: number; posicao: number | null }>> {
  const minha = await ler<Duelista | null>(() =>
    supabase()!.from("ranking_duelistas").select("usuario_id, usuario, pontos, combos_compartilhados").eq("usuario_id", usuarioId).maybeSingle(),
  );
  if (!minha.ok) return minha;
  if (!minha.dados) return { ok: true, dados: { pontos: 0, combos: 0, posicao: null } };
  // posição: quantos têm mais pontos (a contagem vem no cabeçalho da resposta)
  const { count } = await supabase()!.from("ranking_duelistas").select("usuario_id", { count: "exact", head: true }).gt("pontos", minha.dados.pontos);
  return { ok: true, dados: { pontos: minha.dados.pontos, combos: minha.dados.combos_compartilhados, posicao: count === null ? null : count + 1 } };
}

/** Quem mais compartilhou combos de um arquétipo (nome oficial em inglês, como nos combos) */
export function rankingDoArquetipo(arquetipo: string, limite = 10): Promise<Leitura<Duelista[]>> {
  return ler(() =>
    supabase()!
      .from("ranking_arquetipos")
      .select("usuario_id, usuario, pontos, combos_compartilhados")
      .eq("arquetipo", arquetipo)
      .order("pontos", { ascending: false })
      .limit(limite),
  );
}
