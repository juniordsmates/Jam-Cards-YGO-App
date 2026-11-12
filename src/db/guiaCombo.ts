// Guia de combo (Teste de Jogo e Modo de Treino do Simulador): o jogador escolhe uma linha da base de
// combos do deck e acompanha, passo a passo, o que o oponente pode responder e as chances de chegar ao
// campo final.
//
// As probabilidades são estimativas pelas jogadas (não simulam o duelo):
// - Ameaças: cartas que respondem aos passos que faltam (respostas calculadas pelo pipeline em cada
//   passo). Com a mão do oponente conhecida (Teste Avançado), contam as cartas dela; sem isso, cada
//   resposta pesa pela chance de o oponente tê-la na mão, estimada pelo uso em torneios (no total, no
//   máximo 1,5 resposta esperada na mão).
// - Recuperação: quando o combo é respondido, o jogador ainda pode chegar lá com as outras cartas de
//   combo que tem na mão (iniciadores e extensores das linhas do deck, sem contar as interrupções de
//   mão). Cada uma vale cerca de 20 pontos, até 90%: com 4 cartas de combo, ~80%; sem nenhuma, 0%.
// - Ativação do oponente durante o guia (Teste Avançado: ativar uma carta da mão dele; Simulador: a IA
//   ativa no seu turno) conta como resposta que resolveu: o passo atual fica interrompido.
import { groupSteps, respostasDaLinha, semCartaDoCalculo, uniqueLines, type CombosCalculados, type LinhaCombo, type Passo } from "./motor";

/** Linhas da base de combos que o deck pode jogar, agrupadas pelo deck (arquétipo) da base */
export interface GrupoCombos {
  nome: string;
  linhas: LinhaCombo[];
}

/** chance de uma resposta parar o passo em que é ativada */
const PARA = 0.85;
/** chance de abrir uma carta que o deck joga (3 cópias numa mão de 5, por volta de 40%) */
const ABRE = 0.4;
/**
 * Respostas esperadas na mão do oponente, no máximo: a mão tem 5 cartas e um deck de torneio costuma
 * abrir 1 ou 2 interrupções (somar a chance de todas as respostas possíveis passaria disso)
 */
const RESPOSTAS_NA_MAO = 1.5;

/** Respostas esperadas na mão do oponente entre estas cartas, pelo uso em torneios */
const esperadas = (cartas: Iterable<number>, uso: (id: number) => number) => Math.min(RESPOSTAS_NA_MAO, [...cartas].reduce((n, c) => n + Math.min(0.9, uso(c) * ABRE), 0));

export type NivelChance = "Muito Alta" | "Alta" | "Média" | "Baixa" | "Muito Baixa" | "Nula";

/** Resposta do oponente que já resolveu durante o guia: o passo em que veio e a carta */
export interface Interrupcao {
  passo: number;
  carta: number;
}

export interface EstadoGuia {
  linha: LinhaCombo;
  /** passo atual (índice nos passos agrupados) */
  passo: number;
  interrupcoes: Interrupcao[];
}

/**
 * Linhas do deck: a mão inicial toda no Main Deck (ids canônicos, como na base) e, com o formato,
 * válidas nele. Agrupa pelo deck da base e ordena por pontos.
 */
export function combosDoDeck(combos: CombosCalculados | undefined, main: number[], formato?: "TCG" | "OCG"): GrupoCombos[] {
  if (!combos) return [];
  const noDeck = new Map<number, number>();
  for (const id of main) noDeck.set(id, (noDeck.get(id) ?? 0) + 1);
  const cabe = (l: LinhaCombo) => {
    const precisa = new Map<number, number>();
    for (const c of l.mao) precisa.set(c, (precisa.get(c) ?? 0) + 1);
    return [...precisa].every(([c, n]) => (noDeck.get(c) ?? 0) >= n);
  };
  const linhas = uniqueLines(combos.linhas.filter((l) => cabe(l) && (!formato || !l.formatos || l.formatos.includes(formato))));
  const grupos = new Map<number, LinhaCombo[]>();
  for (const l of linhas) grupos.set(l.deck, [...(grupos.get(l.deck) ?? []), l]);
  return [...grupos]
    .map(([deck, ls]) => ({ nome: combos.decks[deck]?.nome ?? "", linhas: ls.sort((a, b) => b.pontos - a.pontos) }))
    .sort((a, b) => b.linhas.length - a.linhas.length);
}

/** Passos agrupados da linha (as consequências de um efeito ficam sob o passo dele) */
export const passosDaLinha = (l: LinhaCombo) => groupSteps(semCartaDoCalculo(l).passos);

/** Respostas do oponente no passo k (com as consequências dele) e as de quase toda a linha */
export function respostasNoPasso(l: LinhaCombo, k: number): { doPasso: number[]; sempre: number[] } {
  const r = respostasDaLinha(l);
  const g = passosDaLinha(l)[k];
  if (!g) return { doPasso: [], sempre: [...r.sempre] };
  const doPasso = new Set<number>();
  for (const p of [g.step, ...g.subs]) for (const c of r.porPasso(p)) doPasso.add(c);
  return { doPasso: [...doPasso], sempre: [...r.sempre] };
}

/** Cartas que, nas linhas do deck, iniciam ou continuam um combo saindo da mão (sem as interrupções de mão) */
function cartasDeCombo(linhas: LinhaCombo[]): Set<number> {
  const respostas = new Set<number>();
  for (const l of linhas) for (const p of l.passos) for (const r of p.resp ?? []) respostas.add(r);
  const combo = new Set<number>();
  for (const l of linhas) {
    l.mao.forEach((c) => combo.add(c));
    for (const p of l.passos as Passo[]) if ((p.t === "normal" || ((p.t === "ativa" || p.t === "invoca") && p.de === "mao")) && typeof p.c === "number") combo.add(p.c);
  }
  for (const r of respostas) combo.delete(r);
  return combo;
}

/** Recuperação com n cartas de combo na mão */
const recupera = (n: number) => Math.min(0.9, 0.2 * Math.max(0, n));

export function nivelDaChance(p: number): NivelChance {
  if (p <= 0) return "Nula";
  if (p < 0.2) return "Muito Baixa";
  if (p < 0.4) return "Baixa";
  if (p < 0.6) return "Média";
  if (p < 0.8) return "Alta";
  return "Muito Alta";
}

export interface AvaliacaoGuia {
  /** Probabilidade de Finalizar o Combo (0 a 1, estimativa) */
  finalizar: number;
  /** Probabilidade Atual: o passo atual resolver */
  atual: NivelChance;
  /** de onde vêm as ameaças: a mão do oponente (Teste Avançado) ou o uso em torneios */
  base: "mao-oponente" | "meta";
  /** cartas da mão do oponente que respondem aos passos que faltam / ao passo atual */
  ameacas: number[];
  ameacasAgora: number[];
  /** cartas de combo na mão do jogador (para continuar se o combo for respondido) */
  cartasDeCombo: number;
  /** linhas do deck que ainda cabem nas cartas do jogador */
  linhasJogaveis: number;
}

export interface EntradaAvaliacao {
  estado: EstadoGuia;
  /** todas as linhas do deck (para as cartas de combo e as linhas que ainda cabem) */
  linhasDoDeck: LinhaCombo[];
  /** cartas do jogador (ids canônicos): mão e campo */
  mao: number[];
  campo: number[];
  /** mão do oponente conhecida (ids canônicos, vazia = sem cartas); null quando escondida */
  maoOponente: number[] | null;
  /** fração dos decks de torneio com a carta (0 a 1) */
  uso: (id: number) => number;
  /** carta legal no formato (respostas proibidas não contam) */
  legal: (id: number) => boolean;
}

export function avaliarGuia(e: EntradaAvaliacao): AvaliacaoGuia {
  const { linha, passo: k, interrupcoes } = e.estado;
  const total = passosDaLinha(linha).length;
  // respostas dos passos que faltam e do passo atual
  const restantes = new Set<number>();
  for (let i = k; i < total; i++) {
    const r = respostasNoPasso(linha, i);
    for (const c of [...r.doPasso, ...r.sempre]) if (e.legal(c)) restantes.add(c);
  }
  const agoraR = respostasNoPasso(linha, k);
  const agora = new Set([...agoraR.doPasso, ...agoraR.sempre].filter(e.legal));

  // cartas de combo na mão e linhas que ainda cabem nas cartas do jogador
  const deCombo = cartasDeCombo(e.linhasDoDeck);
  const nCombo = e.mao.filter((c) => deCombo.has(c)).length;
  const tem = new Map<number, number>();
  for (const c of [...e.mao, ...e.campo]) tem.set(c, (tem.get(c) ?? 0) + 1);
  const linhasJogaveis = e.linhasDoDeck.filter((l) => {
    const precisa = new Map<number, number>();
    for (const c of l.mao) precisa.set(c, (precisa.get(c) ?? 0) + 1);
    return [...precisa].every(([c, n]) => (tem.get(c) ?? 0) >= n);
  }).length;
  // sem nenhuma linha que caiba, as cartas de combo valem menos (podem não começar nada sozinhas)
  const rec = (n: number) => recupera(n) * (linhasJogaveis > 0 ? 1 : 0.6);

  // já respondido: o combo segue só com as outras cartas de combo
  const quebrado = interrupcoes.length > 0;
  let finalizar = quebrado ? rec(nCombo) : 1;
  // mão conhecida (Teste Avançado), mesmo vazia: só ela ameaça; escondida: estimativa pelo meta
  const base: AvaliacaoGuia["base"] = e.maoOponente ? "mao-oponente" : "meta";
  const ameacas: number[] = [];
  const ameacasAgora: number[] = [];
  if (base === "mao-oponente") {
    for (const c of e.maoOponente!) {
      if (restantes.has(c)) ameacas.push(c);
      if (agora.has(c)) ameacasAgora.push(c);
    }
    // cada ameaça provavelmente para um passo; cada parada gasta uma carta de combo para continuar
    ameacas.forEach((_, i) => (finalizar *= 1 - PARA * (1 - rec(nCombo - i - (quebrado ? 1 : 0)))));
  } else {
    // número de respostas na mão como Poisson: chance de passar por todas = exp(-λ · chance de cada uma parar o combo)
    finalizar *= Math.exp(-esperadas(restantes, e.uso) * PARA * (1 - rec(nCombo - (quebrado ? 1 : 0))));
  }

  // passo atual
  let atual: number;
  if (interrupcoes.some((i) => i.passo === k)) atual = 0;
  else {
    atual = base === "mao-oponente" ? (ameacasAgora.length ? 1 - PARA : 1) : Math.exp(-esperadas(agora, e.uso) * PARA);
    if (quebrado) atual *= rec(nCombo);
  }
  return {
    finalizar: Math.max(0, Math.min(1, finalizar)),
    atual: nivelDaChance(atual),
    base,
    ameacas,
    ameacasAgora,
    cartasDeCombo: nCombo,
    linhasJogaveis,
  };
}
