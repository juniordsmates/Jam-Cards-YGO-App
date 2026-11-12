// Guia de combo (Teste de Jogo e Modo de Treino): a janela "Combos" (escolher uma linha do deck) e o
// painel abaixo da carta, com os passos do combo, as interações esperadas em cada passo e as
// probabilidades (src/db/guiaCombo.ts).
import { useState } from "react";
import type { Card } from "../db/types";
import type { LinhaCombo } from "../db/motor";
import { passoEmTexto } from "../db/motor";
import { passosDaLinha, respostasNoPasso, type AvaliacaoGuia, type EstadoGuia, type GrupoCombos } from "../db/guiaCombo";
import { Respostas } from "./VerifiedCombos";
import { LOCALE, t } from "../i18n";

type Hover = (card: Card | null, el?: HTMLElement) => void;

/** linhas por arquétipo na janela (as de mais pontos primeiro) */
const MAX_POR_GRUPO = 20;

const NIVEL: Record<AvaliacaoGuia["atual"], string> = {
  "Muito Alta": t("Muito Alta"),
  Alta: t("Alta"),
  Média: t("Média"),
  Baixa: t("Baixa"),
  "Muito Baixa": t("Muito Baixa"),
  Nula: t("Nula"),
};

/** Janela "Combos": as linhas do deck por arquétipo; o jogador marca uma e confirma */
export function EscolherCombo({
  grupos,
  nomeDe,
  descricao = t("Combos dos arquétipos deste deck (calculados com as regras das cartas). Escolha um: a mão inicial dele vem para a mão e o painel abaixo da carta acompanha os passos."),
  onEscolher,
  onFechar,
}: {
  grupos: GrupoCombos[];
  nomeDe: (id: number) => string;
  /** o que acontece ao escolher (no Simulador, a mão do duelo não muda) */
  descricao?: string;
  onEscolher: (l: LinhaCombo) => void;
  onFechar: () => void;
}) {
  const [marcada, setMarcada] = useState<LinhaCombo | null>(null);
  return (
    <div className="guia-fundo" onClick={onFechar}>
      <div className="guia-janela" role="dialog" aria-modal="true" aria-label={t("Combos")} onClick={(e) => e.stopPropagation()}>
        <h3>{t("Combos")}</h3>
        {!grupos.length ? (
          <p className="tags-note">{t("Nenhum combo da base cabe neste deck: a base calcula os combos dos decks de torneio, e a mão inicial de cada linha precisa estar no seu Main Deck.")}</p>
        ) : (
          <>
            <small className="tags-note">{descricao}</small>
            <div className="guia-lista">
              {grupos.map((g) => (
                <fieldset key={g.nome}>
                  <legend>{g.nome}</legend>
                  {g.linhas.slice(0, MAX_POR_GRUPO).map((l, i) => (
                    <label key={i} className={`guia-linha ${marcada === l ? "guia-marcada" : ""}`}>
                      <input type="radio" name="guia-combo" checked={marcada === l} onChange={() => setMarcada(l)} />
                      <span>
                        <strong>{l.mao.map(nomeDe).join(" + ")}</strong>
                        {l.ramo?.length ? <small>{t("adicionando {0}", [l.ramo.map(nomeDe).join(" + ")])}</small> : null}
                        <small>{t("{0} passos · termina com {1}", [passosDaLinha(l).length, l.campo.monstros.slice(0, 3).map(nomeDe).join(", ") || t("campo sem monstros")])}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </>
        )}
        <div className="guia-botoes">
          <button className="ghost-btn guia-selecionar" disabled={!marcada} onClick={() => marcada && onEscolher(marcada)} autoFocus>
            {t("Selecionar esse combo")}
          </button>
          <button className="ghost-btn" onClick={onFechar}>
            {t("Cancelar")}
          </button>
        </div>
      </div>
    </div>
  );
}

const pct = (x: number) => `${Math.round(x * 100).toLocaleString(LOCALE)}%`;

/** Painel do guia: Passos do combo, Interações e Probabilidades */
export function PainelGuia({
  estado,
  avaliacao,
  nomeDe,
  byId,
  onHover,
  onPasso,
  onDesfazer,
  onFechar,
}: {
  estado: EstadoGuia;
  avaliacao: AvaliacaoGuia;
  nomeDe: (id: number) => string;
  byId: Map<number, Card>;
  onHover: Hover;
  /** vai para o passo k */
  onPasso: (k: number) => void;
  /** tira uma interrupção marcada (índice na lista) */
  onDesfazer: (i: number) => void;
  onFechar: () => void;
}) {
  const passos = passosDaLinha(estado.linha);
  const k = estado.passo;
  const g = passos[k];
  const texto = (p: Parameters<typeof passoEmTexto>[0]) => {
    const s = passoEmTexto(p, nomeDe);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const { doPasso, sempre } = respostasNoPasso(estado.linha, k);
  const interrompido = estado.interrupcoes.filter((i) => i.passo === k);
  return (
    <div className="guia-painel">
      <section className="guia-passos" aria-label={t("Passos do combo")}>
        <header>
          <h4>{t("Passos do combo")}</h4>
          <button className="link-btn" onClick={onFechar} title={t("Fechar o combo")} aria-label={t("Fechar o combo")}>
            ✕
          </button>
        </header>
        <strong>{t("Passo {0} de {1}", [k + 1, passos.length])}</strong>
        {g && (
          <>
            <p>{texto(g.step)}</p>
            {g.subs.length > 0 && (
              <ul>
                {g.subs.map((p, i) => (
                  <li key={i}>{texto(p)}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {interrompido.map((i) => (
          <small key={i.carta} className="guia-interrompido">
            {t("Respondido por {0}: o efeito dele resolveu.", [nomeDe(i.carta)])}
          </small>
        ))}
        <div className="guia-nav">
          <button className="ghost-btn" disabled={k <= 0} onClick={() => onPasso(k - 1)}>
            ◀ {t("Anterior")}
          </button>
          <button className="ghost-btn" disabled={k >= passos.length - 1} onClick={() => onPasso(k + 1)}>
            {t("Próximo")} ▶
          </button>
        </div>
      </section>

      <section className="guia-interacoes" aria-label={t("Interações")}>
        <h4>{t("Interações")}</h4>
        {!doPasso.length && !sempre.length ? (
          <small className="tags-note">{t("Nenhuma resposta conhecida neste passo.")}</small>
        ) : (
          <>
            {doPasso.length > 0 && <Respostas ids={doPasso} byId={byId} onHover={onHover} rotulo={t("Neste passo, o oponente pode ativar")} max={8} />}
            {sempre.length > 0 && <Respostas ids={sempre} byId={byId} onHover={onHover} rotulo={t("Em quase toda a linha")} max={5} />}
          </>
        )}
      </section>

      <section className="guia-prob" aria-label={t("Probabilidades")}>
        <h4>{t("Probabilidades")}</h4>
        <p>
          {t("Probabilidade de Finalizar o Combo")}: <strong>{pct(avaliacao.finalizar)}</strong>
        </p>
        <p>
          {t("Probabilidade Atual")}: <strong className={`guia-nivel guia-nivel-${avaliacao.atual === "Nula" ? "nula" : avaliacao.atual === "Muito Baixa" || avaliacao.atual === "Baixa" ? "baixa" : avaliacao.atual === "Média" ? "media" : "alta"}`}>{NIVEL[avaliacao.atual]}</strong>
        </p>
        <small className="tags-note">
          {avaliacao.base === "mao-oponente"
            ? avaliacao.ameacas.length
              ? t("Ameaças na mão do oponente: {0}.", [avaliacao.ameacas.map(nomeDe).join(", ")])
              : t("A mão do oponente não tem respostas para os passos que faltam.")
            : t("Sem a mão do oponente: estimativa pelo uso das respostas em torneios.")}{" "}
          {t("Cartas de combo na sua mão: {0}; linhas do deck que ainda cabem: {1}.", [avaliacao.cartasDeCombo, avaliacao.linhasJogaveis])}
        </small>
        {estado.interrupcoes.length > 0 && (
          <ul className="guia-respondido">
            {estado.interrupcoes.map((i, n) => (
              <li key={n}>
                {t("Passo {0}: respondido por {1}", [i.passo + 1, nomeDe(i.carta)])}{" "}
                <button className="link-btn" onClick={() => onDesfazer(n)} title={t("Desconsiderar esta resposta")}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <small className="tags-note">{t("Estimativa pelas jogadas, não um valor exato.")}</small>
      </section>
    </div>
  );
}
