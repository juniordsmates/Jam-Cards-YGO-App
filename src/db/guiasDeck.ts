import { supabase } from "./supabase";
import { t } from "../i18n";
import type { BlocoGuia, Idioma, TextoGuia } from "../data/guias";
import type { ArquetipoMeta, CartaNucleo } from "./overlay";

// Guia de Deck → decks acrescentados pelos administradores e referências da comunidade (tabela
// guias_deck, supabase/migrations/20261112010000_guias_deck.sql). Todos leem; só administradores mudam.

/** Uma página sobre o deck num dos sites do app (src/data/referencias.ts) */
export interface ReferenciaDeck {
  titulo: string;
  url: string;
  /** nome do site */
  site: string;
  idioma: string;
  /** o que a página traz, em português */
  resumo: string;
  /** data em que foi encontrada (AAAA-MM-DD) */
  encontrado_em: string;
}

export interface ListaDeck {
  main: number[];
  extra: number[];
  side: number[];
}

export interface GuiaDeckBanco {
  arquetipo: string;
  /** deck list (decks fora do meta); null nos decks do meta que só ganharam referências */
  lista: ListaDeck | null;
  textos: Partial<Record<Idioma, TextoGuia>>;
  referencias: ReferenciaDeck[];
  /** data da revisão (AAAA-MM-DD) */
  revisado: string;
}

const COLS = "arquetipo, lista, textos, referencias, revisado";

const cliente = () => {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  return sb;
};

/** Sem a migração, a tabela não existe: o guia segue só com os decks do meta */
const semTabela = (code?: string) => code === "PGRST205" || code === "42P01";

export async function listarGuiasDeck(): Promise<GuiaDeckBanco[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.from("guias_deck").select(COLS).order("arquetipo");
  if (error) {
    if (semTabela(error.code)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as GuiaDeckBanco[];
}

/** Administrador: cria ou atualiza o deck (pelo nome do arquétipo) */
export async function salvarGuiaDeck(g: GuiaDeckBanco): Promise<GuiaDeckBanco> {
  const { data, error } = await cliente()
    .from("guias_deck")
    .upsert({ ...g, arquetipo: g.arquetipo.trim(), atualizado_em: new Date().toISOString() }, { onConflict: "arquetipo" })
    .select(COLS)
    .single();
  if (error) throw new Error(semTabela(error.code) ? t("Os decks acrescentados ainda não foram ativados no servidor do app.") : error.message);
  return data as GuiaDeckBanco;
}

/** Administrador: apaga o deck acrescentado (ou as referências de um deck do meta) */
export async function apagarGuiaDeck(arquetipo: string): Promise<void> {
  const { error } = await cliente().from("guias_deck").delete().eq("arquetipo", arquetipo);
  if (error) throw new Error(error.message);
}

/** Junta referências novas às que o deck já tem, sem repetir o mesmo endereço */
export function juntarReferencias(atuais: ReferenciaDeck[], novas: ReferenciaDeck[]): ReferenciaDeck[] {
  const vistas = new Set(atuais.map((r) => normalizarUrl(r.url)));
  const out = [...atuais];
  for (const r of novas) {
    const k = normalizarUrl(r.url);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(r);
  }
  return out;
}

/** Endereço sem barra final, âncora e "www." (para comparar) */
export const normalizarUrl = (url: string) => url.trim().replace(/#.*$/, "").replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?/i, "").toLowerCase();

/** Deck acrescentado como arquétipo do guia: o núcleo sai da deck list (sem dados de torneio) */
export function arquetipoDaLista(g: GuiaDeckBanco): ArquetipoMeta {
  const nucleo = (ids: number[]): CartaNucleo[] => {
    const copias = new Map<number, number>();
    for (const id of ids) copias.set(id, (copias.get(id) ?? 0) + 1);
    return [...copias].map(([id, n]) => ({ id, pct: 1, copias: n }));
  };
  return {
    arquetipo: g.arquetipo,
    decks: 0,
    decksRecentes: 0,
    pct6m: 0,
    pct2m: 0,
    vitorias: 0,
    pontos: 0,
    nomes: [g.arquetipo],
    parceiros: [],
    nucleo: { main: nucleo(g.lista?.main ?? []), extra: nucleo(g.lista?.extra ?? []), side: nucleo(g.lista?.side ?? []) },
    exemplos: [],
  };
}

// ---------------------------------------------------------------- texto do formulário

/** Blocos do guia em texto: "## Título" abre um bloco e "- item" é um item dele */
export function blocosParaTexto(blocos: BlocoGuia[] | undefined): string {
  return (blocos ?? []).map((b) => [`## ${b.titulo}`, ...b.itens.map((i) => `- ${i}`)].join("\n")).join("\n\n");
}

/** Lê o texto do formulário de volta em blocos (linha solta sem "## " antes vira item de um bloco sem título) */
export function textoParaBlocos(texto: string): BlocoGuia[] {
  const blocos: BlocoGuia[] = [];
  for (const bruta of texto.split("\n")) {
    const linha = bruta.trim();
    if (!linha) continue;
    if (linha.startsWith("## ")) {
      blocos.push({ titulo: linha.slice(3).trim(), itens: [] });
      continue;
    }
    if (!blocos.length) blocos.push({ titulo: "", itens: [] });
    blocos[blocos.length - 1].itens.push(linha.replace(/^-\s*/, ""));
  }
  return blocos.filter((b) => b.titulo || b.itens.length);
}
