// Sessão do Simulador: um duelo com regras (motor do EDOPro) entre o jogador e a IA. Guarda todas
// as respostas dadas (o histórico): com a mesma semente, repetir o histórico refaz o duelo, e é
// assim que a IA testa jogadas (src/sim/ia.ts). Roda no Worker; a tela recebe só Quadros.
import { cardMatchesOpcode, OcgHintType, OcgLocation as L, OcgMessageType as T, OcgResponseType as R, type OcgDuelHandle, type OcgMessage, type OcgResponse } from "ocgcore-wasm";
import { type Historico, type Motor, type Partida } from "./regras";
import { IA, type LinhaIA, type NivelIA } from "./ia";

export interface CartaSim {
  code: number;
  /** OcgPosition: 1 ataque, 4 defesa, 2/8 virada para baixo */
  pos: number;
  atk?: number;
  def?: number;
  /** matérias Xyz */
  mat?: number[];
  /** marcadores (tipo → quantidade) */
  marc?: Record<string, number>;
}

export interface LadoSim {
  lp: number;
  mao: CartaSim[];
  /** 0-4 Zonas de Monstros, 5-6 Zonas de Monstros Extra */
  monstros: (CartaSim | null)[];
  /** 0-4 Magias e Armadilhas, 5 Zona de Campo */
  magias: (CartaSim | null)[];
  cemiterio: CartaSim[];
  banidas: CartaSim[];
  extra: CartaSim[];
  deck: number;
}

export interface EstadoSim {
  turno: number;
  /** jogador do turno */
  vez: 0 | 1;
  /** OcgPhase */
  fase: number;
  lados: [LadoSim, LadoSim];
  cadeia: { code: number; controller: number }[];
}

/** Acontecimentos do duelo, para o registro da tela */
export type EventoSim =
  | { t: "turno"; p: number; n: number }
  | { t: "fase"; fase: number }
  | { t: "compra"; p: number; codes: number[] }
  | { t: "invoca"; p: number; code: number; como: "normal" | "especial" | "virar" }
  | { t: "baixa"; p: number; code: number }
  | { t: "ativa"; p: number; code: number; texto?: string }
  | { t: "nega"; code?: number }
  | { t: "move"; code: number; de: number; para: number; p: number }
  | { t: "ataque"; p: number; code: number; alvo?: number }
  | { t: "dano"; p: number; v: number }
  | { t: "cura"; p: number; v: number }
  | { t: "custo"; p: number; v: number }
  | { t: "fim"; vencedor: number; motivo: number };

/** Decisão do jogador: a mensagem do motor e o que a tela precisa para mostrá-la */
export interface PedidoSim {
  msg: OcgMessage;
  /** HINTMSG_* da última dica de seleção (ex.: HINTMSG_DESTROY), para o título da escolha */
  dica?: string;
  /** a dica é o texto de um efeito (descrição da carta) */
  dicaTexto?: string;
  /** textos dos efeitos citados na mensagem (descrição → texto em inglês do Project Ignis) */
  textos: Record<string, string>;
  /** ANNOUNCE_CARD: cartas que podem ser declaradas [id, nome em inglês] */
  candidatos?: [number, string][];
  /** a resposta anterior não valia: escolha de novo */
  repetir?: boolean;
}

export interface Quadro {
  estado: EstadoSim;
  pedido: PedidoSim | null;
  eventos: EventoSim[];
  fim?: { vencedor: number; motivo: number };
  /** a IA está decidindo (só nos quadros de progresso) */
  pensando?: boolean;
}

export interface ConfigSessao {
  partida: Partida;
  humano: 0 | 1;
  nivel: NivelIA;
  /** linhas de combo conhecidas do deck da IA (camada: combos calculados no motor) */
  linhas?: LinhaIA[];
  /** janelas de resposta do jogador: "acao" só pergunta logo depois de uma jogada da IA; "todas" pergunta sempre */
  janelas?: "acao" | "todas";
}

// código, posição, ATK, DEF, matérias e marcadores
const QUERY = (1 | 2 | 256 | 512 | 65536 | 131072) as never;

export class Sessao {
  readonly duel: OcgDuelHandle;
  readonly historico: Historico = [];
  private decisao: OcgMessage | null = null;
  private turno = 0;
  private vez: 0 | 1 = 0;
  private fase = 0;
  private fim?: { vencedor: number; motivo: number };
  /** última dica de seleção de cada jogador */
  private dica: [bigint | null, bigint | null] = [null, null];
  private ia: IA;
  private eventos: EventoSim[] = [];
  /** pedido do jogador antes de uma resposta recusada (RETRY) */
  private ultimoPedido: OcgMessage | null = null;
  /** jogador e carta da última ativação (para a IA responder às do oponente) */
  ultimaAcao: { p: number; code: number; tipo: "ativa" | "invoca" | "ataque" } | null = null;

  constructor(
    readonly motor: Motor,
    readonly cfg: ConfigSessao,
  ) {
    this.ia = new IA(cfg.nivel, 1 - cfg.humano as 0 | 1, cfg.linhas ?? []);
    this.duel = motor.novoDuelo(cfg.partida);
  }

  /** Processa até a próxima decisão do jogador (a IA responde as dela no caminho) */
  avancar(aoPensar?: (q: Quadro) => void): Quadro {
    for (let guarda = 0; guarda < 5000; guarda++) {
      const r = this.motor.ate(this.duel);
      this.lerLog(r.log);
      if (this.fim || !r.decisao) {
        this.decisao = null;
        return this.quadro();
      }
      let d = r.decisao;
      const repetida = d.type === T.RETRY;
      if (repetida) {
        // a última resposta não valia: quem respondeu escolhe de novo
        const ultimo = this.ultimoPedido;
        if (ultimo && "player" in ultimo && ultimo.player === this.cfg.humano) {
          this.decisao = ultimo;
          return this.quadro(true);
        }
        d = ultimo ?? d;
        this.ia.recusada();
      }
      this.decisao = d;
      // janela de resposta sem jogada da IA para responder: passa sozinha (a não ser que o jogador peça todas)
      if (d.type === T.SELECT_CHAIN && d.player === this.cfg.humano && !d.forced && this.cfg.janelas !== "todas" && (!this.ultimaAcao || this.ultimaAcao.p === this.cfg.humano)) {
        this.ultimoPedido = d;
        this.aplicar({ type: R.SELECT_CHAIN, index: null }, this.cfg.humano);
        continue;
      }
      if (!("player" in d) || d.player === this.cfg.humano) {
        this.ultimoPedido = d;
        return this.quadro();
      }
      this.ultimoPedido = d;
      if (aoPensar && this.ia.vaiPensar(d, this)) aoPensar({ ...this.quadro(), pedido: null, pensando: true });
      this.aplicar(this.ia.decidir(d, this, repetida), d.player);
    }
    throw new Error("simulador: a IA não terminou de jogar");
  }

  /** Troca as janelas de resposta no meio do duelo */
  definirJanelas(j: "acao" | "todas") {
    this.cfg.janelas = j;
  }

  /** Resposta do jogador à decisão em aberto */
  responder(resp: OcgResponse, aoPensar?: (q: Quadro) => void): Quadro {
    if (!this.decisao || this.fim) return this.quadro();
    this.aplicar(resp, this.cfg.humano);
    return this.avancar(aoPensar);
  }

  private aplicar(resp: OcgResponse, jogador: number) {
    this.historico.push(resp);
    this.ia.observar(resp, jogador);
    this.motor.core.duelSetResponse(this.duel, resp);
  }

  private lerLog(log: OcgMessage[]) {
    const ev = this.eventos;
    for (const m of log) {
      switch (m.type) {
        case T.NEW_TURN:
          this.turno++;
          this.vez = m.player as 0 | 1;
          ev.push({ t: "turno", p: m.player, n: this.turno });
          break;
        case T.NEW_PHASE:
          this.fase = m.phase;
          ev.push({ t: "fase", fase: m.phase });
          break;
        case T.DRAW:
          ev.push({ t: "compra", p: m.player, codes: m.drawn.map((c) => c.code) });
          break;
        case T.SUMMONING:
          ev.push({ t: "invoca", p: m.controller, code: m.code, como: "normal" });
          this.ultimaAcao = { p: m.controller, code: m.code, tipo: "invoca" };
          break;
        case T.SPSUMMONING:
          ev.push({ t: "invoca", p: m.controller, code: m.code, como: "especial" });
          this.ultimaAcao = { p: m.controller, code: m.code, tipo: "invoca" };
          break;
        case T.FLIPSUMMONING:
          ev.push({ t: "invoca", p: m.controller, code: m.code, como: "virar" });
          break;
        case T.SET:
          ev.push({ t: "baixa", p: m.controller, code: m.code });
          break;
        case T.CHAINING:
          ev.push({ t: "ativa", p: m.controller, code: m.code, texto: this.motor.texto(m.description) });
          this.ultimaAcao = { p: m.controller, code: m.code, tipo: "ativa" };
          break;
        case T.CHAIN_NEGATED:
        case T.CHAIN_DISABLED:
          ev.push({ t: "nega" });
          break;
        case T.MOVE: {
          // só o que interessa ao jogador: cartas que saem do campo ou da mão, ou voltam a ela
          const de = m.from.location;
          const para = m.to.location;
          if (de !== para && m.card && !(de === L.DECK && para === L.HAND) && (para & (L.GRAVE | L.REMOVED | L.HAND | L.DECK | L.EXTRA) || de & L.ONFIELD))
            ev.push({ t: "move", code: m.card, de, para, p: m.to.controller });
          break;
        }
        case T.ATTACK: {
          const a = this.cartaEm(m.card.controller, m.card.location, m.card.sequence);
          const alvo = m.target ? this.cartaEm(m.target.controller, m.target.location, m.target.sequence) : undefined;
          ev.push({ t: "ataque", p: m.card.controller, code: a ?? 0, alvo });
          this.ultimaAcao = { p: m.card.controller, code: a ?? 0, tipo: "ataque" };
          break;
        }
        case T.DAMAGE:
          ev.push({ t: "dano", p: m.player, v: m.amount });
          break;
        case T.RECOVER:
          ev.push({ t: "cura", p: m.player, v: m.amount });
          break;
        case T.PAY_LPCOST:
          ev.push({ t: "custo", p: m.player, v: m.amount });
          break;
        case T.HINT:
          if (m.hint_type === OcgHintType.SELECTMSG) this.dica[m.player] = m.hint;
          break;
        case T.WIN:
          if (!this.fim) {
            this.fim = { vencedor: m.player, motivo: m.reason };
            ev.push({ t: "fim", vencedor: m.player, motivo: m.reason });
          }
          break;
      }
      if (m.type === T.CHAIN_END || m.type === T.NEW_PHASE) this.ultimaAcao = null;
    }
  }

  private cartaEm(controller: number, location: number, sequence: number): number | undefined {
    const c = this.motor.core.duelQuery(this.duel, { flags: 1 as never, controller: controller as 0, location: location as L, sequence, overlaySequence: 0 });
    return (c?.code as number | undefined) || undefined;
  }

  /** Última dica de seleção do jogador (HINTMSG_* ou texto de efeito) */
  dicaDe(p: number): { nome?: string; texto?: string; valor?: number } {
    const h = this.dica[p];
    if (h === null) return {};
    const v = Number(h);
    // dicas acima de 0xFFFF são descrições de efeito (id da carta × 16 + número)
    if (v > 0xffff) return { texto: this.motor.texto(h), valor: v };
    return { nome: this.motor.constante(v, "HINTMSG"), valor: v };
  }

  estado(): EstadoSim {
    const core = this.motor.core;
    const campo = core.duelQueryField(this.duel);
    const lado = (p: 0 | 1): LadoSim => {
      const q = (location: number) =>
        core.duelQueryLocation(this.duel, { flags: QUERY, controller: p, location: location as L }).map((c) => {
          if (!c?.code) return null;
          const r = c as Record<string, unknown>;
          const mat = (r.overlayCards as number[] | undefined) ?? [];
          const marc = (r.counters as Record<string, number> | undefined) ?? {};
          return {
            code: r.code as number,
            pos: (r.position as number) ?? 0,
            ...(r.attack !== undefined ? { atk: r.attack as number, def: r.defense as number } : {}),
            ...(mat.length ? { mat } : {}),
            ...(Object.keys(marc).length ? { marc } : {}),
          } satisfies CartaSim;
        });
      const cheias = (location: number) => q(location).filter((c): c is CartaSim => !!c);
      const monstros = q(L.MZONE);
      const magias = q(L.SZONE);
      // o motor manda os PV sem sinal: abaixo de 0 vira um número enorme
      const lp = Math.max(0, ((campo.players[p] as unknown as { lp?: number }).lp ?? 0) | 0);
      return {
        lp,
        mao: cheias(L.HAND),
        monstros: Array.from({ length: 7 }, (_, i) => monstros[i] ?? null),
        magias: Array.from({ length: 6 }, (_, i) => magias[i] ?? null),
        cemiterio: cheias(L.GRAVE),
        banidas: cheias(L.REMOVED),
        extra: cheias(L.EXTRA),
        deck: campo.players[p].deck_size,
      };
    };
    return {
      turno: this.turno,
      vez: this.vez,
      fase: this.fase,
      lados: [lado(0), lado(1)],
      cadeia: campo.chain.map((c) => ({ code: c.code, controller: c.controller })),
    };
  }

  private pedido(repetir: boolean): PedidoSim | null {
    const d = this.decisao;
    if (!d || this.fim || !("player" in d) || d.player !== this.cfg.humano) return null;
    const textos: Record<string, string> = {};
    const anotar = (desc: bigint | number | undefined) => {
      if (desc === undefined) return;
      const s = this.motor.texto(desc);
      if (s) textos[String(desc)] = s;
    };
    if (d.type === T.SELECT_IDLECMD) d.activates.forEach((c) => anotar(c.description));
    if (d.type === T.SELECT_BATTLECMD) d.chains.forEach((c) => anotar(c.description));
    if (d.type === T.SELECT_CHAIN) d.selects.forEach((c) => anotar(c.description));
    if (d.type === T.SELECT_EFFECTYN || d.type === T.SELECT_YESNO) anotar(d.description);
    if (d.type === T.SELECT_OPTION) d.options.forEach(anotar);
    const dica = this.dicaDe(d.player);
    let candidatos: [number, string][] | undefined;
    if (d.type === T.ANNOUNCE_CARD) {
      candidatos = [];
      for (const id of Object.keys(this.motor.pacote.cartas)) {
        const c = this.motor.dados(Number(id));
        // artes alternativas ficam de fora (alias perto do próprio id)
        if (c && !(c.alias && Math.abs(c.alias - c.code) < 20) && cardMatchesOpcode(c, d.opcodes)) candidatos.push([c.code, this.motor.nome(c.code)]);
      }
    }
    return { msg: d, dica: dica.nome, dicaTexto: dica.texto, textos, ...(candidatos ? { candidatos } : {}), ...(repetir ? { repetir } : {}) };
  }

  quadro(repetir = false): Quadro {
    const eventos = this.eventos;
    this.eventos = [];
    return { estado: this.estado(), pedido: this.pedido(repetir), eventos, ...(this.fim ? { fim: this.fim } : {}) };
  }

  /** Dados que a IA precisa da partida (sem expor o resto) */
  get partida(): Partida {
    return this.cfg.partida;
  }
  get faseAtual() {
    return this.fase;
  }
  get jogadorDaVez() {
    return this.vez;
  }
}
