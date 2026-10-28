import { useMemo } from "react";
import { openRespostas } from "./RespostasDialog";
import { ordenarRespostas, TIPOS, useContextoRespostas } from "../db/respostas";
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

/** Registros por lista no painel; o "+" abre a lista completa */
const MAX_PAINEL = 15;

export default function CardRespostas({ card, byId, onOpen }: { card: Card; byId: Map<number, Card>; onOpen: (card: Card) => void }) {
  const combos = useCardDb().extras?.combos;
  const ctx = useContextoRespostas(byId);
  const indice = useMemo(() => (combos ? indiceDe(combos) : null), [combos]);
  if (!indice) return null;

  const contagem = (m: Map<number, Contagem>) => m.get(card.id) ?? new Map<number, number>();
  const aoAtivar = contagem(indice.aoAtivar);
  const aoInvocar = contagem(indice.aoInvocar);
  const responde = contagem(indice.responde);
  if (!aoAtivar.size && !aoInvocar.size && !responde.size) return null;

  const nome = (c: Card | undefined, id: number) =>
    c ? (
      <button className="link-btn" onClick={() => onOpen(c)}>
        {displayName(c)}
      </button>
    ) : (
      <span>#{id}</span>
    );
  // mesma ordem do combo: mais usadas em torneios, hand trap e staple, hand trap, staple, outras
  const lista = (c: Contagem, titulo: string, comUso: boolean) => {
    const ordenadas = ordenarRespostas([...c.keys()], ctx);
    return (
      <ul className="respostas-lista">
        {ordenadas.slice(0, MAX_PAINEL).map((r) => {
          const n = c.get(r.id) ?? 0;
          return (
            <li key={r.id}>
              {nome(r.card, r.id)}
              {comUso && (r.descricao || r.tipos.length) && <small> — {r.descricao ?? r.tipos.map((t) => TIPOS[t] ?? t).join(", ")}</small>}
              <small className="respostas-n">
                {" "}
                · {n} {n === 1 ? "linha" : "linhas"}
              </small>
            </li>
          );
        })}
        {ordenadas.length > MAX_PAINEL && (
          <li>
            <button className="link-btn vc-resp-mais" onClick={() => openRespostas({ titulo, ids: ordenadas.map((r) => r.id), byId })}>
              +{ordenadas.length - MAX_PAINEL} (ver todas)
            </button>
          </li>
        )}
      </ul>
    );
  };

  return (
    <section className="drawer-section respostas-section">
      <h4>Respostas</h4>
      {aoAtivar.size > 0 && (
        <>
          <p className="tags-note">Quando esta carta ativa um efeito, o oponente pode responder com:</p>
          {lista(aoAtivar, `Respostas quando ${displayName(card)} ativa um efeito`, true)}
        </>
      )}
      {aoInvocar.size > 0 && (
        <>
          <p className="tags-note">Quando esta carta é Invocada:</p>
          {lista(aoInvocar, `Respostas quando ${displayName(card)} é Invocada`, true)}
        </>
      )}
      {responde.size > 0 && (
        <>
          <p className="tags-note">Esta carta pode responder a:</p>
          {lista(responde, `${displayName(card)} pode responder a`, false)}
        </>
      )}
      <p className="tags-note">
        Calculado com o App: nas linhas de combo calculadas, com todas as cartas ativáveis da mão na mão do oponente.
      </p>
    </section>
  );
}
