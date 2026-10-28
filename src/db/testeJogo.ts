// Teste de Jogo (como o Solo Mode do Duelingbook): um tabuleiro sem regras, onde o jogador move
// as cartas do deck à mão para testar jogadas. Este módulo guarda o estado e as ações; a tela fica
// em src/screens/TesteJogo.tsx.

import type { CampoFinal, Metodo, Passo, Zona } from "./motor";

export type ZonaId =
  | "deck"
  | "extra"
  | "mao"
  | "cemiterio"
  | "banido"
  | "campo-magia"
  | "m0" | "m1" | "m2" | "m3" | "m4"
  | "em0" | "em1"
  | "st0" | "st1" | "st2" | "st3" | "st4";

export const MONSTROS: ZonaId[] = ["m0", "m1", "m2", "m3", "m4"];
export const MONSTROS_EXTRA: ZonaId[] = ["em0", "em1"];
export const MAGIAS: ZonaId[] = ["st0", "st1", "st2", "st3", "st4"];
/** zonas que recebem uma carta só (e suas matérias Xyz) */
export const ZONAS_UNICAS = new Set<ZonaId>([...MONSTROS, ...MONSTROS_EXTRA, ...MAGIAS, "campo-magia"]);

export interface CartaJogo {
  /** identificador desta cópia no teste */
  uid: string;
  id: number;
  baixada: boolean;
  defesa: boolean;
  /** matérias Xyz anexadas */
  materiais: CartaJogo[];
}

export type Tabuleiro = Record<ZonaId, CartaJogo[]>;

export const NOMES_ZONA: Record<ZonaId, string> = {
  deck: "Deck",
  extra: "Extra Deck",
  mao: "mão",
  cemiterio: "Cemitério",
  banido: "Banidas",
  "campo-magia": "Zona de Campo",
  m0: "Zona de Monstros 1",
  m1: "Zona de Monstros 2",
  m2: "Zona de Monstros 3",
  m3: "Zona de Monstros 4",
  m4: "Zona de Monstros 5",
  em0: "Zona de Monstros Extra (esquerda)",
  em1: "Zona de Monstros Extra (direita)",
  st0: "Zona de Magias e Armadilhas 1",
  st1: "Zona de Magias e Armadilhas 2",
  st2: "Zona de Magias e Armadilhas 3",
  st3: "Zona de Magias e Armadilhas 4",
  st4: "Zona de Magias e Armadilhas 5",
};

let contador = 0;
const carta = (id: number): CartaJogo => ({ uid: `c${++contador}`, id, baixada: false, defesa: false, materiais: [] });

/** Inteiro aleatório e sem viés em [0, n), com o gerador criptográfico do sistema */
export function aleatorio(n: number): number {
  const limite = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    // descarta o resto que causaria viés (rejection sampling)
    if (buf[0] < limite) return buf[0] % n;
  }
}

/** Embaralha (Fisher-Yates) com o gerador criptográfico */
export function embaralhar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tabuleiro inicial: Main embaralhado no Deck, Extra no Extra Deck, o resto vazio */
export function tabuleiroInicial(main: number[], extra: number[]): Tabuleiro {
  const vazio = Object.fromEntries(Object.keys(NOMES_ZONA).map((z) => [z, []])) as unknown as Tabuleiro;
  return { ...vazio, deck: embaralhar(main).map(carta), extra: extra.map(carta) };
}

/** Teste de Mão: tudo volta para o Deck e o Extra Deck, embaralha e compra 5 */
export function testeDeMao(main: number[], extra: number[], quantas = 5): Tabuleiro {
  const t = tabuleiroInicial(main, extra);
  return { ...t, mao: t.deck.slice(0, quantas), deck: t.deck.slice(quantas) };
}

/** Mão inicial de um combo: as cartas da mão saem do Deck (embaralhado) e vão para a mão */
export function maoDoCombo(main: number[], extra: number[], mao: number[]): Tabuleiro {
  const t = tabuleiroInicial(main, extra);
  const resto = [...t.deck];
  const naMao: CartaJogo[] = [];
  for (const id of mao) {
    const i = resto.findIndex((c) => c.id === id);
    if (i >= 0) naMao.push(...resto.splice(i, 1));
  }
  return { ...t, mao: naMao, deck: resto };
}

export function comprar(t: Tabuleiro, n = 1): Tabuleiro {
  return { ...t, mao: [...t.mao, ...t.deck.slice(0, n)], deck: t.deck.slice(n) };
}

export const embaralharDeck = (t: Tabuleiro): Tabuleiro => ({ ...t, deck: embaralhar(t.deck) });

/** Acha a carta pelo uid (em qualquer zona, inclusive como matéria) */
export function acharCarta(t: Tabuleiro, uid: string): { zona: ZonaId; carta: CartaJogo; dono?: CartaJogo } | null {
  for (const zona of Object.keys(t) as ZonaId[]) {
    for (const c of t[zona]) {
      if (c.uid === uid) return { zona, carta: c };
      const m = c.materiais.find((x) => x.uid === uid);
      if (m) return { zona, carta: m, dono: c };
    }
  }
  return null;
}

/** Tira a carta de onde estiver (se tinha matérias e saiu do campo, elas vão para o Cemitério) */
function retirar(t: Tabuleiro, uid: string): { t: Tabuleiro; carta: CartaJogo } | null {
  const achada = acharCarta(t, uid);
  if (!achada) return null;
  const novo = { ...t };
  if (achada.dono) {
    novo[achada.zona] = t[achada.zona].map((c) => (c.uid === achada.dono!.uid ? { ...c, materiais: c.materiais.filter((m) => m.uid !== uid) } : c));
    return { t: novo, carta: achada.carta };
  }
  novo[achada.zona] = t[achada.zona].filter((c) => c.uid !== uid);
  return { t: novo, carta: achada.carta };
}

export type Posicao = "topo" | "fundo";

/**
 * Move a carta para a zona. Em zona de carta única ocupada, a carta vira matéria Xyz do monstro
 * que está lá (como no Duelingbook). Fora do campo, a carta volta virada para cima e em ataque.
 */
export function mover(t: Tabuleiro, uid: string, para: ZonaId, opts: { posicao?: Posicao; baixada?: boolean; defesa?: boolean } = {}): Tabuleiro {
  const r = retirar(t, uid);
  if (!r) return t;
  let { t: novo } = r;
  const saiDoCampo = !ZONAS_UNICAS.has(para);
  const c: CartaJogo = {
    ...r.carta,
    baixada: opts.baixada ?? (para === "deck" || para === "extra" ? false : saiDoCampo ? false : r.carta.baixada),
    defesa: saiDoCampo ? false : (opts.defesa ?? r.carta.defesa),
    materiais: saiDoCampo ? [] : r.carta.materiais,
  };
  // matérias de uma carta que saiu do campo vão para o Cemitério
  if (saiDoCampo && r.carta.materiais.length) novo = { ...novo, cemiterio: [...r.carta.materiais.map((m) => ({ ...m, materiais: [] })), ...novo.cemiterio] };
  if (ZONAS_UNICAS.has(para) && novo[para].length) {
    const [alvo] = novo[para];
    novo = { ...novo, [para]: [{ ...alvo, materiais: [...alvo.materiais, { ...c, baixada: false, defesa: false, materiais: [] }] }] };
    return novo;
  }
  // pilhas: o mais recente fica por cima (início da lista), salvo "fundo"
  const pilha = para === "mao" || opts.posicao === "fundo" ? [...novo[para], c] : [c, ...novo[para]];
  return { ...novo, [para]: pilha };
}

export const alternar = (t: Tabuleiro, uid: string, campo: "baixada" | "defesa"): Tabuleiro => {
  const achada = acharCarta(t, uid);
  if (!achada || achada.dono) return t;
  return { ...t, [achada.zona]: t[achada.zona].map((c) => (c.uid === uid ? { ...c, [campo]: !c[campo] } : c)) };
};

/**
 * Chance de abrir ao menos 1 cópia de uma carta (distribuição hipergeométrica, a mesma dos
 * calculadores como yugioh.otterlord.dev, deck-probability.com e deckcal.cc):
 * 1 − C(N−k, n) / C(N, n), com N cartas no Deck, k cópias da carta e n cartas na mão.
 */
export function chanceDeAbrir(N: number, k: number, n = 5): number {
  if (k <= 0 || N <= 0) return 0;
  if (n >= N || k > N - n) return 1;
  // C(N−k, n) / C(N, n) = Π (N−k−i) / (N−i), i = 0..n−1
  let nenhuma = 1;
  for (let i = 0; i < n; i++) nenhuma *= (N - k - i) / (N - i);
  return 1 - nenhuma;
}

/** C(n, k) em ponto flutuante (suficiente para decks de até 60 cartas) */
function combinacoes(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * Chance de abrir exatamente esta mão (as mesmas cartas, em qualquer ordem), comprando do Deck
 * inteiro: Π C(cópias no Deck, cópias na mão) / C(cartas no Deck, cartas na mão)
 * (hipergeométrica multivariada).
 */
export function probabilidadeDaMao(deck: number[], mao: number[]): number {
  if (!mao.length || mao.length > deck.length) return 0;
  const naMao = new Map<number, number>();
  for (const id of mao) naMao.set(id, (naMao.get(id) ?? 0) + 1);
  let favoraveis = 1;
  for (const [id, x] of naMao) favoraveis *= combinacoes(deck.filter((d) => d === id).length, x);
  return favoraveis / combinacoes(deck.length, mao.length);
}

/**
 * Probabilidade geral: chance de abrir uma mão com o mesmo perfil, sem importar quais cartas
 * (ex.: "5 cartas com 3 cópias": cinco cartas diferentes, cada uma com 3 cópias no Deck). Conta todas as mãos em que, para
 * cada número de cópias no Deck, aparecem tantas cartas diferentes com as mesmas quantidades:
 * Π_c [ D_c! / ((D_c − m_c)! · Π mult!) · Π C(c, x) ] / C(N, n),
 * com D_c cartas diferentes que têm c cópias no Deck e m_c delas na mão.
 */
export function probabilidadeGeral(deck: number[], mao: number[]): { p: number; perfil: string } {
  if (!mao.length || mao.length > deck.length) return { p: 0, perfil: "" };
  const copias = new Map<number, number>();
  for (const id of deck) copias.set(id, (copias.get(id) ?? 0) + 1);
  const naMao = new Map<number, number>();
  for (const id of mao) naMao.set(id, (naMao.get(id) ?? 0) + 1);
  // por número de cópias no Deck: quantas cartas diferentes existem e quantas de cada uma vieram
  const porClasse = new Map<number, number[]>();
  for (const [id, x] of naMao) {
    const c = copias.get(id) ?? 0;
    if (!c) return { p: 0, perfil: "" };
    porClasse.set(c, [...(porClasse.get(c) ?? []), x]);
  }
  const distintasCom = (c: number) => [...copias.values()].filter((v) => v === c).length;
  const fatorial = (n: number) => {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  };
  let maos = 1;
  const partes: string[] = [];
  for (const [c, xs] of [...porClasse].sort((a, b) => b[0] - a[0])) {
    const D = distintasCom(c);
    const m = xs.length;
    // escolhas de quais cartas diferentes ocupam o padrão de quantidades (sem contar repetidas)
    let arranjos = 1;
    for (let i = 0; i < m; i++) arranjos *= D - i;
    const mult = new Map<number, number>();
    for (const x of xs) mult.set(x, (mult.get(x) ?? 0) + 1);
    for (const k of mult.values()) arranjos /= fatorial(k);
    maos *= arranjos * xs.reduce((s, x) => s * combinacoes(c, x), 1);
    for (const [x, k] of [...mult].sort((a, b) => b[0] - a[0]))
      partes.push(`${k} ${k === 1 ? "carta" : "cartas"} com ${c} ${c === 1 ? "cópia" : "cópias"}${x > 1 ? ` (${x} na mão${k > 1 ? ", de cada" : ""})` : ""}`);
  }
  return { p: maos / combinacoes(deck.length, mao.length), perfil: partes.join(" + ") };
}

// ---------------------------------------------------------------- Criar combo (a partir do teste)

/** Zona do tabuleiro → zona dos passos de combo (as mesmas da tela de Combos) */
export function zonaDoPasso(z: ZonaId | "material"): Zona {
  if (z === "material") return "material";
  if (MONSTROS.includes(z) || MONSTROS_EXTRA.includes(z)) return "campo";
  if (MAGIAS.includes(z)) return "magia";
  return z as Zona;
}

/** Método de Invocação de um monstro do Extra Deck pelo tipo de carta (frame da YGOPRODeck) */
export function metodoDoExtra(frame: string): Metodo | undefined {
  if (frame.startsWith("xyz")) return "xyz";
  if (frame.startsWith("link")) return "link";
  if (frame.startsWith("synchro")) return "sincro";
  if (frame.startsWith("fusion")) return "fusao";
  return undefined;
}

/**
 * Acrescenta um passo à lista, no mesmo formato das linhas da tela de Combos:
 * - compras seguidas viram um passo só;
 * - na Invocação do Extra Deck, as cartas que acabaram de sair do campo (Cemitério, banidas ou
 *   matéria) viram as matérias dela ("Link de X usando A + B");
 * - cartas anexadas logo depois de uma Invocação-Xyz entram nas matérias dela.
 */
export function anotarPasso(passos: Passo[], p: Passo): Passo[] {
  const ultimo = passos[passos.length - 1];
  if (p.t === "compra" && ultimo?.t === "compra") return [...passos.slice(0, -1), { t: "compra", c: [...ultimo.c, ...p.c] }];
  if (p.t === "move" && p.para === "material" && ultimo?.t === "invoca" && ultimo.m === "xyz")
    return [...passos.slice(0, -1), { ...ultimo, mat: [...(ultimo.mat ?? []), p.c] }];
  if (p.t === "invoca" && p.de === "extra" && p.m && !p.mat?.length) {
    let i = passos.length;
    while (i > 0) {
      const q = passos[i - 1];
      if (q.t !== "move" || q.de !== "campo" || !["cemiterio", "banido", "material"].includes(q.para)) break;
      i--;
    }
    const mat = passos.slice(i).map((q) => q.c as number);
    if (mat.length) return [...passos.slice(0, i), { ...p, mat }];
  }
  return [...passos, p];
}

/** Campo final do teste: monstros (Zonas de Monstros e Extra), Magias/Armadilhas e a mão */
export function campoDoTabuleiro(t: Tabuleiro): CampoFinal {
  return {
    monstros: [...MONSTROS_EXTRA, ...MONSTROS].flatMap((z) => t[z].map((c) => c.id)),
    magias: (["campo-magia", ...MAGIAS] as ZonaId[]).flatMap((z) => t[z].map((c): [number, boolean] => [c.id, c.baixada])),
    mao: t.mao.map((c) => c.id),
  };
}
