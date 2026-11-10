// Combo de uma mão com várias cartas, calculado na hora no motor (Combos → Mão inicial). Os combos
// da base são calculados com cada carta sozinha na mão; para uma mão como Centur-Ion Primera +
// Griffoh, a IA joga o primeiro turno com só essas cartas (mais "cartas quaisquer" para descarte,
// como no cálculo da base), contra um oponente que passa, e cada carta da mão que ela não usar pesa
// contra a linha. O resultado vem no formato das linhas calculadas (passos e campo final).
import { OcgLocation as L, OcgMessageType as T, type OcgMessage } from "ocgcore-wasm";
import type { CampoFinal, Passo } from "../db/motor";
import { passivo, type LinhaIA } from "./ia";
import { passosDoLog } from "./passos";
import { ehComando, TIPO, TIPOS_EXTRA, type DeckSim, type Historico, type Motor, type Partida } from "./regras";
import { Sessao } from "./sessao";

/** "Carta qualquer" do cálculo da base (Blue-Eyes White Dragon): completa a mão e o Deck do oponente */
const QUALQUER = 89631139;
const MAO = 5;

export interface PedidoCalculo {
  /** Deck com as cartas da mão (e as engines delas) */
  deck: DeckSim;
  mao: number[];
  /** linhas conhecidas das cartas da mão (puxam a IA para as engines) */
  linhas: LinhaIA[];
}

export interface LinhaCalculada {
  mao: number[];
  /** cartas quaisquer usadas (descartes) */
  qualquer: number;
  passos: Passo[];
  campo: CampoFinal;
  pontos: number;
}

export function calcularMao(motor: Motor, p: PedidoCalculo): LinhaCalculada {
  const mao = p.mao.slice(0, MAO);
  const enche = Array<number>(MAO - mao.length).fill(QUALQUER);
  const semente = Array.from({ length: 4 }, () => String(Math.floor(Math.random() * 2 ** 32))) as Partida["semente"];
  const partida: Partida = {
    decks: [{ main: [...p.deck.main, ...enche], extra: p.deck.extra }, { main: Array(40).fill(QUALQUER), extra: [] }],
    semente,
    maos: [[...mao, ...enche], []],
  };
  // a própria mão vira uma linha conhecida: as cartas dela pesam mais nas jogadas sorteadas
  const daMao: LinhaIA = { mao, passos: mao.map((c) => ({ t: "ativa", c, de: "mao" }) as Passo), campo: { monstros: [], magias: [], mao: [] }, pontos: 0 };
  const s = new Sessao(motor, { partida, humano: 1, nivel: "dificil", linhas: [...p.linhas, daMao], exigidas: mao, janelas: "acao" });
  try {
    // o oponente só passa; o primeiro turno termina quando chega a vez dele de jogar (turno 2)
    s.avancar();
    for (let guarda = 0; guarda < 400 && s.pendente && s.momento().turno < 2; guarda++) {
      const d = s.pendente;
      const resp = passivo(d, motor);
      if (!resp) break;
      s.responder(resp);
    }
    return linhaDoTurno(motor, partida, s.historico);
  } finally {
    s.encerrar();
  }
}

/** Refaz o primeiro turno com as respostas dadas e monta os passos e o campo do jogador 0 */
function linhaDoTurno(motor: Motor, partida: Partida, historico: Historico): LinhaCalculada {
  const duel = motor.novoDuelo(partida);
  try {
    const log: OcgMessage[] = [];
    let turnos = 0;
    const ler = (l: OcgMessage[]) => {
      for (const m of l) {
        if (m.type === T.NEW_TURN && ++turnos >= 2) return false;
        log.push(m);
      }
      return true;
    };
    let r = motor.ate(duel);
    let segue = ler(r.log);
    // (o cálculo não cria Fichas pelo botão: o histórico só tem respostas)
    for (const resp of historico) {
      if (!segue || !r.decisao) break;
      if (ehComando(resp)) continue;
      motor.core.duelSetResponse(duel, resp);
      r = motor.ate(duel);
      segue = ler(r.log);
    }
    // sem a compra da mão inicial (as cartas da mão já aparecem como a mão da linha)
    const passos = (passosDoLog(log, motor.tipo, 0) as Passo[]).filter((x, i) => !(i === 0 && x.t === "compra"));
    const ficha = (c: number) => (motor.tipo(c) & TIPO.FICHA ? 0 : c);
    const zona = (location: number) =>
      motor.core
        .duelQueryLocation(duel, { flags: (1 | 2) as never, controller: 0, location: location as L })
        .filter((c) => c?.code)
        .map((c) => ({ code: ficha(c!.code as number), baixada: ((c!.position as number) & 0xa) !== 0 }));
    const monstros = zona(L.MZONE).map((c) => c.code);
    const magias = zona(L.SZONE).map((c) => [c.code, c.baixada] as [number, boolean]);
    const naMao = zona(L.HAND).map((c) => c.code).filter((c) => c !== QUALQUER);
    const qualquer = passos.filter((x) => x.t === "move" && x.c === QUALQUER && x.de === "mao").length;
    const pontos = monstros.reduce((n, c) => n + (c && motor.tipo(c) & TIPOS_EXTRA ? 3 : 1.5), 0) + magias.reduce((n, [, b]) => n + (b ? 2 : 1), 0) + naMao.length;
    return { mao: partida.maos![0].filter((c) => c !== QUALQUER), qualquer, passos, campo: { monstros, magias, mao: naMao }, pontos };
  } finally {
    motor.core.destroyDuel(duel);
  }
}
