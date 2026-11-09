// IA do Simulador. Na Main Phase 1 dela, a IA planeja: repete o duelo até o ponto atual (o motor é
// determinístico) e joga o turno várias vezes com escolhas sorteadas, puxadas para as cartas das
// linhas de combo conhecidas do deck; fica com a sequência que deixou o melhor campo e a executa.
// Se o jogador responder diferente do que o plano previa, ela planeja de novo. Batalha, respostas
// no turno do oponente e escolhas fora do plano seguem regras simples.
import { OcgLocation as L, OcgMessageType as T, OcgPhase, OcgResponseType as R, type OcgDuelHandle, type OcgMessage, type OcgResponse } from "ocgcore-wasm";
import type { LinhaCombo } from "../db/motor";
import { reproduzir, TIPO, TIPOS_EXTRA, type Motor } from "./regras";
import { opcoesDe, type Opcao, type RefCarta } from "./opcoes";
import type { Sessao } from "./sessao";

export type NivelIA = "passiva" | "facil" | "normal" | "dificil";
export type LinhaIA = Pick<LinhaCombo, "mao" | "passos" | "campo" | "pontos">;

/** tempo de planejamento do turno (ms); a Fácil joga uma tentativa só */
const TEMPO: Record<NivelIA, number> = { passiva: 0, facil: 0, normal: 1500, dificil: 4000 };
/** chance de responder a uma jogada do oponente com o que tiver (interrupções de mão, armadilhas) */
const RESPONDE: Record<NivelIA, number> = { passiva: 0, facil: 0.15, normal: 0.6, dificil: 1 };
const MAX_TENTATIVAS = 400;

// código, posição, ATK, DEF e matérias
const QUERY = (1 | 2 | 256 | 512 | 65536) as never;

// dicas de seleção (HINTMSG_*) em que a escolha prejudica a carta escolhida
const HOSTIS = new Set(["DESTROY", "REMOVE", "TOGRAVE", "RTOHAND", "TODECK", "CONTROL", "FACEDOWN", "POSCHANGE", "DISABLE", "NEGATE", "ATTACKTARGET", "TARGET", "DEATTACHFROM"]);
// dicas de custo: gastar as cartas que valem menos
const CUSTOS = new Set(["RELEASE", "DISCARD", "XMATERIAL", "SMATERIAL", "LMATERIAL", "FMATERIAL", "REMOVEXYZ", "TRIBUTE"]);

const igual = (a: OcgResponse, b: OcgResponse) => JSON.stringify(a, (_, v) => (typeof v === "bigint" ? String(v) : v)) === JSON.stringify(b, (_, v) => (typeof v === "bigint" ? String(v) : v));

/** tipo de resposta que cada decisão aceita (para conferir o plano) */
const RESPOSTA_DE: Partial<Record<number, number>> = {
  [T.SELECT_BATTLECMD]: R.SELECT_BATTLECMD,
  [T.SELECT_IDLECMD]: R.SELECT_IDLECMD,
  [T.SELECT_EFFECTYN]: R.SELECT_EFFECTYN,
  [T.SELECT_YESNO]: R.SELECT_YESNO,
  [T.SELECT_OPTION]: R.SELECT_OPTION,
  [T.SELECT_CARD]: R.SELECT_CARD,
  [T.SELECT_CHAIN]: R.SELECT_CHAIN,
  [T.SELECT_PLACE]: R.SELECT_PLACE,
  [T.SELECT_DISFIELD]: R.SELECT_DISFIELD,
  [T.SELECT_POSITION]: R.SELECT_POSITION,
  [T.SELECT_TRIBUTE]: R.SELECT_TRIBUTE,
  [T.SELECT_COUNTER]: R.SELECT_COUNTER,
  [T.SELECT_SUM]: R.SELECT_SUM,
  [T.SORT_CARD]: R.SORT_CARD,
  [T.SORT_CHAIN]: R.SORT_CARD,
  [T.SELECT_UNSELECT_CARD]: R.SELECT_UNSELECT_CARD,
  [T.ANNOUNCE_RACE]: R.ANNOUNCE_RACE,
  [T.ANNOUNCE_ATTRIB]: R.ANNOUNCE_ATTRIB,
  [T.ANNOUNCE_CARD]: R.ANNOUNCE_CARD,
  [T.ANNOUNCE_NUMBER]: R.ANNOUNCE_NUMBER,
  [T.ROCK_PAPER_SCISSORS]: R.ROCK_PAPER_SCISSORS,
};

/** Sorteia uma opção pelo peso */
function sortear(ops: Opcao[], peso: (o: Opcao) => number): Opcao {
  const pesos = ops.map((o) => Math.max(0, peso(o)));
  let x = Math.random() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ops.length; i++) if ((x -= pesos[i]) <= 0) return ops[i];
  return ops[ops.length - 1];
}

/** Resposta de quem não interage (o oponente nas simulações, a IA Passiva) */
function passivo(d: OcgMessage, motor: Motor): OcgResponse | undefined {
  if (d.type === T.SELECT_CHAIN && !d.forced) return { type: R.SELECT_CHAIN, index: null };
  if (d.type === T.SELECT_EFFECTYN) return { type: R.SELECT_EFFECTYN, yes: false };
  if (d.type === T.SELECT_YESNO) return { type: R.SELECT_YESNO, yes: false };
  const ops = opcoesDe(d, motor.tipo);
  if (d.type === T.SELECT_IDLECMD || d.type === T.SELECT_BATTLECMD) {
    const ep = ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "ep");
    if (ep) return ep.resp;
  }
  return ops[0]?.resp;
}

export class IA {
  private plano: { resps: OcgResponse[]; i: number } | null = null;
  private tentativa = 0;
  /** alvo escolhido para o ataque em andamento */
  private alvo: RefCarta | null = null;

  constructor(
    readonly nivel: NivelIA,
    readonly eu: 0 | 1,
    readonly linhas: LinhaIA[],
  ) {}

  /** A última resposta da IA não valia (RETRY): a próxima tentativa usa outra opção */
  recusada() {
    this.tentativa++;
    this.plano = null;
  }

  /** Respostas dadas no duelo: as do jogador conferem o plano (se ele fez outra coisa, o plano cai) */
  observar(resp: OcgResponse, jogador: number) {
    if (!this.plano || jogador === this.eu) return;
    const esperado = this.plano.resps[this.plano.i];
    if (esperado && igual(esperado, resp)) this.plano.i++;
    else this.plano = null;
  }

  /** A decisão vai fazer a IA planejar (a tela mostra "pensando") */
  vaiPensar(d: OcgMessage, s: Sessao) {
    return this.nivel !== "passiva" && TEMPO[this.nivel] > 0 && !this.plano && d.type === T.SELECT_IDLECMD && s.faseAtual === OcgPhase.MAIN1;
  }

  decidir(d: OcgMessage, s: Sessao, repetida = false): OcgResponse {
    const motor = s.motor;
    const ops = opcoesDe(d, motor.tipo);
    if (!repetida) this.tentativa = 0;
    else if (ops.length) return ops[this.tentativa % ops.length].resp;
    const fallback = ops[0]?.resp ?? passivo(d, motor) ?? { type: R.SELECT_CHAIN, index: null };

    // seguindo o plano do turno
    if (this.plano) {
      const r = this.plano.resps[this.plano.i];
      if (r && r.type === RESPOSTA_DE[d.type]) {
        this.plano.i++;
        if (this.plano.i >= this.plano.resps.length) this.plano = null;
        return r;
      }
      this.plano = null;
    }
    if (this.nivel === "passiva") return passivo(d, motor) ?? fallback;

    switch (d.type) {
      case T.SELECT_IDLECMD: {
        if (s.faseAtual === OcgPhase.MAIN1) {
          this.planejar(s);
          if (this.plano) return this.decidir(d, s);
          const bp = ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "bp");
          if (bp && this.atacantes(s) > 0) return bp.resp;
        }
        // Main Phase 2 (ou nada melhor a fazer): baixa interrupções e passa
        const baixa = ops.find((o) => o.acao?.k === "baixa");
        if (baixa) return baixa.resp;
        return (ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "ep") ?? ops[0])?.resp ?? fallback;
      }
      case T.SELECT_BATTLECMD:
        return this.batalha(d, s, ops) ?? fallback;
      case T.SELECT_CHAIN: {
        if (!d.selects.length) return fallback;
        const ativar = ops.find((o) => !o.recusa && o.acao?.k === "ativa");
        if (!ativar || d.forced) return ativar?.resp ?? fallback;
        const ultima = s.ultimaAcao;
        // responde às jogadas do oponente com a chance do nível; no próprio turno, ativa os gatilhos
        if (ultima && ultima.p !== this.eu) return Math.random() < RESPONDE[this.nivel] ? ativar.resp : { type: R.SELECT_CHAIN, index: null };
        if (s.jogadorDaVez === this.eu && this.nivel !== "facil") return ativar.resp;
        return { type: R.SELECT_CHAIN, index: null };
      }
      case T.SELECT_EFFECTYN:
        return { type: R.SELECT_EFFECTYN, yes: true };
      case T.SELECT_YESNO:
        return { type: R.SELECT_YESNO, yes: true };
      case T.SELECT_CARD:
      case T.SELECT_TRIBUTE:
      case T.SELECT_UNSELECT_CARD:
        return this.escolherCartas(s, ops) ?? fallback;
      default:
        return fallback;
    }
  }

  // ---------- batalha ----------

  private campo(motor: Motor, duel: OcgDuelHandle, p: number, location: number) {
    return motor.core
      .duelQueryLocation(duel, { flags: QUERY, controller: p as 0, location: location as L })
      .map((c, sequence) => (c?.code ? { code: c.code as number, pos: (c.position as number) ?? 0, atk: (c.attack as number) ?? 0, def: (c.defense as number) ?? 0, sequence } : null));
  }

  /** Monstros da IA em Posição de Ataque */
  private atacantes(s: Sessao) {
    return this.campo(s.motor, s.duel, this.eu, L.MZONE).filter((c) => c && c.pos & 1).length;
  }

  /** Melhor alvo de um atacante: o que ele destrói com mais valor; null = ataque direto; undefined = não ataca */
  private melhorAlvo(s: Sessao, atk: number): RefCarta | null | undefined {
    const op = 1 - this.eu;
    const monstros = this.campo(s.motor, s.duel, op, L.MZONE).filter(Boolean) as NonNullable<ReturnType<IA["campo"]>[number]>[];
    if (!monstros.length) return null;
    let melhor: { ref: RefCarta; v: number } | undefined;
    for (const m of monstros) {
      const baixo = (m.pos & 0xa) !== 0;
      // virado para baixo: o ATK/DEF não é visível para quem ataca; só arrisca com ATK alto
      const vence = baixo ? atk >= 2000 : m.pos & 1 ? atk > m.atk : atk > m.def;
      if (!vence) continue;
      const v = baixo ? 1 : m.atk / 1000 + (s.motor.tipo(m.code) & TIPOS_EXTRA ? 2 : 0);
      if (!melhor || v > melhor.v) melhor = { ref: { code: m.code, controller: op, location: L.MZONE, sequence: m.sequence }, v };
    }
    return melhor?.ref;
  }

  private batalha(d: Extract<OcgMessage, { type: T.SELECT_BATTLECMD }>, s: Sessao, ops: Opcao[]): OcgResponse | undefined {
    let melhor: { i: number; atk: number; alvo: RefCarta | null } | undefined;
    d.attacks.forEach((a, i) => {
      const c = s.motor.core.duelQuery(s.duel, { flags: 256 as never, controller: a.controller, location: a.location, sequence: a.sequence, overlaySequence: 0 });
      const atk = (c?.attack as number) ?? 0;
      const alvo = this.melhorAlvo(s, atk);
      if (alvo === undefined || (alvo === null && !a.can_direct)) return;
      if (!melhor || atk > melhor.atk) melhor = { i, atk, alvo };
    });
    if (melhor) {
      this.alvo = melhor.alvo;
      return { type: R.SELECT_BATTLECMD, action: 1, index: melhor.i };
    }
    this.alvo = null;
    const m2 = ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "m2");
    const ep = ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "ep");
    return (m2 ?? ep)?.resp;
  }

  // ---------- escolha de cartas fora do plano ----------

  private valor(motor: Motor, c: RefCarta, linha: Set<number>) {
    const dados = motor.dados(c.code);
    let v = dados && dados.type & TIPO.MONSTRO ? dados.attack / 1000 + (dados.type & TIPOS_EXTRA ? 2 : 0) : 1;
    if (c.location & L.ONFIELD) v += 1;
    if (linha.has(this.canonico(motor, c.code))) v += 1.5;
    return v;
  }

  private escolherCartas(s: Sessao, ops: Opcao[]): OcgResponse | undefined {
    const dica = s.dicaDe(this.eu).nome?.replace(/^HINTMSG_/, "") ?? "";
    if (dica === "ATTACKTARGET" && this.alvo) {
      const alvo = this.alvo;
      const o = ops.find((x) => x.escolha?.some((c) => c.controller === alvo.controller && c.sequence === alvo.sequence && c.location === alvo.location));
      if (o) return o.resp;
    }
    const comEscolha = ops.filter((o) => o.escolha?.length);
    if (!comEscolha.length) return ops[0]?.resp;
    const linha = this.cartasDasLinhas(s).passos;
    const hostil = HOSTIS.has(dica);
    const custo = CUSTOS.has(dica);
    const nota = (o: Opcao) =>
      o.escolha!.reduce((n, c) => {
        const v = this.valor(s.motor, c, linha);
        if (hostil) return n + (c.controller !== this.eu ? v : -v);
        if (custo) return n - v;
        return n + (c.controller === this.eu ? v : -v);
      }, 0) - (custo ? 0.01 * o.escolha!.length : 0);
    return comEscolha.reduce((a, b) => (nota(b) > nota(a) ? b : a)).resp;
  }

  // ---------- planejamento do turno ----------

  private canonico(motor: Motor, code: number) {
    const alias = motor.dados(code)?.alias ?? 0;
    return alias && Math.abs(alias - code) < 20 ? alias : code;
  }

  /** Linhas conhecidas que a mão atual da IA pode jogar: cartas dos passos e do campo final */
  private cartasDasLinhas(s: Sessao) {
    const motor = s.motor;
    const mao = new Map<number, number>();
    for (const c of motor.core.duelQueryLocation(s.duel, { flags: 1 as never, controller: this.eu, location: L.HAND })) {
      if (!c?.code) continue;
      const k = this.canonico(motor, c.code as number);
      mao.set(k, (mao.get(k) ?? 0) + 1);
    }
    const cabe = (l: LinhaIA) => {
      const precisa = new Map<number, number>();
      for (const c of l.mao) precisa.set(c, (precisa.get(c) ?? 0) + 1);
      return [...precisa].every(([c, n]) => (mao.get(c) ?? 0) >= n);
    };
    const linhas = this.linhas.filter(cabe).sort((a, b) => b.pontos - a.pontos).slice(0, 3);
    const passos = new Set<number>();
    const campo = new Set<number>();
    for (const l of linhas) {
      for (const p of l.passos) for (const c of Array.isArray(p.c) ? p.c : [p.c]) passos.add(c);
      l.campo.monstros.forEach((c) => c && campo.add(c));
      l.campo.magias.forEach(([c]) => campo.add(c));
    }
    return { passos, campo };
  }

  /** Nota do campo da IA: monstros (do Extra valem mais), interrupções baixadas, mão, campo do oponente e PV */
  private nota(motor: Motor, duel: OcgDuelHandle, alvo: Set<number>) {
    const op = 1 - this.eu;
    const q = (p: number, location: number) => this.campo(motor, duel, p, location).filter(Boolean) as NonNullable<ReturnType<IA["campo"]>[number]>[];
    let n = 0;
    for (const m of q(this.eu, L.MZONE)) {
      n += (motor.tipo(m.code) & TIPOS_EXTRA ? 3 : 1.5) + (0.6 * m.atk) / 1000;
      if (alvo.has(this.canonico(motor, m.code))) n += 2;
    }
    for (const c of q(this.eu, L.SZONE)) {
      n += c.pos & 0xa ? 2 : 1;
      if (alvo.has(this.canonico(motor, c.code))) n += 2;
    }
    n += 0.7 * motor.core.duelQueryCount(duel, this.eu, L.HAND);
    n -= 1.2 * (q(op, L.MZONE).length + q(op, L.SZONE).length);
    const campo = motor.core.duelQueryField(duel);
    // o motor manda os PV sem sinal: abaixo de 0 vira um número enorme
    const lp = (p: number) => ((campo.players[p] as unknown as { lp?: number }).lp ?? 8000) | 0;
    n += (lp(this.eu) - lp(op)) / 4000;
    return n;
  }

  /** Uma tentativa do turno: escolhas sorteadas até a IA passar de fase */
  private tentar(s: Sessao, linha: Set<number>, alvo: Set<number>): { resps: OcgResponse[]; nota: number } | null {
    const motor = s.motor;
    const { duel, decisao } = reproduzir(motor, s.partida, s.historico);
    try {
      const resps: OcgResponse[] = [];
      let d = decisao;
      let acoes = 0;
      for (let passo = 0; d && passo < 400; passo++) {
        if (d.type === T.RETRY) return null;
        let resp: OcgResponse | undefined;
        let parar = false;
        if (!("player" in d) || d.player !== this.eu) resp = passivo(d, motor);
        else if (d.type === T.SELECT_BATTLECMD) break;
        else {
          const ops = opcoesDe(d, motor.tipo);
          if (d.type === T.SELECT_IDLECMD) {
            acoes++;
            const fases = ops.filter((o) => o.acao?.k === "fase");
            const jogadas = ops.filter((o) => o.acao && o.acao.k !== "fase" && o.acao.k !== "posicao");
            if (!jogadas.length || acoes > 30 || Math.random() < 0.03 * acoes) {
              resp = (fases.find((o) => o.acao!.desc === "bp") ?? fases.find((o) => o.acao!.desc === "ep") ?? ops[0])?.resp;
              parar = true;
            } else {
              const base: Record<string, number> = { ativa: 3, especial: 3, normal: 2, baixa: 1, "baixa-monstro": 0.4 };
              resp = sortear(jogadas, (o) => (base[o.acao!.k] ?? 1) * (o.acao!.code && linha.has(this.canonico(motor, o.acao!.code)) ? 4 : 1)).resp;
            }
          } else if (ops.length) {
            resp = sortear(ops, (o) => {
              if (o.recusa) return 0.6;
              if (d!.type === T.SELECT_EFFECTYN || d!.type === T.SELECT_CHAIN) return 3;
              return o.escolha?.some((c) => linha.has(this.canonico(motor, c.code))) ? 3 : 1;
            }).resp;
          }
        }
        if (!resp) return null;
        resps.push(resp);
        motor.core.duelSetResponse(duel, resp);
        if (parar) break;
        const r = motor.ate(duel);
        if (r.log.some((m) => m.type === T.WIN)) return { resps, nota: r.log.some((m) => m.type === T.WIN && m.player === this.eu) ? 1e6 : -1e6 };
        if (r.log.some((m) => m.type === T.NEW_TURN)) break;
        d = r.decisao;
      }
      return { resps, nota: this.nota(motor, duel, alvo) };
    } finally {
      motor.core.destroyDuel(duel);
    }
  }

  private planejar(s: Sessao) {
    const { passos, campo } = this.cartasDasLinhas(s);
    const base = this.nota(s.motor, s.duel, campo);
    const inicio = performance.now();
    let melhor: { resps: OcgResponse[]; nota: number } | null = null;
    for (let n = 0; n < MAX_TENTATIVAS; n++) {
      const r = this.tentar(s, passos, campo);
      if (r && (!melhor || r.nota > melhor.nota)) melhor = r;
      if (performance.now() - inicio >= TEMPO[this.nivel]) break;
    }
    // só joga se a sequência deixa o campo melhor do que passar a vez
    this.plano = melhor && melhor.nota > base && melhor.resps.length ? { resps: melhor.resps, i: 0 } : null;
  }
}
