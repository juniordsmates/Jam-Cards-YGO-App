import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardPreview from "../components/CardPreview";
import { SearchIcon } from "../icons";
import { initCardDb, useCardDb, useRelationIndex, useTagLookup } from "../db/cardStore";
import { exploreCombos, type ComboNode } from "../db/combos";
import { legalIn, type GameFormat } from "../db/legality";
import { rankCandidates } from "../db/ranking";
import { normalize } from "../db/search";
import { categoryOf, displayName, type Card } from "../db/types";
import "./combos.css";

const MAX_SUGGESTIONS = 8;
const VISIBLE_CHILDREN = 8;
// tags que fazem de um monstro alcançado um bom ponto de chegada (interrupções no turno do oponente)
const INTERRUPTIONS = ["omni-negate", "nega-ativacao", "nega-efeito", "nega-invocacao", "board-breaker", "floodgate"];

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Linha de uma carta na árvore, com os filhos (onde ela pode chegar) */
function TreeNode({ node, expanded, toggle, onHover }: {
  node: ComboNode;
  expanded: Set<number>;
  toggle: (id: number) => void;
  onHover: (card: Card | null, el?: HTMLElement) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const open = expanded.has(node.card.id);
  const children = showAll ? node.children : node.children.slice(0, VISIBLE_CHILDREN);
  return (
    <li className={`combo-node depth-${node.depth}`}>
      <div className="combo-row">
        <button
          className="combo-toggle"
          onClick={() => toggle(node.card.id)}
          disabled={!node.children.length}
          aria-expanded={open}
          aria-label={open ? "Recolher" : "Expandir"}
        >
          {node.children.length ? (open ? "▾" : "▸") : "·"}
        </button>
        {node.via && <span className={`via via-${node.via.kind}`}>{node.via.label}</span>}
        <span
          className="combo-name"
          onPointerEnter={(e) => e.pointerType === "mouse" && onHover(node.card, e.currentTarget)}
          onPointerLeave={() => onHover(null)}
        >
          {displayName(node.card)}
        </span>
        {node.needsCombination && <span className="combo-flag" title="Nenhuma carta da mão chega aqui sozinha">só combinando</span>}
        {node.notes.map((n) => (
          <span key={n} className="combo-note">{n}</span>
        ))}
        {node.children.length > 0 && <span className="combo-count">{node.children.length}</span>}
      </div>
      {open && node.children.length > 0 && (
        <ul className="combo-children">
          {children.map((c) => (
            <TreeNode key={c.card.id} node={c} expanded={expanded} toggle={toggle} onHover={onHover} />
          ))}
          {node.children.length > VISIBLE_CHILDREN && (
            <li>
              <button className="link-btn combo-more" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "mostrar menos" : `+${node.children.length - VISIBLE_CHILDREN} possibilidades`}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export default function Combos({ onBack }: { onBack: () => void }) {
  const db = useCardDb();
  const index = useRelationIndex();
  const tagById = useTagLookup();
  const [format, setFormat] = useState<GameFormat>("TCG");
  const [hand, setHand] = useState<Card[]>([]);
  const [depth, setDepth] = useState(3);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => void initCardDb(), []);
  useEffect(() => inputRef.current?.focus(), [db.status]);

  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);

  // Sugestões: cartas pelo nome (pt/en), legais no formato primeiro
  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    const terms = q.split(" ");
    return db.cards
      .filter((c) => c.frame !== "skill" && c.frame !== "token" && terms.every((t) => c.key.includes(t)) && !hand.some((h) => h.id === c.id))
      .sort((a, b) => Number(legalIn(b, format)) - Number(legalIn(a, format)) || (b.views ?? 0) - (a.views ?? 0))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, db.cards, hand, format]);

  const legalHand = hand.filter((c) => legalIn(c, format));

  const result = useMemo(() => {
    if (!index || !legalHand.length) return null;
    return exploreCombos(legalHand, {
      cards: db.cards,
      byId,
      index,
      format,
      maxDepth: depth,
      // ordem dos ramos: citadas > combo com a mão inicial > metagame > popularidade
      rank: (ids) => rankCandidates(ids, byId, legalHand[0], { byName, meta: db.extras?.meta }).map((r) => r.card.id),
    });
    // legalHand muda de identidade a cada render; as cartas e o formato bastam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hand, format, depth, db.cards, byId, byName, db.extras]);

  // abre a mão inicial e o primeiro nível a cada nova exploração
  useEffect(() => {
    if (result) setExpanded(new Set(result.roots.map((r) => r.card.id)));
  }, [result]);

  const finals = useMemo(() => {
    if (!result) return [];
    return [...result.reached.values()]
      .filter((n) => categoryOf(n.card) === "monster")
      .map((n) => ({ node: n, hits: (n.card.tags ?? []).filter((t) => INTERRUPTIONS.includes(t)) }))
      .filter((x) => x.hits.length)
      .sort((a, b) => b.hits.length - a.hits.length || (b.node.card.views ?? 0) - (a.node.card.views ?? 0))
      .slice(0, 12);
  }, [result]);

  const toggle = useCallback(
    (id: number) => setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    }),
    [],
  );

  // prévia ao passar o mouse (mesmo popup da busca)
  const [hover, setHover] = useState<{ card: Card; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const onHover = useCallback((card: Card | null, el?: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (!card || !el) return setHover(null);
    hoverTimer.current = window.setTimeout(() => setHover({ card, rect: el.getBoundingClientRect() }), 300);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const addCard = (c: Card) => {
    setHand((h) => [...h, c]);
    setQuery("");
    inputRef.current?.focus();
  };

  const ready = db.status === "ready";

  return (
    <ScreenShell title="Combos" accent="magenta" onBack={onBack} plain>
      {!ready ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? "Carregando base de cartas…"}</p>
        </div>
      ) : (
        <div className="combos">
          <section className="combos-setup">
            <div className="format-switch" role="radiogroup" aria-label="Formato">
              {(["TCG", "OCG"] as GameFormat[]).map((f) => (
                <button key={f} role="radio" aria-checked={format === f} className={format === f ? "active" : ""} onClick={() => setFormat(f)}>
                  {f}
                </button>
              ))}
            </div>
            <p className="format-help">
              {format === "TCG"
                ? "Só cartas lançadas no TCG e não proibidas na banlist do TCG."
                : "Só cartas lançadas no OCG e não proibidas na banlist do OCG."}
            </p>

            <div className="hand">
              <span className="field-label">Mão inicial</span>
              <div className="hand-cards">
                {hand.map((c) => {
                  const ok = legalIn(c, format);
                  return (
                    <span key={c.id} className={`hand-card ${ok ? "" : "illegal"}`} title={ok ? undefined : `Não pode ser usada no ${format}`}>
                      {displayName(c)}
                      {!ok && <em> · fora do {format}</em>}
                      <button onClick={() => setHand((h) => h.filter((x) => x.id !== c.id))} aria-label={`Tirar ${displayName(c)} da mão`}>
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="hand-search">
                <label className="search-input">
                  <SearchIcon />
                  <input
                    ref={inputRef}
                    type="search"
                    placeholder={hand.length ? "Acrescentar outra carta à mão…" : "Escolha uma carta (ex.: Mitsurugi Prayers)"}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && suggestions[0] && legalIn(suggestions[0], format) && addCard(suggestions[0])}
                  />
                </label>
                {suggestions.length > 0 && (
                  <ul className="suggestions" role="listbox">
                    {suggestions.map((c) => {
                      const ok = legalIn(c, format);
                      return (
                        <li key={c.id}>
                          <button disabled={!ok} onClick={() => addCard(c)} role="option" aria-selected={false}>
                            <span>{displayName(c)}</span>
                            {c.namePt && <small>{c.name}</small>}
                            {!ok && <em>{c.ban?.[format === "TCG" ? "tcg" : "ocg"] === "Forbidden" ? "proibida" : `fora do ${format}`}</em>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <label className="field depth-field">
              <span className="field-label">Passos</span>
              <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
                {[1, 2, 3, 4].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="combos-result">
            {!legalHand.length ? (
              <div className="combos-empty">
                <p>Escolha uma ou mais cartas para a mão inicial.</p>
                <small>
                  A árvore mostra o que cada carta alcança sozinha (busca, invoca, Ritual, Fusão com os materiais à mão) e onde
                  cada caminho pode chegar. Os ramos vêm ordenados por combo com a mão inicial, uso no metagame e popularidade.
                </small>
              </div>
            ) : !index || !result ? (
              <div className="combos-empty">
                <span className="spinner" />
                <p>Montando relações entre cartas…</p>
              </div>
            ) : (
              <>
                <p className="combos-summary">
                  <strong>{fmt(result.reached.size)}</strong> cartas alcançáveis em até {depth} {depth === 1 ? "passo" : "passos"} no {format}
                  {legalHand.length > 1 && (
                    <> · <strong>{[...result.reached.values()].filter((n) => n.needsCombination).length}</strong> só combinando as cartas da mão</>
                  )}
                </p>

                <div className="combos-columns">
                  <ul className="combo-tree" aria-label="Árvore de combos">
                    {result.roots.map((n) => (
                      <TreeNode key={n.card.id} node={n} expanded={expanded} toggle={toggle} onHover={onHover} />
                    ))}
                  </ul>

                  <aside className="combo-finals">
                    <h4>Pontos de chegada</h4>
                    <p className="tags-note">Monstros alcançados com interrupções para o turno do oponente.</p>
                    {finals.length === 0 ? (
                      <p className="tags-note">Nenhum monstro com negação, remoção em massa ou floodgate nesses caminhos.</p>
                    ) : (
                      <ol>
                        {finals.map(({ node, hits }) => (
                          <li key={node.card.id}>
                            <span
                              className="combo-name"
                              onPointerEnter={(e) => e.pointerType === "mouse" && onHover(node.card, e.currentTarget)}
                              onPointerLeave={() => onHover(null)}
                            >
                              {displayName(node.card)}
                            </span>
                            <span className="finals-tags">
                              {hits.map((t) => (
                                <span key={t} className="combo-note">{tagById(t)?.label ?? t}</span>
                              ))}
                            </span>
                            <small>
                              {node.depth} {node.depth === 1 ? "passo" : "passos"}
                            </small>
                          </li>
                        ))}
                      </ol>
                    )}
                  </aside>
                </div>
                <p className="tags-note combos-disclaimer">
                  Aproximação pelo texto das cartas: não simula custos, ordem de Chain, limites de Invocação nem a necessidade de
                  um efeito de Fusão. Use como mapa de possibilidades.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
