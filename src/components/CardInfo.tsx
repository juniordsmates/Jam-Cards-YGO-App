import type { ReactNode } from "react";
import type { Card } from "../db/types";
import { t, LOCALE } from "../i18n";

type Props = {
  card: Card;
  /** pontos no formato Genesys (só cartas com pontos) */
  genesysPoints?: number;
  onTreatedAs?: (name: string) => void;
};

const date = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(LOCALE) : undefined);
const fmt = (n: number) => n.toLocaleString(LOCALE);

const MD_RARITY: Record<string, string> = {
  Common: t("Normal (N)"),
  Rare: t("Rara (R)"),
  "Super Rare": t("Super Rara (SR)"),
  "Ultra Rare": t("Ultra Rara (UR)"),
};

/** Dados de catálogo: lançamento, formatos, raridade no Master Duel, popularidade… */
export default function CardInfo({ card, genesysPoints, onTreatedAs }: Props) {
  const rows: [string, ReactNode][] = [];
  if (card.tcgDate) rows.push([t("Lançamento TCG"), date(card.tcgDate)]);
  if (card.ocgDate) rows.push([t("Lançamento OCG"), date(card.ocgDate)]);
  if (card.mdRarity) rows.push([t("Raridade no Master Duel"), MD_RARITY[card.mdRarity] ?? card.mdRarity]);
  if (genesysPoints) rows.push([t("Pontos no Genesys"), fmt(genesysPoints)]);
  if (card.views) rows.push([t("Visualizações na YGOPRODeck"), fmt(card.views)]);
  if (card.treatedAs) {
    rows.push([
      t("Tratada como"),
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
      <h4>{t("Informações")}</h4>
      {card.formats && card.formats.length > 0 && (
        <div className="format-badges" aria-label={t("Formatos")}>
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
