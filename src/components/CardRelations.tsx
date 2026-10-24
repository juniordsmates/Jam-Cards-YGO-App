import { useMemo, useState } from "react";
import {
  describeQuery,
  incomingRelations,
  RELATION_LABELS,
  relationTargetIds,
  type Relation,
  type RelationIndex,
  type RelationType,
} from "../db/relations";
import { rankCandidates, type Ranked } from "../db/ranking";
import { MONSTER_RACES } from "../db/labels";
import type { Overlay } from "../db/overlay";
import { displayName, type Card } from "../db/types";

type Props = {
  card: Card;
  /** null enquanto o índice ainda está sendo montado */
  index: RelationIndex | null;
  cards: Card[];
  byId: Map<number, Card>;
  byName: Map<string, Card>;
  archetypePt: Map<string, string>;
  meta?: Overlay["meta"];
  onOpen: (card: Card) => void;
  /** mostra um conjunto de cartas na busca, na ordem dada; keepFilters = combinar com os filtros atuais */
  onShowSet: (label: string, ids: number[], keepFilters: boolean) => void;
};

// Ordem dos grupos: o que a carta faz primeiro, depois o que fazem com ela
const ORDER: RelationType[] = ["invoca", "exclusiva", "ritual", "material", "busca", "cita"];
const VISIBLE_CHIPS = 8;
const LIST_PAGE = 12;

const raceLabel = (race: string) => MONSTER_RACES[race] ?? race;
const fmtViews = (n?: number) =>
  !n ? "" : n >= 1e6 ? `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : `${Math.round(n / 1e3)} mil`;

/** Conjunto de cartas alcançado por um alvo que não é uma carta só (arquétipo, descrição, "cartas que citam X") */
interface CardSet {
  key: string;
  label: string;
  ids: number[];
}

interface Group {
  key: string;
  label: string;
  cards: Card[];
  sets: CardSet[];
  /** todas as cartas do grupo, na ordem de exibição */
  ids: number[];
}

/** Lista ordenada de um conjunto: citadas > combo > metagame > popularidade */
function RankedList({ ranked, label, onOpen, onShowSet }: {
  ranked: Ranked[];
  label: string;
  onOpen: (card: Card) => void;
  onShowSet: Props["onShowSet"];
}) {
  const [shown, setShown] = useState(LIST_PAGE);
  return (
    <div className="ranked">
      <ol className="ranked-list">
        {ranked.slice(0, shown).map(({ card, tier, meta }) => (
          <li key={card.id}>
            <button className="ranked-row" onClick={() => onOpen(card)}>
              <span className="ranked-name">{displayName(card)}</span>
              {tier === 0 && <span className="badge badge-named">Citada</span>}
              {tier === 1 && <span className="badge badge-combo">Combo</span>}
              {/* só a partir de 1% de participação média: abaixo disso é ruído */}
              {meta * 25 >= 1 && (
                <span className="badge badge-meta" title="Participação média do arquétipo nos decks colocados do OCG no último ano (Road of the King)">
                  Meta {(meta * 25).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              )}
              <span className="ranked-views" title="Visualizações na YGOPRODeck">{fmtViews(card.views)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="ranked-actions">
        {shown < ranked.length && (
          <button className="link-btn" onClick={() => setShown((n) => n + LIST_PAGE)}>
            mostrar mais ({ranked.length - shown})
          </button>
        )}
        <button className="link-btn" onClick={() => onShowSet(label, ranked.map((r) => r.card.id), false)}>
          Ver todas na busca, nesta ordem
        </button>
      </div>
    </div>
  );
}

export default function CardRelations({ card, index, cards, byId, byName, archetypePt, meta, onOpen, onShowSet }: Props) {
  const [expandedChips, setExpandedChips] = useState<string | null>(null);
  const [openSet, setOpenSet] = useState<string | null>(null);

  const groups = useMemo<Group[]>(() => {
    if (!index) return [];
    const result: Group[] = [];
    const ptName = (name: string) => archetypePt.get(name) ?? byName.get(name)?.namePt ?? name;

    const outgoing = index.out.get(card.id) ?? [];
    const { named: incoming, generic } = incomingRelations(index, card);

    const build = (key: string, label: string, rels: Relation[], dir: "out" | "in") => {
      const cardsById = new Map<number, Card>();
      const sets: CardSet[] = [];
      for (const r of rels) {
        if (dir === "in") {
          const from = byId.get(r.from);
          if (from) cardsById.set(from.id, from);
        } else if (r.target.kind === "card") {
          const target = byId.get(r.target.id);
          if (target) cardsById.set(target.id, target);
        } else {
          const ids = relationTargetIds(r, cards);
          if (!ids.length) continue;
          const t = r.target;
          const what =
            t.kind === "query"
              ? describeQuery(t.query, raceLabel)
              : t.kind === "archetype"
                ? `arquétipo ${ptName(t.name)}${t.query ? ` · ${describeQuery(t.query, raceLabel)}` : ""}`
                : `${t.query ? describeQuery(t.query, raceLabel) : "cartas"} que citam "${ptName(t.name)}"`;
          sets.push({ key: `${key}:${sets.length}`, label: what, ids });
        }
      }
      const groupCards = [...cardsById.values()].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
      if (!groupCards.length && !sets.length) return;
      const ids = [...new Set([...groupCards.map((c) => c.id), ...sets.flatMap((s) => s.ids)])];
      result.push({ key, label, cards: groupCards, sets, ids });
    };

    for (const type of ORDER) {
      const rels = outgoing.filter((r) => r.type === type);
      if (rels.length) build(`out-${type}`, RELATION_LABELS[type].out, rels, "out");
    }
    for (const type of ORDER) {
      const rels = incoming.filter((r) => r.type === type);
      if (rels.length) build(`in-${type}`, RELATION_LABELS[type].in, rels, "in");
    }
    // alvos genéricos ("1 monstro Mago de TREVAS"): separados, para não misturar com quem cita pelo nome
    for (const type of ["invoca", "busca"] as RelationType[]) {
      const rels = generic.filter((r) => r.type === type);
      if (rels.length) build(`gen-${type}`, type === "invoca" ? "Pode ser invocada por" : "Pode ser buscada por", rels, "in");
    }
    return result;
  }, [index, card, cards, byId, byName, archetypePt]);

  // ranqueamento só do conjunto aberto (pode ter centenas de cartas)
  const openRanked = useMemo(() => {
    const set = groups.flatMap((g) => g.sets).find((s) => s.key === openSet);
    return set ? { set, ranked: rankCandidates(set.ids, byId, card, { byName, meta }) } : null;
  }, [openSet, groups, byId, card, byName, meta]);

  if (!index) {
    return (
      <section className="drawer-section">
        <h4>Relacionamentos</h4>
        <p className="tags-note">Montando relações entre cartas…</p>
      </section>
    );
  }
  if (!groups.length) return null;

  const name = displayName(card);

  return (
    <section className="drawer-section">
      <h4>Relacionamentos</h4>
      <div className="relations">
        {groups.map((g) => {
          const chipsOpen = expandedChips === g.key;
          const chips = chipsOpen ? g.cards : g.cards.slice(0, VISIBLE_CHIPS);
          const setLabel = `${g.label}: ${name}`;
          const dir = g.key.startsWith("out") ? "out" : "in";
          return (
            <div key={g.key} className={`relation-group rel-${g.key} rel-dir-${dir}`}>
              <div className="relation-head">
                <span className="relation-label">
                  {g.label} <span className="relation-count">{g.ids.length}</span>
                </span>
                <span className="relation-actions">
                  <button className="link-btn" onClick={() => onShowSet(setLabel, g.ids, false)} title="Mostrar só estas cartas na busca">
                    Ver na busca
                  </button>
                  <button className="link-btn" onClick={() => onShowSet(setLabel, g.ids, true)} title="Aplicar sobre os filtros atuais">
                    Combinar com filtros
                  </button>
                </span>
              </div>

              {g.cards.length > 0 && (
                <div className="chips">
                  {chips.map((c) => (
                    <button key={c.id} className="chip rel-chip" onClick={() => onOpen(c)} title="Abrir esta carta">
                      {displayName(c)}
                    </button>
                  ))}
                  {g.cards.length > VISIBLE_CHIPS && (
                    <button className="link-btn" onClick={() => setExpandedChips(chipsOpen ? null : g.key)}>
                      {chipsOpen ? "mostrar menos" : `+${g.cards.length - VISIBLE_CHIPS}`}
                    </button>
                  )}
                </div>
              )}

              {g.sets.map((s) => {
                const open = openSet === s.key;
                return (
                  <div key={s.key} className="relation-set">
                    <button
                      className={`set-toggle ${open ? "open" : ""}`}
                      aria-expanded={open}
                      onClick={() => setOpenSet(open ? null : s.key)}
                    >
                      <span className="set-kind">{g.cards.length ? "Outros" : "Possibilidades"}</span>
                      {s.label}
                      <span className="relation-count">{s.ids.length}</span>
                    </button>
                    {open && openRanked?.set.key === s.key && (
                      <RankedList ranked={openRanked.ranked} label={`${g.label} (${s.label}): ${name}`} onOpen={onOpen} onShowSet={onShowSet} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
