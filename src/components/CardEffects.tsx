import type { ReactNode } from "react";
import { EFFECT_KIND_LABELS, isActivated, type CardReading, type ParsedEffect } from "../db/effects";
import { t } from "../i18n";

type Props = {
  reading: CardReading;
  /** versão do popup: só selos + frase, sem as linhas condição/custo/efeito */
  compact?: boolean;
  /** conteúdo extra embaixo de cada efeito (ex.: cartas que ele invoca), pelo índice do efeito */
  renderExtra?: (effectIndex: number) => ReactNode;
};

function Badges({ e }: { e: ParsedEffect }) {
  return (
    <div className="effect-badges">
      <span className={`kind kind-${e.kind}`}>{EFFECT_KIND_LABELS[e.kind]}</span>
      {e.section && <span>{e.section}</span>}
      {e.zone && <span>{t(e.zone)}</span>}
      {e.optional !== undefined && <span>{e.optional ? t("Opcional") : t("Obrigatório")}</span>}
      {e.opt && <span className="opt">{e.opt === "hard" ? t("1x por turno (hard)") : t("1x por turno")}</span>}
      {e.duration && <span>{e.duration}</span>}
    </div>
  );
}

function costTargetLabel(e: ParsedEffect) {
  if (e.hasCost && e.hasTarget) return t("Custo e alvo");
  if (e.hasTarget) return "Alvo";
  return "Custo";
}

/** Resumo de uma linha: "2 efeitos ativados: Efeito Rápido (Mão), Gatilho (Campo)" */
export function readingSummary(reading: CardReading) {
  const active = reading.effects.filter(isActivated);
  if (active.length === 0) return null;
  const parts = active.map((e) => `${EFFECT_KIND_LABELS[e.kind]}${e.zone ? ` (${t(e.zone)})` : ""}`);
  return `${active.length} ${active.length === 1 ? t("efeito ativado") : t("efeitos ativados")}: ${parts.join(", ")}`;
}

export default function CardEffects({ reading, compact, renderExtra }: Props) {
  // Restrições "1x por turno" já aparecem como selo no efeito; no popup, escondê-las economiza espaço
  const effects = compact ? reading.effects.filter((e) => e.kind !== "restricao") : reading.effects;

  return (
    <ol className={`effects ${compact ? "compact" : ""}`}>
      {effects.map((e, i) => (
        <li key={i} className={`effect effect-${e.kind}`}>
          <Badges e={e} />
          {compact || !isActivated(e) ? (
            <p className="effect-text">{e.text}</p>
          ) : (
            <dl className="effect-parts">
              {e.condition && (
                <div>
                  <dt>{t("Condição")}</dt>
                  <dd>{e.condition}</dd>
                </div>
              )}
              {e.costTarget && (
                <div>
                  <dt>{costTargetLabel(e)}</dt>
                  <dd>{e.costTarget}</dd>
                </div>
              )}
              {e.resolution && (
                <div>
                  <dt>{t("Efeito")}</dt>
                  <dd>{e.resolution}</dd>
                </div>
              )}
            </dl>
          )}
          {e.bullets && (
            <ul className="effect-bullets">
              {e.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {!compact && renderExtra?.(i)}
        </li>
      ))}
    </ol>
  );
}
