import { banNoFormato, papeisDa } from "../db/classificacao";
import { BAN_LABELS } from "../db/labels";
import type { GameFormat } from "../db/legality";
import type { Card } from "../db/types";
import "./selos.css";

/** Classificação por extenso (painel da carta) */
export function PapeisDaCarta({ card }: { card: Card }) {
  const papeis = papeisDa(card);
  if (!papeis.length) return null;
  return (
    <span className="papeis-da-carta">
      {papeis.map((p) => (
        <span key={p.id} className="selo-papel" style={{ background: p.cor }}>
          {p.label}
        </span>
      ))}
    </span>
  );
}

/**
 * Indicações sobre a imagem da carta, como na Buscar Carta: no canto de cima, a banlist do formato
 * (Proibida, Limitada, Semi-Limitada ou Não lançada); embaixo, as siglas da classificação
 * (Hand trap, Starter, Extender, Board breaker, Floodgate, Staple).
 */
export default function CardSelos({ card, formato }: { card: Card; formato: GameFormat }) {
  const ban = banNoFormato(card, formato);
  const papeis = papeisDa(card);
  return (
    <>
      {ban && (
        <span className={`selo-ban ban-${ban}`} title={ban === "fora" ? `Não lançada no ${formato}` : `${BAN_LABELS[ban]} no ${formato}`}>
          {ban === "fora" ? "Não lançada" : BAN_LABELS[ban]}
        </span>
      )}
      {papeis.length > 0 && (
        <span className="selo-papeis" title={papeis.map((p) => p.label).join(", ")}>
          {papeis.map((p) => (
            <span key={p.id} className="selo-papel" style={{ background: p.cor }}>
              {p.sigla}
            </span>
          ))}
        </span>
      )}
    </>
  );
}
