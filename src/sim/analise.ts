// Análise do duelo pela IA, depois do fim (ou num replay): refaz a partida, aponta o que decidiu o
// duelo (efeitos negados, perdas grandes de PV, quem venceu) e volta aos momentos em que a IA passou
// a vez podendo Invocar do Extra Deck. Em cada um, testa as Invocações possíveis (em Ataque e em
// Defesa) contra o que ela fez: a partir dali a IA joga pelos dois lados até o começo do turno
// seguinte dela, e a nota do campo nesse momento compara as escolhas. O que se sai bem melhor vira
// valor aprendido da carta (IA.aprendidos), usado nos próximos duelos.
import { OcgMessageType as T, type OcgMessage, type OcgResponse } from "ocgcore-wasm";
import { IA, type LinhaIA } from "./ia";
import { opcoesDe } from "./opcoes";
import { ehComando, executarComando, TIPO, TIPOS_EXTRA, type Historico, type Motor, type Partida } from "./regras";
import { Sessao } from "./sessao";

export interface PedidoAnalise {
  partida: Partida;
  /** lugar do jogador; a IA é o outro */
  humano: 0 | 1;
  historico: Historico;
  /** linhas conhecidas do deck da IA */
  linhas?: LinhaIA[];
  aprendidos?: Record<number, number>;
}

/** O que aconteceu no duelo, por turno (a tela monta o texto) */
export type FatoDuelo =
  | { t: "negado"; turno: number; jogador: number; carta: number; por?: number }
  | { t: "pv"; turno: number; jogador: number; perdeu: number }
  | { t: "fim"; turno: number; vencedor: number | null };

/** Uma escolha melhor do que a que a IA fez */
export interface Achado {
  turno: number;
  /** carta do Extra Deck que ela poderia ter Invocado */
  carta: number;
  defesa: boolean;
  /** quanto a nota do campo no começo do turno seguinte dela ficou acima da do que ela fez */
  ganho: number;
}

export interface AnaliseDuelo {
  fatos: FatoDuelo[];
  achados: Achado[];
  /** pontos a somar no valor aprendido de cada carta */
  aprender: Record<number, number>;
}

/** quantos momentos de passar a vez são testados, e quantas Invocações em cada um */
const MAX_MOMENTOS = 2;
const MAX_ALTERNATIVAS = 4;
/** ganho mínimo para a escolha virar achado (e valor aprendido) */
const GANHO_MINIMO = 1;
const APRENDE = 0.5;
/** simulações por escolha (a média tira parte do acaso das jogadas sorteadas da IA) */
const AMOSTRAS = 2;

interface Momento {
  k: number;
  turno: number;
  alternativas: OcgResponse[];
  codes: number[];
}

export function analisarDuelo(motor: Motor, p: PedidoAnalise): AnaliseDuelo {
  const ia = (1 - p.humano) as 0 | 1;
  const { fatos, momentos } = refazer(motor, p, ia);
  const achados: Achado[] = [];
  const nota = new IA("normal", ia, [], motor, { aprendidos: p.aprendidos });
  const media = (resp: OcgResponse, k: number, turno: number, emDefesa: boolean) => {
    let soma = 0;
    for (let i = 0; i < AMOSTRAS; i++) soma += continuar(resp, k, turno, emDefesa);
    return soma / AMOSTRAS;
  };
  const continuar = (resp: OcgResponse, k: number, turno: number, emDefesa: boolean) => {
    const s = new Sessao(motor, {
      partida: p.partida,
      humano: p.humano,
      nivel: "normal",
      linhas: p.linhas,
      aprendidos: p.aprendidos,
      historico: [...p.historico.slice(0, k), resp],
      iaNoHumano: { nivel: "normal" },
      ateTurno: turno + 1,
      iaEmDefesa: emDefesa,
    });
    try {
      const q = s.avancar();
      if (q.fim) return q.fim.vencedor === ia ? 100 : -100;
      return nota.avaliar(motor, s.duel);
    } finally {
      s.encerrar();
    }
  };
  for (const m of momentos.slice(0, MAX_MOMENTOS)) {
    const feito = p.historico[m.k] as OcgResponse;
    const base = media(feito, m.k, m.turno, false);
    m.alternativas.slice(0, MAX_ALTERNATIVAS).forEach((alt, i) => {
      const code = m.codes[i];
      // Link não tem Posição de Defesa
      for (const defesa of motor.tipo(code) & TIPO.LINK ? [false] : [false, true]) {
        const ganho = media(alt, m.k, m.turno, defesa) - base;
        if (ganho >= GANHO_MINIMO) achados.push({ turno: m.turno, carta: code, defesa, ganho: Math.round(ganho * 10) / 10 });
      }
    });
  }
  achados.sort((a, b) => b.ganho - a.ganho);
  const aprender: Record<number, number> = {};
  for (const a of achados) aprender[a.carta] = APRENDE;
  return { fatos, achados, aprender };
}

/** Refaz o duelo: fatos marcantes e os momentos em que a IA passou a vez com Invocações do Extra Deck à mão */
function refazer(motor: Motor, p: PedidoAnalise, ia: number) {
  const duel = motor.novoDuelo(p.partida);
  const fatos: FatoDuelo[] = [];
  const momentos: Momento[] = [];
  let turno = 0;
  const cadeia = new Map<number, { code: number; p: number }>();
  // elos que já resolveram na cadeia atual (quem negou é o último do outro jogador)
  let resolvidos: { code: number; p: number }[] = [];
  let acabou = false;
  // o motor manda os PV sem sinal: abaixo de 0 vira um número enorme
  const pv = () => duelPv(motor, duel);
  let pvTurno = pv();
  const fimDoTurno = () => {
    const agora = pv();
    [0, 1].forEach((j) => {
      const perdeu = pvTurno[j] - agora[j];
      if (perdeu >= 1000) fatos.push({ t: "pv", turno, jogador: j, perdeu });
    });
    pvTurno = agora;
  };
  const ler = (log: OcgMessage[]) => {
    for (const m of log) {
      if (m.type === T.NEW_TURN) {
        if (turno) fimDoTurno();
        turno++;
      } else if (m.type === T.CHAINING) cadeia.set(m.chain_size, { code: m.code, p: m.controller });
      else if (m.type === T.CHAIN_SOLVED) {
        const elo = cadeia.get(m.chain_size);
        if (elo) resolvidos.push(elo);
      } else if (m.type === T.CHAIN_END) {
        cadeia.clear();
        resolvidos = [];
      } else if (m.type === T.CHAIN_NEGATED || m.type === T.CHAIN_DISABLED) {
        const elo = cadeia.get(m.chain_size);
        const por = [...resolvidos].reverse().find((x) => x.p !== elo?.p);
        if (elo) fatos.push({ t: "negado", turno, jogador: elo.p, carta: elo.code, ...(por ? { por: por.code } : {}) });
      } else if (m.type === T.WIN && !acabou) {
        acabou = true;
        fimDoTurno();
        fatos.push({ t: "fim", turno, vencedor: m.player > 1 ? null : m.player });
      }
    }
  };
  try {
    let r = motor.ate(duel);
    ler(r.log);
    for (let k = 0; k < p.historico.length && r.decisao; k++) {
      const j = p.historico[k];
      if (ehComando(j)) {
        executarComando(motor, duel, j);
        continue;
      }
      const d = r.decisao;
      // a IA passou de fase na Main Phase podendo Invocar do Extra Deck
      if (d.type === T.SELECT_IDLECMD && d.player === ia && j.type === 1 && ((j as { action: number }).action === 6 || (j as { action: number }).action === 7)) {
        const extras = opcoesDe(d, motor.tipo).filter((o) => o.acao?.k === "especial" && o.acao.code && motor.tipo(o.acao.code) & TIPOS_EXTRA);
        const vistos = new Set<number>();
        const unicos = extras.filter((o) => !vistos.has(o.acao!.code!) && vistos.add(o.acao!.code!));
        if (unicos.length) momentos.push({ k, turno, alternativas: unicos.map((o) => o.resp), codes: unicos.map((o) => o.acao!.code!) });
      }
      motor.core.duelSetResponse(duel, j);
      r = motor.ate(duel);
      ler(r.log);
    }
    return { fatos, momentos };
  } finally {
    motor.core.destroyDuel(duel);
  }
}

function duelPv(motor: Motor, duel: Parameters<Motor["core"]["duelQueryField"]>[0]): [number, number] {
  const campo = motor.core.duelQueryField(duel);
  const lp = (j: number) => ((campo.players[j] as unknown as { lp?: number }).lp ?? 8000) | 0;
  return [lp(0), lp(1)];
}
