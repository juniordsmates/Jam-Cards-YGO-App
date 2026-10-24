import { applyTags, TAGS } from "./tags";
import type { Card } from "./types";
import type { CombosCalculados } from "./motor";
import { normalize } from "./search";

// Camada pública de marcações (repositório Database-Cards-Ygo-Camada): tags e ajustes de
// leitura revisados, sem textos de cartas. O app aplica a camada sobre os dados da YGOPRODeck.
export const OVERLAY_URL =
  "https://raw.githubusercontent.com/juniordsmates/Database-Cards-Ygo-Camada/main/camada.json";

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
}

const LOCAL_TAG_DEFS: TagDefinition[] = TAGS.map(({ id, label, group, hint }) => ({ id, label, group, hint }));

export async function fetchOverlay(): Promise<Overlay> {
  const res = await fetch(OVERLAY_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`camada: HTTP ${res.status}`);
  const overlay = (await res.json()) as Overlay;
  if (overlay.formato !== SUPPORTED_FORMAT) throw new Error(`camada: formato ${overlay.formato} não suportado`);
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
