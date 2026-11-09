// Teste de Jogo (como o Solo Mode do Duelingbook): um tabuleiro sem regras, onde o jogador move
// as cartas do deck à mão para testar jogadas. Este módulo guarda o estado e as ações; a tela fica
// em src/screens/TesteJogo.tsx.

import { CARTA_QUALQUER, type CampoFinal, type Metodo, type Passo, type Zona } from "./motor";
import { t as tr } from "../i18n";

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
  /** token criado no teste: só existe no campo (ao sair, deixa de existir) */
  ficha?: boolean;
}

/** Token genérico (sem carta na base) */
export const TOKEN_GENERICO = 0;

export type Tabuleiro = Record<ZonaId, CartaJogo[]>;

export const NOMES_ZONA: Record<ZonaId, string> = {
  deck: tr("Deck"),
  extra: tr("Extra Deck"),
  mao: "mão",
  cemiterio: tr("Cemitério"),
  banido: tr("Banidas"),
  "campo-magia": tr("Zona de Campo"),
  m0: tr("Zona de Monstros 1"),
  m1: tr("Zona de Monstros 2"),
  m2: tr("Zona de Monstros 3"),
  m3: tr("Zona de Monstros 4"),
  m4: tr("Zona de Monstros 5"),
  em0: tr("Zona de Monstros Extra (esquerda)"),
  em1: tr("Zona de Monstros Extra (direita)"),
  st0: tr("Zona de Magias e Armadilhas 1"),
  st1: tr("Zona de Magias e Armadilhas 2"),
  st2: tr("Zona de Magias e Armadilhas 3"),
  st3: tr("Zona de Magias e Armadilhas 4"),
  st4: tr("Zona de Magias e Armadilhas 5"),
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

/** Tira a carta do teste (cartas do oponente no Teste Avançado) */
export const removerCarta = (t: Tabuleiro, uid: string): Tabuleiro => retirar(t, uid)?.t ?? t;

/** Cria um token na zona (virado para cima, em ataque ou em defesa) */
export function criarToken(t: Tabuleiro, id: number, para: ZonaId, defesa = false): Tabuleiro {
  return { ...t, [para]: [{ ...carta(id), defesa, ficha: true }, ...t[para]] };
}

/**
 * Cria uma carta que não sai de deck nenhum (cartas do oponente no Teste Avançado), na zona
 * escolhida; em zona de carta única ocupada, não entra.
 */
export function adicionarCarta(t: Tabuleiro, id: number, para: ZonaId, opts: { baixada?: boolean; defesa?: boolean } = {}): { t: Tabuleiro; uid?: string } {
  if (ZONAS_UNICAS.has(para) && t[para].length) return { t };
  const c = { ...carta(id), baixada: !!opts.baixada, defesa: !!opts.defesa };
  return { t: { ...t, [para]: para === "mao" ? [...t[para], c] : [c, ...t[para]] }, uid: c.uid };
}

/** Zonas onde um token pode ficar (fora delas, ele deixa de existir) */
const ZONAS_DE_TOKEN = new Set<ZonaId>([...MONSTROS, ...MONSTROS_EXTRA]);

export type Posicao = "topo" | "fundo";

/**
 * Move a carta para a zona. Em zona de carta única ocupada, a carta vira matéria Xyz do monstro
 * que está lá (como no Duelingbook). Fora do campo, a carta volta virada para cima e em ataque.
 */
export function mover(t: Tabuleiro, uid: string, para: ZonaId, opts: { posicao?: Posicao; baixada?: boolean; defesa?: boolean } = {}): Tabuleiro {
  const r = retirar(t, uid);
  if (!r) return t;
  let { t: novo } = r;
  // token que sai das Zonas de Monstros deixa de existir
  if (r.carta.ficha && !ZONAS_DE_TOKEN.has(para)) return novo;
  const saiDoCampo = !ZONAS_UNICAS.has(para);
  const c: CartaJogo = {
    ...r.carta,
    baixada: opts.baixada ?? (para === "deck" || para === "extra" ? false : saiDoCampo ? false : r.carta.baixada),
    defesa: saiDoCampo ? false : (opts.defesa ?? r.carta.defesa),
    materiais: saiDoCampo ? [] : r.carta.materiais,
  };
  // matérias de uma carta que saiu do campo vão para o Cemitério
  // (tokens usados como matéria deixam de existir)
  const materiais = r.carta.materiais.filter((m) => !m.ficha);
  if (saiDoCampo && materiais.length) novo = { ...novo, cemiterio: [...materiais.map((m) => ({ ...m, materiais: [] })), ...novo.cemiterio] };
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
      partes.push(tr("{0} {1} com {2} {3}{4}", [k, k === 1 ? tr("carta") : tr("cartas"), c, c === 1 ? tr("cópia") : tr("cópias"), x > 1 ? tr(" ({0} na mão{1})", [x, k > 1 ? tr(", de cada") : ""]) : ""]));
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

// ---------------------------------------------------------------- Executar combo (passo a passo)

/** O que o Executar precisa saber de uma carta para colocá-la no lugar certo (a tela resolve pela base) */
export interface TipoCarta {
  monstro: boolean;
  /** monstro do Extra Deck (Fusão, Sincro, Xyz, Link) */
  extra: boolean;
  xyz: boolean;
  /** Magia de Campo: vai para a Zona de Campo */
  campo: boolean;
  /** Magia/Armadilha que fica no campo depois de resolver (Contínua, de Campo, de Equipamento) */
  permanece: boolean;
}

/** Um passo aplicado: a carta que ele moveu ou ativou (para o histórico, o Criar combo e o destaque) */
export interface PassoAplicado {
  p: Passo;
  carta: CartaJogo;
  /** o passo ativou um efeito (recurso visual de efeito ativado) */
  ativou: boolean;
}

export interface Execucao {
  t: Tabuleiro;
  aplicados: PassoAplicado[];
  /** passos que não deu para aplicar (carta não encontrada ou sem zona livre) */
  falhas: Passo[];
}

const PILHAS_DE: Record<Exclude<Zona, "material" | "fora">, ZonaId[]> = {
  mao: ["mao"],
  deck: ["deck"],
  extra: ["extra"],
  cemiterio: ["cemiterio"],
  banido: ["banido"],
  campo: [...MONSTROS_EXTRA, ...MONSTROS],
  magia: MAGIAS,
  "campo-magia": ["campo-magia"],
  pendulo: ["st0", "st4"],
};

const TODAS = Object.keys(NOMES_ZONA) as ZonaId[];

/** Primeira cópia da carta (id) nas zonas; CARTA_QUALQUER aceita qualquer carta da mão */
function acharNas(t: Tabuleiro, id: number, zonas: ZonaId[]): CartaJogo | undefined {
  for (const z of zonas) {
    const c = id === CARTA_QUALQUER ? t[z][t[z].length - 1] : t[z].find((x) => x.id === id);
    if (c) return c;
  }
}

/** A carta do passo: primeiro onde o passo diz que ela está, depois em qualquer lugar (o usuário pode ter mexido) */
function acharDoPasso(t: Tabuleiro, id: number, de: Zona | undefined): CartaJogo | undefined {
  if (de === "material" || de === undefined) {
    for (const z of TODAS) for (const c of t[z]) {
      const m = c.materiais.find((x) => x.id === id);
      if (m) return m;
    }
    if (de === "material") return acharNas(t, id, TODAS);
  }
  return (de && de !== "fora" && acharNas(t, id, PILHAS_DE[de])) || acharNas(t, id, de === "mao" || de === undefined ? ["mao", ...TODAS] : TODAS);
}

/**
 * Aplica no tabuleiro o que o passo do combo diz (sem regras: só leva cada carta ao lugar indicado).
 * - Invocação: as matérias saem do campo (ou da mão) para o Cemitério, ou ficam anexadas no Xyz;
 *   monstros do Extra Deck vão para a Zona de Monstros Extra se ela estiver livre.
 * - Ativação: Magia/Armadilha da mão ou baixada fica virada para cima no campo se permanece
 *   (Contínua, de Campo, de Equipamento); as outras resolvem e vão para o Cemitério. Carta virada
 *   para baixo no campo que ativa o efeito vira para cima.
 * `livre` diz se uma zona vazia pode ser usada (no Teste Avançado a Zona de Monstros Extra é dividida).
 */
export function executarPasso(t: Tabuleiro, p: Passo, tipo: (id: number) => TipoCarta, livre: (z: ZonaId) => boolean = () => true): Execucao {
  const aplicados: PassoAplicado[] = [];
  const falha = (): Execucao => ({ t, aplicados, falhas: [p] });
  const vaga = (tab: Tabuleiro, zonas: ZonaId[]) => zonas.find((z) => !tab[z].length && livre(z));
  /** Zona de Monstros para a carta (Extra Deck: a Zona de Monstros Extra, se ainda não tiver uma sua) */
  const zonaMonstro = (tab: Tabuleiro, id: number) => {
    const temEMZ = MONSTROS_EXTRA.some((z) => tab[z].length);
    return tipo(id).extra && !temEMZ ? vaga(tab, [...MONSTROS_EXTRA, ...MONSTROS]) : vaga(tab, MONSTROS);
  };
  const zonaMagia = (tab: Tabuleiro, id: number) => (tipo(id).campo ? "campo-magia" : vaga(tab, MAGIAS));

  // passo descrito em texto: não há o que aplicar sozinho
  if (p.t === "texto") return falha();

  if (p.t === "compra") {
    let novo = t;
    const cartas: CartaJogo[] = [];
    for (const id of p.c) {
      const c = acharNas(novo, id, ["deck"]);
      if (!c) return falha();
      novo = mover(novo, c.uid, "mao");
      cartas.push(c);
    }
    return { t: novo, aplicados: cartas.map((carta) => ({ p, carta, ativou: false })), falhas: [] };
  }

  if (p.t === "normal" || p.t === "baixa") {
    const c = acharDoPasso(t, p.c, "mao");
    if (!c) return falha();
    const k = tipo(c.id);
    const baixa = p.t === "baixa";
    const para = k.monstro ? zonaMonstro(t, c.id) : zonaMagia(t, c.id);
    if (!para) return falha();
    return { t: mover(t, c.uid, para, { baixada: baixa, defesa: baixa && k.monstro }), aplicados: [{ p, carta: c, ativou: false }], falhas: [] };
  }

  if (p.t === "invoca") {
    let novo = t;
    // matérias: saem do campo (ou da mão, na Fusão e no Ritual); só as que ainda estão lá
    const zonasMat: ZonaId[] = [...MONSTROS_EXTRA, ...MONSTROS, ...MAGIAS, "mao"];
    const materiais: CartaJogo[] = [];
    for (const id of p.mat ?? []) {
      // duas cópias da mesma carta como matéria: cada uma é uma carta diferente
      const m = zonasMat.flatMap((z) => novo[z]).find((c) => c.id === id && !materiais.includes(c));
      if (m) materiais.push(m);
    }
    const xyz = p.m === "xyz";
    if (!xyz) for (const m of materiais) novo = mover(novo, m.uid, "cemiterio");
    else for (const m of materiais) novo = { ...novo, ...semCarta(novo, m.uid) };

    let carta: CartaJogo | undefined;
    if (p.de === "fora") {
      // token: criado na hora
      const para = zonaMonstro(novo, p.c);
      if (!para) return falha();
      novo = criarToken(novo, p.c, para);
      carta = novo[para][0];
    } else {
      carta = acharDoPasso(novo, p.c, p.de);
      const para = carta && zonaMonstro(novo, carta.id);
      if (!carta || !para) return falha();
      novo = mover(novo, carta.uid, para, { baixada: false, defesa: false });
      if (xyz && materiais.length)
        novo = { ...novo, [para]: novo[para].map((c) => (c.uid === carta!.uid ? { ...c, materiais: [...c.materiais, ...materiais.map((m) => ({ ...m, baixada: false, defesa: false, materiais: [] }))] } : c)) };
    }
    return { t: novo, aplicados: [{ p, carta, ativou: false }, ...materiais.map((m) => ({ p, carta: m, ativou: false }))], falhas: [] };
  }

  if (p.t === "move") {
    const c = acharDoPasso(t, p.c, p.de);
    if (!c && p.de !== "fora") return falha();
    if (p.para === "fora") return c ? { t: removerCarta(t, c.uid), aplicados: [{ p, carta: c, ativou: false }], falhas: [] } : falha();
    let para: ZonaId | undefined;
    if (p.para === "material") {
      // anexa ao monstro que causou o passo, ou ao primeiro Xyz no campo
      const campo = [...MONSTROS_EXTRA, ...MONSTROS];
      const dono = (p.por !== undefined && acharNas(t, p.por, campo)) || campo.flatMap((z) => t[z]).find((x) => tipo(x.id).xyz);
      para = dono ? campo.find((z) => t[z][0]?.uid === dono.uid) : undefined;
    } else if (p.para === "campo") para = zonaMonstro(t, p.c);
    else if (p.para === "magia") para = tipo(p.c).campo ? "campo-magia" : vaga(t, MAGIAS);
    else if (p.para === "pendulo") para = vaga(t, PILHAS_DE.pendulo);
    else para = PILHAS_DE[p.para][0];
    if (!para) return falha();
    if (c) return { t: mover(t, c.uid, para), aplicados: [{ p, carta: c, ativou: false }], falhas: [] };
    // carta que vem de fora do duelo (criada por um efeito): entra na hora
    const criada = adicionarCarta(t, p.c, para);
    const nova = criada.uid ? acharCarta(criada.t, criada.uid)?.carta : undefined;
    return nova ? { t: criada.t, aplicados: [{ p, carta: nova, ativou: false }], falhas: [] } : falha();
  }

  // ativação de efeito
  const c = acharDoPasso(t, p.c, p.de);
  if (!c) return falha();
  const k = tipo(c.id);
  const onde = acharCarta(t, c.uid);
  let novo = t;
  if (!k.monstro && onde && !onde.dono && (onde.zona === "mao" || onde.zona === "deck" || ZONAS_UNICAS.has(onde.zona))) {
    if (!k.permanece) novo = mover(t, c.uid, "cemiterio");
    else if (!ZONAS_UNICAS.has(onde.zona)) {
      // Magia de Campo nova manda a anterior para o Cemitério
      if (k.campo && t["campo-magia"][0]) novo = mover(novo, t["campo-magia"][0].uid, "cemiterio");
      const para = zonaMagia(novo, c.id);
      if (!para) return falha();
      novo = mover(novo, c.uid, para, { baixada: false });
    } else if (c.baixada) novo = alternar(t, c.uid, "baixada");
  } else if (onde && !onde.dono && ZONAS_UNICAS.has(onde.zona) && c.baixada) {
    // monstro virado para baixo que ativa o efeito: vira para cima
    novo = alternar(t, c.uid, "baixada");
  }
  return { t: novo, aplicados: [{ p, carta: c, ativou: true }], falhas: [] };
}

/** Tira a carta do tabuleiro sem mandá-la a lugar nenhum (matéria que vai ser anexada a um Xyz) */
function semCarta(t: Tabuleiro, uid: string): Tabuleiro {
  return retirar(t, uid)?.t ?? t;
}
