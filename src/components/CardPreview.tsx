import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import CardEffects from "./CardEffects";
import CardStats from "./CardStats";
import { readCard } from "../db/effects";
import { BAN_LABELS, frameColor, kindLabel } from "../db/labels";
import { useTagLookup } from "../db/cardStore";
import { displayName, type Card } from "../db/types";

type Props = {
  card: Card;
  /** retângulo da carta sob o cursor, para posicionar o popup ao lado */
  anchor: DOMRect;
};

const GAP = 12;
const MARGIN = 12;

/** Popup de leitura rápida exibido ao passar o mouse sobre uma carta */
export default function CardPreview({ card, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Mede o popup e o encaixa à direita da carta; sem espaço, vai para a esquerda
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    let left = anchor.right + GAP;
    if (left + w > window.innerWidth - MARGIN) left = anchor.left - GAP - w;
    left = Math.max(MARGIN, left);
    const top = Math.max(MARGIN, Math.min(anchor.top, window.innerHeight - h - MARGIN));
    setPos({ left, top });
  }, [anchor, card]);

  const reading = useMemo(() => readCard(card), [card]);
  const ban = card.ban?.tcg;
  const tagById = useTagLookup();
  const tags = (card.tags ?? []).map(tagById).filter((t) => t !== undefined);

  // Portal no body: um ancestral com transform (animação da tela) deslocaria o position: fixed
  return createPortal(
    <div
      ref={ref}
      className="preview"
      role="tooltip"
      style={{
        ...({ "--frame": frameColor(card.frame) } as CSSProperties),
        // primeira renderização invisível, só para medir o tamanho antes de posicionar
        ...(pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }),
      }}
    >
      <header className="preview-head">
        <strong>{displayName(card)}</strong>
        {card.namePt && <span className="preview-en">{card.name}</span>}
        <span className="preview-kind">{kindLabel(card)}</span>
      </header>

      <CardStats card={card} compact />

      <div className="preview-desc">
        <CardEffects reading={reading} compact />
      </div>

      {(tags.length > 0 || ban || card.archetype) && (
        <footer className="preview-foot">
          {ban && <span className={`tag ban-${ban}`}>TCG: {BAN_LABELS[ban]}</span>}
          {card.archetype && <span className="tag">{card.archetype}</span>}
          {tags.map((t) => (
            <span key={t.id} className="tag preview-tag">
              {t.label}
            </span>
          ))}
        </footer>
      )}
    </div>,
    document.body,
  );
}
