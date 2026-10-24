import { ATTRIBUTES, levelLabel } from "../db/labels";
import { categoryOf, type Card } from "../db/types";

const LINK_ARROWS: Record<string, string> = {
  "Top-Left": "↖",
  Top: "↑",
  "Top-Right": "↗",
  Left: "←",
  Right: "→",
  "Bottom-Left": "↙",
  Bottom: "↓",
  "Bottom-Right": "↘",
};

/** Atributo, nível, ATK/DEF etc. de monstros (nada para magias/armadilhas) */
export default function CardStats({ card, compact }: { card: Card; compact?: boolean }) {
  if (categoryOf(card) !== "monster") return null;

  return (
    <dl className={`stats ${compact ? "compact" : ""}`}>
      {card.attribute && (
        <div>
          <dt>Atributo</dt>
          <dd className={`attr attr-${card.attribute}`}>{ATTRIBUTES[card.attribute] ?? card.attribute}</dd>
        </div>
      )}
      {(card.level ?? card.linkval) !== undefined && (
        <div>
          <dt>{levelLabel(card)}</dt>
          <dd>{card.level ?? card.linkval}</dd>
        </div>
      )}
      {card.scale !== undefined && (
        <div>
          <dt>Escala</dt>
          <dd>{card.scale}</dd>
        </div>
      )}
      <div>
        <dt>ATK</dt>
        <dd>{card.atk ?? "?"}</dd>
      </div>
      {card.frame !== "link" && (
        <div>
          <dt>DEF</dt>
          <dd>{card.def ?? "?"}</dd>
        </div>
      )}
      {card.linkmarkers && (
        <div>
          <dt>Setas</dt>
          <dd className="arrows">{card.linkmarkers.map((m) => LINK_ARROWS[m] ?? m).join(" ")}</dd>
        </div>
      )}
    </dl>
  );
}
