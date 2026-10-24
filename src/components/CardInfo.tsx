import type { ReactNode } from "react";
import type { Card } from "../db/types";

type Props = {
  card: Card;
  /** pontos no formato Genesys (só cartas com pontos) */
  genesysPoints?: number;
  onTreatedAs?: (name: string) => void;
};

const date = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : undefined);
const fmt = (n: number) => n.toLocaleString("pt-BR");

const MD_RARITY: Record<string, string> = {
  Common: "Normal (N)",
  Rare: "Rara (R)",
  "Super Rare": "Super Rara (SR)",
  "Ultra Rare": "Ultra Rara (UR)",
};

/** Dados de catálogo: lançamento, formatos, raridade no Master Duel, popularidade… */
export default function CardInfo({ card, genesysPoints, onTreatedAs }: Props) {
  const rows: [string, ReactNode][] = [];
  if (card.tcgDate) rows.push(["Lançamento TCG", date(card.tcgDate)]);
  if (card.ocgDate) rows.push(["Lançamento OCG", date(card.ocgDate)]);
  if (card.mdRarity) rows.push(["Raridade no Master Duel", MD_RARITY[card.mdRarity] ?? card.mdRarity]);
  if (genesysPoints) rows.push(["Pontos no Genesys", fmt(genesysPoints)]);
  if (card.views) rows.push(["Visualizações na YGOPRODeck", fmt(card.views)]);
  if (card.treatedAs) {
    rows.push([
      "Tratada como",
      onTreatedAs ? (
        <button className="link-btn" onClick={() => onTreatedAs(card.treatedAs!)}>
          {card.treatedAs}
        </button>
      ) : (
        card.treatedAs
      ),
    ]);
  }

  if (!rows.length && !card.formats?.length) return null;

  return (
    <section className="drawer-section">
      <h4>Informações</h4>
      {card.formats && card.formats.length > 0 && (
        <div className="format-badges" aria-label="Formatos">
          {card.formats.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      )}
      <dl className="info-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
