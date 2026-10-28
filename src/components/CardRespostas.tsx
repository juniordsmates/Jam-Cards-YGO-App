import { useMemo } from "react";
import { RESPOSTAS } from "../data/respostas";
import { useCardDb } from "../db/cardStore";
import { respostasDaLinha, uniqueLines, type CombosCalculados } from "../db/motor";
import { displayName, type Card } from "../db/types";

type Contagem = Map<number, number>;

interface Indice {
  /** carta → quem pode responder quando ela ativa / é invocada (nº de linhas) */
  aoAtivar: Map<number, Contagem>;
  aoInvocar: Map<number, Contagem>;
  /** interrupção → cartas que ela pode responder (nº de linhas) */
  responde: Map<number, Contagem>;
}

let cache: { combos: CombosCalculados; indice: Indice } | undefined;

/** Índice das respostas em todas as linhas calculadas (montado uma vez por camada) */
function indiceDe(combos: CombosCalculados): Indice {
  if (cache?.combos === combos) return cache.indice;
  const indice: Indice = { aoAtivar: new Map(), aoInvocar: new Map(), responde: new Map() };
  const somar = (m: Map<number, Contagem>, a: number, b: number) => {
    const c = m.get(a) ?? new Map<number, number>();
    c.set(b, (c.get(b) ?? 0) + 1);
    m.set(a, c);
  };
  for (const l of uniqueLines(combos.linhas)) {
    const { porPasso } = respostasDaLinha(l);
    // cada par (carta, resposta) conta uma vez por linha
    const vistos = new Set<string>();
    for (const p of l.passos) {
      if (p.t !== "ativa" && p.t !== "normal" && p.t !== "invoca") continue;
      for (const r of porPasso(p)) {
        const key = `${p.t === "ativa" ? "a" : "i"}:${p.c}:${r}`;
        if (vistos.has(key)) continue;
        vistos.add(key);
        somar(p.t === "ativa" ? indice.aoAtivar : indice.aoInvocar, p.c, r);
        somar(indice.responde, r, p.c);
      }
    }
  }
  cache = { combos, indice };
  return indice;
}

const ordenar = (c?: Contagem) => [...(c ?? new Map<number, number>())].sort((a, b) => b[1] - a[1]);

/**
 * Respostas calculadas com o App: quem pode responder a esta carta nas linhas calculadas e, se ela
 * for uma interrupção de mão, a que ela pode responder.
 */
export default function CardRespostas({ card, byId, onOpen }: { card: Card; byId: Map<number, Card>; onOpen: (card: Card) => void }) {
  const combos = useCardDb().extras?.combos;
  const indice = useMemo(() => (combos ? indiceDe(combos) : null), [combos]);
  if (!indice) return null;

  const aoAtivar = ordenar(indice.aoAtivar.get(card.id));
  const aoInvocar = ordenar(indice.aoInvocar.get(card.id));
  const responde = ordenar(indice.responde.get(card.id));
  if (!aoAtivar.length && !aoInvocar.length && !responde.length) return null;

  const nome = (id: number) => {
    const c = byId.get(id);
    return c ? (
      <button className="link-btn" onClick={() => onOpen(c)} title={RESPOSTAS[c.name]}>
        {displayName(c)}
      </button>
    ) : (
      <span>#{id}</span>
    );
  };
  const lista = (itens: [number, number][], comUso: boolean) => (
    <ul className="respostas-lista">
      {itens.slice(0, 12).map(([id, n]) => (
        <li key={id}>
          {nome(id)}
          {comUso && RESPOSTAS[byId.get(id)?.name ?? ""] && <small> — {RESPOSTAS[byId.get(id)!.name]}</small>}
          <small className="respostas-n">
            {" "}
            · {n} {n === 1 ? "linha" : "linhas"}
          </small>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="drawer-section respostas-section">
      <h4>Respostas</h4>
      {aoAtivar.length > 0 && (
        <>
          <p className="tags-note">Quando esta carta ativa um efeito, o oponente pode responder com:</p>
          {lista(aoAtivar, true)}
        </>
      )}
      {aoInvocar.length > 0 && (
        <>
          <p className="tags-note">Quando esta carta é Invocada:</p>
          {lista(aoInvocar, true)}
        </>
      )}
      {responde.length > 0 && (
        <>
          <p className="tags-note">Esta carta pode responder a:</p>
          {lista(responde, false)}
        </>
      )}
      <p className="tags-note">
        Calculado com o App: nas linhas de combo calculadas, com as interrupções de mão mais usadas na mão do oponente.
      </p>
    </section>
  );
}
