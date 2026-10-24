import { memo, useState, type CSSProperties } from "react";
import { cardImage } from "../db/images";
import { BAN_LABELS, frameColor } from "../db/labels";
import { displayName, type Card } from "../db/types";

type Props = {
  card: Card;
  onSelect: (card: Card) => void;
  /** mouse entrou (com o elemento) ou saiu (null) da carta */
  onHover: (card: Card | null, el?: HTMLElement) => void;
};

function CardTile({ card, onSelect, onHover }: Props) {
  const [failed, setFailed] = useState(false);
  const ban = card.ban?.tcg;

  return (
    <button
      className="tile"
      style={{ "--frame": frameColor(card.frame) } as CSSProperties}
      onClick={() => onSelect(card)}
      // só mouse: em tela de toque o "hover" viria junto com o toque e cobriria o painel
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(card, e.currentTarget)}
      onPointerLeave={() => onHover(null)}
    >
      <span className="tile-art">
        {failed ? (
          <span className="tile-fallback">{displayName(card)}</span>
        ) : (
          <img
            src={cardImage(card.images[0] ?? card.id, "small")}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
        {ban && <span className={`ban-badge ban-${ban}`}>{BAN_LABELS[ban]}</span>}
      </span>
      <span className="tile-name">{displayName(card)}</span>
    </button>
  );
}

export default memo(CardTile);
