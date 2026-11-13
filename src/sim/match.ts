// Match (melhor de 3) do Simulador: placar, quem escolhe quem começa e a troca de side entre os jogos.
// Segue as regras de torneio: vence quem ganha 2 jogos; antes do jogo 2 e do jogo 3 cada um pode trocar
// cartas do Main ou do Extra com o Side, carta por carta (as três partes continuam do mesmo tamanho); o
// perdedor do jogo anterior escolhe se começa. Um jogo empatado não conta, e quem escolheu da última vez
// escolhe de novo. Não sabe nada do motor nem do banco: contra a IA o Simulador guarda os resultados aqui;
// na partida 1x1 o banco faz a mesma conta (supabase/migrations/20261112000000_matches.sql).

/** Lado do jogador neste aparelho */
export type Lado = "eu" | "op";
/** Vencedor de um jogo; null = empate */
export type ResultadoJogo = Lado | null;

export const VITORIAS_PARA_VENCER = 2;

export interface DeckCompleto {
  main: number[];
  extra: number[];
  side: number[];
}

export type ParteDeck = keyof DeckCompleto;

export const outroLado = (l: Lado): Lado => (l === "eu" ? "op" : "eu");

export function placar(resultados: ResultadoJogo[]): Record<Lado, number> {
  return {
    eu: resultados.filter((r) => r === "eu").length,
    op: resultados.filter((r) => r === "op").length,
  };
}

/** Quem venceu a match (null: ainda não acabou) */
export function vencedorDaMatch(resultados: ResultadoJogo[]): Lado | null {
  const p = placar(resultados);
  return p.eu >= VITORIAS_PARA_VENCER ? "eu" : p.op >= VITORIAS_PARA_VENCER ? "op" : null;
}

/**
 * Quem escolhe quem começa o próximo jogo: o perdedor do último jogo. Num empate, quem escolheu antes
 * dele; no empate do jogo 1, `inicial` (quem ganhou o sorteio do jogo 1).
 */
export function quemEscolhe(resultados: ResultadoJogo[], inicial: Lado): Lado {
  let escolhe = inicial;
  for (const r of resultados) if (r) escolhe = outroLado(r);
  return escolhe;
}

function ordenadas(d: DeckCompleto): number[] {
  return [...d.main, ...d.extra, ...d.side].sort((a, b) => a - b);
}

/** O deck com o side trocado vale: as mesmas cartas do original e Main, Extra e Side do mesmo tamanho */
export function sideValido(original: DeckCompleto, novo: DeckCompleto): boolean {
  if (novo.main.length !== original.main.length || novo.extra.length !== original.extra.length || novo.side.length !== original.side.length) return false;
  const a = ordenadas(original);
  const b = ordenadas(novo);
  return a.every((c, i) => c === b[i]);
}

/**
 * Move a carta na posição `indice` de `de`: do Main ou do Extra ela vai para o Side; do Side volta
 * para o Extra (monstro de Fusão, Sincro, Xyz ou Link) ou para o Main.
 */
export function moverCarta(deck: DeckCompleto, de: ParteDeck, indice: number, ehDoExtra: (id: number) => boolean): DeckCompleto {
  const id = deck[de][indice];
  if (id === undefined) return deck;
  const para: ParteDeck = de !== "side" ? "side" : ehDoExtra(id) ? "extra" : "main";
  return { ...deck, [de]: deck[de].filter((_, i) => i !== indice), [para]: [...deck[para], id] };
}
