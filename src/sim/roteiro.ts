// Roteiro da IA no teste de combo: a IA começa o duelo com a mão do combo e tenta repetir os passos
// dele. Em cada decisão do primeiro turno, procura nos próximos passos uma jogada que o motor permita
// (ativar, invocar, baixar) ou as cartas que eles citam (buscas, custos, matérias). O que o motor
// registra avança o roteiro, mesmo quando um passo do combo não corresponde exatamente ao registro
// (combos anotados à mão no Teste de Jogo pulam ou juntam movimentos).
import { OcgMessageType as T, OcgResponseType as R, type OcgMessage, type OcgResponse } from "ocgcore-wasm";
import type { CampoFinal, Passo } from "../db/motor";
import { passosDoLog, type Passo as PassoMotor } from "./passos";
import type { Opcao } from "./opcoes";

/** quantos passos à frente do ponto atual a IA procura a próxima jogada */
const JANELA = 12;

/**
 * Mão inicial que os passos pedem: cada carta usada da mão (ativada, invocada, descartada) antes de
 * chegar nela por um passo, mais as que sobram na mão no fim sem terem entrado nela.
 */
export function maoDoRoteiro(passos: Passo[], campo: Pick<CampoFinal, "mao">): number[] {
  const mao: number[] = [];
  const tem = new Map<number, number>();
  // Magias ativadas da mão continuam contadas na mão até o passo que as ativa na zona
  const ativadas = new Map<number, number>();
  const conta = (m: Map<number, number>, c: number, n: number) => m.set(c, (m.get(c) ?? 0) + n);
  const garantir = (c: number) => {
    if ((tem.get(c) ?? 0) > 0) return;
    mao.push(c);
    conta(tem, c, 1);
  };
  const tirar = (c: number) => {
    garantir(c);
    conta(tem, c, -1);
  };
  for (const p of passos) {
    if (p.t === "normal" || p.t === "baixa") tirar(p.c);
    else if (p.t === "ativa" && p.de === "mao") {
      garantir(p.c);
      conta(ativadas, p.c, 1);
    } else if (p.t === "ativa" && (ativadas.get(p.c) ?? 0) > 0 && ["magia", "campo-magia", "pendulo"].includes(p.de)) {
      conta(ativadas, p.c, -1);
      conta(tem, p.c, -1);
    } else if (p.t === "invoca" && p.de === "mao") tirar(p.c);
    else if (p.t === "move") {
      if (p.de === "mao") {
        tirar(p.c);
        if ((ativadas.get(p.c) ?? 0) > 0) conta(ativadas, p.c, -1);
      }
      if (p.para === "mao") conta(tem, p.c, 1);
    }
  }
  for (const c of campo.mao) tirar(c);
  return mao;
}

/** Passo feito por uma ação da Main Phase (a invocação por efeito de outra carta vem da ativação dela) */
const jogadaDaMain = (p: Passo) => p.t === "normal" || p.t === "baixa" || p.t === "ativa" || (p.t === "invoca" && !p.por);

const cartasDoPasso = (p: Passo): number[] => (p.t === "compra" || p.t === "texto" ? p.c : [p.c, ...(p.t === "invoca" ? (p.mat ?? []) : [])]);

/** A IA seguindo um combo no primeiro turno dela */
export class Roteiro {
  /** próximo passo do combo ainda não feito */
  private k = 0;
  private log: OcgMessage[] = [];
  private registrados = 0;
  /** passos de jogada que ficaram para trás quando o roteiro avançou (ainda tentados, até sair da janela) */
  private pulados = new Set<number>();
  /** o primeiro turno da IA começou (o registro conta só dele) */
  private comecou = false;
  private acabou = false;

  constructor(
    readonly passos: Passo[],
    readonly eu: 0 | 1,
    /** mesma carta (artes alternativas contam como a mesma) */
    private readonly mesma: (a: number, b: number) => boolean,
    private readonly tipo: (code: number) => number,
  ) {}

  get ativo() {
    return !this.acabou && this.k < this.passos.length;
  }

  /** Mensagens do motor: os passos que a IA fez avançam o roteiro; o fim do primeiro turno o encerra */
  ler(log: OcgMessage[]) {
    if (this.acabou) return;
    for (const m of log) {
      if (m.type === T.NEW_TURN) {
        if (this.comecou) {
          this.acabou = true;
          return;
        }
        this.comecou = m.player === this.eu;
      } else if (this.comecou) this.log.push(m);
    }
    const feitos = passosDoLog(this.log, this.tipo, this.eu);
    for (const q of feitos.slice(this.registrados)) {
      const j = this.indices().find((i) => this.corresponde(this.passos[i], q));
      if (j === undefined) continue;
      if (j < this.k) this.pulados.delete(j);
      else {
        // jogadas que o motor pulou ao avançar continuam pendentes (ex.: um efeito que ficou para depois)
        for (let i = this.k; i < j; i++) if (jogadaDaMain(this.passos[i]) || this.passos[i].t === "ativa") this.pulados.add(i);
        this.k = j + 1;
      }
    }
    for (const i of this.pulados) if (i < this.k - JANELA) this.pulados.delete(i);
    this.registrados = feitos.length;
  }

  /** Resposta do roteiro para uma decisão da IA; undefined quando o combo não diz nada sobre ela */
  decidir(d: OcgMessage, ops: Opcao[]): OcgResponse | undefined {
    if (!this.ativo) return undefined;
    switch (d.type) {
      case T.SELECT_IDLECMD:
        return this.jogada(ops)?.resp;
      case T.SELECT_CHAIN: {
        // só a próxima jogada do combo (ou uma pulada): ativar uma carta de mais à frente pularia os passos do meio
        const proxima = this.indices().find((i) => i >= this.k && (jogadaDaMain(this.passos[i]) || this.passos[i].t === "ativa"));
        const candidatos = [...this.pulados, ...(proxima === undefined ? [] : [proxima])].map((i) => this.passos[i]);
        const i = d.selects.findIndex((s) => candidatos.some((p) => p.t === "ativa" && this.mesma(p.c, s.code)));
        if (i >= 0) return { type: R.SELECT_CHAIN, index: i };
        // no próprio combo, ativar o que não está nele gasta cartas e efeitos de "uma vez por turno"
        return d.forced ? undefined : { type: R.SELECT_CHAIN, index: null };
      }
      case T.SELECT_CARD:
      case T.SELECT_TRIBUTE:
      case T.SELECT_UNSELECT_CARD:
      case T.SELECT_SUM:
        return this.cartas(ops)?.resp;
      default:
        return undefined;
    }
  }

  /** Passos que a IA pode fazer agora, em ordem: os pulados e os da janela a partir do ponto atual */
  private indices(): number[] {
    const janela = Array.from({ length: Math.max(0, Math.min(this.passos.length, this.k + JANELA) - this.k) }, (_, i) => this.k + i);
    return [...[...this.pulados].sort((a, b) => a - b), ...janela];
  }

  /** O passo do combo e o passo registrado pelo motor são a mesma jogada */
  private corresponde(p: Passo, q: PassoMotor) {
    if (p.t === "compra" || p.t === "texto" || q.t === "compra" || !this.mesma(p.c, q.c)) return false;
    // Invocação-Ritual anotada como Normal no Teste de Jogo: as duas são invocações
    const invoca = (t: string) => t === "normal" || t === "invoca";
    if (invoca(p.t) && invoca(q.t)) return true;
    if (p.t === "move" && q.t === "move") return p.para === q.para;
    return p.t === q.t;
  }

  /** Jogada da Main Phase que corresponde ao primeiro passo possível da janela */
  private jogada(ops: Opcao[]): Opcao | undefined {
    // ações da Main Phase (Opcao.acao.k) que fazem cada tipo de passo
    const kinds: Record<string, string[]> = {
      normal: ["normal"],
      baixa: ["baixa", "baixa-monstro"],
      ativa: ["ativa"],
      invoca: ["especial", "normal"],
    };
    for (const j of this.indices()) {
      const p = this.passos[j];
      if (!jogadaDaMain(p)) continue;
      const ks = kinds[p.t];
      const o = ops.find((x) => x.acao && ks.includes(x.acao.k) && x.acao.code !== undefined && this.mesma(x.acao.code, (p as { c: number }).c));
      if (o) return o;
    }
    return undefined;
  }

  /** Escolha de cartas: a que mais cita cartas dos próximos passos (os mais próximos valem mais) */
  private cartas(ops: Opcao[]): Opcao | undefined {
    const peso = new Map<number, number>();
    for (let j = this.k; j < Math.min(this.passos.length, this.k + JANELA); j++) {
      for (const c of cartasDoPasso(this.passos[j])) if (!peso.has(c)) peso.set(c, 1 / (1 + j - this.k));
    }
    const nota = (o: Opcao) => (o.escolha ?? []).reduce((n, c) => n + Math.max(0, ...[...peso].filter(([x]) => this.mesma(x, c.code)).map(([, v]) => v)), 0);
    let melhor: { o: Opcao; n: number } | undefined;
    for (const o of ops) {
      if (!o.escolha?.length) continue;
      const n = nota(o) - 0.001 * o.escolha.length;
      if (n > 0 && (!melhor || n > melhor.n)) melhor = { o, n };
    }
    return melhor?.o;
  }
}
