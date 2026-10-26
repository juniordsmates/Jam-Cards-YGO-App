import { supabase } from "./supabase";
import type { GameFormat } from "./legality";
import type { CampoFinal, Passo } from "./motor";
import type { SugestaoIA } from "./ia";
import type { Card } from "./types";

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
}

export interface ComboBase {
  id: string;
  origem: OrigemCombo;
  autor_nome: string | null;
  titulo: string;
  arquetipos: string[];
  iniciais: number[];
  finais: number[];
  dados: DadosCombo;
  conferido_em: string | null;
  criado_em: string;
}

const COLS = "id, origem, autor_nome, titulo, arquetipos, iniciais, finais, dados, conferido_em, criado_em";

/** Arquétipos (nomes oficiais em inglês) das cartas do combo */
export const arquetiposDe = (cards: Card[]) => [...new Set(cards.map((c) => c.archetype).filter((a): a is string => !!a))];

/** Combos da base com todas as iniciais na mão e todas as finais em algum ponto do combo */
export async function buscarNaBase(iniciais: number[], finais: number[]): Promise<ComboBase[]> {
  const sb = supabase();
  if (!sb || iniciais.length + finais.length === 0) return [];
  let q = sb.from("combos").select(COLS);
  if (iniciais.length) q = q.contains("iniciais", iniciais);
  if (finais.length) q = q.contains("cartas", finais);
  const { data, error } = await q.order("conferido_em", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false }).limit(40);
  if (error) throw new Error(`Base de combos: ${error.message}`);
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
  if (e1) throw new Error(`Gravar busca: ${e1.message}`);
  const validas = sugestoes.filter((s) => s.iniciais.length + s.finais.length > 0);
  if (!validas.length) return [];
  const rows = validas.map((s) => ({
    origem: "ia" as const,
    titulo: s.titulo.slice(0, 120) || "Combo sugerido",
    arquetipos: arquetiposDe(cardsDe([...s.iniciais, ...s.finais])),
    iniciais: s.iniciais.slice(0, 10),
    finais: s.finais.slice(0, 20),
    dados: { passos: s.passos, campo: s.campo, observacoes: s.observacoes, fontes: s.fontes, modelo: params.modelo } satisfies DadosCombo,
    busca_id: busca.id,
  }));
  const { data, error } = await sb.from("combos").insert(rows).select(COLS);
  if (error) throw new Error(`Gravar combos: ${error.message}`);
  return (data ?? []) as ComboBase[];
}

/** Publica um combo (sugerido pela IA ou da base) como Combo da Comunidade, com o nome do autor */
export async function salvarComoComunidade(
  origem: ComboBase,
  campos: { autorNome: string; titulo: string; observacoes: string },
): Promise<ComboBase> {
  const sb = supabase();
  if (!sb) throw new Error("Contas ainda não configuradas neste app.");
  const { data, error } = await sb
    .from("combos")
    .insert({
      origem: "comunidade",
      autor_nome: campos.autorNome.trim().slice(0, 60),
      titulo: campos.titulo.trim().slice(0, 120),
      arquetipos: origem.arquetipos,
      iniciais: origem.iniciais,
      finais: origem.finais,
      dados: { ...origem.dados, observacoes: campos.observacoes.trim().slice(0, 2000), modelo: undefined },
      // sugestão ainda não gravada (sem login na hora da busca) não tem id na base
      copiado_de: /^[0-9a-f-]{36}$/.test(origem.id) ? origem.id : null,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(`Salvar combo: ${error.message}`);
  return data as ComboBase;
}
