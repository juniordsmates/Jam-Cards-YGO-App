import type { ComboStep, KnownCombo } from "../data/combos";
import { FontesButton } from "./Fontes";
import { legalIn, type GameFormat } from "../db/legality";
import { displayName, type Card } from "../db/types";

type Props = {
  title?: string;
  combos: KnownCombo[];
  byName: Map<string, Card>;
  format: GameFormat;
  onHover: (card: Card | null, el?: HTMLElement) => void;
};

/** Nome da carta em português, com o popup da carta ao passar o mouse */
function CardName({ name, byName, onHover }: { name: string; byName: Map<string, Card>; onHover: Props["onHover"] }) {
  const card = byName.get(name);
  return (
    <span
      className="kc-card"
      onPointerEnter={(e) => card && e.pointerType === "mouse" && onHover(card, e.currentTarget)}
      onPointerLeave={() => onHover(null)}
    >
      {card ? displayName(card) : name}
    </span>
  );
}

function Steps({ steps, byName, onHover, start = 1 }: { steps: ComboStep[]; byName: Map<string, Card>; onHover: Props["onHover"]; start?: number }) {
  return (
    <ol className="kc-steps" start={start}>
      {steps.map((s, i) => (
        <li key={i}>
          {s.card && <CardName name={s.card} byName={byName} onHover={onHover} />}
          <span className="kc-action">{s.acao}</span>
          {s.resultado && (
            <span className="kc-result">
              →{" "}
              {s.resultado.map((r, j) => (
                <span key={r}>
                  {j > 0 && " ou "}
                  <CardName name={r} byName={byName} onHover={onHover} />
                </span>
              ))}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Linhas de combo escritas pela comunidade (a tela só mostra as que o motor confirmou) */
export default function KnownCombos({ title = "Combos conhecidos", combos, byName, format, onHover }: Props) {
  if (!combos.length) return null;
  return (
    <section className="known-combos" aria-label={title}>
      <h4>
        {title} ({combos.length})
      </h4>
      {combos.map((c) => {
        // cartas da linha que não podem ser usadas no formato escolhido
        const names = new Set([
          ...c.passos.flatMap((s) => [s.card, ...(s.resultado ?? [])]),
          ...c.campoFinal,
        ].filter(Boolean) as string[]);
        const blocked = [...names].map((n) => byName.get(n)).filter((card): card is Card => !!card && !legalIn(card, format));
        return (
          <details key={c.id} className="kc">
            <summary>
              <span className="kc-title">{c.titulo}</span>
              <span className="kc-hand">
                Mão: {c.mao.map((n) => displayName(byName.get(n) ?? ({ name: n } as Card))).join(" + ")}
                {c.maoExtra && ` (${c.maoExtra})`}
              </span>
            </summary>
            {blocked.length > 0 && (
              <p className="db-warning">
                No {format}, não pode usar: {blocked.map((b) => displayName(b)).join(", ")}.
              </p>
            )}
            <Steps steps={c.passos} byName={byName} onHover={onHover} />

            {c.ramificacoes?.map((b) => (
              <details key={b.titulo} className="kc-branch">
                <summary>
                  Ramificação a partir do passo {b.aPartirDoPasso}: {b.titulo}
                </summary>
                <Steps steps={b.passos} byName={byName} onHover={onHover} start={b.aPartirDoPasso} />
              </details>
            ))}

            {c.turnoOponente && (
              <details className="kc-branch">
                <summary>Turno do oponente</summary>
                <Steps steps={c.turnoOponente} byName={byName} onHover={onHover} />
              </details>
            )}

            <div className="kc-board">
              <span className="field-label">Campo final</span>
              <span className="kc-board-cards">
                {c.campoFinal.map((n) => (
                  <CardName key={n} name={n} byName={byName} onHover={onHover} />
                ))}
              </span>
            </div>
            <p className="tags-note">
              <FontesButton links={c.fontes.filter((f) => f.url).map((f) => ({ nome: f.nome, url: f.url! }))} />
            </p>
          </details>
        );
      })}
    </section>
  );
}
