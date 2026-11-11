// Modo de Treino: "Pedir jogada à IA". A partir do momento atual do duelo, a IA joga pelo jogador até o
// fim do turno (a IA do oponente responde como no duelo) e devolve os passos que ela fez. O duelo em
// andamento não muda: tudo roda numa sessão à parte, refeita com o mesmo histórico (o motor é determinístico).
import { OcgMessageType as T, type OcgMessage } from "ocgcore-wasm";
import type { LinhaIA } from "./ia";
import { passosDoLog, type Passo } from "./passos";
import { ehComando, executarComando, type Historico, type Motor } from "./regras";
import { Sessao, type ConfigSessao } from "./sessao";

export interface PedidoSugestao {
  /** configuração do duelo em andamento (partida, lado do jogador, nível e linhas da IA) */
  cfg: ConfigSessao;
  /** respostas dadas até agora */
  historico: Historico;
  /** turno atual: a sugestão vai até o fim dele */
  turno: number;
  /** linhas de combo conhecidas do deck do jogador (puxam as escolhas da IA) */
  linhas: LinhaIA[];
}

export function sugerirJogada(motor: Motor, p: PedidoSugestao): Passo[] {
  const s = new Sessao(motor, {
    ...p.cfg,
    historico: p.historico,
    iaNoHumano: { nivel: "dificil", linhas: p.linhas, aprendidos: p.cfg.aprendidos },
    ateTurno: p.turno,
    remoto: false,
    janelas: "acao",
  });
  let historico: Historico;
  try {
    s.avancar();
    historico = s.historico;
  } finally {
    s.encerrar();
  }
  return passosDesde(motor, p.cfg, historico, p.historico.length, p.turno);
}

/** Refaz o duelo e monta os passos do jogador a partir da resposta k, até o turno `ate` acabar */
function passosDesde(motor: Motor, cfg: ConfigSessao, historico: Historico, k: number, ate: number): Passo[] {
  const duel = motor.novoDuelo(cfg.partida);
  try {
    const log: OcgMessage[] = [];
    let gravando = k === 0;
    let acabou = false;
    let turno = 0;
    const ler = (l: OcgMessage[]) => {
      for (const m of l) {
        if (m.type === T.NEW_TURN && ++turno > ate) {
          acabou = true;
          return;
        }
        if (gravando) log.push(m);
      }
    };
    let r = motor.ate(duel);
    ler(r.log);
    for (let i = 0; i < historico.length && !acabou; i++) {
      const resp = historico[i];
      if (i + 1 >= k) gravando = true;
      // comando (Ficha) não consome a decisão: o motor continua esperando a resposta seguinte
      if (ehComando(resp)) {
        executarComando(motor, duel, resp);
        continue;
      }
      if (!r.decisao) break;
      motor.core.duelSetResponse(duel, resp);
      r = motor.ate(duel);
      ler(r.log);
    }
    // compras não são decisão do jogador: ficam de fora da sugestão
    return passosDoLog(log, motor.tipo, cfg.humano).filter((x) => x.t !== "compra");
  } finally {
    motor.core.destroyDuel(duel);
  }
}
