import { METODO_LABEL, moveText, origemText, passoEmTexto, uniqueLines, type CombosCalculados, type LinhaCombo, type Metodo, type Passo, type Zona } from "./motor";
import { resposta, type ContextoRespostas, type Resposta } from "./respostas";
import type { Idioma } from "../data/guias";

// Guia de Deck: o que é calculado a partir dos dados (linhas do motor de combos, respostas e uso em
// torneios) para cada arquétipo, e o texto dos passos em português, inglês e espanhol.

// ---------------------------------------------------------------- passos em inglês e espanhol

const METODO: Record<"en" | "es", Record<Metodo, string>> = {
  en: { xyz: "Xyz Summon", link: "Link Summon", sincro: "Synchro Summon", fusao: "Fusion Summon", ritual: "Ritual Summon" },
  es: { xyz: "Invocación por Xyz de", link: "Invocación por Enlace de", sincro: "Invocación por Sincronía de", fusao: "Invocación por Fusión de", ritual: "Invocación por Ritual de" },
};

const ORIGEM: Record<"en" | "es", Partial<Record<Zona, string>>> = {
  en: {
    deck: "from the Deck",
    mao: "from the hand",
    cemiterio: "from the GY",
    banido: "from banishment",
    extra: "from the Extra Deck",
    magia: "from the Spell & Trap Zone",
    "campo-magia": "from the Field Zone",
    pendulo: "from the Pendulum Zone",
  },
  es: {
    deck: "del Deck",
    mao: "de la mano",
    cemiterio: "del Cementerio",
    banido: "de los desterrados",
    extra: "del Deck Extra",
    magia: "de la Zona de Mágicas y Trampas",
    "campo-magia": "de la Zona de Campo",
    pendulo: "de la Zona de Péndulo",
  },
};

/** Movimento de carta em inglês/espanhol: [antes do nome, depois do nome] (como moveText em motor.ts) */
function movimento(de: Zona, para: Zona, idioma: "en" | "es"): [string, string] {
  const o = ORIGEM[idioma];
  const en = idioma === "en";
  if (de === "material" && para === "cemiterio") return en ? ["Detach", "(Xyz Material)"] : ["Desacopla", "(Material Xyz)"];
  if (para === "mao")
    return de === "deck" ? (en ? ["Add", "from the Deck to the hand"] : ["Añade", "del Deck a la mano"]) : en ? ["Return", `${o[de] ?? "from the field"} to the hand`] : ["Devuelve", `${o[de] ?? "del campo"} a la mano`];
  if (para === "cemiterio") {
    if (de === "mao") return en ? ["Discard", ""] : ["Descarta", ""];
    if (de === "deck") return en ? ["Send", "from the Deck to the GY"] : ["Envía", "del Deck al Cementerio"];
    return en ? ["Send", "to the GY"] : ["Envía", "al Cementerio"];
  }
  if (para === "banido") return en ? ["Banish", o[de] ?? ""] : ["Destierra", o[de] ?? ""];
  if (para === "magia")
    return de === "deck" ? (en ? ["Place", "from the Deck in the Spell & Trap Zone"] : ["Coloca", "del Deck en la Zona de Mágicas y Trampas"]) : en ? ["Place", "in the Spell & Trap Zone"] : ["Coloca", "en la Zona de Mágicas y Trampas"];
  if (para === "campo-magia") return en ? ["Place", `${o[de] ?? ""} in the Field Zone`] : ["Coloca", `${o[de] ?? ""} en la Zona de Campo`];
  if (para === "deck") return en ? ["Return", "to the Deck"] : ["Devuelve", "al Deck"];
  if (para === "extra") return en ? ["Return", "to the Extra Deck"] : ["Devuelve", "al Deck Extra"];
  if (para === "material") return en ? ["Attach", "as Xyz Material"] : ["Acopla", "como Material Xyz"];
  if (para === "campo") return en ? ["Place", `${o[de] ?? ""} on the field`] : ["Coloca", `${o[de] ?? ""} en el campo`];
  return en ? ["Move", ""] : ["Mueve", ""];
}

/** Passo do combo no idioma escolhido (em português, o mesmo texto da tela de Combos) */
export function passoNoIdioma(p: Passo, nome: (id: number) => string, idioma: Idioma): string {
  if (idioma === "pt") {
    const t = passoEmTexto(p, nome);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const en = idioma === "en";
  const lista = (ids: number[]) => ids.map(nome).join(" + ");
  const de = (z: Zona) => ORIGEM[idioma][z] ?? "";
  switch (p.t) {
    case "normal":
      return en ? `Normal Summon ${nome(p.c)}` : `Invocación Normal de ${nome(p.c)}`;
    case "baixa":
      return en ? `Set ${nome(p.c)}` : `Coloca ${nome(p.c)}`;
    case "ativa":
      return `${en ? "Activate" : "Activa"} ${nome(p.c)}${p.de === "mao" || p.de === "cemiterio" || p.de === "banido" ? ` ${de(p.de)}` : ""}`;
    case "invoca":
      if (p.m) return `${METODO[idioma][p.m]} ${nome(p.c)}${p.mat?.length ? ` ${en ? "using" : "usando"} ${lista(p.mat)}` : ""}`;
      return `${en ? "Special Summon" : "Invocación Especial de"} ${nome(p.c)} ${de(p.de)}`.trim();
    case "move": {
      const [antes, depois] = movimento(p.de, p.para, idioma);
      return `${antes} ${nome(p.c)} ${depois}`.trim();
    }
    case "compra":
      return `${en ? "Draw" : "Roba"} ${p.c.map(nome).join(", ")}`;
    case "texto":
      return p.texto;
  }
}

/** Rótulo do método (para títulos), no idioma */
export const metodoNoIdioma = (m: Metodo, idioma: Idioma) => (idioma === "pt" ? METODO_LABEL[m] : METODO[idioma][m]);
export { origemText, moveText };

// ---------------------------------------------------------------- linhas do arquétipo

/** Linhas calculadas pelo motor para os decklists do arquétipo (sem repetidas, das mais fortes) */
export function linhasDoArquetipo(combos: CombosCalculados | undefined, arquetipo: string): LinhaCombo[] {
  if (!combos) return [];
  const alvo = arquetipo.toLowerCase();
  const decks = new Set(combos.decks.flatMap((d, i) => (d.busca.toLowerCase() === alvo ? [i] : [])));
  return uniqueLines(combos.linhas.filter((l) => decks.has(l.deck))).sort((a, b) => b.pontos - a.pontos);
}

/** Cartas que começam combos sozinhas (mão de 1 carta), com quantas linhas cada uma abre */
export function startersCalculados(linhas: LinhaCombo[]): { id: number; linhas: number }[] {
  const conta = new Map<number, number>();
  for (const l of linhas) if (l.mao.length === 1) conta.set(l.mao[0], (conta.get(l.mao[0]) ?? 0) + 1);
  return [...conta].map(([id, n]) => ({ id, linhas: n })).sort((a, b) => b.linhas - a.linhas);
}

// ---------------------------------------------------------------- interações

/** Uma carta do oponente que pode parar o deck */
export interface InteracaoResposta extends Resposta {
  /** linhas em que ela pode responder em algum passo */
  linhas: number;
  /** fração das linhas (0 a 1) */
  pctLinhas: number;
  /** em média, o primeiro passo (1, 2, …) em que ela já pode responder */
  primeiroPasso: number;
  /** os passos em que ela responde com mais frequência */
  passos: { passo: Passo; vezes: number }[];
}

/** Uma ativação do deck que muitas respostas podem parar (ponto crítico do combo) */
export interface PontoCritico {
  passo: Passo;
  /** respostas diferentes que podem parar este passo */
  respostas: Resposta[];
  /** linhas em que este passo aparece com respostas */
  linhas: number;
}

const chavePasso = (p: Passo) => JSON.stringify([p.t, "c" in p ? p.c : 0, "de" in p ? p.de : "", "para" in p ? p.para : "", "m" in p ? p.m : ""]);

/**
 * Interações do deck a partir das linhas do motor: cada passo traz as cartas que o oponente pode
 * ativar logo depois dele (resp). Junta tudo por carta (o que mais para o deck e onde) e por passo
 * (os pontos do combo que mais respostas podem parar).
 */
export function calcularInteracoes(linhas: LinhaCombo[], ctx: ContextoRespostas): { respostas: InteracaoResposta[]; pontos: PontoCritico[] } {
  const porCarta = new Map<number, { linhas: Set<number>; primeiro: number[]; passos: Map<string, { passo: Passo; vezes: number }> }>();
  const porPasso = new Map<string, { passo: Passo; respostas: Set<number>; linhas: Set<number> }>();
  linhas.forEach((l, i) => {
    const vistoNaLinha = new Set<number>();
    l.passos.forEach((p, j) => {
      for (const r of p.resp ?? []) {
        const x = porCarta.get(r) ?? { linhas: new Set<number>(), primeiro: [] as number[], passos: new Map<string, { passo: Passo; vezes: number }>() };
        x.linhas.add(i);
        if (!vistoNaLinha.has(r)) {
          vistoNaLinha.add(r);
          x.primeiro.push(j + 1);
        }
        const k = chavePasso(p);
        const ps = x.passos.get(k) ?? { passo: p, vezes: 0 };
        ps.vezes++;
        x.passos.set(k, ps);
        porCarta.set(r, x);
      }
      if (p.resp?.length) {
        const k = chavePasso(p);
        const y = porPasso.get(k) ?? { passo: p, respostas: new Set<number>(), linhas: new Set<number>() };
        p.resp.forEach((r) => y.respostas.add(r));
        y.linhas.add(i);
        porPasso.set(k, y);
      }
    });
  });
  const respostas = [...porCarta]
    .map(([id, x]) => ({
      ...resposta(id, ctx),
      linhas: x.linhas.size,
      pctLinhas: linhas.length ? x.linhas.size / linhas.length : 0,
      primeiroPasso: x.primeiro.reduce((s, n) => s + n, 0) / x.primeiro.length,
      passos: [...x.passos.values()].sort((a, b) => b.vezes - a.vezes).slice(0, 3),
    }))
    // as que param mais linhas, e entre elas as mais jogadas em torneios
    .sort((a, b) => b.linhas - a.linhas || b.uso - a.uso);
  const pontos = [...porPasso.values()]
    .map((y) => ({ passo: y.passo, linhas: y.linhas.size, respostas: [...y.respostas].map((r) => resposta(r, ctx)).sort((a, b) => b.uso - a.uso) }))
    .sort((a, b) => b.linhas * b.respostas.length - a.linhas * a.respostas.length)
    .slice(0, 10);
  return { respostas, pontos };
}
