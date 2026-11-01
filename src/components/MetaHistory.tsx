import type { Overlay } from "../db/overlay";
import { FontesButton } from "./Fontes";
import { t, LOCALE } from "../i18n";

type Props = {
  archetype: string;
  meta: Overlay["meta"];
};

const pct = (share: number) => `${(share * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`;

/**
 * Participação do arquétipo nos decks colocados em torneios do OCG, por trimestre.
 * Uma série só: colunas de um tom, rótulos apenas no pico e no último trimestre,
 * tooltip em cada coluna e tabela equivalente para leitores de tela.
 */
export default function MetaHistory({ archetype, meta }: Props) {
  const tops = new Map(meta.porArquetipo[archetype] ?? []);
  if (tops.size === 0) return null;

  // da mais antiga para a mais recente (a camada vem com o trimestre atual primeiro)
  const points = [...meta.periodos].reverse().map((p) => {
    const n = tops.get(p.periodo) ?? 0;
    return { ...p, tops: n, share: n / p.total };
  });
  const peak = points.reduce((a, b) => (b.share > a.share ? b : a));
  const latest = points[points.length - 1];
  // escala até o pico (mínimo 5%), para valores pequenos continuarem visíveis
  const max = Math.max(peak.share, 0.05);

  return (
    <section className="drawer-section">
      <h4>{t("Metagame OCG · {0}", [archetype])}</h4>
      <p className="meta-summary">
        {t("Último trimestre:")}{" "}<strong>{pct(latest.share)}</strong> {" "}{t("dos decks colocados")}{peak.periodo !== latest.periodo && (
          <>
            {" "}{t("· pico de")}{" "}<strong>{pct(peak.share)}</strong> {" "}{t("em {0}", [peak.periodo])}
          </>
        )}
      </p>

      <div className="meta-chart" role="img" aria-label={t("Participação de {0} por trimestre no OCG", [archetype])}>
        {points.map((p) => {
          const label = p === peak || p === latest;
          return (
            <div key={p.periodo} className="meta-col" tabIndex={0}>
              <span className="meta-value">{label && p.share > 0 ? pct(p.share) : ""}</span>
              <span className="meta-track">
                <span className="meta-bar" style={{ height: `${(p.share / max) * 100}%` }} />
              </span>
              <span className="meta-period">{p.periodo.slice(2)}</span>
              <span className="meta-tip" role="tooltip">
                <strong>{t("OCG {0}", [p.periodo])}</strong>
                {t("{0} de {1} decks · {2}", [p.tops, p.total.toLocaleString(LOCALE), pct(p.share)])}
              </span>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{t("Participação de {0} no OCG por trimestre", [archetype])}</caption>
        <thead>
          <tr>
            <th>{t("Trimestre")}</th>
            <th>{t("Decks colocados")}</th>
            <th>{t("Participação")}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.periodo}>
              <td>{p.periodo}</td>
              <td>
                {t("{0} de {1}", [p.tops, p.total])}
              </td>
              <td>{pct(p.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <FontesButton
        className="meta-source"
        sites={["road-of-the-king"]}
        links={[{ nome: `Road of the King: OCG ${meta.periodos[0].periodo}`, url: meta.periodos[0].url }]}
      />
    </section>
  );
}
