import { useState } from "react";
import { cardImage } from "../db/images";
import { ACOES_LABEL, type Lado } from "../db/indicacoes";
import type { ItemIndicacao, ResultadoIndicacoes } from "../db/indicar";
import { passoEmTexto, type Passo } from "../db/motor";
import { displayName, type Card } from "../db/types";
import { LOCALE, t as tr } from "../i18n";

// Teste Avançado → "Indicações de resposta": a cada ação (de qualquer lado), o que o outro lado pode
// responder. Fica na coluna da direita, ao lado da mesa (não cobre cartas) e perto do histórico;
// passar o mouse numa carta mostra o texto dela no painel da esquerda.

export interface EntradaIndicacao {
  r: ResultadoIndicacoes;
  passo: Passo;
  lado: Lado;
}

/** Itens visíveis antes do "ver todas" */
const VISIVEIS = 6;

const pct = (x: number) => `${(x * 100).toLocaleString(LOCALE, { maximumFractionDigits: x < 0.1 ? 1 : 0 })}%`;
const ONDE: Record<NonNullable<ItemIndicacao["onde"]>, string> = { mao: tr("na mão"), campo: tr("no campo"), baixada: tr("baixada") };

function Item({ i, onHover }: { i: ItemIndicacao; onHover: (c: Card) => void }) {
  return (
    <li className={`tj-ind-item ${i.impedida ? "tj-ind-impedida" : ""}`} onMouseEnter={() => i.card && onHover(i.card)}>
      <img src={cardImage(i.id, "small")} alt="" loading="lazy" />
      <span>
        <strong>{i.card ? displayName(i.card) : `#${i.id}`}</strong>
        {i.onde && <span className="tj-ind-onde"> · {ONDE[i.onde]}</span>}
        <small className="tj-ind-motivo">{i.motivo}</small>
        {i.impedida && <small className="tj-ind-aviso">{tr("Agora não: {0}", [i.impedida])}</small>}
        {!i.impedida && i.condicao && <small className="tj-ind-cond">{i.condicao}</small>}
        <span className="tj-ind-selos">
          {i.uso > 0 && <span title={tr("Fração dos decklists de torneio que usam a carta")}>{tr("{0} dos decks", [pct(i.uso)])}</span>}
          {!!i.motor && <span title={tr("Confirmada pelo motor de regras nas linhas de combo calculadas")}>{tr("motor · {0}", [i.motor])}</span>}
          {(i.fonte === "texto" || i.fonte === "scripts") && <span title={tr("Indicação pelo texto ou pelos scripts da carta: confira")}>{tr("confira")}</span>}
        </span>
      </span>
    </li>
  );
}

function Lista({ titulo, itens, onHover, classe }: { titulo: string; itens: ItemIndicacao[]; onHover: (c: Card) => void; classe?: string }) {
  const [todas, setTodas] = useState(false);
  if (!itens.length) return null;
  const vis = todas ? itens : itens.slice(0, VISIVEIS);
  return (
    <div className={`tj-ind-grupo ${classe ?? ""}`}>
      <h5>
        {titulo} <span>({itens.length})</span>
      </h5>
      <ul>
        {vis.map((i) => (
          <Item key={`${i.id}-${i.onde ?? ""}`} i={i} onHover={onHover} />
        ))}
      </ul>
      {itens.length > VISIVEIS && (
        <button className="link-btn" onClick={() => setTodas(!todas)}>
          {todas ? tr("Mostrar menos") : tr("Ver todas ({0})", [itens.length])}
        </button>
      )}
    </div>
  );
}

export default function IndicacoesResposta({
  entradas,
  byId,
  invocacoes,
  onHover,
}: {
  entradas: EntradaIndicacao[];
  byId: Map<number, Card>;
  /** Invocações de cada lado neste turno (contador do Nibiru) */
  invocacoes: Record<Lado, number>;
  onHover: (c: Card) => void;
}) {
  const [pos, setPos] = useState(0);
  // nova ação: volta para a mais recente
  const [ultima, setUltima] = useState(entradas[0]);
  if (entradas[0] !== ultima) {
    setUltima(entradas[0]);
    setPos(0);
  }
  const e = entradas[Math.min(pos, entradas.length - 1)];
  const nome = (id: number) => (id === 0 ? "Token" : byId.get(id) ? displayName(byId.get(id)!) : `#${id}`);

  return (
    <section className="tj-ind" aria-label={tr("Indicações de resposta")} aria-live="polite">
      <div className="tj-ind-cab">
        <h4>{tr("Indicações de resposta")}</h4>
        {entradas.length > 1 && (
          <span className="tj-ind-nav">
            <button className="link-btn" disabled={pos >= entradas.length - 1} onClick={() => setPos(pos + 1)} aria-label={tr("Ação anterior")}>
              ‹
            </button>
            <small>
              {pos + 1}/{entradas.length}
            </small>
            <button className="link-btn" disabled={pos === 0} onClick={() => setPos(pos - 1)} aria-label={tr("Ação seguinte")}>
              ›
            </button>
          </span>
        )}
      </div>
      <p className="tj-ind-contador">
        {tr("Invocações neste turno: você {0} · oponente {1}", [invocacoes.eu, invocacoes.op])}{" "}<small>{tr("(Nibiru a partir de 5)")}</small>
      </p>
      {!e ? (
        <p className="tags-note">
          {tr("Jogue normalmente (ativar, invocar, mover). A cada ação, aparecem aqui as cartas que podem responder — as que o outro lado tem e as do meta.")}</p>
      ) : (
        <>
          <p className="tj-ind-acao">
            <span className={`tj-ind-quem tj-ind-${e.lado}`}>{e.lado === "eu" ? tr("Você") : tr("Oponente")}</span>{" "}
            {(() => {
              const t = passoEmTexto(e.passo, nome);
              return t.charAt(0).toUpperCase() + t.slice(1);
            })()}
            {e.r.analise.acoes.size > 0 && (
              <small className="tj-ind-faz" title={e.r.analise.efeitos.join("\n\n")}>
                {tr("O efeito {0}", [[...e.r.analise.acoes].filter((a) => a !== "invoca" || e.r.analise.acoes.size === 1).map((a) => ACOES_LABEL[a]).join(", ")])}
              </small>
            )}
          </p>
          <Lista titulo={e.lado === "eu" ? tr("O oponente tem") : tr("Você tem")} itens={e.r.noJogo} onHover={onHover} classe="tj-ind-tem" />
          <Lista titulo={tr("Podem responder (meta)")} itens={e.r.gerais} onHover={onHover} />
          <Lista titulo={tr("Outras usadas em torneios (confira)")} itens={e.r.outras} onHover={onHover} classe="tj-ind-outras" />
          {!e.r.noJogo.length && !e.r.gerais.length && !e.r.outras.length && <p className="tags-note">{tr("Nenhuma interrupção conhecida responde a esta ação.")}</p>}
        </>
      )}
    </section>
  );
}
