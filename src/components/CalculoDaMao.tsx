import { useEffect, useRef, useState, type ComponentProps } from "react";
import VerifiedCombos from "./VerifiedCombos";
import { useDecks } from "../db/decks";
import type { GameFormat } from "../db/legality";
import type { CombosCalculados, LinhaCombo } from "../db/motor";
import { ClienteSim, obterPacote } from "../sim/cliente";
import type { DeckSim } from "../sim/regras";
import { t } from "../i18n";

/**
 * Deck para calcular uma mão com várias cartas: para cada carta, o deck (de torneio ou seu) que tem
 * mais cartas da mão; os escolhidos se juntam (as engines de cada carta ficam no mesmo Deck) e a
 * carta que nenhum deck tem entra sozinha.
 */
function deckParaMao(mao: number[], decks: DeckSim[]): DeckSim {
  const conta = (d: DeckSim) => mao.filter((c) => d.main.includes(c) || d.extra.includes(c)).length;
  const escolhidos = new Set<DeckSim>();
  for (const c of mao) {
    const melhor = decks.filter((d) => d.main.includes(c)).sort((a, b) => conta(b) - conta(a))[0];
    if (melhor) escolhidos.add(melhor);
  }
  // cópias: o máximo de cada carta entre os decks escolhidos
  const junta = (parte: (d: DeckSim) => number[]) => {
    const copias = new Map<number, number>();
    for (const d of escolhidos) {
      const aqui = new Map<number, number>();
      for (const c of parte(d)) aqui.set(c, (aqui.get(c) ?? 0) + 1);
      for (const [c, n] of aqui) copias.set(c, Math.max(copias.get(c) ?? 0, n));
    }
    return [...copias].flatMap(([c, n]) => Array<number>(n).fill(c));
  };
  const main = junta((d) => d.main);
  for (const c of mao) if (main.filter((x) => x === c).length < mao.filter((x) => x === c).length) main.push(c);
  return { main, extra: junta((d) => d.extra) };
}

type Props = Omit<ComponentProps<typeof VerifiedCombos>, "title" | "lines"> & {
  combos: CombosCalculados;
  mao: number[];
  format: GameFormat;
  /** linhas da base com parte da mão (puxam a IA para as engines das cartas) */
  linhas: LinhaCombo[];
};

/**
 * Combos → Mão inicial com várias cartas: a base calcula cada carta sozinha na mão; aqui o motor
 * joga a mão inteira (Sim/calculo.ts) para achar uma linha que use todas as cartas.
 */
export default function CalculoDaMao({ combos, mao, format, linhas, ...lista }: Props) {
  const { decks } = useDecks();
  const [estado, setEstado] = useState<{ status: "calculando" | "ok" | "erro"; linha?: LinhaCombo; erro?: string } | null>(null);
  const [vez, setVez] = useState(0);
  const cliente = useRef<Promise<ClienteSim> | null>(null);
  useEffect(() => () => void cliente.current?.then((c) => c.encerrar()), []);

  const chave = `${mao.join(",")}|${format}|${vez}`;
  useEffect(() => {
    let vivo = true;
    setEstado({ status: "calculando" });
    // espera a mão parar de mudar antes de ocupar o motor
    const timer = window.setTimeout(async () => {
      try {
        cliente.current ??= obterPacote().then(async (dados) => {
          const c = new ClienteSim(() => {}, () => {});
          await c.carregar(dados);
          return c;
        });
        const c = await cliente.current;
        const torneio = combos.decks.flatMap((d) => {
          const l = d.listas?.find((x) => x.formatos.includes(format)) ?? d.listas?.[0];
          return l ? [{ main: l.main, extra: l.extra }] : [];
        });
        const meus = decks.filter((d) => !d.temporario && d.main.length).map((d) => ({ main: d.main, extra: d.extra }));
        const r = await c.calcular({ deck: deckParaMao(mao, [...meus, ...torneio]), mao, linhas });
        if (!vivo) return;
        setEstado({ status: "ok", linha: { deck: -1, formatos: [format], ...r } });
      } catch (e) {
        cliente.current = null;
        if (vivo) setEstado({ status: "erro", erro: e instanceof Error ? e.message : String(e) });
      }
    }, 600);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="calculo-mao">
      {estado?.status === "calculando" && (
        <p className="tags-note" role="status">
          <span className="spinner" /> {t("Calculando no motor um combo com todas as cartas da mão (leva alguns segundos)…")}
        </p>
      )}
      {estado?.status === "erro" && <p className="db-warning">{t("Não foi possível calcular a mão: {0}", [estado.erro])}</p>}
      {estado?.status === "ok" && estado.linha && (
        <>
          <VerifiedCombos {...lista} combos={combos} title={t("Combo calculado agora com todas as cartas da mão")} lines={[estado.linha]} />
          <p className="tags-note">
            {t("Jogado agora pelo App no primeiro turno, com o oponente passando, num deck com as cartas da mão e as engines delas. Cada cálculo pode achar uma linha diferente.")}{" "}
            <button className="ghost-btn" onClick={() => setVez((v) => v + 1)}>
              {t("Calcular de novo")}
            </button>
          </p>
        </>
      )}
    </section>
  );
}
