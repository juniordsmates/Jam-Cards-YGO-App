import { t } from "../i18n";
import { ehExtra } from "../db/decks";
import { displayName, type Card } from "../db/types";
import { moverCarta, sideValido, type DeckCompleto, type ParteDeck } from "../sim/match";

/**
 * Troca de side entre os jogos de uma match: clicar numa carta do Main ou do Extra manda uma cópia
 * para o Side; clicar numa carta do Side a devolve (ao Extra ou ao Main). "Pronto" só vale com as
 * três partes do mesmo tamanho do deck original.
 */
export default function SideDeck({
  original,
  deck,
  byId,
  onChange,
}: {
  original: DeckCompleto;
  deck: DeckCompleto;
  byId: Map<number, Card>;
  onChange: (deck: DeckCompleto) => void;
}) {
  const nome = (id: number) => (byId.get(id) ? displayName(byId.get(id)!) : `#${id}`);
  const doExtra = (id: number) => {
    const c = byId.get(id);
    return !!c && ehExtra(c);
  };
  const valido = sideValido(original, deck);

  const parte = (p: ParteDeck, titulo: string) => {
    // uma linha por carta, com as cópias juntas
    const copias = new Map<number, number>();
    for (const c of deck[p]) copias.set(c, (copias.get(c) ?? 0) + 1);
    const certo = deck[p].length === original[p].length;
    return (
      <fieldset className="sim-campo escolher-mao">
        <legend className="field-label escolher-mao-titulo">
          <span>{titulo}</span>
          <small className={certo ? "tags-note" : "conta-erro"}>
            {deck[p].length}/{original[p].length}
          </small>
        </legend>
        <div className="escolher-mao-cartas">
          {[...copias].map(([c, n]) => (
            <button
              key={c}
              className="chip"
              title={p === "side" ? t("Voltar para o deck") : t("Mandar para o Side")}
              onClick={() => onChange(moverCarta(deck, p, deck[p].indexOf(c), doExtra))}
            >
              {nome(c)}
              {n > 1 ? ` ×${n}` : ""}
            </button>
          ))}
          {!deck[p].length && <small className="tags-note">{t("Vazio")}</small>}
        </div>
      </fieldset>
    );
  };

  return (
    <div className="sim-side">
      <small className="tags-note">
        {t("Clique numa carta do Main ou do Extra para mandá-la ao Side e numa do Side para trazê-la de volta. A troca é carta por carta: Main, Extra e Side terminam com o mesmo número de cartas do deck original.")}
      </small>
      {parte("main", t("Main Deck"))}
      {parte("extra", t("Extra Deck"))}
      {parte("side", t("Side Deck"))}
      <div className="sim-niveis">
        <button className="ghost-btn" onClick={() => onChange({ main: [...original.main], extra: [...original.extra], side: [...original.side] })}>
          {t("Restaurar deck original")}
        </button>
      </div>
      {!valido && <p className="conta-erro">{t("Ajuste as trocas: cada parte precisa ter o mesmo número de cartas do deck original.")}</p>}
    </div>
  );
}
