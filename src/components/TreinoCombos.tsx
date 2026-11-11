// Modo de Treino: caixa abaixo da mão do oponente. Para a carta em foco, mostra as linhas da base de
// combos que a usam (primeiro as que cabem nas cartas que o jogador tem agora) e, quando o jogador pede,
// a jogada que a IA faria por ele a partir do momento atual (src/sim/sugestao.ts).
import { useMemo } from "react";
import { cardsOfLine, passoEmTexto, uniqueLines, type LinhaCombo, type Passo } from "../db/motor";
import { t } from "../i18n";

/** linhas mostradas por carta */
const MAX_LINHAS = 5;

export type SugestaoTreino = { estado: "pensando" } | { estado: "pronta"; passos: Passo[] } | { estado: "erro"; erro: string };

interface Props {
  /** carta em foco (id canônico) */
  carta: number | null;
  /** todas as linhas da base de combos */
  linhas: LinhaCombo[];
  /** Deck principal do jogador (ids canônicos) */
  deck: number[];
  /** cartas que o jogador tem agora: mão e campo (ids canônicos) */
  disponiveis: number[];
  nomeDe: (id: number) => string;
  /** pedir a jogada à IA (ausente quando não é a vez do jogador) */
  onPedir?: () => void;
  sugestao: SugestaoTreino | null;
}

export default function TreinoCombos({ carta, linhas, deck, disponiveis, nomeDe, onPedir, sugestao }: Props) {
  // linhas com a carta: as do deck do jogador primeiro; sem nenhuma, as de outros decks
  const { lista, deOutros } = useMemo(() => {
    if (!carta) return { lista: [], deOutros: false };
    const noDeck = new Set(deck);
    const tem = new Set(disponiveis);
    const comCarta = uniqueLines(linhas.filter((l) => cardsOfLine(l).includes(carta)));
    const doDeck = comCarta.filter((l) => l.mao.every((c) => noDeck.has(c)));
    const base = doDeck.length ? doDeck : comCarta;
    const faltam = (l: LinhaCombo) => l.mao.filter((c) => !tem.has(c));
    const lista = base
      .map((l) => ({ l, faltam: faltam(l) }))
      .sort((a, b) => a.faltam.length - b.faltam.length || b.l.pontos - a.l.pontos)
      .slice(0, MAX_LINHAS);
    return { lista, deOutros: !doDeck.length && comCarta.length > 0 };
  }, [carta, linhas, deck, disponiveis]);

  const passos = (ps: Passo[]) => (
    <ol className="treino-passos">
      {ps.map((p, i) => (
        <li key={i}>
          {passoEmTexto(p, nomeDe)}
        </li>
      ))}
    </ol>
  );

  return (
    <section className="treino-combos" aria-live="polite" aria-label={t("Combos possíveis")}>
      <header>
        <h4>{carta ? t("Combos possíveis com {0}", [nomeDe(carta)]) : t("Combos possíveis")}</h4>
        <button className="ghost-btn" disabled={!onPedir || sugestao?.estado === "pensando"} onClick={onPedir} title={onPedir ? undefined : t("Disponível no seu turno, quando for a sua vez de jogar")}>
          {sugestao?.estado === "pensando" ? t("A IA está pensando…") : t("Pedir jogada à IA")}
        </button>
      </header>
      {sugestao?.estado === "pensando" && <small className="tags-note">{t("O duelo espera alguns segundos enquanto a IA testa as jogadas a partir de agora.")}</small>}
      {sugestao?.estado === "erro" && <small className="conta-erro">{sugestao.erro}</small>}
      {sugestao?.estado === "pronta" && (
        <div className="treino-sugestao">
          <strong>{t("Jogada sugerida pela IA (até o fim do turno)")}</strong>
          {sugestao.passos.length ? passos(sugestao.passos) : <small className="tags-note">{t("A IA não faria nada daqui até o fim do turno.")}</small>}
        </div>
      )}
      {!carta ? (
        <small className="tags-note">{t("Passe o mouse sobre uma carta (ou ative uma) para ver as linhas de combo da base que a usam.")}</small>
      ) : !lista.length ? (
        <small className="tags-note">{t("Nenhuma linha da base de combos usa esta carta.")}</small>
      ) : (
        <>
          {deOutros && <small className="tags-note">{t("Nenhuma linha do seu deck usa esta carta; estas são de outros decks.")}</small>}
          {lista.map(({ l, faltam }, i) => (
            <details key={i} className="treino-linha">
              <summary>
                <span>{l.mao.map(nomeDe).join(" + ")}</span>
                <small className={faltam.length ? "" : "treino-cabe"}>{faltam.length ? t("faltam: {0}", [faltam.map(nomeDe).join(", ")]) : t("cabe nas suas cartas")}</small>
                <small>{t("{0} passos · termina com {1}", [l.passos.length, l.campo.monstros.slice(0, 3).map(nomeDe).join(", ") || t("campo sem monstros")])}</small>
              </summary>
              {passos(l.passos)}
            </details>
          ))}
        </>
      )}
    </section>
  );
}
