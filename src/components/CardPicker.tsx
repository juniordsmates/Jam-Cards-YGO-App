import { useMemo, useState, type RefObject } from "react";
import { SearchIcon } from "../icons";
import { legalIn, type GameFormat } from "../db/legality";
import { archetypeKey, normalize } from "../db/search";
import { bilingualName, displayName, type Card } from "../db/types";
import { t } from "../i18n";

// a lista rola: um arquétipo inteiro (ex.: "toon", com as do Extra Deck) cabe nela
const MAX_SUGGESTIONS = 80;

type Props = {
  label: string;
  cards: Card[];
  onChange: (cards: Card[]) => void;
  all: Card[];
  format: GameFormat;
  placeholder: string;
  placeholderMore: string;
  inputRef?: RefObject<HTMLInputElement>;
  /** classe extra (para os testes e o layout distinguirem os campos) */
  className?: string;
};

/** Lista de cartas escolhidas + busca por nome (pt/en), com as legais no formato primeiro */
export default function CardPicker({ label, cards, onChange, all, format, placeholder, placeholderMore, inputRef, className = "" }: Props) {
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    const terms = q.split(" ");
    return all
      .filter((c) => c.frame !== "skill" && c.frame !== "token" && terms.every((t) => c.key.includes(t) || archetypeKey(c).includes(t)) && !cards.some((h) => h.id === c.id))
      .sort((a, b) => Number(legalIn(b, format)) - Number(legalIn(a, format)) || (b.views ?? 0) - (a.views ?? 0))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, all, cards, format]);

  const add = (c: Card) => {
    onChange([...cards, c]);
    setQuery("");
    inputRef?.current?.focus();
  };

  return (
    <div className={`hand ${className}`}>
      <span className="field-label">{label}</span>
      <div className="hand-cards">
        {cards.map((c) => {
          const ok = legalIn(c, format);
          return (
            <span key={c.id} className={`hand-card ${ok ? "" : "illegal"}`} title={ok ? bilingualName(c) : t("{0} — não pode ser usada no {1}", [bilingualName(c), format])}>
              {displayName(c)}
              {!ok && <em> {" "}{t("· fora do {0}", [format])}</em>}
              <button onClick={() => onChange(cards.filter((x) => x.id !== c.id))} aria-label={t("Tirar {0}", [displayName(c)])}>
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
            placeholder={cards.length ? placeholderMore : placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && suggestions[0] && legalIn(suggestions[0], format) && add(suggestions[0])}
          />
        </label>
        {suggestions.length > 0 && (
          <ul className="suggestions" role="listbox">
            {suggestions.map((c) => {
              const ok = legalIn(c, format);
              return (
                <li key={c.id}>
                  <button disabled={!ok} onClick={() => add(c)} role="option" aria-selected={false}>
                    <span>{displayName(c)}</span>
                    {c.namePt && <small>{c.name}</small>}
                    {!ok && <em>{c.ban?.[format === "TCG" ? "tcg" : "ocg"] === "Forbidden" ? t("proibida") : t("fora do {0}", [format])}</em>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
