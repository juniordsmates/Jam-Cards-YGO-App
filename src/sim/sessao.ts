// Sessão do Simulador: um duelo com regras (motor do EDOPro) entre o jogador e a IA. Guarda todas
// as respostas dadas (o histórico): com a mesma semente, repetir o histórico refaz o duelo, e é
// assim que a IA testa jogadas (src/sim/ia.ts). Roda no Worker; a tela recebe só Quadros.
import { cardMatchesOpcode, OcgHintType, OcgLocation as L, OcgMessageType as T, OcgPhase, OcgResponseType as R, type OcgDuelHandle, type OcgMessage, type OcgResponse } from "ocgcore-wasm";
import { ehComando, executarComando, TIPO, TIPOS_EXTRA, type ComandoFicha, type Historico, type Jogada, type Motor, type Partida } from "./regras";
import { IA, type LinhaIA, type NivelIA } from "./ia";
import { passosDoLog, type Passo } from "./passos";
import type { CampoFinal } from "../db/motor";

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
  /** carta da mão revelada a todos (o oponente também vê) */
  pub?: boolean;
  /** Ficha (Token): dados para desenhar a carta (as criadas pelo jogador não têm imagem) */
  ficha?: { nome: string; nivel: number; atributo: number; raca: number };
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
  /** cadeia em aberto (elo 1 primeiro): carta, onde foi ativada e o texto do efeito */
  cadeia: { code: number; controller: number; location: number; sequence: number; texto?: string }[];
}

/** Acontecimentos do duelo, para o registro da tela */
export type EventoSim =
  | { t: "turno"; p: number; n: number }
  | { t: "fase"; fase: number }
  | { t: "compra"; p: number; codes: number[] }
  | { t: "invoca"; p: number; code: number; como: "normal" | "especial" | "virar" }
  | { t: "baixa"; p: number; code: number }
  /** ativação: elo da cadeia e onde a carta foi ativada (dono, local e posição) */
  | { t: "ativa"; p: number; code: number; texto?: string; elo: number; location: number; sequence: number }
  | { t: "resolve"; elo: number }
  | { t: "cadeia-fim" }
  | { t: "nega"; code?: number }
  | { t: "embaralha"; p: number }
  /** carta mudando de lugar (para a animação; não entra no registro) */
  | { t: "voo"; code: number; de: { p: number; local: number; seq: number }; para: { p: number; local: number; seq: number; baixada: boolean } }
  /** dado jogado pelo jogador (só no registro da tela) */
  | { t: "dado"; p: number; v: number }
  /** cartas mostradas ao jogador p (ex.: a mão do oponente, o topo do Deck) */
  | { t: "revela"; p: number; cartas: { code: number; controller: number; location: number }[] }
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
  /** carta cujo efeito está resolvendo (ou sendo ativado) quando a escolha aparece */
  carta?: number;
  /** ANNOUNCE_CARD: cartas que podem ser declaradas [id, nome em inglês] */
  candidatos?: [number, string][];
  /** a resposta anterior não valia: escolha de novo */
  repetir?: boolean;
}

/** O que provocou uma janela de resposta (o último acontecimento antes dela) */
export interface EventoJanela {
  tipo: "busca" | "invocacao" | "ativacao" | "ataque" | "compra" | "fase";
  /** foi o oponente de quem responde */
  doOponente: boolean;
  /** carta envolvida (a buscada, a invocada, a ativada, a que atacou) ou a fase */
  code?: number;
  fase?: number;
}

/** Janela de resposta que o jogador viu: o que podia ativar, o que fez e em que contexto */
export interface RespostaAprendida {
  /** posição da resposta no histórico (prova para refazer no motor) */
  n: number;
  turno: number;
  opcoes: number[];
  /** carta ativada; null = deixou passar */
  escolha: number | null;
  fase: number;
  minhaVez: boolean;
  evento: EventoJanela | null;
  /** cadeia aberta na hora (elo 1 primeiro) */
  cadeia: { code: number; minha: boolean }[];
}

/** Turno de combo do jogador: mão no início da Main Phase 1, passos e campo final */
export interface LinhaAprendida {
  /** tamanho do histórico no fim do turno (prova para refazer no motor) */
  n: number;
  turno: number;
  mao: number[];
  passos: Passo[];
  campo: CampoFinal;
  pontos: number;
}

/** O que um duelo ensina (só turnos e janelas do jogador deste aparelho), com a prova para conferir */
export interface Aprendizado {
  partida: Partida;
  humano: 0 | 1;
  remoto: boolean;
  historico: Jogada[];
  linhas: LinhaAprendida[];
  respostas: RespostaAprendida[];
}

/** Um momento da partida (antes da resposta de posição n): quem decide, em que turno e fase */
export interface Momento {
  n: number;
  turno: number;
  fase: number;
  vez: number;
  /** tipo da decisão (OcgMessageType) e jogador; null no fim do duelo */
  decisao: { tipo: number; jogador: number } | null;
}

/** Fatos do motor sobre uma carta de um jogador num momento (para o "?": por que não pôde) */
export interface FatosCarta {
  turno: number;
  fase: number;
  vez: number;
  decisao: { tipo: number; jogador: number } | null;
  /** onde o jogador tem a carta agora */
  locais: ("mao" | "deck" | "extra" | "cemiterio" | "banido" | "campo")[];
  /** a decisão era do jogador na Main/Battle Phase: o que o motor oferecia com a carta */
  oferecida: { normal: boolean; especial: boolean; ativar: boolean; baixar: boolean } | null;
  /** monstros do jogador no campo */
  monstros: { code: number; faceUp: boolean; tipo: number; nivel: number; extra: boolean }[];
  /** o jogador já tem monstro numa Zona de Monstros Extra; quantas estão livres; tem monstro Link no campo */
  emz: { minha: boolean; livres: number; temLink: boolean };
  zonasPrincipaisLivres: number;
  /** cartas ativadas no turno (dono) e cartas com a face para cima no campo (dono) */
  ativadasNoTurno: { code: number; p: number }[];
  faceParaCima: { code: number; p: number }[];
  /** quantas vezes a carta foi invocada neste turno pelo jogador */
  invocadaNoTurno: number;
}

export interface Quadro {
  estado: EstadoSim;
  pedido: PedidoSim | null;
  eventos: EventoSim[];
  fim?: { vencedor: number; motivo: number };
  /** a IA está decidindo (só nos quadros de progresso) */
  pensando?: boolean;
  /** duelo contra outra pessoa: é a vez do oponente decidir */
  aguardando?: boolean;
  /** duelo contra outra pessoa: respostas deste aparelho a enviar ao oponente (posição no histórico) */
  publicar?: { n: number; resp: Jogada }[];
  /** no fim do duelo: o que ele ensinou */
  aprendizado?: Aprendizado;
}

export interface ConfigSessao {
  partida: Partida;
  humano: 0 | 1;
  nivel: NivelIA;
  /** linhas de combo conhecidas do deck da IA (camada: combos calculados no motor) */
  linhas?: LinhaIA[];
  /** janelas de resposta do jogador: "acao" só pergunta logo depois de uma jogada da IA; "todas" pergunta sempre */
  janelas?: "acao" | "todas";
  /** o oponente é outra pessoa (partida 1x1): sem IA; as decisões dele chegam por `receberRemota` */
  remoto?: boolean;
  /** respostas já dadas no duelo (para voltar a uma partida 1x1 depois de cair) */
  historico?: Jogada[];
}

// código, posição, ATK, DEF, matérias, marcadores e se a carta é pública
const QUERY = (1 | 2 | 256 | 512 | 65536 | 131072 | 1048576) as never;

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
  private ia: IA | null;
  /** respostas conhecidas ainda não aplicadas (histórico salvo ou jogadas do oponente), em ordem */
  private pendentes: Jogada[] = [];
  /** jogadas do oponente que chegaram fora de ordem (posição → resposta) */
  private adiantadas = new Map<number, Jogada>();
  /** respostas deste aparelho que ainda não foram entregues à tela para envio */
  private saida: { n: number; resp: Jogada }[] = [];
  private eventos: EventoSim[] = [];
  /** pedido do jogador antes de uma resposta recusada (RETRY) */
  private ultimoPedido: OcgMessage | null = null;
  /** cartas da cadeia (pelo elo) e a que está resolvendo agora */
  private cadeia: number[] = [];
  private resolvendo: number | null = null;
  // aprendizado: registro do turno do jogador (desde a Main Phase 1), mão no começo dele, linhas e respostas
  private logTurno: OcgMessage[] | null = null;
  private maoInicio: number[] = [];
  private linhas: LinhaAprendida[] = [];
  private respostas: RespostaAprendida[] = [];
  private janela: Omit<RespostaAprendida, "escolha"> & { indices: number[] } | null = null;
  private ultimoEvento: { tipo: EventoJanela["tipo"]; p: number; code?: number; fase?: number } | null = null;
  /** ativações e invocações do turno atual (para o "?") */
  private ativacoesTurno: { code: number; p: number }[] = [];
  private invocacoesTurno: { code: number; p: number }[] = [];
  /** jogador e carta da última ativação (para a IA responder às do oponente) */
  ultimaAcao: { p: number; code: number; tipo: "ativa" | "invoca" | "ataque" } | null = null;

  constructor(
    readonly motor: Motor,
    readonly cfg: ConfigSessao,
  ) {
    this.ia = cfg.remoto ? null : new IA(cfg.nivel, (1 - cfg.humano) as 0 | 1, cfg.linhas ?? []);
    this.pendentes = [...(cfg.historico ?? [])];
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
      if (!repetida) this.ultimoPedido = d;
      const dono = (m: OcgMessage | null) => (m && "player" in m ? m.player : this.cfg.humano);
      // respostas já conhecidas (histórico salvo ou jogadas do oponente) vêm antes de perguntar
      // (comandos, como a Ficha criada, não consomem a decisão: sem resposta, segue para perguntá-la)
      if (this.pendentes.length && this.aplicarPendentes(dono(this.ultimoPedido))) continue;
      if (repetida) {
        // a última resposta não valia: quem respondeu escolhe de novo
        const ultimo = this.ultimoPedido;
        if (ultimo && dono(ultimo) === this.cfg.humano) {
          this.decisao = ultimo;
          return this.quadro(true);
        }
        d = ultimo ?? d;
        this.ia?.recusada();
      }
      this.decisao = d;
      // janela vazia (sem corrente aberta e sem jogada do oponente para responder, como nas mudanças de
      // fase): passa sozinha, a não ser que o jogador peça todas. Com corrente aberta, de qualquer
      // jogador, sempre pergunta: dá para encadear até à própria ativação (ex.: Infinite Impermanence
      // em cima da Mind Scan quando o oponente não responde)
      // spe_count > 0: o motor marca opções que não são de corrente livre (ex.: gatilhos que acabaram de
      // acontecer): também pergunta, para não pular um gatilho opcional do jogador
      const cadeiaAberta = d.type === T.SELECT_CHAIN && this.motor.core.duelQueryField(this.duel).chain.length > 0;
      // no turno do jogador, a Draw e a Standby esperam ele passar de fase (barra de fases da tela)
      const faseManual = this.vez === this.cfg.humano && (this.fase === OcgPhase.DRAW || this.fase === OcgPhase.STANDBY);
      if (d.type === T.SELECT_CHAIN && d.player === this.cfg.humano && !d.forced && !d.spe_count && !faseManual && this.cfg.janelas !== "todas" && !cadeiaAberta && (!this.ultimaAcao || this.ultimaAcao.p === this.cfg.humano)) {
        this.aplicar({ type: R.SELECT_CHAIN, index: null }, this.cfg.humano);
        continue;
      }
      if (dono(d) === this.cfg.humano) {
        if (d.type === T.SELECT_CHAIN && !d.forced && d.selects.length) this.abrirJanela(d.selects.map((c) => c.code));
        return this.quadro();
      }
      // partida 1x1: a decisão é do oponente, que responde do aparelho dele
      if (!this.ia) return { ...this.quadro(), aguardando: true };
      if (aoPensar && this.ia.vaiPensar(d, this)) aoPensar({ ...this.quadro(), pedido: null, pensando: true });
      this.aplicar(this.ia.decidir(d, this, repetida), dono(d));
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
    if (this.janela && resp.type === R.SELECT_CHAIN) {
      const { indices, ...j } = this.janela;
      this.respostas.push({ ...j, escolha: resp.index === null ? null : (indices[resp.index] ?? null) });
    }
    this.janela = null;
    this.aplicar(resp, this.cfg.humano);
    return this.avancar(aoPensar);
  }

  /**
   * Partida 1x1: jogada do oponente na posição n do histórico. Repetidas são ignoradas e as que
   * chegam antes da hora esperam a vez. Devolve o quadro novo quando o duelo andou.
   */
  receberRemota(n: number, resp: Jogada): Quadro | null {
    const proxima = () => this.historico.length + this.pendentes.length;
    if (n < proxima()) return null;
    this.adiantadas.set(n, resp);
    let chegou = false;
    while (this.adiantadas.has(proxima())) {
      const k = proxima();
      this.pendentes.push(this.adiantadas.get(k)!);
      this.adiantadas.delete(k);
      chegou = true;
    }
    // só anda se o duelo estava esperando o oponente (a decisão em aberto não é deste aparelho)
    if (!chegou || this.fim || !this.decisao || ("player" in this.decisao && this.decisao.player === this.cfg.humano)) return null;
    // a resposta vai antes de o motor processar de novo: processar sem resposta conta como "não ativar"
    return this.aplicarPendentes("player" in this.decisao ? this.decisao.player : 1 - this.cfg.humano) ? this.avancar() : this.quadro();
  }

  /** Aplica as jogadas conhecidas até a primeira resposta; devolve se alguma resposta foi dada ao motor */
  private aplicarPendentes(jogador: number): boolean {
    while (this.pendentes.length) {
      const j = this.pendentes.shift()!;
      this.aplicar(j, ehComando(j) ? j.jogador : jogador, false);
      if (!ehComando(j)) return true;
    }
    return false;
  }

  /**
   * "Criar Token": Ficha com os dados escolhidos na primeira Zona de Monstros livre do jogador, na
   * Main Phase dele. Em seguida, embaralha a mão (não muda o jogo) para o motor refazer a lista de
   * ações já com a Ficha. Fica no histórico: a revisão e o oponente (1x1) refazem a mesma Ficha.
   */
  criarFicha(f: Pick<ComandoFicha, "nome" | "nivel" | "atributo" | "raca" | "atk" | "def" | "posicao"> & { sequencia?: number }): Quadro {
    const humano = this.cfg.humano;
    const d = this.decisao;
    if (!d || this.fim || d.type !== T.SELECT_IDLECMD || d.player !== humano) throw new Error("Só dá para criar uma Ficha na sua Main Phase, quando você tem a ação.");
    const mz = this.motor.core.duelQueryLocation(this.duel, { flags: 1 as never, controller: humano, location: L.MZONE });
    const sequencia = f.sequencia !== undefined && f.sequencia >= 0 && f.sequencia <= 4 && !mz[f.sequencia]?.code ? f.sequencia : [0, 1, 2, 3, 4].find((i) => !mz[i]?.code);
    if (sequencia === undefined) throw new Error("Não há Zona de Monstros livre para a Ficha.");
    this.aplicar({ type: "ficha", code: 990000000 + this.historico.length, jogador: humano, ...f, sequencia }, humano);
    if (d.shuffle) {
      this.aplicar({ type: R.SELECT_IDLECMD, action: 8, index: null }, humano);
      return this.avancar();
    }
    return this.quadro();
  }

  /** `publicar`: jogada deste aparelho, que numa partida 1x1 vai para o oponente */
  private aplicar(resp: Jogada, jogador: number, publicar = true) {
    this.historico.push(resp);
    this.ia?.observar(resp, jogador);
    if (publicar && this.cfg.remoto && jogador === this.cfg.humano) this.saida.push({ n: this.historico.length - 1, resp });
    if (ehComando(resp)) executarComando(this.motor, this.duel, resp);
    else this.motor.core.duelSetResponse(this.duel, resp);
  }

  private lerLog(log: OcgMessage[]) {
    const ev = this.eventos;
    const humano = this.cfg.humano;
    for (const m of log) {
      this.logTurno?.push(m);
      switch (m.type) {
        case T.NEW_TURN:
          // fim do turno do jogador: vira linha de combo se foi um combo
          if (this.logTurno && this.vez === humano) this.fecharTurno();
          this.logTurno = null;
          this.ativacoesTurno = [];
          this.invocacoesTurno = [];
          this.turno++;
          this.vez = m.player as 0 | 1;
          ev.push({ t: "turno", p: m.player, n: this.turno });
          break;
        case T.NEW_PHASE:
          this.fase = m.phase;
          this.ultimoEvento = { tipo: "fase", p: this.vez, fase: m.phase };
          // Main Phase 1 do jogador: começa a registrar o turno (a mão é a de agora)
          if (m.phase === OcgPhase.MAIN1 && this.vez === humano) {
            this.logTurno = [];
            this.maoInicio = this.codigos(humano, L.HAND);
          }
          ev.push({ t: "fase", fase: m.phase });
          break;
        case T.DRAW:
          ev.push({ t: "compra", p: m.player, codes: m.drawn.map((c) => c.code) });
          this.ultimoEvento = { tipo: "compra", p: m.player };
          break;
        case T.SUMMONING:
          ev.push({ t: "invoca", p: m.controller, code: m.code, como: "normal" });
          this.ultimoEvento = { tipo: "invocacao", p: m.controller, code: m.code };
          this.invocacoesTurno.push({ code: this.canonico(m.code), p: m.controller });
          this.ultimaAcao = { p: m.controller, code: m.code, tipo: "invoca" };
          break;
        case T.SPSUMMONING:
          ev.push({ t: "invoca", p: m.controller, code: m.code, como: "especial" });
          this.ultimoEvento = { tipo: "invocacao", p: m.controller, code: m.code };
          this.invocacoesTurno.push({ code: this.canonico(m.code), p: m.controller });
          this.ultimaAcao = { p: m.controller, code: m.code, tipo: "invoca" };
          break;
        case T.FLIPSUMMONING:
          ev.push({ t: "invoca", p: m.controller, code: m.code, como: "virar" });
          break;
        case T.SET:
          ev.push({ t: "baixa", p: m.controller, code: m.code });
          break;
        case T.CHAINING:
          this.cadeia[m.chain_size - 1] = m.code;
          ev.push({ t: "ativa", p: m.controller, code: m.code, texto: this.motor.texto(m.description), elo: m.chain_size, location: m.triggering_location, sequence: m.triggering_sequence });
          this.ultimoEvento = { tipo: "ativacao", p: m.controller, code: m.code };
          this.ativacoesTurno.push({ code: this.canonico(m.code), p: m.controller });
          this.ultimaAcao = { p: m.controller, code: m.code, tipo: "ativa" };
          break;
        case T.CHAIN_SOLVING:
          this.resolvendo = this.cadeia[m.chain_size - 1] ?? null;
          break;
        case T.CHAIN_SOLVED:
          ev.push({ t: "resolve", elo: m.chain_size });
          break;
        case T.CHAIN_END:
          this.cadeia = [];
          this.resolvendo = null;
          ev.push({ t: "cadeia-fim" });
          break;
        case T.CONFIRM_CARDS:
        case T.CONFIRM_DECKTOP:
        case T.CONFIRM_EXTRATOP:
          if (m.cards.length) ev.push({ t: "revela", p: m.player, cartas: m.cards.map((c) => ({ code: c.code, controller: c.controller, location: c.location })) });
          break;
        case T.SHUFFLE_DECK:
          ev.push({ t: "embaralha", p: m.player });
          break;
        case T.CHAIN_NEGATED:
        case T.CHAIN_DISABLED:
          ev.push({ t: "nega" });
          break;
        case T.MOVE: {
          // só o que interessa ao jogador: cartas que saem do campo ou da mão, ou voltam a ela
          const de = m.from.location;
          const para = m.to.location;
          // carta do Deck para a mão fora da compra: busca (o que, por exemplo, ativa Droll & Lock Bird)
          if (de === L.DECK && para === L.HAND) this.ultimoEvento = { tipo: "busca", p: m.to.controller, code: m.card };
          if (de !== para || m.from.controller !== m.to.controller)
            ev.push({
              t: "voo",
              code: m.card,
              de: { p: m.from.controller, local: de, seq: m.from.sequence },
              para: { p: m.to.controller, local: para, seq: m.to.sequence, baixada: (((m.to as { position?: number }).position ?? 0) & 0xa) !== 0 },
            });
          if (de !== para && m.card && !(de === L.DECK && para === L.HAND) && (para & (L.GRAVE | L.REMOVED | L.HAND | L.DECK | L.EXTRA) || de & L.ONFIELD))
            ev.push({ t: "move", code: m.card, de, para, p: m.to.controller });
          break;
        }
        case T.ATTACK: {
          const a = this.cartaEm(m.card.controller, m.card.location, m.card.sequence);
          const alvo = m.target ? this.cartaEm(m.target.controller, m.target.location, m.target.sequence) : undefined;
          ev.push({ t: "ataque", p: m.card.controller, code: a ?? 0, alvo });
          this.ultimoEvento = { tipo: "ataque", p: m.card.controller, code: a };
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
            if (this.logTurno && this.vez === humano) this.fecharTurno();
            this.logTurno = null;
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

  /** Ids (arte original) das cartas de um jogador num local */
  private codigos(p: number, location: number): number[] {
    return this.motor.core
      .duelQueryLocation(this.duel, { flags: 1 as never, controller: p as 0, location: location as L })
      .map((c) => (c?.code as number | undefined) ?? 0)
      .filter(Boolean)
      .map((c) => this.canonico(c));
  }

  private canonico(code: number) {
    const alias = this.motor.dados(code)?.alias ?? 0;
    return alias && Math.abs(alias - code) < 20 ? alias : code;
  }

  /** Fecha o turno do jogador: guarda a linha se foi um combo */
  private fecharTurno() {
    const linha = this.linhaDoTurno();
    if (linha) this.linhas.push(linha);
  }

  /** Linha do turno do jogador registrado até agora, se foi um combo (Invocação do Extra Deck ou 3+ Invocações) */
  private linhaDoTurno(): LinhaAprendida | null {
    const humano = this.cfg.humano;
    const tipo = this.motor.tipo;
    const passos = passosDoLog(this.logTurno ?? [], tipo, humano);
    const invocacoes = passos.filter((p) => p.t === "invoca" || p.t === "normal");
    const doExtra = passos.some((p) => p.t === "invoca" && p.de === "extra");
    if (!doExtra && invocacoes.length < 3) return null;
    const q = (location: number) =>
      this.motor.core.duelQueryLocation(this.duel, { flags: (1 | 2) as never, controller: humano, location: location as L }).filter((c): c is NonNullable<typeof c> => !!c?.code);
    const monstros = q(L.MZONE).map((c) => (tipo(c.code as number) & TIPO.FICHA ? 0 : this.canonico(c.code as number)));
    const magias = [...q(L.SZONE), ...q(L.FZONE)].map((c) => [this.canonico(c.code as number), (((c.position as number) ?? 0) & 0xa) !== 0] as [number, boolean]);
    const mao = this.codigos(humano, L.HAND);
    // mesma pontuação de campo das linhas do pipeline: monstros do Extra valem mais, baixadas são interrupções
    const pontos = monstros.reduce((n, c) => n + (c && tipo(c) & TIPOS_EXTRA ? 3 : 1.5), 0) + magias.reduce((n, [, baixada]) => n + (baixada ? 2 : 1), 0) + mao.length;
    const ficha = (c: number) => (tipo(c) & TIPO.FICHA ? 0 : this.canonico(c));
    return {
      n: this.historico.length,
      turno: this.turno,
      mao: this.maoInicio,
      passos: passos.map((p) => (p.t === "compra" ? p : ({ ...p, c: p.c && ficha(p.c), ...("mat" in p && p.mat ? { mat: p.mat.map(ficha) } : {}), ...("por" in p && p.por ? { por: ficha(p.por) } : {}) } as Passo))),
      campo: { monstros, magias, mao },
      pontos,
    };
  }

  /** Janela de resposta que o jogador vai ver: guarda o contexto até ele responder */
  private abrirJanela(indices: number[]) {
    const humano = this.cfg.humano;
    const e = this.ultimoEvento;
    const cadeia = this.motor.core.duelQueryField(this.duel).chain.map((c) => ({ code: this.canonico(c.code), minha: c.triggering_controller === humano }));
    this.janela = {
      n: this.historico.length,
      turno: this.turno,
      indices: indices.map((c) => this.canonico(c)),
      opcoes: [...new Set(indices.map((c) => this.canonico(c)))],
      fase: this.fase,
      minhaVez: this.vez === humano,
      evento: e ? { tipo: e.tipo, doOponente: e.p !== humano, ...(e.code ? { code: this.canonico(e.code) } : {}), ...(e.fase ? { fase: e.fase } : {}) } : null,
      cadeia,
    };
  }

  /** Cartas ativadas neste turno (id e jogador) */
  get ativadasNoTurno() {
    return this.ativacoesTurno;
  }

  /** Último acontecimento do duelo (busca, Invocação, ativação, ataque, compra, fase) e de quem foi */
  get eventoRecente() {
    return this.ultimoEvento;
  }

  /** Decisão em aberto (de qualquer jogador) */
  decisaoPendente(): { tipo: number; jogador: number } | null {
    const d = this.decisao;
    if (!d || this.fim) return null;
    return { tipo: d.type, jogador: "player" in d ? d.player : this.cfg.humano };
  }

  /** Momento atual: posição no histórico, turno, fase, de quem é a vez e a decisão em aberto */
  momento(): Momento {
    return { n: this.historico.length + this.pendentes.length, turno: this.turno, fase: this.fase, vez: this.vez, decisao: this.decisaoPendente() };
  }

  /** Aplica uma resposta do histórico (de qualquer jogador) e avança até a próxima decisão */
  passo(resp: Jogada) {
    this.pendentes.push(resp);
    if (!this.decisao) return this.avancar();
    return this.aplicarPendentes(this.decisaoPendente()?.jogador ?? this.cfg.humano) ? this.avancar() : this.quadro();
  }

  /** Libera o duelo no motor (revisões criam sessões temporárias) */
  encerrar() {
    this.motor.core.destroyDuel(this.duel);
  }

  /** Fatos do motor sobre a carta `code` do jogador agora (o "?": por que não pôde usar) */
  fatos(code: number, jogador: number): FatosCarta {
    const core = this.motor.core;
    const alvo = this.canonico(code);
    const q = (p: number, location: number) => core.duelQueryLocation(this.duel, { flags: (1 | 2) as never, controller: p as 0, location: location as L });
    const tem = (p: number, location: number) => q(p, location).some((c) => c?.code && this.canonico(c.code as number) === alvo);
    const locais: FatosCarta["locais"] = [];
    if (tem(jogador, L.HAND)) locais.push("mao");
    if (tem(jogador, L.DECK)) locais.push("deck");
    if (tem(jogador, L.EXTRA)) locais.push("extra");
    if (tem(jogador, L.GRAVE)) locais.push("cemiterio");
    if (tem(jogador, L.REMOVED)) locais.push("banido");
    if (tem(jogador, L.MZONE) || tem(jogador, L.SZONE) || tem(jogador, L.FZONE)) locais.push("campo");
    const d = this.decisao;
    let oferecida: FatosCarta["oferecida"] = null;
    if (d && !this.fim && "player" in d && d.player === jogador && (d.type === T.SELECT_IDLECMD || d.type === T.SELECT_BATTLECMD)) {
      const e = (lista: { code: number }[]) => lista.some((c) => this.canonico(c.code) === alvo);
      oferecida =
        d.type === T.SELECT_IDLECMD
          ? { normal: e(d.summons) || e(d.monster_sets), especial: e(d.special_summons), ativar: e(d.activates), baixar: e(d.spell_sets) }
          : { normal: false, especial: false, ativar: e(d.chains), baixar: false };
    }
    const mz = q(jogador, L.MZONE);
    const mzOp = q(1 - jogador, L.MZONE);
    const monstros = mz
      .filter((c): c is NonNullable<typeof c> => !!c?.code)
      .map((c) => {
        const dados = this.motor.dados(c.code as number);
        const tipo = (dados?.type as number) ?? 0;
        return { code: this.canonico(c.code as number), faceUp: (((c.position as number) ?? 0) & 5) !== 0, tipo, nivel: dados?.level ?? 0, extra: (tipo & TIPOS_EXTRA) !== 0 };
      });
    // Zonas de Monstros Extra: 5 e 6 de cada lado (a esquerda de um é a direita do outro)
    const minha = !!mz[5]?.code || !!mz[6]?.code;
    const livres = (mz[5]?.code || mzOp[6]?.code ? 0 : 1) + (mz[6]?.code || mzOp[5]?.code ? 0 : 1);
    const faceParaCima: FatosCarta["faceParaCima"] = [];
    for (const p of [0, 1])
      for (const loc of [L.MZONE, L.SZONE, L.FZONE])
        for (const c of q(p, loc)) if (c?.code && ((c.position as number) ?? 0) & 5) faceParaCima.push({ code: this.canonico(c.code as number), p });
    return {
      turno: this.turno,
      fase: this.fase,
      vez: this.vez,
      decisao: this.decisaoPendente(),
      locais,
      oferecida,
      monstros,
      emz: { minha, livres: minha ? 0 : livres, temLink: monstros.some((m) => m.tipo & TIPO.LINK) },
      zonasPrincipaisLivres: [0, 1, 2, 3, 4].filter((i) => !mz[i]?.code).length,
      ativadasNoTurno: [...this.ativacoesTurno],
      faceParaCima,
      invocadaNoTurno: this.invocacoesTurno.filter((x) => x.p === jogador && x.code === alvo).length,
    };
  }

  /** O que o duelo ensinou até agora (turnos e janelas só do jogador deste aparelho) */
  aprendizado(): Aprendizado {
    // turno do jogador ainda aberto (desistiu no meio dele): entra se já é um combo
    const aberta = this.logTurno && this.vez === this.cfg.humano ? this.linhaDoTurno() : null;
    return { partida: this.cfg.partida, humano: this.cfg.humano, remoto: !!this.cfg.remoto, historico: [...this.historico], linhas: aberta ? [...this.linhas, aberta] : this.linhas, respostas: this.respostas };
  }

  estado(): EstadoSim {
    const core = this.motor.core;
    const campo = core.duelQueryField(this.duel);
    const lado = (p: 0 | 1): LadoSim => {
      const q = (location: number) =>
        core.duelQueryLocation(this.duel, { flags: QUERY, controller: p, location: location as L }).map((c): CartaSim | null => {
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
            ...(r.isPublic ? { pub: true } : {}),
            ...(this.motor.tipo(r.code as number) & TIPO.FICHA
              ? (() => {
                  const dd = this.motor.dados(r.code as number);
                  return { ficha: { nome: this.motor.nome(r.code as number), nivel: dd?.level ?? 0, atributo: (dd?.attribute as number) ?? 0, raca: Number(dd?.race ?? 0) } };
                })()
              : {}),
          };
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
      cadeia: campo.chain.map((c) => ({ code: c.code, controller: c.triggering_controller, location: c.triggering_location, sequence: c.triggering_sequence, texto: this.motor.texto(c.description) })),
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
    // carta do efeito: a que está resolvendo, ou a que pergunta (efeito opcional)
    const carta = d.type === T.SELECT_EFFECTYN ? d.code : (this.resolvendo ?? undefined);
    return { msg: d, dica: dica.nome, dicaTexto: dica.texto, textos, ...(carta ? { carta } : {}), ...(candidatos ? { candidatos } : {}), ...(repetir ? { repetir } : {}) };
  }

  quadro(repetir = false): Quadro {
    const eventos = this.eventos;
    this.eventos = [];
    const publicar = this.saida;
    this.saida = [];
    return { estado: this.estado(), pedido: this.pedido(repetir), eventos, ...(this.fim ? { fim: this.fim, aprendizado: this.aprendizado() } : {}), ...(publicar.length ? { publicar } : {}) };
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
