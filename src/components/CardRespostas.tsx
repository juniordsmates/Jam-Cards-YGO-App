import { useMemo } from "react";
import { openRespostas } from "./RespostasDialog";
import { indiceDeRespostas, ordenarRespostas, TIPOS, useContextoRespostas, type Contagem } from "../db/respostas";
import { useCardDb } from "../db/cardStore";
import { displayName, type Card } from "../db/types";
import { t } from "../i18n";

/** Registros por lista no painel; o "+" abre a lista completa */
const MAX_PAINEL = 15;

export default function CardRespostas({ card, byId, onOpen }: { card: Card; byId: Map<number, Card>; onOpen: (card: Card) => void }) {
  const combos = useCardDb().extras?.combos;
  const ctx = useContextoRespostas(byId);
  const indice = useMemo(() => (combos ? indiceDeRespostas(combos) : null), [combos]);
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
                · {n} {n === 1 ? t("linha") : t("linhas")}
              </small>
            </li>
          );
        })}
        {ordenadas.length > MAX_PAINEL && (
          <li>
            <button className="link-btn vc-resp-mais" onClick={() => openRespostas({ titulo, ids: ordenadas.map((r) => r.id), byId })}>
              {t("+{0} (ver todas)", [ordenadas.length - MAX_PAINEL])}</button>
          </li>
        )}
      </ul>
    );
  };

  return (
    <section className="drawer-section respostas-section">
      <h4>{t("Respostas")}</h4>
      {aoAtivar.size > 0 && (
        <>
          <p className="tags-note">{t("Quando esta carta ativa um efeito, o oponente pode responder com:")}</p>
          {lista(aoAtivar, t("Respostas quando {0} ativa um efeito", [displayName(card)]), true)}
        </>
      )}
      {aoInvocar.size > 0 && (
        <>
          <p className="tags-note">{t("Quando esta carta é Invocada:")}</p>
          {lista(aoInvocar, t("Respostas quando {0} é Invocada", [displayName(card)]), true)}
        </>
      )}
      {responde.size > 0 && (
        <>
          <p className="tags-note">{t("Esta carta pode responder a:")}</p>
          {lista(responde, t("{0} pode responder a", [displayName(card)]), false)}
        </>
      )}
      <p className="tags-note">
        {t("Calculado com o App: nas linhas de combo calculadas, com todas as cartas ativáveis da mão na mão do oponente.")}</p>
    </section>
  );
}
