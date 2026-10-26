import type { Overlay } from "../db/overlay";
import { FontesButton } from "./Fontes";

type Props = {
  archetype: string;
  meta: Overlay["meta"];
};

const pct = (share: number) => `${(share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

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
      <h4>Metagame OCG · {archetype}</h4>
      <p className="meta-summary">
        Último trimestre: <strong>{pct(latest.share)}</strong> dos decks colocados
        {peak.periodo !== latest.periodo && (
          <>
            {" "}· pico de <strong>{pct(peak.share)}</strong> em {peak.periodo}
          </>
        )}
      </p>

      <div className="meta-chart" role="img" aria-label={`Participação de ${archetype} por trimestre no OCG`}>
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
                <strong>OCG {p.periodo}</strong>
                {p.tops} de {p.total.toLocaleString("pt-BR")} decks · {pct(p.share)}
              </span>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>Participação de {archetype} no OCG por trimestre</caption>
        <thead>
          <tr>
            <th>Trimestre</th>
            <th>Decks colocados</th>
            <th>Participação</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.periodo}>
              <td>{p.periodo}</td>
              <td>
                {p.tops} de {p.total}
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
