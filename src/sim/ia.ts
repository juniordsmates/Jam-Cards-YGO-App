// IA do Simulador. Na Main Phase 1 dela, a IA planeja: repete o duelo até o ponto atual (o motor é
// determinístico) e joga o turno várias vezes com escolhas sorteadas, puxadas para as cartas das
// linhas de combo conhecidas do deck; fica com a sequência que deixou o melhor campo e a executa.
// Se o jogador responder diferente do que o plano previa, ela planeja de novo. Batalha, respostas
// no turno do oponente e escolhas fora do plano seguem regras simples.
import { cardMatchesOpcode, OcgHintType, OcgLocation as L, OcgMessageType as T, OcgPhase, OcgResponseType as R, type OcgDuelHandle, type OcgMessage, type OcgResponse } from "ocgcore-wasm";
import type { LinhaCombo, Passo } from "../db/motor";
import { reproduzir, TIPO, TIPOS_EXTRA, type Jogada, type Motor } from "./regras";
import { opcoesDe, type Opcao, type RefCarta } from "./opcoes";
import { Roteiro } from "./roteiro";
import type { Sessao } from "./sessao";

export type NivelIA = "passiva" | "facil" | "normal" | "dificil";
export type LinhaIA = Pick<LinhaCombo, "mao" | "passos" | "campo" | "pontos">;

export interface OpcoesIA {
  /** teste de combo: passos que a IA tenta repetir no primeiro turno */
  roteiro?: Passo[];
  /** cálculo de combo da mão: cartas que a linha precisa usar */
  exigidas?: number[];
  /** valor extra de cartas em campo aprendido nas análises dos duelos (id → pontos) */
  aprendidos?: Record<number, number>;
  /** prefere a Posição de Defesa ao Invocar (análise do duelo: jogar mais seguro) */
  emDefesa?: boolean;
  /** decks de torneio, para a IA deduzir o do oponente pelas cartas que ele revela */
  metaDecks?: DeckEsperado[];
}

/** Um deck de torneio: as cartas que o identificam e as respostas (hand traps) que ele costuma jogar */
export interface DeckEsperado {
  arquetipo: string;
  cartas: number[];
  respostas: number[];
}

/** cartas reveladas que batem com um deck para a IA considerar que é ele */
const MIN_IDENTIFICA = 2;
/** quanto vale menos uma linha de combo por resposta do deck do oponente que a para na primeira metade */
const EXPOSTA = 1.5;

/** tempo de planejamento do turno (ms); a Fácil joga uma tentativa só */
const TEMPO: Record<NivelIA, number> = { passiva: 0, facil: 0, normal: 2000, dificil: 5000 };
/** chance de responder a uma jogada do oponente com o que tiver (interrupções de mão, armadilhas) */
const RESPONDE: Record<NivelIA, number> = { passiva: 0, facil: 0.15, normal: 0.6, dificil: 1 };
const MAX_TENTATIVAS = 400;
/** "Mulcharmy" (Purulia, Fuwalos, Meowls) e Maxx "C": só punem quem Invoca enquanto estão ativas */
const puneInvocacoes = (nome: string) => /^Mulcharmy /.test(nome) || nome === 'Maxx "C"';
/** linhas conhecidas testadas inteiras (pelo roteiro) a cada planejamento */
const MAX_LINHAS_GUIADAS = 12;
/**
 * Valor extra de uma interrupção de mão guardada na mão (além do 0,7 de qualquer carta na mão):
 * Invocá-la como corpo quase nunca compensa; só vale se o campo melhorar mais do que isso (ex.: virar
 * matéria de S:P Little Knight e banir uma carta importante do oponente).
 */
const VALOR_INTERRUPCAO = 1.5;
/**
 * monstro do Extra Deck em campo (antes do ATK e dos efeitos); um do Main Deck vale 1,5. Pouco acima de
 * dois corpos do Main Deck: subir para o Extra só compensa se o monstro fizer mais que as matérias
 */
const EXTRA = 3.5;
/**
 * cartas que ainda estão no Extra Deck: gastar o Extra (matéria, custo de banir) também gasta recurso.
 * Por carta: a 1ª cópia vale mais, as repetidas menos (com 3 Chaos Angel, banir 1 quase não custa; banir
 * a única cópia de outra carta custa bem mais)
 */
const RECURSO_EXTRA = [0.6, 0.3, 0.15];
/** interrupções além da terceira quase não mudam o turno do oponente: cada uma vale isto a menos */
const SOBRA_INTERRUPCAO = 0.6;
/**
 * gastar (custo, matéria, banir) a última cópia de uma carta do Deck/Extra Deck/mão, que perde o acesso a
 * ela; com cópias sobrando, isto dividido pelas que sobram mais 1
 */
const COPIA_FINAL = 1;
/** cada ponto de Motor.valorEmCampo (interrupção vale 2, remoção 1, proteção 1) */
const VALOR_EFEITO = 0.8;
/** Magia/Armadilha baixada vale 2 (possível interrupção); a que não pode ser ativada com o campo de agora, isto */
const BAIXADA_MORTA = 0.5;
/** campo que fecha o duelo na Battle Phase deste turno (ATK suficiente para zerar os PV do oponente) */
const LETAL = 30;
/** dano possível na Battle Phase que não fecha o duelo: metade do peso dos PV (o oponente ainda pode responder) */
const PESO_DANO = 0.5;

// código, posição, ATK, DEF e matérias
const QUERY = (1 | 2 | 256 | 512 | 65536) as never;

// dicas de seleção (HINTMSG_*) em que a escolha prejudica a carta escolhida
const HOSTIS = new Set(["DESTROY", "REMOVE", "TOGRAVE", "RTOHAND", "TODECK", "CONTROL", "FACEDOWN", "POSCHANGE", "DISABLE", "NEGATE", "ATTACKTARGET", "TARGET", "DEATTACHFROM"]);
// dicas de custo: gastar as cartas que valem menos
const CUSTOS = new Set(["RELEASE", "DISCARD", "XMATERIAL", "SMATERIAL", "LMATERIAL", "FMATERIAL", "REMOVEXYZ", "TRIBUTE"]);
// dicas em que a carta escolhida vai para o Cemitério (carta com efeito lá ganha com isso)
const AO_CEMITERIO = new Set(["TOGRAVE", "DISCARD", "RELEASE", "TRIBUTE", "DESTROY", "REMOVEXYZ", "SMATERIAL", "LMATERIAL", "FMATERIAL"]);
// dicas que tiram a carta do campo (tirar uma Magia Contínua que está ativando corta o efeito dela)
const TIRAM = new Set(["DESTROY", "REMOVE", "TOGRAVE", "RTOHAND", "TODECK", "CONTROL"]);
/** Magias/Armadilhas que ficam no campo e valem pelo que fazem lá */
const PERMANENTES = TIPO.CONTINUA | TIPO.CAMPO | TIPO.EQUIPAMENTO;

type RefLoc = { controller: number; location: number; sequence: number };
const mesmaZona = (a: RefLoc, b: RefLoc) => a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;

/** contexto de uma escolha de cartas (dica do motor e cadeia em aberto) */
interface Escolha {
  dica: string;
  hostil: boolean;
  /** cartas ativadas na cadeia em aberto */
  cadeia: { code: number; controller: number }[];
}

const igual = (a: Jogada, b: Jogada) => JSON.stringify(a, (_, v) => (typeof v === "bigint" ? String(v) : v)) === JSON.stringify(b, (_, v) => (typeof v === "bigint" ? String(v) : v));

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

/** Decisão da IA no duelo, com o motivo (lista da apresentação IA x IA e exportação do replay) */
export interface DecisaoIA {
  /** posição da resposta no histórico do duelo */
  n: number;
  jogador: number;
  turno: number;
  fase: number;
  /** o que ela fez, em texto */
  acao: string;
  motivo: string;
  /** jogada de verdade ou escolha com alternativa (fica de fora: passar sem ter o que ativar) */
  relevante: boolean;
}

const FASE_TEXTO: Record<string, string> = { bp: "Vai para a Battle Phase", m2: "Vai para a Main Phase 2", ep: "Encerra o turno" };

/** A resposta da IA em texto, a partir das opções da decisão */
export function descreverResposta(d: OcgMessage, resp: OcgResponse, motor: Motor): { texto: string; relevante: boolean } {
  const o = opcoesDe(d, motor.tipo).find((x) => igual(x.resp, resp));
  const nome = (code?: number) => (code ? motor.nome(code) : "uma carta");
  // passar com algo para ativar é uma decisão; sem nada, não
  const temEscolha = d.type === T.SELECT_CHAIN ? d.selects.length > 0 : d.type !== T.SELECT_YESNO;
  if (!o) return { texto: "Responde ao motor", relevante: false };
  if (o.acao) {
    const a = o.acao;
    const texto =
      a.k === "normal" ? `Invoca por Invocação-Normal ${nome(a.code)}`
      : a.k === "especial" ? `Invoca por Invocação-Especial ${nome(a.code)}`
      : a.k === "ativa" ? `Ativa ${nome(a.code)}`
      : a.k === "baixa" ? `Baixa ${nome(a.code)}`
      : a.k === "baixa-monstro" ? `Baixa um monstro (${nome(a.code)})`
      : a.k === "posicao" ? `Muda a posição de ${nome(a.code)}`
      : a.k === "ataque" ? `Declara ataque com ${nome(a.code)}`
      : (FASE_TEXTO[a.desc ?? ""] ?? "Muda de fase");
    return { texto, relevante: true };
  }
  if (o.escolha?.length) return { texto: `Escolhe ${o.escolha.map((c) => nome(c.code)).join(", ")}`, relevante: true };
  if (o.recusa || (resp.type === R.SELECT_CHAIN && resp.index === null)) return { texto: "Passa (não ativa)", relevante: temEscolha };
  if (resp.type === R.SELECT_EFFECTYN) return { texto: resp.yes ? "Usa o efeito" : "Não usa o efeito", relevante: true };
  return { texto: "Responde ao motor", relevante: false };
}

/** Resposta de quem não interage (o oponente nas simulações, a IA Passiva) */
export function passivo(d: OcgMessage, motor: Motor): OcgResponse | undefined {
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
  /**
   * Por que a IA tomou a última decisão (texto para a lista de decisões da apresentação IA x IA e para
   * a exportação do replay). A IA só usa o que um jogador veria: as suas cartas, o campo e o que foi
   * revelado; nas simulações do turno, o oponente não responde (ela não conhece a mão dele).
   */
  motivo = "";
  /** como o plano do turno foi escolhido (para o motivo de cada lance dele) */
  private planoInfo: {
    nota: number;
    base: number;
    tentativas: number;
    origem: "linha" | "gulosa" | "sorteio";
    mao?: number[];
    letal?: boolean;
    /** deck do oponente deduzido e as respostas dele que acertavam as linhas conhecidas */
    leitura?: { arquetipo: string; evitadas: number[] };
  } | null = null;
  private plano: { resps: OcgResponse[]; i: number } | null = null;
  private tentativa = 0;
  /** alvo escolhido para o ataque em andamento */
  private alvo: RefCarta | null = null;
  /**
   * proteção na resolução aceita (ex.: Toon World the Perfect World): monstros que o elo do oponente
   * atinge (escolher um deles) e os que os elos da própria IA miram (não tirar do campo)
   */
  private proteger: { alvos: RefLoc[]; proibidas: RefLoc[] } | null = null;

  /** teste de combo: passos que a IA tenta repetir no primeiro turno */
  private roteiro: Roteiro | null;

  /** cálculo de combo da mão: cartas que a linha precisa usar (cada uma que fica na mão pesa contra) */
  private readonly exigidas: number[];
  /** valor extra de cartas em campo, aprendido nas análises dos duelos (id → pontos) */
  private readonly aprendidos: Record<number, number>;

  constructor(
    readonly nivel: NivelIA,
    readonly eu: 0 | 1,
    readonly linhas: LinhaIA[],
    motor: Motor,
    opcoes: OpcoesIA = {},
  ) {
    const { roteiro } = opcoes;
    this.roteiro = roteiro?.length ? new Roteiro(roteiro, eu, (a, b) => this.canonico(motor, a) === this.canonico(motor, b), motor.tipo) : null;
    this.exigidas = opcoes.exigidas ?? [];
    this.aprendidos = opcoes.aprendidos ?? {};
    this.emDefesa = !!opcoes.emDefesa;
    this.metaDecks = opcoes.metaDecks ?? [];
  }

  private readonly metaDecks: DeckEsperado[];
  /** cartas que o oponente já revelou (ativou, Invocou, mandou ao Cemitério ou baniu com a face para cima) */
  private readonly vistasOp = new Set<number>();

  /**
   * "Ler o deck do oponente" (aula 1 do PRRJ): pelo que ele revelou, o deck de torneio mais provável e
   * as respostas que esse deck costuma jogar. Sem cartas suficientes para identificar, null.
   */
  private deckDoOponente(s: Sessao): { arquetipo: string; respostas: Set<number> } | null {
    if (!this.metaDecks.length) return null;
    const motor = s.motor;
    const op = 1 - this.eu;
    // o que está à vista agora: Cemitério, banidas e campo com a face para cima
    for (const loc of [L.GRAVE, L.REMOVED, L.MZONE, L.SZONE])
      for (const c of motor.core.duelQueryLocation(s.duel, { flags: 3 as never, controller: op as 0, location: loc }))
        if (c?.code && !(((c.position as number) ?? 0) & 0xa)) this.vistasOp.add(this.canonico(motor, c.code as number));
    let melhor: { d: DeckEsperado; n: number } | null = null;
    for (const d of this.metaDecks) {
      const n = d.cartas.filter((c) => this.vistasOp.has(c)).length;
      if (n >= MIN_IDENTIFICA && (!melhor || n > melhor.n)) melhor = { d, n };
    }
    return melhor ? { arquetipo: melhor.d.arquetipo, respostas: new Set(melhor.d.respostas) } : null;
  }

  /** respostas do deck do oponente que param a linha na primeira metade dela (quanto antes, pior) */
  private exposicao(l: LinhaIA, respostas: Set<number>): number[] {
    const metade = Math.ceil(l.passos.length / 2);
    const acertam = new Set<number>();
    for (const p of l.passos.slice(0, metade)) for (const r of p.resp ?? []) if (respostas.has(r)) acertam.add(r);
    return [...acertam];
  }

  private readonly emDefesa: boolean;

  /** Nota do campo deste jogador agora (análise do duelo: compara o que aconteceu com as alternativas) */
  avaliar(motor: Motor, duel: OcgDuelHandle) {
    return this.nota(motor, duel, new Set(), new Set());
  }

  /** Mensagens do motor (o roteiro acompanha o que a IA já fez do combo) */
  ler(log: OcgMessage[]) {
    this.roteiro?.ler(log);
  }

  /** A última resposta da IA não valia (RETRY): a próxima tentativa usa outra opção */
  recusada() {
    this.tentativa++;
    this.plano = null;
  }

  /** Respostas dadas no duelo: as do jogador conferem o plano (se ele fez outra coisa, o plano cai) */
  observar(resp: Jogada, jogador: number) {
    if (!this.plano || jogador === this.eu) return;
    const esperado = this.plano.resps[this.plano.i];
    if (esperado && igual(esperado, resp)) this.plano.i++;
    else this.plano = null;
  }

  /** A decisão vai fazer a IA planejar (a tela mostra "pensando") */
  vaiPensar(d: OcgMessage, s: Sessao) {
    return this.nivel !== "passiva" && TEMPO[this.nivel] > 0 && !this.plano && !this.roteiro?.ativo && d.type === T.SELECT_IDLECMD && s.faseAtual === OcgPhase.MAIN1;
  }

  decidir(d: OcgMessage, s: Sessao, repetida = false): OcgResponse {
    this.motivo = "";
    const r = this.escolher(d, s, repetida);
    if (!this.motivo) this.motivo = "Opção padrão: a decisão não muda o jogo.";
    return r;
  }

  private escolher(d: OcgMessage, s: Sessao, repetida: boolean): OcgResponse {
    const motor = s.motor;
    if (s.ultimaAcao && s.ultimaAcao.p !== this.eu) this.vistasOp.add(this.canonico(motor, s.ultimaAcao.code));
    const nome = (code: number | undefined) => (code ? motor.nome(code) : "");
    const ops = opcoesDe(d, motor.tipo);
    if (!repetida) this.tentativa = 0;
    else if (ops.length) {
      this.motivo = "A resposta anterior não valia para o motor: tenta outra opção.";
      return ops[this.tentativa % ops.length].resp;
    }
    const fallback = ops[0]?.resp ?? passivo(d, motor) ?? { type: R.SELECT_CHAIN, index: null };
    // a proteção aceita só vale para a escolha de carta logo em seguida
    const proteger = this.proteger;
    this.proteger = null;

    // seguindo o plano do turno
    if (this.plano) {
      const r = this.plano.resps[this.plano.i];
      if (r && r.type === RESPOSTA_DE[d.type]) {
        const info = this.planoInfo;
        this.motivo = info
          ? `Plano do turno (lance ${this.plano.i + 1} de ${this.plano.resps.length}): ${
              info.origem === "linha"
                ? `linha de combo conhecida do deck${info.mao?.length ? ` (${info.mao.map(nome).join(" + ")})` : ""}`
                : info.origem === "gulosa"
                  ? "a sequência mais direta (cada passo com a jogada de maior peso)"
                  : `a melhor de ${info.tentativas} sequências testadas`
            }; ${info.letal ? "deixa ATK suficiente para fechar o duelo na Battle Phase" : `deixa o campo com nota ${info.nota.toFixed(1)}, contra ${info.base.toFixed(1)} sem jogar`}.${
              info.leitura
                ? ` Pelas cartas reveladas, o oponente deve jogar ${info.leitura.arquetipo}${info.leitura.evitadas.length ? `; linhas expostas a ${info.leitura.evitadas.slice(0, 3).map(nome).join(", ")} valem menos` : ""}.`
                : ""
            }`
          : "Plano do turno.";
        this.plano.i++;
        if (this.plano.i >= this.plano.resps.length) this.plano = null;
        return r;
      }
      this.plano = null;
      this.motivo = "O oponente respondeu diferente do previsto: o plano caiu e a IA decide de novo.";
    }
    // teste de combo: o próximo passo do combo vem antes do planejamento (vale em qualquer nível)
    const doRoteiro = "player" in d && d.player === this.eu ? this.roteiro?.decidir(d, ops) : undefined;
    if (doRoteiro) {
      this.motivo = "Teste de combo: o próximo passo do combo escolhido.";
      return doRoteiro;
    }
    if (this.nivel === "passiva") {
      this.motivo = "IA Passiva: não joga nem responde.";
      return passivo(d, motor) ?? fallback;
    }

    switch (d.type) {
      case T.SELECT_IDLECMD: {
        if (s.faseAtual === OcgPhase.MAIN1) {
          this.planejar(s);
          if (this.plano) return this.escolher(d, s, false);
          const bp = ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "bp");
          if (bp && this.atacantes(s) > 0) {
            this.motivo = "Nenhuma sequência testada deixa o campo melhor; com monstros em Posição de Ataque, vai para a Battle Phase.";
            return bp.resp;
          }
        }
        // Main Phase 2 (ou nada melhor a fazer): baixa interrupções e passa
        const baixa = ops.find((o) => o.acao?.k === "baixa");
        if (baixa) {
          this.motivo = `Sem jogada melhor: baixa ${nome(baixa.acao?.code)} para usar no turno do oponente.`;
          return baixa.resp;
        }
        this.motivo = "Nada melhora o campo: encerra o turno.";
        return (ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "ep") ?? ops[0])?.resp ?? fallback;
      }
      case T.SELECT_BATTLECMD:
        return this.batalha(d, s, ops) ?? fallback;
      case T.SELECT_CHAIN: {
        if (!d.selects.length) {
          this.motivo = "Nada para encadear.";
          return fallback;
        }
        // efeito que só tiraria uma carta própria (o campo do oponente está vazio) fica de fora, e também
        // interrupção (Ash Blossom, Ghost Ogre, Toon Terror...) em cima da própria jogada
        // também: efeito só de Cemitério sem carta do oponente que valha tirar de lá (Evil Box à toa), e
        // negação simples num efeito que o oponente pode repetir no turno (não é o ponto que trava o combo)
        const ativar = ops.find(
          (o) => !o.recusa && o.acao?.k === "ativa" && !this.semAlvo(s, o) && !this.desperdica(motor, s.duel, o, s.ultimaAcao) && !this.semUso(motor, s.duel, o) && !this.naoTrava(motor, s.duel, o),
        );
        if (d.forced) {
          this.motivo = "Efeito obrigatório.";
          return ativar?.resp ?? fallback;
        }
        // nenhuma opção que valha a pena: passa (o fallback ativaria a primeira, ex.: Ghost Ogre no próprio efeito)
        if (!ativar) {
          this.motivo =
            "Não ativa: os efeitos disponíveis não teriam alvo útil no oponente, gastariam uma interrupção na própria jogada ou negariam um efeito que o oponente repete no mesmo turno.";
          return { type: R.SELECT_CHAIN, index: null };
        }
        // interrupções de mão com momento certo (o que os jogadores costumam fazer para ganhar vantagem)
        const momento = this.momentoCerto(d, s);
        if (momento) return momento;
        // Mulcharmy / Maxx "C" do oponente no turno dele não punem a IA (ela não Invoca do Deck/Extra
        // no turno do oponente): negar seria gastar a interrupção à toa
        if (this.respostaInutil(s)) {
          this.motivo = "Não nega Mulcharmy / Maxx \"C\" no turno do oponente: a IA não Invoca no turno dele, então a carta não a pune.";
          return { type: R.SELECT_CHAIN, index: null };
        }
        const ultima = s.ultimaAcao;
        // responde às jogadas do oponente com a chance do nível; no próprio turno, ativa os gatilhos
        if (ultima && ultima.p !== this.eu) {
          const responde = Math.random() < RESPONDE[this.nivel];
          this.motivo = responde
            ? `Responde à jogada do oponente (${nome(ultima.code)}) com ${nome(ativar.acao?.code)}.`
            : `Guarda ${nome(ativar.acao?.code)}: no nível ${this.nivel}, a IA responde só às vezes (${Math.round(RESPONDE[this.nivel] * 100)}% das jogadas do oponente).`;
          return responde ? ativar.resp : { type: R.SELECT_CHAIN, index: null };
        }
        // no próprio turno, os gatilhos sim; na Draw e na Standby, cartas de corrente livre ficam para o plano da Main Phase
        const comecoDoTurno = s.faseAtual === OcgPhase.DRAW || s.faseAtual === OcgPhase.STANDBY;
        if (s.jogadorDaVez === this.eu && this.nivel !== "facil" && (!comecoDoTurno || d.spe_count)) {
          this.motivo = `Ativa ${nome(ativar.acao?.code)} no próprio turno: o efeito só ajuda a montar o campo.`;
          return ativar.resp;
        }
        this.motivo = comecoDoTurno ? "Na Draw e na Standby, guarda as cartas de corrente livre para o plano da Main Phase." : "Guarda as cartas para um momento melhor.";
        return { type: R.SELECT_CHAIN, index: null };
      }
      case T.SELECT_EFFECTYN: {
        if (motor.aoResolver(d.code)) return this.protegerNaResolucao(s);
        const sim = !this.semAlvo(s, ops[0]);
        this.motivo = sim ? "Usa o efeito opcional." : "Não usa o efeito: ele só tiraria uma carta própria (o oponente não tem cartas em campo).";
        return { type: R.SELECT_EFFECTYN, yes: sim };
      }
      case T.SELECT_YESNO:
        this.motivo = "Aceita.";
        return { type: R.SELECT_YESNO, yes: true };
      case T.SELECT_POSITION: {
        const defesa = this.emDefesa ? ops.find((o) => (o.resp as { position?: number }).position === 4) : undefined;
        this.motivo = defesa ? "Posição de Defesa: jogar mais seguro." : "Posição padrão.";
        return defesa?.resp ?? fallback;
      }
      case T.SELECT_CARD:
      case T.SELECT_TRIBUTE:
      case T.SELECT_UNSELECT_CARD:
        return this.escolherCartas(s, ops, d, proteger) ?? fallback;
      case T.ANNOUNCE_CARD:
        this.motivo = "Declara uma carta que o oponente ainda pode usar (mão, campo, Cemitério ou banidas; senão, do deck dele).";
        return this.declarar(s, s.duel, d) ?? fallback;
      default:
        return fallback;
    }
  }

  /**
   * Ativar a opção só tiraria uma carta própria: o efeito apenas bane, destrói ou devolve (Motor.soRemove)
   * e o oponente não tem cartas em campo (ex.: o banir da Chaos Angel no primeiro turno)
   */
  private semAlvo(s: Sessao, o: Opcao | undefined, duel = s.duel) {
    if (!o || o.recusa || !o.acao?.desc || !/^d+$/.test(o.acao.desc) || !s.motor.soRemove(BigInt(o.acao.desc))) return false;
    const op = 1 - this.eu;
    return s.motor.core.duelQueryCount(duel, op as 0, L.ONFIELD) === 0;
  }

  /**
   * Ativar a opção gastaria uma interrupção na própria jogada: o efeito responde a uma ativação ou
   * Invocação (Motor.respondeJogada) e quem fez a jogada não é o oponente. A jogada é o último elo da
   * cadeia; com a cadeia vazia, a última ação vista (`ultima`, ex.: uma Invocação). Sem jogada conhecida
   * (no planejamento, o oponente é passivo), conta como da própria IA.
   */
  private desperdica(motor: Motor, duel: OcgDuelHandle, o: Opcao | undefined, ultima: { p: number } | null) {
    const code = o?.acao?.code;
    if (!o || o.recusa || !code || !o.acao?.desc || !/^\d+$/.test(o.acao.desc) || !motor.respondeJogada(code, BigInt(o.acao.desc))) return false;
    const cadeia = motor.core.duelQueryField(duel).chain;
    const autor = cadeia.length ? (cadeia[cadeia.length - 1].triggering_controller as number) : ultima?.p;
    return autor !== 1 - this.eu;
  }

  /**
   * Efeito que só mexe no Cemitério (Motor.soNoCemiterio, ex.: Evil Box) sem carta do oponente que valha
   * tirar de lá: uma com efeito no Cemitério e que não seja do Extra Deck (devolver ao Deck um monstro
   * do Extra Deck o devolve ao Extra Deck do dono, de presente)
   */
  private semUso(motor: Motor, duel: OcgDuelHandle, o: Opcao | undefined) {
    const code = o?.acao?.code;
    if (!o || o.recusa || !code || !o.acao?.desc || !/^\d+$/.test(o.acao.desc) || !motor.soNoCemiterio(code, BigInt(o.acao.desc))) return false;
    const op = 1 - this.eu;
    return !motor.core
      .duelQueryLocation(duel, { flags: 1 as never, controller: op as 0, location: L.GRAVE })
      .some((c) => c?.code && motor.noCemiterio(c.code as number) && !(motor.tipo(c.code as number) & TIPOS_EXTRA));
  }

  /**
   * Negação simples (Motor.soNega, ex.: Ash Blossom) contra um efeito que o oponente pode usar de novo no
   * mesmo turno (Motor.repetivel, ex.: a busca do Toon World the Perfect World, 3 vezes por turno): ela só
   * atrasa a jogada. A interrupção fica para um efeito que trava o combo (uma Magia ativada, um efeito
   * de uma vez por turno).
   */
  private naoTrava(motor: Motor, duel: OcgDuelHandle, o: Opcao | undefined) {
    const code = o?.acao?.code;
    if (!o || o.recusa || !code || !o.acao?.desc || !/^\d+$/.test(o.acao.desc) || !motor.soNega(code, BigInt(o.acao.desc))) return false;
    const cadeia = motor.core.duelQueryField(duel).chain;
    const elo = cadeia[cadeia.length - 1];
    return !!elo && elo.triggering_controller === 1 - this.eu && motor.repetivel(elo.code as number, elo.description);
  }

  /**
   * Efeito contínuo que age antes de um elo resolver (ex.: Toon World the Perfect World bane um monstro
   * Toon até o elo resolver). Só usa quando o elo que resolve é do oponente e atinge um monstro da IA:
   * mira ele, ou nega e destrói a carta que ativou o elo anterior. Elo da própria IA, nunca: tirar um
   * monstro do campo no meio do próprio efeito faz o efeito perder o alvo (ex.: S:P Little Knight). E
   * nunca tira um monstro que um elo da própria IA ainda mira.
   */
  private protegerNaResolucao(s: Sessao): OcgResponse {
    const cadeia = s.motor.cadeia(s.duel);
    const elo = cadeia[cadeia.length - 1];
    const nao = (motivo: string): OcgResponse => {
      this.motivo = motivo;
      return { type: R.SELECT_EFFECTYN, yes: false };
    };
    if (!elo || elo.p === this.eu) return nao("Não usa a proteção: o efeito que resolve agora é da própria IA (tirar um monstro do campo agora só atrapalharia o efeito).");
    const meu = (r: RefLoc) => r.controller === this.eu && (r.location & L.MZONE) !== 0;
    const proibidas = cadeia
      .slice(0, -1)
      .filter((e) => e.p === this.eu)
      .flatMap((e) => e.alvos)
      .filter(meu);
    const alvos = elo.alvos.filter(meu);
    const anterior = cadeia[cadeia.length - 2];
    if (elo.nega && elo.tira && anterior && meu(anterior.dono)) alvos.push(anterior.dono);
    const livres = alvos.filter((a) => !proibidas.some((p) => mesmaZona(a, p)));
    // sem alvo: um efeito que tira cartas escolhendo na resolução (ex.: Comic Cat Tributa um monstro) pode pegar qualquer um
    const qualquer = !elo.alvos.length && elo.tira && !elo.nega;
    if (!livres.length && !qualquer) return nao("Não usa a proteção: o efeito do oponente que resolve agora não atinge os monstros da IA.");
    this.proteger = { alvos: livres, proibidas };
    this.motivo = "Usa a proteção: tira do campo, até o efeito do oponente resolver, o monstro que ele atingiria.";
    return { type: R.SELECT_EFFECTYN, yes: true };
  }

  /**
   * A última jogada é um "Mulcharmy" ou Maxx "C" do oponente no turno dele. Essas cartas só punem
   * Invocações da IA, e a IA não Invoca do Deck/Extra Deck no turno do oponente, então responder
   * (negar, por exemplo) gastaria a carta sem ganho.
   */
  private respostaInutil(s: Sessao) {
    const u = s.ultimaAcao;
    return !!u && u.tipo === "ativa" && u.p !== this.eu && s.jogadorDaVez !== this.eu && puneInvocacoes(s.motor.nome(u.code));
  }

  // ---------- momento certo das interrupções de mão ----------

  /**
   * Cartas cujo valor depende do momento, como os jogadores fazem:
   * - "Mulcharmy" (Purulia, Fuwalos, Meowls) e Maxx "C": logo no começo do turno do oponente (Draw,
   *   Standby ou antes da primeira jogada da Main Phase 1). Se ele Invocar ao menos uma vez, a carta
   *   já se pagou (troca 1 por 1).
   * - Droll & Lock Bird: logo depois da primeira carta que o oponente adicionar do Deck à mão (fora
   *   da Draw Phase), ainda na resolução, para travar as buscas seguintes.
   * Nas outras janelas, essas cartas ficam guardadas (não são gastas por sorteio).
   */
  private momentoCerto(d: Extract<OcgMessage, { type: T.SELECT_CHAIN }>, s: Sessao): OcgResponse | null {
    if (d.forced) return null;
    const nome = (code: number) => s.motor.nome(code);
    const cedo = (code: number) => puneInvocacoes(nome(code));
    const droll = (code: number) => nome(code) === "Droll & Lock Bird";
    const turnoDele = s.jogadorDaVez !== this.eu;
    const fase = s.faseAtual;
    const ev = s.eventoRecente;
    const comecoDoTurno = fase === OcgPhase.DRAW || fase === OcgPhase.STANDBY || (fase === OcgPhase.MAIN1 && (!ev || ev.tipo === "fase" || ev.tipo === "compra"));
    // a chance do nível vale aqui também (a Fácil quase nunca faz a jogada)
    const sorte = () => Math.random() < Math.max(RESPONDE[this.nivel], this.nivel === "facil" ? 0.3 : 0.9);
    let guardar = false;
    for (let i = 0; i < d.selects.length; i++) {
      const code = d.selects[i].code;
      // uma de cada por turno: a segunda cópia não traz vantagem nova
      const jaUsou = s.ativadasNoTurno.some((x) => x.p === this.eu && nome(x.code) === nome(code));
      if (cedo(code)) {
        if (turnoDele && comecoDoTurno && !jaUsou) {
          if (!sorte()) return null;
          this.motivo = `${nome(code)} logo no começo do turno do oponente: se ele Invocar ao menos uma vez, a carta já se pagou.`;
          return { type: R.SELECT_CHAIN, index: i };
        }
        guardar = true;
      }
      if (droll(code)) {
        if (turnoDele && !jaUsou && ev?.tipo === "busca" && ev.p !== this.eu && fase !== OcgPhase.DRAW) {
          if (!sorte()) return null;
          this.motivo = "Droll & Lock Bird logo depois da primeira busca do oponente: trava as buscas seguintes.";
          return { type: R.SELECT_CHAIN, index: i };
        }
        guardar = true;
      }
    }
    // só tem cartas de momento e não é o momento delas: passa (sem gastar por sorteio)
    if (guardar && d.selects.every((c) => cedo(c.code) || droll(c.code))) {
      this.motivo = "Guarda a interrupção para o momento certo (Mulcharmy / Maxx \"C\" no começo do turno do oponente; Droll depois de uma busca).";
      return { type: R.SELECT_CHAIN, index: null };
    }
    return null;
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
      const a = d.attacks[melhor.i];
      this.motivo = `Ataca com ${s.motor.nome(a.code)} (ATK ${melhor.atk}) ${melhor.alvo ? `${s.motor.nome(melhor.alvo.code)}: o monstro de mais valor que ele vence` : "diretamente: o oponente não tem monstros que o parem"}.`;
      return { type: R.SELECT_BATTLECMD, action: 1, index: melhor.i };
    }
    this.alvo = null;
    this.motivo = "Nenhum ataque vantajoso: segue para a Main Phase 2.";
    const m2 = ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "m2");
    const ep = ops.find((o) => o.acao?.k === "fase" && o.acao.desc === "ep");
    return (m2 ?? ep)?.resp;
  }

  // ---------- escolha de cartas fora do plano ----------

  /**
   * Valor de uma carta numa escolha (o sinal vem de quem é a carta e da dica):
   * - monstro: ATK, Extra Deck e o que ele faz em campo (interrupção, remoção, proteção, o aprendido nos duelos);
   * - Magia/Armadilha: Contínua, de Campo e de Equipamento valem pelo que fazem em campo; baixada é uma
   *   possível interrupção;
   * - em campo, nas linhas de combo da mão, ativando na cadeia agora (tirar uma Contínua/de Campo/
   *   Equipamento/Pêndulo que está ativando corta o efeito);
   * - alvo do oponente que não sai (imune, ou não pode ser destruído e a dica é destruir) quase não vale.
   */
  private valor(s: Sessao, c: RefCarta, linha: Set<number>, e: Escolha) {
    const motor = s.motor;
    const campo = (c.location & L.ONFIELD) !== 0;
    const pos = campo ? (((motor.core.duelQuery(s.duel, { flags: 2 as never, controller: c.controller as 0, location: c.location as L, sequence: c.sequence, overlaySequence: 0 })?.position as number) ?? 0) as number) : 0;
    const baixada = campo && (pos & 0xa) !== 0;
    // carta baixada do oponente: a IA não vê qual é (Magia/Armadilha baixada pode ser uma interrupção)
    if (baixada && c.controller !== this.eu) return c.location & L.SZONE ? 3 : 2.5;
    const dados = motor.dados(c.code);
    const tipo = (dados?.type as number) ?? 0;
    const k = this.canonico(motor, c.code);
    let v: number;
    if (tipo & TIPO.MONSTRO)
      v = Math.max(0, (dados!.attack as number) ?? 0) / 1000 + (tipo & TIPOS_EXTRA ? 2 : 0) + VALOR_EFEITO * motor.valorEmCampo(c.code) + (this.aprendidos[k] ?? 0) + (tipo & TIPO.EFEITO ? 0.05 : 0);
    else if (baixada) v = 2;
    else v = 1 + (tipo & PERMANENTES ? 1 + VALOR_EFEITO * motor.valorEmCampo(c.code) : 0);
    if (campo) v += 1;
    if (linha.has(k)) v += 1.5;
    if (campo && e.cadeia.some((x) => x.code === c.code && x.controller === c.controller)) {
      const corta = TIRAM.has(e.dica) && (tipo & PERMANENTES || (tipo & TIPO.PENDULO && c.location & L.SZONE));
      v += corta ? 2 : 0.1;
    }
    if (campo && e.hostil && c.controller !== this.eu) {
      const p = motor.protecao(c.code);
      if (p.imune || (e.dica === "DESTROY" && p.destruir)) v *= 0.2;
    }
    return v;
  }

  private escolherCartas(s: Sessao, ops: Opcao[], d: OcgMessage, proteger: IA["proteger"]): OcgResponse | undefined {
    const dica = s.dicaDe(this.eu).nome?.replace(/^HINTMSG_/, "") ?? "";
    if (proteger) {
      const so = ops.filter((o) => o.escolha?.length === 1);
      const alvo = so.find((o) => proteger.alvos.some((a) => mesmaZona(a, o.escolha![0])));
      const livre = alvo ?? so.filter((o) => !proteger.proibidas.some((p) => mesmaZona(p, o.escolha![0]))).sort((a, b) => (this.campoValor(s, b.escolha![0]) > this.campoValor(s, a.escolha![0]) ? 1 : -1))[0];
      if (livre) {
        this.motivo = alvo ? "Proteção: tira do campo o monstro que o efeito do oponente atinge." : "Proteção: tira do campo o monstro de mais valor (o efeito do oponente escolhe na resolução).";
        return livre.resp;
      }
    }
    if (dica === "ATTACKTARGET" && this.alvo) {
      const alvo = this.alvo;
      const o = ops.find((x) => x.escolha?.some((c) => c.controller === alvo.controller && c.sequence === alvo.sequence && c.location === alvo.location));
      if (o) {
        this.motivo = "Alvo do ataque escolhido na declaração: o monstro de mais valor que o atacante vence.";
        return o.resp;
      }
    }
    this.motivo = HOSTIS.has(dica)
      ? "Efeito prejudicial: escolhe as cartas do oponente que mais valem (do Extra Deck, com ATK alto, que respondem) e poupa as próprias."
      : CUSTOS.has(dica)
        ? "Custo: paga com as cartas que menos valem e poupa as interrupções de mão e as peças das linhas de combo."
        : "Escolhe as cartas que mais ajudam: as das linhas de combo do deck e as de mais valor no campo.";
    const comEscolha = ops.filter((o) => o.escolha?.length);
    if (!comEscolha.length) return ops[0]?.resp;
    const motor = s.motor;
    const linha = this.cartasDasLinhas(s).passos;
    const hostil = HOSTIS.has(dica);
    const custo = CUSTOS.has(dica);
    const aoCemiterio = AO_CEMITERIO.has(dica);
    // tirar da mão para o campo (Invocar, baixar): poupa as interrupções de mão
    const paraOCampo = dica === "SPSUMMON" || dica === "SUMMON" || dica === "SET";
    const e: Escolha = { dica, hostil, cadeia: motor.core.duelQueryField(s.duel).chain.map((x) => ({ code: x.code as number, controller: x.triggering_controller as number })) };
    // cópias de cada carta própria no Deck, Extra Deck e mão (gastar a última cópia perde o acesso a ela);
    // numa escolha de uma carta por vez, as já escolhidas contam como gastas
    const copias = new Map<string, number>();
    const chave = (location: number, code: number) => `${location}:${this.canonico(motor, code)}`;
    for (const loc of [L.DECK, L.EXTRA, L.HAND])
      for (const c of motor.core.duelQueryLocation(s.duel, { flags: 1 as never, controller: this.eu, location: loc }))
        if (c?.code) copias.set(chave(loc, c.code as number), (copias.get(chave(loc, c.code as number)) ?? 0) + 1);
    const jaEscolhidas = d.type === T.SELECT_UNSELECT_CARD ? d.unselect_cards : [];
    for (const c of jaEscolhidas) if (c.controller === this.eu) copias.set(chave(c.location, c.code), (copias.get(chave(c.location, c.code)) ?? 0) - 1);
    const nota = (o: Opcao) => {
      const gastas = new Map<string, number>();
      return o.escolha!.reduce((n, c) => {
        const minha = c.controller === this.eu;
        const v = this.valor(s, c, linha, e);
        const guardada = minha && c.location & L.HAND && this.guardar(motor, c.code, linha) ? VALOR_INTERRUPCAO : 0;
        if (hostil || custo) {
          if (!minha) {
            // Cemitério do oponente: tirar de lá uma carta com efeito no Cemitério vale mais; devolver ao Deck
            // um monstro do Extra Deck o devolve ao Extra Deck dele (presente)
            if (c.location & L.GRAVE && (dica === "TODECK" || dica === "REMOVE")) {
              if (dica === "TODECK" && motor.tipo(c.code) & TIPOS_EXTRA) return n - 1;
              if (motor.noCemiterio(c.code)) return n + v + 2;
            }
            return n + (hostil ? v : -v);
          }
          // carta própria para o Cemitério: com efeito lá é ganho; saindo do Deck/Extra Deck quase não é perda
          // (ex.: "mande 1 monstro do seu Deck para o Cemitério" busca justamente um efeito no Cemitério)
          const ganho = aoCemiterio && !(c.location & L.GRAVE) && motor.noCemiterio(c.code) ? 2 : 0;
          const perda = aoCemiterio && c.location & (L.DECK | L.EXTRA) ? 0.2 * v : v + guardada;
          // cópias no Deck/Extra Deck/mão: gastar uma das repetidas custa pouco; a última, mais (depois dela a
          // carta não está mais à mão). Ex.: o custo do Rainbow Bridge Bifrost bane 1 Chaos Angel, não 2
          let escassez = 0;
          if (c.location & (L.DECK | L.EXTRA | L.HAND)) {
            const k = chave(c.location, c.code);
            gastas.set(k, (gastas.get(k) ?? 0) + 1);
            escassez = COPIA_FINAL / (Math.max(0, (copias.get(k) ?? 1) - gastas.get(k)!) + 1);
          }
          return n + ganho - perda - escassez;
        }
        // Invocar vai para o campo de quem escolhe, venha a carta de que lado vier (ex.: do Cemitério do oponente)
        if (paraOCampo) return n + (minha || !(c.location & L.ONFIELD) ? v - 2 * guardada : -v);
        return n + (minha ? v : -v);
      }, 0) - (custo ? 0.01 * o.escolha!.length : 0);
    };
    const melhor = comEscolha.reduce((a, b) => (nota(b) > nota(a) ? b : a));
    if (hostil && melhor.escolha!.every((c) => c.controller === this.eu))
      this.motivo = "Efeito que tira a carta escolhida, sem carta do oponente para escolher: escolhe a própria que menos vale.";
    return melhor.resp;
  }

  /**
   * Folga das cartas próprias que uma escolha gasta do Deck/Extra Deck: para cada uma, 0,5 mais as cópias
   * que sobram dela ali (as já escolhidas, numa escolha de uma por vez, contam como gastas)
   */
  private folga(motor: Motor, duel: OcgDuelHandle, escolha: RefCarta[], d: OcgMessage) {
    const copias = new Map<string, number>();
    const chave = (location: number, code: number) => `${location}:${this.canonico(motor, code)}`;
    for (const loc of [L.DECK, L.EXTRA])
      for (const c of motor.core.duelQueryLocation(duel, { flags: 1 as never, controller: this.eu, location: loc }))
        if (c?.code) copias.set(chave(loc, c.code as number), (copias.get(chave(loc, c.code as number)) ?? 0) + 1);
    if (d.type === T.SELECT_UNSELECT_CARD) for (const c of d.unselect_cards) copias.set(chave(c.location, c.code), (copias.get(chave(c.location, c.code)) ?? 0) - 1);
    return escolha.reduce((f, c) => {
      const k = chave(c.location, c.code);
      const sobra = (copias.get(k) ?? 1) - 1;
      copias.set(k, sobra);
      return f * (0.5 + Math.max(0, sobra));
    }, 1);
  }

  /** Valor de um monstro em campo para a proteção: ATK, Extra Deck e o que ele faz em campo */
  private campoValor(s: Sessao, c: RefCarta) {
    const motor = s.motor;
    const atk = Math.max(0, (motor.dados(c.code)?.attack as number) ?? 0);
    return atk / 1000 + (motor.tipo(c.code) & TIPOS_EXTRA ? 2 : 0) + VALOR_EFEITO * motor.valorEmCampo(c.code);
  }

  /**
   * Declarar um nome de carta (ex.: Mind Scan nega os efeitos ativados do nome declarado): primeiro as
   * cartas do oponente que ele ainda pode usar (mão, campo, Cemitério, banidas), depois o resto do deck
   * dele e, por fim, qualquer carta que o filtro do efeito aceite. Sem resposta, o motor pediria de novo
   * para sempre.
   */
  private declarar(s: Sessao, duel: OcgDuelHandle, d: Extract<OcgMessage, { type: T.ANNOUNCE_CARD }>): OcgResponse | undefined {
    const motor = s.motor;
    const op = 1 - this.eu;
    const aceita = (code: number) => {
      const c = motor.dados(code);
      return !!c && cardMatchesOpcode(c, d.opcodes);
    };
    for (const loc of [L.HAND, L.MZONE, L.SZONE, L.GRAVE, L.REMOVED])
      for (const c of motor.core.duelQueryLocation(duel, { flags: 1 as never, controller: op as 0, location: loc })) if (c?.code && aceita(c.code as number)) return { type: R.ANNOUNCE_CARD, card: c.code as number };
    const deck = s.partida.decks[op];
    const conhecida = [...deck.main, ...deck.extra].find(aceita) ?? Object.keys(motor.pacote.cartas).map(Number).find(aceita);
    return conhecida ? { type: R.ANNOUNCE_CARD, card: conhecida } : undefined;
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

  /**
   * Interrupção de mão que a IA prefere guardar: fora das cartas das linhas de combo do deck (essas
   * são peças do combo, mesmo com Efeito Rápido da mão)
   */
  private guardar(motor: Motor, code: number, linha: Set<number>) {
    return motor.interrompeDaMao(code) && !linha.has(this.canonico(motor, code));
  }

  /** Nota do campo da IA: monstros (do Extra valem mais), interrupções baixadas, mão (interrupções de mão valem mais), campo do oponente e PV */
  private nota(motor: Motor, duel: OcgDuelHandle, alvo: Set<number>, linha: Set<number>) {
    const op = 1 - this.eu;
    const q = (p: number, location: number) => this.campo(motor, duel, p, location).filter(Boolean) as NonNullable<ReturnType<IA["campo"]>[number]>[];
    let n = 0;
    for (const m of q(this.eu, L.MZONE)) {
      // um monstro do Extra Deck (o "chefe" de um combo) vale mais que os corpos que viraram matéria dele;
      // interrupção de mão em campo é só um corpo: o ATK dela (ex.: Nibiru) não compensa tirá-la da mão
      n += motor.tipo(m.code) & TIPOS_EXTRA ? EXTRA + (0.6 * m.atk) / 1000 : 1.5 + (this.guardar(motor, m.code, linha) ? 0 : (0.6 * m.atk) / 1000);
      // o que ela faz em campo (lido do script: interrupção, remoção, proteção) e o que os duelos ensinaram
      if (!(m.pos & 0xa)) n += VALOR_EFEITO * motor.valorEmCampo(m.code) + (this.aprendidos[this.canonico(motor, m.code)] ?? 0);
      if (alvo.has(this.canonico(motor, m.code))) n += 2;
    }
    // interrupções prontas para o turno do oponente (monstro com Efeito Rápido que tira cartas, baixada
    // viva que nega ou tira, interrupção de mão guardada): passando de 3, cada uma muda pouco
    let interrupcoes = q(this.eu, L.MZONE).filter((m) => !(m.pos & 0xa) && motor.valorEmCampo(m.code) >= 2).length;
    const magias = q(this.eu, L.SZONE);
    // baixada só vale como interrupção se o campo deixa ativá-la (ex.: Toon Terror pede um monstro Toon);
    // viva, vale também o que o efeito faz ao ativar (negar ou tirar uma carta conta como um monstro que faz isso)
    const vivas = magias.some((c) => c.pos & 0xa) ? motor.baixadasVivas(duel, this.eu) : new Set<number>();
    for (const c of magias) {
      if (c.pos & 0xa) {
        const viva = vivas.has(c.sequence);
        n += viva ? 2 + VALOR_EFEITO * motor.valorAoAtivar(c.code) : BAIXADA_MORTA;
        if (viva && motor.valorAoAtivar(c.code) > 0) interrupcoes++;
      } else n += 1 + VALOR_EFEITO * motor.valorEmCampo(c.code);
      if (alvo.has(this.canonico(motor, c.code))) n += 2;
    }
    const mao = motor.core.duelQueryLocation(duel, { flags: 1 as never, controller: this.eu, location: L.HAND });
    n += 0.7 * mao.length;
    for (const c of mao)
      if (c?.code && this.guardar(motor, c.code as number, linha)) {
        n += VALOR_INTERRUPCAO;
        interrupcoes++;
      }
    n -= SOBRA_INTERRUPCAO * Math.max(0, interrupcoes - 3);
    // o que sobra no Extra Deck é recurso para os próximos turnos (Pêndulos virados para cima ficam de fora)
    const extra = new Map<number, number>();
    for (const c of motor.core.duelQueryLocation(duel, { flags: 3 as never, controller: this.eu, location: L.EXTRA }))
      if (c?.code && (c.position as number) & 0xa) {
        const k = this.canonico(motor, c.code as number);
        const i = extra.get(k) ?? 0;
        extra.set(k, i + 1);
        n += RECURSO_EXTRA[i] ?? 0.1;
      }
    if (this.exigidas.length) {
      const exigidas = new Set(this.exigidas.map((c) => this.canonico(motor, c)));
      const naMao = motor.core.duelQueryLocation(duel, { flags: 1 as never, controller: this.eu, location: L.HAND }).filter((c) => c?.code && exigidas.has(this.canonico(motor, c.code as number)));
      n -= 4 * naMao.length;
    }
    n -= 1.2 * (q(op, L.MZONE).length + q(op, L.SZONE).length);
    const campo = motor.core.duelQueryField(duel);
    // o motor manda os PV sem sinal: abaixo de 0 vira um número enorme
    const lp = (p: number) => ((campo.players[p] as unknown as { lp?: number }).lp ?? 8000) | 0;
    n += (lp(this.eu) - lp(op)) / 4000;
    // "ganhar quando dá": com Battle Phase neste turno, o dano que os monstros em Posição de Ataque causam
    if (this.podeAtacar) {
      const dano = this.danoPossivel(q(this.eu, L.MZONE), q(op, L.MZONE));
      n += dano >= lp(op) ? LETAL : (PESO_DANO * dano) / 4000;
    }
    return n;
  }

  /** a Battle Phase deste turno pode acontecer (no primeiro turno do duelo, não) */
  private podeAtacar = false;

  /**
   * Dano que os monstros em Posição de Ataque causam na Battle Phase: cada monstro do oponente é vencido
   * pelo atacante mais fraco que o destrói (virado para baixo: só com ATK alto); os que sobram atacam direto
   */
  private danoPossivel(meus: { pos: number; atk: number }[], deles: { pos: number; atk: number; def: number }[]) {
    const atacantes = meus.filter((m) => m.pos & 1).map((m) => m.atk).sort((a, b) => a - b);
    let dano = 0;
    // os mais difíceis de vencer primeiro
    const alvos = deles
      .map((m) => (m.pos & 0xa ? { precisa: 2000, dano: 0 } : m.pos & 1 ? { precisa: m.atk + 1, dano: -m.atk } : { precisa: m.def + 1, dano: -Infinity }))
      .sort((a, b) => b.precisa - a.precisa);
    for (const a of alvos) {
      const i = atacantes.findIndex((x) => x >= a.precisa);
      if (i < 0) return dano; // um monstro que nenhum atacante vence: não há caminho para o ataque direto
      const atk = atacantes.splice(i, 1)[0];
      // vencer um monstro em Posição de Ataque causa a diferença; em defesa ou virado para baixo, nada
      if (a.dano > -Infinity && a.dano !== 0) dano += atk + a.dano;
    }
    return dano + atacantes.reduce((s2, x) => s2 + x, 0);
  }

  /** Uma tentativa do turno: escolhas sorteadas até a IA passar de fase */
  /**
   * Peso de uma jogada da Main Phase: Invocações do Extra Deck (Sincro, Xyz, Link, Fusão) costumam
   * continuar o combo e pesam mais; cartas das linhas conhecidas do deck também.
   */
  private peso(motor: Motor, o: Opcao, linha: Set<number>) {
    const base: Record<string, number> = { ativa: 3, especial: 3, normal: 2, baixa: 1, "baixa-monstro": 0.4 };
    const code = o.acao?.code;
    let p = base[o.acao!.k] ?? 1;
    if (o.acao!.k === "especial" && code && motor.tipo(code) & TIPOS_EXTRA) p *= 2.5;
    if (code && linha.has(this.canonico(motor, code))) p *= 4;
    // Invocar ou baixar uma interrupção de mão: raro nas tentativas (a nota decide se compensou)
    if (code && (o.acao!.k === "normal" || o.acao!.k === "baixa-monstro" || o.acao!.k === "especial") && this.guardar(motor, code, linha)) p *= 0.1;
    return p;
  }

  /**
   * Uma tentativa do turno a partir do ponto atual. `guloso`: sempre a jogada de maior peso (a linha
   * "óbvia", sempre avaliada); senão, sorteada pelos pesos. Para quando não há jogada ou ao acaso
   * (a fase não entra no plano: quando ele acaba, a IA olha o campo e planeja a continuação).
   */
  private tentar(s: Sessao, linha: Set<number>, alvo: Set<number>, guloso = false, guia?: Passo[]): { resps: OcgResponse[]; nota: number } | null {
    const motor = s.motor;
    const { duel, decisao } = reproduzir(motor, s.partida, s.historico);
    // tentativa guiada por uma linha conhecida: o roteiro escolhe enquanto a linha tem o que fazer
    const roteiro = guia ? new Roteiro(guia, this.eu, (a, b) => this.canonico(motor, a) === this.canonico(motor, b), motor.tipo, true) : null;
    try {
      const resps: OcgResponse[] = [];
      let d = decisao;
      let acoes = 0;
      // dica da última escolha pedida à IA (HINTMSG_*): diz se a escolha é um custo
      let dica = "";
      for (let passo = 0; d && passo < 400; passo++) {
        if (d.type === T.RETRY) return null;
        let resp: OcgResponse | undefined;
        if (!("player" in d) || d.player !== this.eu) resp = passivo(d, motor);
        else if (d.type === T.SELECT_BATTLECMD) break;
        else {
          const ops = opcoesDe(d, motor.tipo);
          const doRoteiro = roteiro?.decidir(d, ops);
          if (doRoteiro) {
            resp = doRoteiro;
            if (d.type === T.SELECT_IDLECMD) acoes++;
          } else if (roteiro && d.type === T.SELECT_IDLECMD) {
            // a linha acabou (ou não tem mais o que fazer): a tentativa vale pelo campo dela, sem estender
            break;
          } else if (d.type === T.SELECT_IDLECMD) {
            acoes++;
            const jogadas = ops.filter((o) => o.acao && o.acao.k !== "fase" && o.acao.k !== "posicao" && !this.semUso(motor, duel, o));
            if (!jogadas.length || acoes > 30 || (!guloso && Math.random() < 0.03 * acoes)) break;
            resp = (guloso ? jogadas.reduce((a, b) => (this.peso(motor, b, linha) > this.peso(motor, a, linha) ? b : a)) : sortear(jogadas, (o) => this.peso(motor, o, linha))).resp;
          } else if (d.type === T.ANNOUNCE_CARD) {
            resp = this.declarar(s, duel, d);
          } else if (d.type === T.SELECT_EFFECTYN && motor.aoResolver(d.code)) {
            // no planejamento o oponente não joga: o elo que resolve é sempre da própria IA
            resp = { type: R.SELECT_EFFECTYN, yes: false };
          } else if (ops.length) {
            const pesoEscolha = (o: Opcao) => {
              if (o.recusa) return 0.6;
              // "então você pode..." (ex.: Evil Box busca ou baixa uma Armadilha Toon): o sim é testado mais vezes
              if (d!.type === T.SELECT_YESNO) return (o.resp as { yes?: boolean }).yes ? 3 : 1;
              if (d!.type === T.SELECT_EFFECTYN || d!.type === T.SELECT_CHAIN) return this.semAlvo(s, o, duel) || this.desperdica(motor, duel, o, null) || this.semUso(motor, duel, o) ? 0 : 3;
              const p = o.escolha?.some((c) => linha.has(this.canonico(motor, c.code))) ? 3 : 1;
              // custo pago com cartas do Deck/Extra Deck: as repetidas são sorteadas mais vezes
              const gasto = dica === "REMOVE" || dica === "TOGRAVE" || CUSTOS.has(dica);
              return gasto && o.escolha?.length && o.escolha.every((c) => c.controller === this.eu && c.location & (L.DECK | L.EXTRA)) ? p * this.folga(motor, duel, o.escolha, d!) : p;
            };
            resp = (guloso ? ops.reduce((a, b) => (pesoEscolha(b) > pesoEscolha(a) ? b : a)) : sortear(ops, pesoEscolha)).resp;
          }
        }
        if (!resp) return null;
        resps.push(resp);
        motor.core.duelSetResponse(duel, resp);
        const r = motor.ate(duel);
        roteiro?.ler(r.log);
        for (const m of r.log)
          if (m.type === T.HINT && m.hint_type === OcgHintType.SELECTMSG && m.player === this.eu) dica = motor.constante(Number(m.hint), "HINTMSG")?.replace(/^HINTMSG_/, "") ?? "";
        if (r.log.some((m) => m.type === T.WIN)) return { resps, nota: r.log.some((m) => m.type === T.WIN && m.player === this.eu) ? 1e6 : -1e6 };
        if (r.log.some((m) => m.type === T.NEW_TURN)) break;
        d = r.decisao;
      }
      return { resps, nota: this.nota(motor, duel, alvo, linha) };
    } finally {
      motor.core.destroyDuel(duel);
    }
  }

  /**
   * Linhas conhecidas (calculadas e combos salvos do deck) que a IA pode seguir agora: alguma das
   * primeiras jogadas usa uma carta que ela tem na mão, no campo ou no Cemitério. As de mais pontos primeiro.
   */
  private linhasPossiveis(s: Sessao): LinhaIA[] {
    const motor = s.motor;
    const tem = new Set<number>();
    for (const loc of [L.HAND, L.MZONE, L.SZONE, L.GRAVE])
      for (const c of motor.core.duelQueryLocation(s.duel, { flags: 1 as never, controller: this.eu, location: loc })) if (c?.code) tem.add(this.canonico(motor, c.code as number));
    const jogadas = (l: LinhaIA) => l.passos.filter((p) => p.t === "normal" || p.t === "ativa" || p.t === "baixa" || (p.t === "invoca" && !p.por)).slice(0, 6);
    return this.linhas
      .filter((l) => jogadas(l).some((p) => tem.has(this.canonico(motor, (p as { c: number }).c))))
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, MAX_LINHAS_GUIADAS);
  }

  /** turno do último planejamento (o primeiro do turno usa o tempo todo; as continuações, metade) */
  private turnoPlanejado = -1;

  private planejar(s: Sessao) {
    const { passos, campo } = this.cartasDasLinhas(s);
    const turno = s.momento().turno;
    // antes da nota de base: as duas notas contam o dano da Battle Phase do mesmo jeito
    this.podeAtacar = turno > 1;
    const base = this.nota(s.motor, s.duel, campo, passos);
    const inicio = performance.now();
    const tempo = turno === this.turnoPlanejado ? TEMPO[this.nivel] / 2 : TEMPO[this.nivel];
    this.turnoPlanejado = turno;
    let melhor: { resps: OcgResponse[]; nota: number; origem: "linha" | "gulosa" | "sorteio"; mao?: number[] } | null = null;
    // linhas inteiras primeiro: cada linha conhecida que passa pelas cartas que a IA tem, seguida pelo roteiro
    // deck do oponente lido pelas cartas reveladas: linhas expostas às respostas dele valem menos
    const leitura = this.deckDoOponente(s);
    let evitadas: number[] = [];
    for (const l of this.linhasPossiveis(s)) {
      const r = this.tentar(s, passos, campo, true, l.passos);
      if (!r) continue;
      const expostas = leitura ? this.exposicao(l, leitura.respostas) : [];
      const nota = r.nota - EXPOSTA * expostas.length;
      if (!melhor || nota > melhor.nota) melhor = { ...r, nota, origem: "linha", mao: l.mao };
      for (const x of expostas) if (!evitadas.includes(x)) evitadas.push(x);
    }
    let tentativas = 0;
    for (let n = 0; n < MAX_TENTATIVAS; n++) {
      // a primeira tentativa é a gulosa: a linha de maior peso sempre é avaliada
      const r = this.tentar(s, passos, campo, n === 0);
      tentativas++;
      if (r && (!melhor || r.nota > melhor.nota)) melhor = { ...r, origem: n === 0 ? "gulosa" : "sorteio" };
      if (performance.now() - inicio >= tempo) break;
    }
    // só joga se a sequência deixa o campo melhor do que passar a vez
    this.plano = melhor && melhor.nota > base && melhor.resps.length ? { resps: melhor.resps, i: 0 } : null;
    this.planoInfo = melhor
      ? { nota: melhor.nota, base, tentativas, origem: melhor.origem, mao: melhor.mao, letal: this.podeAtacar && melhor.nota - base >= LETAL / 2, ...(leitura ? { leitura: { arquetipo: leitura.arquetipo, evitadas } } : {}) }
      : null;
  }
}
