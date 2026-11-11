// Modo de Treino: interações possíveis com a carta em foco (o que responde aos efeitos dela, à Invocação
// e a ela parada no campo), em três grupos: as principais do meta atual, as comuns nas listas dos
// principais decks e as outras. Mesma fonte das "Cartas respostas" do Buscar Carta (src/db/indicar.ts).
import { useMemo, useState } from "react";
import { useCardDb } from "../db/cardStore";
import { respostasDaCarta, type ItemIndicacao } from "../db/indicar";
import { indiceDeRespostas, nivelMeta, pesoNoMeta } from "../db/respostas";
import { legalIn } from "../db/legality";
import { displayName, type Card } from "../db/types";
import { LOCALE, t } from "../i18n";

/** cartas visíveis por grupo antes do "ver todas" */
const VISIVEIS = 6;

const GRUPOS = [t("Principais do meta atual"), t("Comuns nas listas dos principais decks"), t("Outras")];

const pct = (x: number) => `${(x * 100).toLocaleString(LOCALE, { maximumFractionDigits: x < 0.1 ? 1 : 0 })}%`;

interface Props {
  card: Card;
  byId: Map<number, Card>;
}

export default function InteracoesCarta({ card, byId }: Props) {
  const db = useCardDb();
  const extras = db.extras;
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);
  const indice = useMemo(() => (extras?.combos ? indiceDeRespostas(extras.combos) : null), [extras?.combos]);
  const [todas, setTodas] = useState<number | null>(null);

  const grupos = useMemo(() => {
    const efeitos = respostasDaCarta(card, {
      byId,
      byName,
      uso: extras?.uso,
      respondedores: extras?.respondedores,
      indice,
      legal: (c) => legalIn(c, "TCG") || legalIn(c, "OCG"),
    });
    // cada carta uma vez, com o motivo do primeiro efeito em que aparece
    const itens = new Map<number, ItemIndicacao>();
    for (const g of efeitos) for (const i of g.itens) if (!itens.has(i.id)) itens.set(i.id, i);
    const peso = pesoNoMeta(extras?.metaTcg);
    const out: ItemIndicacao[][] = [[], [], []];
    for (const i of itens.values()) out[nivelMeta(i.id, peso, extras?.uso)].push(i);
    for (const g of out) g.sort((a, b) => (peso.get(b.id) ?? 0) - (peso.get(a.id) ?? 0) || b.uso - a.uso);
    return out;
  }, [card, byId, byName, extras?.uso, extras?.respondedores, extras?.metaTcg, indice]);

  if (!grupos.some((g) => g.length)) return <p className="tags-note">{t("Nenhuma interação conhecida com esta carta.")}</p>;
  return (
    <section className="treino-interacoes" aria-label={t("Interações possíveis")}>
      <h4>{t("Interações possíveis")}</h4>
      {grupos.map((g, n) =>
        g.length ? (
          <div key={n} className="treino-grupo">
            <strong>{GRUPOS[n]}</strong>
            <ul>
              {(todas === n ? g : g.slice(0, VISIVEIS)).map((i) => (
                <li key={i.id}>
                  <span>{i.card ? displayName(i.card) : `#${i.id}`}</span>
                  <small>
                    {i.motivo}
                    {i.uso > 0 && ` · ${t("em {0} dos decks", [pct(i.uso)])}`}
                  </small>
                </li>
              ))}
            </ul>
            {g.length > VISIVEIS && (
              <button className="link-btn" onClick={() => setTodas(todas === n ? null : n)}>
                {todas === n ? t("Mostrar menos") : t("Ver todas ({0})", [g.length])}
              </button>
            )}
          </div>
        ) : null,
      )}
    </section>
  );
}
