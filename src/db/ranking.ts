import type { Overlay } from "./overlay";
import type { Card } from "./types";

// Ordena as cartas que uma relação alcança ("Outros"), das mais prováveis de serem usadas
// para as menos: citadas no texto > envolvidas no combo > uso no metagame > popularidade.

export interface RankContext {
  byName: Map<string, Card>;
  meta?: Overlay["meta"];
}

export interface Ranked {
  card: Card;
  /** 0 = citada no texto da carta de origem, 1 = combo, 2 = demais */
  tier: 0 | 1 | 2;
  /** participação do arquétipo nos decks colocados do OCG no último ano (soma dos trimestres) */
  meta: number;
}

const quotedNames = (c: Card) => [...new Set([...c.desc.matchAll(/"([^"]+)"/g)].map((m) => m[1]))];

/** Participação de cada arquétipo nos últimos 4 trimestres (0–4, soma das participações) */
function metaShares(meta: Overlay["meta"] | undefined): Map<string, number> {
  const result = new Map<string, number>();
  if (!meta) return result;
  const recent = meta.periodos.slice(0, 4);
  const totals = new Map(recent.map((p) => [p.periodo, p.total]));
  for (const [archetype, list] of Object.entries(meta.porArquetipo)) {
    const share = list.reduce((sum, [periodo, tops]) => sum + (totals.has(periodo) ? tops / totals.get(periodo)! : 0), 0);
    if (share > 0) result.set(archetype, share);
  }
  return result;
}

export function rankCandidates(ids: number[], byId: Map<number, Card>, source: Card, ctx: RankContext): Ranked[] {
  const named = new Set(quotedNames(source).filter((n) => n !== source.name));
  // arquétipos do combo: o da carta de origem e os das cartas que ela cita (ou os próprios nomes, se forem arquétipos)
  const comboArchetypes = new Set<string>();
  if (source.archetype) comboArchetypes.add(source.archetype.toLowerCase());
  for (const n of named) {
    comboArchetypes.add(n.toLowerCase());
    const ref = ctx.byName.get(n);
    if (ref?.archetype) comboArchetypes.add(ref.archetype.toLowerCase());
  }
  const shares = metaShares(ctx.meta);

  const ranked: Ranked[] = [];
  for (const id of ids) {
    const card = byId.get(id);
    if (!card) continue;
    let tier: Ranked["tier"] = 2;
    if (named.has(card.name)) tier = 0;
    else if (
      (card.archetype && comboArchetypes.has(card.archetype.toLowerCase())) ||
      quotedNames(card).some((n) => named.has(n))
    ) {
      tier = 1;
    }
    ranked.push({ card, tier, meta: (card.archetype && shares.get(card.archetype)) || 0 });
  }
  return ranked.sort((a, b) => a.tier - b.tier || b.meta - a.meta || (b.card.views ?? 0) - (a.card.views ?? 0));
}
