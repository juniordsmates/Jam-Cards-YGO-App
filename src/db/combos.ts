import { readCard } from "./effects";
import { legalIn, type GameFormat } from "./legality";
import { relationTargetIds, type Relation, type RelationIndex, type RelationType } from "./relations";
import { categoryOf, type Card } from "./types";

// Explorador de combos: a partir das cartas da mão inicial, segue as relações que trazem
// cartas novas para o jogo (busca, invoca, Ritual, materiais de Fusão/Link…) até alguns
// passos de distância, formando uma árvore: o que cada carta faz e onde ela pode chegar.
// É uma aproximação pelo texto: não simula custos, ordem de Chain nem limites de Invocação.

export type StepKind = "busca" | "invoca" | "material";

export interface ComboNode {
  card: Card;
  /** 0 = mão inicial */
  depth: number;
  /** como a carta chegou: de qual carta, por qual tipo de passo e qual efeito */
  via?: { from: number; kind: StepKind; effect: number; label: string };
  /** exigências do passo que trouxe a carta: Invocação-Normal, Tributo, descarte… */
  notes: string[];
  children: ComboNode[];
  /** só alcançável combinando duas ou mais cartas da mão inicial */
  needsCombination?: boolean;
}

export interface ComboResult {
  roots: ComboNode[];
  /** todas as cartas alcançadas (exceto a mão inicial), pelo menor caminho */
  reached: Map<number, ComboNode>;
}

export interface ExploreOptions {
  cards: Card[];
  byId: Map<number, Card>;
  index: RelationIndex;
  format: GameFormat;
  /** passos a partir da mão inicial */
  maxDepth?: number;
  /** ordena os candidatos de um passo (ex.: combo > metagame > popularidade) */
  rank?: (ids: number[], parent: Card) => number[];
}

const STEP_OF: Partial<Record<RelationType, StepKind>> = { busca: "busca", invoca: "invoca" };
const STEP_LABEL: Record<StepKind, string> = { busca: "Busca", invoca: "Invoca", material: "Material de" };

/** Exigências do efeito que faz o passo, lidas da leitura da carta */
export function stepNotes(card: Card, effectIndex: number): string[] {
  const e = readCard(card, false).effects[effectIndex];
  if (!e) return [];
  const notes: string[] = [];
  const head = `${e.condition ?? ""} ${e.costTarget ?? ""}`;
  const isMonster = categoryOf(card) === "monster";
  if (isMonster && /\bnormal (or special |or flip )?summoned\b|\bnormal summoned\b/i.test(e.condition ?? "")) notes.push("Invocação-Normal");
  else if (isMonster && /\bspecial summoned\b/i.test(e.condition ?? "")) notes.push("ao ser Invocada");
  if (/\bis tributed\b|\bif this card is tributed\b/i.test(e.condition ?? "")) notes.push("ao ser Tributada");
  if (/\byou can also tribute\b/i.test(e.text)) notes.push("Tributo opcional");
  else if (/\btribute\b/i.test(e.costTarget ?? "") || /\bby tributing\b/i.test(e.text)) notes.push("Tributo");
  if (/\bdiscard\b/i.test(head)) notes.push("Descarte");
  if (/\bpay\b[^.;]*\blp\b|\btake \d+ damage\b/i.test(e.text)) notes.push("Custa PV");
  if (/\bsent to the (gy|graveyard)\b/i.test(e.condition ?? "")) notes.push("ao ir para o Cemitério");
  if (e.zone === "Mão") notes.push("da mão");
  if (e.zone === "Cemitério") notes.push("do Cemitério");
  if (e.opt === "hard") notes.push("1x por turno");
  return notes;
}

// cartas com materiais listados (Fusão/Link/…), por índice de relações
const materialCache = new WeakMap<RelationIndex, Map<number, Relation[]>>();
function materialLists(index: RelationIndex) {
  let byFusion = materialCache.get(index);
  if (!byFusion) {
    byFusion = new Map();
    for (const [from, rels] of index.out) {
      const mats = rels.filter((r) => r.type === "material");
      if (mats.length) byFusion.set(from, mats);
    }
    materialCache.set(index, byFusion);
  }
  return byFusion;
}

/** Relações de material: a carta de Fusão/Link/… lista materiais; libera quando todos estão disponíveis */
function materialUnlocks(
  index: RelationIndex,
  cards: Card[],
  byIdCards: Map<number, Card>,
  available: Set<number>,
  legal: (c: Card) => boolean,
) {
  const unlocked: { id: number; from: number; effect: number }[] = [];
  for (const [fusionId, mats] of materialLists(index)) {
    const fusion = byIdCards.get(fusionId);
    if (!fusion || available.has(fusionId) || !legal(fusion)) continue;
    // cada material listado precisa de ao menos uma carta disponível que o satisfaça
    const satisfiers = mats.map((r) => relationTargetIds(r, cards).filter((id) => available.has(id)));
    if (satisfiers.every((s) => s.length > 0)) unlocked.push({ id: fusionId, from: satisfiers[0][0], effect: mats[0].effect });
  }
  return unlocked;
}

function explore(start: Card[], opts: ExploreOptions): ComboResult {
  const { cards, byId, index, format } = opts;
  const maxDepth = opts.maxDepth ?? 3;
  const legal = (c: Card) => legalIn(c, format);
  const startIds = new Set(start.map((c) => c.id));
  const nodes = new Map<number, ComboNode>();
  const roots: ComboNode[] = start.map((card) => ({ card, depth: 0, notes: [], children: [] }));
  roots.forEach((n) => nodes.set(n.card.id, n));

  let frontier = roots;
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: ComboNode[] = [];
    for (const parent of frontier) {
      const rels = (index.out.get(parent.card.id) ?? []).filter((r) => STEP_OF[r.type]);
      for (const r of rels) {
        const kind = STEP_OF[r.type]!;
        let ids = relationTargetIds(r, cards).filter((id) => !nodes.has(id) && legal(byId.get(id)!));
        if (opts.rank) ids = opts.rank(ids, parent.card);
        const notes = stepNotes(parent.card, r.effect);
        for (const id of ids) {
          if (nodes.has(id)) continue;
          const node: ComboNode = {
            card: byId.get(id)!,
            depth,
            via: { from: parent.card.id, kind, effect: r.effect, label: STEP_LABEL[kind] },
            notes,
            children: [],
          };
          nodes.set(id, node);
          parent.children.push(node);
          next.push(node);
        }
      }
    }
    // Fusão/Link/… cujos materiais nomeados já estão disponíveis
    for (const u of materialUnlocks(index, cards, byId, new Set(nodes.keys()), legal)) {
      const parent = nodes.get(u.from)!;
      const node: ComboNode = {
        card: byId.get(u.id)!,
        depth,
        via: { from: u.from, kind: "material", effect: u.effect, label: STEP_LABEL.material },
        notes: ["materiais disponíveis"],
        children: [],
      };
      nodes.set(u.id, node);
      parent.children.push(node);
      next.push(node);
    }
    frontier = next;
  }

  const reached = new Map([...nodes].filter(([id]) => !startIds.has(id)));
  return { roots, reached };
}

/**
 * Explora os combos de uma mão inicial. Com mais de uma carta, marca as cartas que só
 * ficam alcançáveis combinando as cartas da mão (nenhuma delas sozinha chega lá).
 */
export function exploreCombos(start: Card[], opts: ExploreOptions): ComboResult {
  const result = explore(start, opts);
  if (start.length > 1) {
    const alone = new Set<number>();
    for (const c of start) for (const id of explore([c], opts).reached.keys()) alone.add(id);
    for (const [id, node] of result.reached) if (!alone.has(id)) node.needsCombination = true;
  }
  return result;
}
