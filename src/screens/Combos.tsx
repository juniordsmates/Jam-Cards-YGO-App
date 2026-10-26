import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardPreview from "../components/CardPreview";
import { FontesButton } from "../components/Fontes";
import KnownCombos from "../components/KnownCombos";
import VerifiedCombos from "../components/VerifiedCombos";
import { KNOWN_COMBOS } from "../data/combos";
import { SearchIcon } from "../icons";
import { initCardDb, useCardDb } from "../db/cardStore";
import { legalIn, type GameFormat } from "../db/legality";
import { cardsOfLine, linesForHand, type LinhaCombo } from "../db/motor";
import { normalize } from "../db/search";
import { displayName, type Card } from "../db/types";
import "./combos.css";

const MAX_SUGGESTIONS = 8;

/** `initialHand`: cartas já na mão ao abrir (vindas da busca) */
export default function Combos({ onBack, initialHand = [] }: { onBack: () => void; initialHand?: Card[] }) {
  const db = useCardDb();
  const [format, setFormat] = useState<GameFormat>("TCG");
  const [hand, setHand] = useState<Card[]>(initialHand);
  const [query, setQuery] = useState("");
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

  const combos = db.extras?.combos;
  const known = useMemo(() => new Map(KNOWN_COMBOS.map((k) => [k.id, k])), []);

  // linha do formato escolhido, sem nenhuma carta proibida ou não lançada nele
  const fits = useCallback(
    (l: LinhaCombo) =>
      (!l.formatos || l.formatos.includes(format)) &&
      cardsOfLine(l).every((id) => {
        const c = byId.get(id);
        return !c || legalIn(c, format);
      }),
    [format, byId],
  );
  // linhas calculadas no motor cuja mão inicial está na mão escolhida
  const lines = useMemo(
    () => linesForHand(combos, hand.map((c) => c.id)).filter(fits).sort((x, y) => y.pontos - x.pontos),
    [combos, hand, fits],
  );
  // linhas que passam pelas cartas escolhidas sem começar com elas: como chegar nelas e o que fazer depois
  const reach = useMemo(() => {
    if (!combos || !hand.length) return [];
    const ids = hand.map((c) => c.id);
    const start = new Set(lines);
    return combos.linhas
      .filter((l) => !start.has(l) && fits(l) && ids.some((id) => !l.mao.includes(id) && cardsOfLine(l).includes(id)))
      .sort((x, y) => y.pontos - x.pontos)
      .slice(0, 12);
  }, [combos, hand, lines, fits]);
  const handNames = hand.map((c) => displayName(c)).join(", ");

  // linhas escritas pela comunidade só aparecem quando o motor as confirmou
  const confirmed = KNOWN_COMBOS.filter((k) => lines.some((l) => l.comunidade === k.id));

  // cartas que iniciam combos calculados sozinhas (atalhos na tela vazia), por deck
  const starters = useMemo(() => {
    if (!combos) return [];
    return combos.decks.map((d, i) => ({
      deck: d,
      cards: [...new Set(combos.linhas.filter((l) => l.deck === i && l.mao.length === 1 && fits(l)).map((l) => l.mao[0]))]
        .map((id) => byId.get(id))
        .filter((c): c is Card => !!c),
    })).filter((s) => s.cards.length);
  }, [combos, byId, fits]);

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

          </section>

          <section className="combos-result">
            {!combos ? (
              <div className="combos-empty">
                <p>Os combos calculados ainda não foram baixados.</p>
                <small>Eles chegam com a camada de marcações da base; confira a conexão e abra a tela de novo.</small>
              </div>
            ) : !hand.length ? (
              <div className="combos-empty">
                <p>Escolha uma ou mais cartas para a mão inicial.</p>
                <small>
                  Só aparecem linhas que o App conseguiu jogar, com as regras do EDOPro, usando decklists reais de torneio: custos,
                  condições de ativação, travas, “uma vez por turno” e o limite de Invocação-Normal são aplicados pelos scripts
                  oficiais das cartas, no primeiro turno e com o oponente passando.
                </small>
                {starters.map((s) => (
                  <div key={s.deck.url} className="starter-chips">
                    <span className="field-label">{s.deck.busca}</span>
                    {s.cards.map((c) => (
                      <button key={c.id} className="chip" onClick={() => addCard(c)}>
                        {displayName(c)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : !lines.length && !reach.length ? (
              <div className="combos-empty">
                <p>Nenhum combo calculado com esta mão, nem chegando nela, no {format}.</p>
                <small>
                  O App testa cada carta dos decks abaixo sozinha na mão (e as mãos das linhas da comunidade), com a banlist
                  atual de cada formato. Uma mão sem linha aqui não chegou a um campo com Invocação do Extra Deck ou 3+ Invocações,
                  ou a linha usa carta proibida ou não lançada no {format}.
                </small>
                <ul className="combos-decks">
                  {combos.decks.map((d) => (
                    <li key={d.url}>
                      {d.nome}
                      {d.evento && <small> · {d.evento}</small>}
                    </li>
                  ))}
                </ul>
                <FontesButton sites={["ygoprodeck", "project-ignis"]} links={combos.decks.map((d) => ({ nome: `Deck: ${d.nome}`, url: d.url }))} />
              </div>
            ) : (
              <>
                <VerifiedCombos
                  title="Combos começando com a mão"
                  lines={lines}
                  combos={combos}
                  byId={byId}
                  known={known}
                  format={format}
                  onHover={onHover}
                />
                <VerifiedCombos
                  title={`Combos que chegam em ${handNames}`}
                  lines={reach}
                  highlight={hand.map((c) => c.id)}
                  combos={combos}
                  byId={byId}
                  known={known}
                  format={format}
                  onHover={onHover}
                />
                {confirmed.length > 0 && (
                  <KnownCombos
                    title="Linhas da comunidade conferidas com o App"
                    combos={confirmed}
                    byName={byName}
                    format={format}
                    onHover={onHover}
                  />
                )}
                <p className="tags-note combos-disclaimer">
                  Calculado com o App em {new Date(combos.geradoEm).toLocaleDateString("pt-BR")} (scripts {combos.motor.scripts}). O cálculo
                  não simula interrupções do oponente. <FontesButton sites={["project-ignis", "ygoprodeck"]} />
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
