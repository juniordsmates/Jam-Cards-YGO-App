// Teste de Jogo (como o Solo Mode do Duelingbook): um tabuleiro sem regras, onde o jogador move
// as cartas do deck à mão para testar jogadas. Este módulo guarda o estado e as ações; a tela fica
// em src/screens/TesteJogo.tsx.

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
