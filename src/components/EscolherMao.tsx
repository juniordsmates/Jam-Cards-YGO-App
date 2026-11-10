import { t } from "../i18n";
import { displayName, type Card } from "../db/types";

/** cartas na mão inicial de quem joga primeiro (quem joga depois compra a 6ª no turno dele) */
export const TAMANHO_MAO = 5;

/**
 * "Escolher Cartas na Mão" (Simulador, Premium): até 5 cartas do Deck principal para a mão inicial.
 * `mao` null = Aleatório (a mão sai do Deck embaralhado); com menos de 5, o resto sai ao acaso.
 */
export default function EscolherMao({
  titulo,
  main,
  byId,
  mao,
  onChange,
}: {
  titulo: string;
  main: number[];
  byId: Map<number, Card>;
  mao: number[] | null;
  onChange: (mao: number[] | null) => void;
}) {
  const nome = (id: number) => (byId.get(id) ? displayName(byId.get(id)!) : `#${id}`);
  // cópias de cada carta no Deck que ainda não estão na mão
  const restam = new Map<number, number>();
  for (const c of main) restam.set(c, (restam.get(c) ?? 0) + 1);
  for (const c of mao ?? []) restam.set(c, (restam.get(c) ?? 0) - 1);
  const cheia = (mao?.length ?? 0) >= TAMANHO_MAO;

  return (
    <fieldset className="sim-campo escolher-mao">
      <legend className="field-label escolher-mao-titulo">
        <span>{titulo}</span>
        <label>
          <input type="checkbox" checked={mao === null} onChange={(e) => onChange(e.target.checked ? null : [])} /> {t("Aleatório")}
        </label>
      </legend>
      {mao !== null && (
        <>
          <div className="escolher-mao-cartas" aria-label={t("Mão escolhida")}>
            {mao.map((c, i) => (
              <button key={i} className="chip escolher-mao-na-mao" onClick={() => onChange(mao.filter((_, j) => j !== i))} title={t("Tirar da mão")}>
                {nome(c)} ×
              </button>
            ))}
            {mao.length < TAMANHO_MAO && <small className="tags-note">{t("+ {0} carta(s) do Deck ao acaso", [TAMANHO_MAO - mao.length])}</small>}
          </div>
          <div className="escolher-mao-cartas" aria-label={t("Cartas do Deck")}>
            {[...restam]
              .filter(([, n]) => n > 0)
              .map(([c, n]) => (
                <button key={c} className="chip" disabled={cheia} onClick={() => onChange([...mao, c])}>
                  {nome(c)}
                  {n > 1 ? ` (${n})` : ""}
                </button>
              ))}
          </div>
        </>
      )}
    </fieldset>
  );
}
