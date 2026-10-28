// Combos calculados no motor de regras do EDOPro (Project Ignis) pelo pipeline da base
// (Database-Cards-Ygo, scripts/combos.ts). Chegam na camada pública, campo "combos": só ids e zonas.

export type Zona = "deck" | "mao" | "campo" | "magia" | "cemiterio" | "banido" | "extra" | "material" | "campo-magia" | "pendulo" | "fora";
export type Metodo = "xyz" | "link" | "sincro" | "fusao" | "ritual";

/** cartas do oponente que poderiam responder logo depois do passo (calculado no pipeline) */
type ComRespostas = { resp?: number[] };

export type Passo = ComRespostas & (
  | { t: "normal"; c: number }
  | { t: "baixa"; c: number }
  | { t: "ativa"; c: number; de: Zona }
  | { t: "invoca"; c: number; de: Zona; m?: Metodo; mat?: number[]; por?: number }
  | { t: "move"; c: number; de: Zona; para: Zona; por?: number }
  | { t: "compra"; c: number[] }
  // passo descrito em texto (combos da comunidade e sugestões de IA), com as cartas citadas
  | { t: "texto"; texto: string; c: number[] }
);

export interface CampoFinal {
  monstros: number[];
  /** [id, baixada] */
  magias: [number, boolean][];
  mao: number[];
}

export interface LinhaCombo {
  /** índice em `decks` */
  deck: number;
  mao: number[];
  /** cartas sem uso na linha, só para custos de descarte */
  qualquer?: number;
  /** id da linha da comunidade que esta linha confirma (src/data/combos.ts) */
  comunidade?: string;
  /** formatos em que a linha vale (decklist ajustado à banlist de cada um) */
  formatos?: ("TCG" | "OCG")[];
  passos: Passo[];
  campo: CampoFinal;
  pontos: number;
  /** ramificação: carta(s) que a primeira escolha do Deck trouxe nesta linha (ex.: o que a Engage adicionou) */
  ramo?: number[];
}

export interface CombosCalculados {
  motor: { nome: string; ocgcore: string; scripts: string; base: string };
  geradoEm: string;
  decks: { busca: string; nome: string; evento: string; url: string }[];
  linhas: LinhaCombo[];
}

/** Ids de todas as cartas citadas numa linha (passos e campo final) */
export function cardsOfLine(l: LinhaCombo): number[] {
  const ids = new Set<number>(l.mao);
  for (const p of l.passos) {
    if (p.t === "compra" || p.t === "texto") p.c.forEach((c) => ids.add(c));
    else {
      ids.add(p.c);
      if ("mat" in p) p.mat?.forEach((c) => ids.add(c));
      if ("por" in p && p.por) ids.add(p.por);
    }
  }
  l.campo.monstros.forEach((c) => ids.add(c));
  l.campo.magias.forEach(([c]) => ids.add(c));
  l.campo.mao.forEach((c) => ids.add(c));
  return [...ids];
}

/**
 * O pipeline calcula o decklist com a banlist de cada formato; quando as versões chegam ao mesmo
 * campo final com a mesma mão (e a mesma carta adicionada), a linha aparece uma vez só.
 */
export function uniqueLines(lines: LinhaCombo[]): LinhaCombo[] {
  const seen = new Set<string>();
  return lines.filter((l) => {
    // mesma mão, mesma carta adicionada e mesmo campo final: a linha repetida não acrescenta nada
    const campo = [...l.campo.monstros, ...l.campo.magias.map(([c]) => c)].sort();
    const key = JSON.stringify([l.deck, [...l.mao].sort(), l.qualquer ?? 0, l.ramo ?? [], campo]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Linhas cuja mão inicial está toda na mão escolhida */
export function linesForHand(combos: CombosCalculados | undefined, hand: number[]): LinhaCombo[] {
  if (!combos || !hand.length) return [];
  const have = new Set(hand);
  return combos.linhas.filter((l) => l.mao.every((c) => have.has(c)));
}

export const METODO_LABEL: Record<Metodo, string> = {
  xyz: "Invocação-Xyz",
  link: "Invocação-Link",
  sincro: "Invocação-Sincro",
  fusao: "Invocação-Fusão",
  ritual: "Invocação-Ritual",
};

const ORIGEM: Partial<Record<Zona, string>> = {
  deck: "do Deck",
  mao: "da mão",
  cemiterio: "do Cemitério",
  banido: "dos banidos",
  extra: "do Extra Deck",
  magia: "da Zona de Magias e Armadilhas",
  "campo-magia": "da Zona de Campo",
  pendulo: "da Zona de Pêndulo",
};

/**
 * Frase de um movimento de carta: [antes do nome, depois do nome].
 * Ex.: deck → mão = ["adiciona", "do Deck à mão"].
 */
export function moveText(de: Zona, para: Zona): [string, string] {
  if (de === "material" && para === "cemiterio") return ["desanexa", "(material Xyz)"];
  if (para === "mao") return de === "deck" ? ["adiciona", "do Deck à mão"] : ["volta", `${ORIGEM[de] ?? "do campo"} para a mão`];
  if (para === "cemiterio") {
    if (de === "mao") return ["descarta", ""];
    if (de === "deck") return ["envia", "do Deck ao Cemitério"];
    return ["envia", "ao Cemitério"];
  }
  if (para === "banido") return ["bane", ORIGEM[de] ?? ""];
  if (para === "magia") return de === "deck" ? ["coloca", "do Deck na Zona de Magias e Armadilhas"] : ["coloca", "na Zona de Magias e Armadilhas"];
  if (para === "campo-magia") return ["coloca", `${ORIGEM[de] ?? ""} na Zona de Campo`];
  if (para === "deck") return ["devolve", "ao Deck"];
  if (para === "extra") return ["devolve", "ao Extra Deck"];
  if (para === "material") return ["anexa", "como material Xyz"];
  if (para === "campo") return ["coloca", `${ORIGEM[de] ?? ""} no campo`];
  return ["move", ""];
}

export const origemText = (z: Zona) => ORIGEM[z] ?? "";

/** Passo em texto corrido (para enviar combos existentes à IA do Combo Search) */
export function passoEmTexto(p: Passo, nome: (id: number) => string): string {
  const lista = (ids: number[]) => ids.map(nome).join(" + ");
  switch (p.t) {
    case "normal":
      return `Invocação-Normal de ${nome(p.c)}`;
    case "baixa":
      return `Baixa ${nome(p.c)}`;
    case "ativa":
      return `Ativa ${nome(p.c)}${p.de === "mao" || p.de === "cemiterio" || p.de === "banido" ? ` ${origemText(p.de)}` : ""}`;
    case "invoca":
      return p.m
        ? `${METODO_LABEL[p.m]} de ${nome(p.c)}${p.mat?.length ? ` usando ${lista(p.mat)}` : ""}`
        : `Invocação-Especial de ${nome(p.c)} ${origemText(p.de)}`.trim();
    case "move": {
      const [verb, rest] = moveText(p.de, p.para);
      return `${verb} ${nome(p.c)} ${rest}`.trim();
    }
    case "compra":
      return `Compra ${p.c.map(nome).join(", ")}`;
    case "texto":
      return p.texto;
  }
}

/**
 * Respostas de uma linha: as que valem em quase toda a linha (ativáveis a qualquer momento, como
 * Maxx "C") ficam separadas das que um passo específico abre (como Ash Blossom numa busca).
 */
export function respostasDaLinha(l: { passos: Passo[] }): { sempre: Set<number>; porPasso: (p: Passo) => number[] } {
  const comResp = l.passos.filter((p) => p.resp?.length);
  const conta = new Map<number, number>();
  for (const p of comResp) for (const r of p.resp!) conta.set(r, (conta.get(r) ?? 0) + 1);
  const sempre = new Set(comResp.length >= 4 ? [...conta].filter(([, n]) => n >= comResp.length * 0.75).map(([r]) => r) : []);
  return { sempre, porPasso: (p) => (p.resp ?? []).filter((r) => !sempre.has(r)) };
}
