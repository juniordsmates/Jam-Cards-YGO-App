import { applyTags, TAGS } from "./tags";
import type { Card } from "./types";
import type { CombosCalculados } from "./motor";
import { normalize } from "./search";
import { t } from "../i18n";
import { supabase } from "./supabase";

// Camada de dados do app (tags revisadas, combos calculados, metagame, respostas), sem textos de
// cartas; o app aplica a camada sobre os dados da YGOPRODeck. Fica no bucket privado "camada" do
// Supabase (supabase/migrations/20261101000000_camada_privada.sql): só o app lê, com a chave dele,
// e não há link aberto para robôs. versao.json traz só o geradoEm, para baixar a camada inteira
// apenas quando ela muda.
const BUCKET = "camada";
/** Endereço antigo (repositório público), só enquanto o bucket não estiver ativo */
export const OVERLAY_URL_ANTIGA = "https://raw.githubusercontent.com/juniordsmates/Jam-Cards-YGO/main/dados/camada.json";

const SUPPORTED_FORMAT = 1;

export interface TagDefinition {
  id: string;
  label: string;
  group: string;
  hint: string;
}

export interface Overlay {
  formato: number;
  versao: string;
  geradoEm: string;
  ids: number[];
  tags: (TagDefinition & { cartas: number[] })[];
  efeitos: Record<string, Card["effectOverrides"]>;
  /** nomes oficiais dos arquétipos */
  arquetipos: string[];
  /** metagame do OCG (Road of the King): por arquétipo, [período, colocações] */
  meta: {
    fonte: string;
    periodos: { periodo: string; inicio: string; fim: string; url: string; total: number }[];
    porArquetipo: Record<string, [string, number][]>;
  };
  /** pontos do formato Genesys por id (só cartas com pontos) */
  genesys: Record<string, number>;
  /** nomes oficiais em português (Yu-Gi-Oh! Wiki) que corrigem os da YGOPRODeck: id → nome */
  nomes?: Record<string, string>;
  /** linhas de combo jogadas pelo motor de regras do EDOPro com decklists de torneio */
  combos?: CombosCalculados;
  /** uso em torneios: em quantos dos `decks` decklists recentes cada carta (id) aparece */
  uso?: { decks: number; atualizadoEm: string; maisAntigo: string; cartas: Record<string, number> };
  /** cartas ativáveis da mão no turno do oponente → tipos de resposta (pelos scripts oficiais) */
  respondedores?: Record<string, string[]>;
  /** metagame do TCG (6 meses de decklists de torneio): base do Guia de Deck */
  metaTcg?: MetaTcg;
}

/** Carta do núcleo de um deck: em que fração das listas aparece e com quantas cópias, em média */
export interface CartaNucleo {
  id: number;
  pct: number;
  copias: number;
}

export interface ArquetipoMeta {
  arquetipo: string;
  decks: number;
  decksRecentes: number;
  pct6m: number;
  pct2m: number;
  vitorias: number;
  pontos: number;
  nomes: string[];
  parceiros: string[];
  nucleo: { main: CartaNucleo[]; extra: CartaNucleo[]; side: CartaNucleo[] };
  exemplos: { deckNum: number; url: string; nome: string; torneio: string; colocacao: string; jogadores: number | null; quando: string }[];
}

/** Gerado pelo pipeline da base (src/metaTcg.ts) */
export interface MetaTcg {
  fonte: string;
  atualizadoEm: string;
  meses: number;
  decks: number;
  decksRecentes: number;
  arquetipos: ArquetipoMeta[];
}

const LOCAL_TAG_DEFS: TagDefinition[] = TAGS.map(({ id, label, group, hint }) => ({ id, label, group, hint }));

const conferir = (overlay: Overlay) => {
  if (overlay.formato !== SUPPORTED_FORMAT) throw new Error(t("camada: formato {0} não suportado", [overlay.formato]));
  return overlay;
};

/**
 * Baixa a camada; null quando ela não mudou desde `atual` (geradoEm da camada salva).
 * Primeiro o bucket privado do Supabase; sem ele (ainda não ativado), o endereço antigo.
 */
export async function fetchOverlay(atual?: string): Promise<Overlay | null> {
  const sb = supabase();
  if (sb) {
    const versao = await sb.storage.from(BUCKET).download("versao.json");
    if (!versao.error && versao.data) {
      const { geradoEm } = JSON.parse(await versao.data.text()) as { geradoEm?: string };
      if (geradoEm && geradoEm === atual) return null;
      const camada = await sb.storage.from(BUCKET).download("camada.json");
      if (!camada.error && camada.data) return conferir(JSON.parse(await camada.data.text()) as Overlay);
    }
  }
  const res = await fetch(OVERLAY_URL_ANTIGA, { cache: "no-cache" });
  if (!res.ok) throw new Error(t("camada: HTTP {0}", [res.status]));
  return conferir((await res.json()) as Overlay);
}

/** Administrador: publica a camada no bucket (camada.json e versao.json) */
export async function publicarCamada(arquivo: File): Promise<Overlay> {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  const overlay = conferir(JSON.parse(await arquivo.text()) as Overlay);
  if (!overlay.geradoEm || !Array.isArray(overlay.ids)) throw new Error(t("O arquivo não é uma camada do app."));
  const corpo = new Blob([JSON.stringify(overlay)], { type: "application/json" });
  const a = await sb.storage.from(BUCKET).upload("camada.json", corpo, { upsert: true, contentType: "application/json", cacheControl: "0" });
  if (a.error) throw new Error(a.error.message);
  const v = new Blob([JSON.stringify({ geradoEm: overlay.geradoEm, versao: overlay.versao })], { type: "application/json" });
  const b = await sb.storage.from(BUCKET).upload("versao.json", v, { upsert: true, contentType: "application/json", cacheControl: "0" });
  if (b.error) throw new Error(b.error.message);
  return overlay;
}

/**
 * Define as tags e os ajustes de leitura de cada carta e devolve as definições de tags.
 * Cartas cobertas pela camada usam as marcações revisadas; as demais (lançadas depois
 * da camada, ou sem camada disponível) usam as regras locais.
 */
export function applyOverlay(cards: Card[], overlay?: Overlay): TagDefinition[] {
  if (!overlay) {
    applyTags(cards);
    return LOCAL_TAG_DEFS;
  }

  const covered = new Set(overlay.ids);
  const tagsByCard = new Map<number, string[]>();
  for (const tag of overlay.tags) {
    for (const id of tag.cartas) {
      const list = tagsByCard.get(id);
      if (list) list.push(tag.id);
      else tagsByCard.set(id, [tag.id]);
    }
  }

  applyTags(cards.filter((c) => !covered.has(c.id)));

  // nomes em português corrigidos pela wiki (a busca usa "key", então ela é refeita também)
  const byId = new Map(cards.map((c) => [c.id, c]));
  for (const [id, name] of Object.entries(overlay.nomes ?? {})) {
    const card = byId.get(Number(id));
    if (!card) continue;
    card.namePt = name;
    card.key = normalize(`${name} ${card.name}`);
  }
  for (const card of cards) {
    if (!covered.has(card.id)) continue;
    card.tags = tagsByCard.get(card.id) ?? [];
    card.effectOverrides = overlay.efeitos[card.id];
  }

  // Definições da camada primeiro (podem trazer tags novas); locais completam o que faltar
  const defs = overlay.tags.map(({ cartas: _cartas, ...def }) => def);
  for (const local of LOCAL_TAG_DEFS) if (!defs.some((d) => d.id === local.id)) defs.push(local);
  return defs;
}
