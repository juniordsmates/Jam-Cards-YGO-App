import type { ReactNode } from "react";
import { FontesButton } from "./Fontes";
import type { KnownCombo } from "../data/combos";
import { METODO_LABEL, moveText, origemText, respostasDaLinha, type CombosCalculados, type LinhaCombo, type Passo } from "../db/motor";
import { RESPOSTAS } from "../data/respostas";
import { displayName, type Card } from "../db/types";

type Hover = (card: Card | null, el?: HTMLElement) => void;

type Props = {
  title?: string;
  lines: LinhaCombo[];
  /** cartas a destacar: a linha mostra em que passo chega nelas */
  highlight?: number[];
  combos: CombosCalculados;
  byId: Map<number, Card>;
  known: Map<string, KnownCombo>;
  onHover: Hover;
  /** mostra em cada passo as interrupções de mão que o oponente poderia ativar */
  respostas?: boolean;
  /** a carta pode ser usada no formato escolhido (respostas proibidas não aparecem) */
  legal?: (id: number) => boolean;
};

/** Nome da carta em português, com o popup da carta ao passar o mouse (id 0 = Ficha) */
export function Name({ id, byId, onHover }: { id: number; byId: Map<number, Card>; onHover: Hover }) {
  if (id === 0) return <span className="kc-card">Ficha</span>;
  const card = byId.get(id);
  return (
    <span
      className="kc-card"
      onPointerEnter={(e) => card && e.pointerType === "mouse" && onHover(card, e.currentTarget)}
      onPointerLeave={() => onHover(null)}
    >
      {card ? displayName(card) : `#${id}`}
    </span>
  );
}

export const join = (nodes: ReactNode[], sep: string) => nodes.flatMap((n, i) => (i ? [sep, n] : [n]));

/** Texto de um passo (calculado pelo App, ou escrito pela comunidade/IA) */
export function StepText({ p, byId, onHover }: { p: Passo; byId: Map<number, Card>; onHover: Hover }) {
  const N = (id: number) => <Name key={id} id={id} byId={byId} onHover={onHover} />;
  switch (p.t) {
    case "normal":
      return <>Invocação-Normal de {N(p.c)}</>;
    case "baixa":
      return <>Baixa {N(p.c)}</>;
    case "ativa":
      return (
        <>
          Ativa {N(p.c)}
          {p.de === "mao" || p.de === "cemiterio" || p.de === "banido" ? ` ${origemText(p.de)}` : ""}
        </>
      );
    case "invoca":
      if (p.m)
        return (
          <>
            {METODO_LABEL[p.m]} de {N(p.c)}
            {p.mat?.length ? <> usando {join(p.mat.map((m, i) => <Name key={`${m}-${i}`} id={m} byId={byId} onHover={onHover} />), " + ")}</> : null}
          </>
        );
      return (
        <>
          Invocação-Especial de {N(p.c)} {origemText(p.de)}
          {p.por === p.c ? " (pelo próprio efeito)" : ""}
        </>
      );
    case "move": {
      const [verb, rest] = moveText(p.de, p.para);
      return (
        <>
          {verb[0].toUpperCase() + verb.slice(1)} {N(p.c)} {rest}
        </>
      );
    }
    case "compra":
      return <>Compra {join(p.c.map((c, i) => <Name key={`${c}-${i}`} id={c} byId={byId} onHover={onHover} />), ", ")}</>;
    case "texto":
      return (
        <>
          {p.texto}
          {p.c.length > 0 && (
            <span className="vc-step-cards">
              {" "}
              ({join(p.c.map((c, i) => <Name key={`${c}-${i}`} id={c} byId={byId} onHover={onHover} />), ", ")})
            </span>
          )}
        </>
      );
  }
}

/** O passo envolve alguma das cartas? */
export function stepHas(p: Passo, ids: Set<number>) {
  if (p.t === "compra" || p.t === "texto") return p.c.some((c) => ids.has(c));
  return ids.has(p.c);
}

/** Agrupa as consequências da resolução de um efeito sob o passo anterior (numeração só nos passos) */
export function groupSteps(passos: Passo[]) {
  const groups: { step: Passo; subs: Passo[] }[] = [];
  for (const p of passos) {
    const sub = "por" in p && p.por !== undefined && p.por !== p.c;
    if (sub && groups.length) groups[groups.length - 1].subs.push(p);
    else groups.push({ step: p, subs: [] });
  }
  return groups;
}

/** Interrupções do oponente que poderiam ser ativadas neste ponto, com o que cada uma faz */
export function Respostas({ ids, byId, onHover, rotulo = "Pode ser respondido por" }: { ids: number[]; byId: Map<number, Card>; onHover: Hover; rotulo?: string }) {
  if (!ids.length) return null;
  return (
    <span className="vc-resp">
      <span className="vc-resp-label">↯ {rotulo}:</span>{" "}
      {join(
        ids.map((id) => (
          <span key={id} title={RESPOSTAS[byId.get(id)?.name ?? ""] ?? undefined}>
            <Name id={id} byId={byId} onHover={onHover} />
          </span>
        )),
        ", ",
      )}
    </span>
  );
}

/** Linhas de combo jogadas pelo motor de regras do EDOPro para a mão escolhida */
export default function VerifiedCombos({ title = "Combos calculados", lines, highlight = [], combos, byId, known, onHover, respostas = false, legal = () => true }: Props) {
  if (!lines.length) return null;
  const hits = new Set(highlight);
  return (
    <section className="known-combos verified-combos" aria-label={title}>
      <h4>
        {title} ({lines.length})
      </h4>
      {lines.map((l, idx) => {
        const deck = combos.decks[l.deck];
        const community = l.comunidade ? known.get(l.comunidade) : undefined;
        const top = l.campo.monstros.slice(0, 3);
        const groups = groupSteps(l.passos);
        // primeiro passo em que a linha chega a uma carta destacada
        const firstHit = hits.size ? groups.findIndex((g) => stepHas(g.step, hits) || g.subs.some((p) => stepHas(p, hits))) : -1;
        // respostas: as de quase toda a linha ficam no topo; em cada passo, só as que ele abre
        const resp = respostasDaLinha(l);
        const doPasso = (p: Passo) => (respostas ? resp.porPasso(p).filter(legal) : []);
        const sempre = respostas ? [...resp.sempre].filter(legal) : [];
        return (
          <details key={`${l.deck}-${idx}`} className="kc vc" open={idx === 0}>
            <summary>
              <span className="kc-title">
                {top.length ? join(top.map((id) => <Name key={id} id={id} byId={byId} onHover={onHover} />), " · ") : "Campo de Magias e Armadilhas"}
                {l.campo.monstros.length > 3 && ` +${l.campo.monstros.length - 3}`}
              </span>
              <span className="kc-hand">
                Mão: {join(l.mao.map((id) => <Name key={id} id={id} byId={byId} onHover={onHover} />), " + ")}
                {l.qualquer ? ` + ${l.qualquer} carta qualquer (para descarte)` : ""}
                {l.ramo?.length ? <> · adicionando {join(l.ramo.map((id) => <Name key={id} id={id} byId={byId} onHover={onHover} />), " + ")}</> : null}
              </span>
              {firstHit >= 0 && (
                <span className="vc-reach">
                  Chega em {join(highlight.filter((id) => l.passos.some((p) => stepHas(p, new Set([id])))).map((id) => <Name key={id} id={id} byId={byId} onHover={onHover} />), ", ")} no passo{" "}
                  {firstHit + 1}; os passos seguintes continuam a partir dela.
                </span>
              )}
              <span className="vc-badge" title="Linha jogada pelo App com as regras oficiais das cartas: custos, condições, travas e limites aplicados">
                Calculado com o App
              </span>
            </summary>

            {community && (
              <p className="vc-community">
                Confirma a linha da comunidade “{community.titulo}”.
              </p>
            )}

            {sempre.length > 0 && (
              <p className="vc-resp-sempre">
                <Respostas ids={sempre} byId={byId} onHover={onHover} rotulo="Em quase toda a linha, o oponente pode ativar" />
              </p>
            )}

            <ol className="kc-steps vc-steps">
              {groups.map(({ step, subs }, i) => (
                <li key={i} className={firstHit >= 0 && (stepHas(step, hits) || subs.some((p) => stepHas(p, hits))) ? "vc-hit" : undefined}>
                  <StepText p={step} byId={byId} onHover={onHover} />
                  <Respostas ids={doPasso(step)} byId={byId} onHover={onHover} />
                  {subs.length > 0 && (
                    <ul className="vc-subs">
                      {subs.map((p, j) => (
                        <li key={j}>
                          <StepText p={p} byId={byId} onHover={onHover} />
                          <Respostas ids={doPasso(p)} byId={byId} onHover={onHover} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>

            <div className="kc-board">
              <span className="field-label">Campo final</span>
              <span className="kc-board-cards">
                {l.campo.monstros.map((id, i) => (
                  <Name key={`m${id}-${i}`} id={id} byId={byId} onHover={onHover} />
                ))}
                {l.campo.magias.map(([id, set], i) => (
                  <span key={`s${id}-${i}`} className="vc-spell">
                    <Name id={id} byId={byId} onHover={onHover} />
                    {set && <small> (baixada)</small>}
                  </span>
                ))}
              </span>
            </div>
            {l.campo.mao.length > 0 && (
              <div className="kc-board">
                <span className="field-label">Na mão</span>
                <span className="kc-board-cards">
                  {l.campo.mao.map((id, i) => (
                    <Name key={`h${id}-${i}`} id={id} byId={byId} onHover={onHover} />
                  ))}
                </span>
              </div>
            )}
            <p className="tags-note">
              Deck {deck.nome}
              {deck.evento && ` (${deck.evento})`}. Jogado pelo App no primeiro turno, com o oponente passando; vale em todo formato
              em que as cartas da linha existem e não são proibidas.{" "}
              <FontesButton
                sites={["ygoprodeck", "project-ignis"]}
                links={[
                  { nome: `Deck: ${deck.nome}`, url: deck.url },
                  ...(community?.fontes ?? []).filter((f) => f.url).map((f) => ({ nome: f.nome, url: f.url! })),
                ]}
              />
            </p>
          </details>
        );
      })}
    </section>
  );
}
