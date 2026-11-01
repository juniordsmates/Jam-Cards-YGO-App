import { isActivated, readCard, type ParsedEffect } from "./effects";
import type { Metodo, Zona } from "./motor";
import { categoryOf, type Card } from "./types";
import { t as tr } from "../i18n";

// Indicações de resposta (Teste Avançado) e perfil de deck (Meta Call): o que uma ação faz, lido do
// texto oficial da carta (em inglês, pela pontuação PSCT), e quais interrupções podem responder a
// ela. Não é um simulador: as regras de cada interrupção (src/data/interrupcoes.ts) olham só a
// ação, o efeito e a situação dos campos, para indicar o que pode vir — o jogador confere.

/** O que um efeito faz (só a resolução: custos não contam, como nas cartas de resposta) */
export type Acao =
  | "busca" // adiciona do Deck à mão
  | "compra" // compra cartas
  | "invoca" // Invoca por Invocação-Especial (qualquer origem)
  | "invoca-deck"
  | "invoca-extra"
  | "invoca-mao"
  | "invoca-gy" // Invoca do Cemitério
  | "invoca-banido"
  | "envia-deck" // envia do Deck ao Cemitério (inclusive matéria do Deck)
  | "gy-mao" // adiciona/devolve do Cemitério à mão, ao Deck ou ao Extra Deck
  | "gy-bane" // bane do Cemitério
  | "bane" // bane do campo, da mão ou do Deck
  | "destroi"
  | "nega"
  | "devolve"; // devolve do campo para a mão ou o Deck

export const ACOES_LABEL: Record<Acao, string> = {
  busca: "busca do Deck",
  compra: tr("compra cartas"),
  invoca: tr("Invoca por Invocação-Especial"),
  "invoca-deck": tr("Invoca do Deck"),
  "invoca-extra": tr("Invoca do Extra Deck"),
  "invoca-mao": tr("Invoca da mão"),
  "invoca-gy": tr("Invoca do Cemitério"),
  "invoca-banido": tr("Invoca das banidas"),
  "envia-deck": tr("envia do Deck ao Cemitério"),
  "gy-mao": tr("recupera do Cemitério"),
  "gy-bane": tr("bane do Cemitério"),
  bane: tr("bane cartas"),
  destroi: tr("destrói cartas"),
  nega: tr("nega"),
  devolve: tr("devolve cartas do campo"),
};

/** Lugares citados num trecho do texto (o "Extra Deck" não conta como Deck) */
function lugares(t: string) {
  const s = t.replace(/extra deck/g, "extradeck");
  return {
    deck: /\bdeck\b/.test(s),
    extra: s.includes("extradeck"),
    mao: /\bhand\b/.test(s),
    gy: /\bgy\b|graveyard/.test(s),
    banido: /\bbanished\b|banishment/.test(s),
    campo: /\bfield\b|\bcontrols?\b/.test(s),
  };
}

/**
 * Ações de um texto de resolução (em inglês). `alvo`: o trecho de custo/alvo do efeito, para quando a
 * resolução só diz "it"/"that target" (ex.: Monster Reborn: "Target 1 monster in either GY; Special
 * Summon it").
 */
export function acoesDoTexto(texto: string, alvo = ""): Set<Acao> {
  const out = new Set<Acao>();
  const doAlvo = lugares(alvo.toLowerCase());
  // trechos: cada verbo com os lugares da mesma oração
  const trechos = texto
    .toLowerCase()
    .replace(/[“”]/g, '"')
    // nomes entre aspas não são lugares ("Deck Master" etc.)
    .replace(/"[^"]*"/g, '"x"')
    .split(/[.;]|, then |, and if you do|, also |\band if you do\b|\bthen\b/);
  for (const t of trechos) {
    const proprio = lugares(t);
    const pronome = /\b(it|them|that target|those targets|that monster|those monsters|that card)\b/.test(t);
    const semLugar = !proprio.deck && !proprio.extra && !proprio.mao && !proprio.gy && !proprio.banido;
    const l = pronome && semLugar ? doAlvo : proprio;
    if (/\badd(s|ed)?\b/.test(t)) {
      if (l.deck && !/to (the|your) deck/.test(t)) out.add("busca");
      if (l.gy) out.add("gy-mao");
    }
    if (/\bdraws?\b/.test(t)) out.add("compra");
    if (/special summons?\b|(fusion|synchro|xyz|link|ritual) summons?\b/.test(t)) {
      out.add("invoca");
      const procedimento = /(fusion|synchro|xyz|link|ritual) summons?\b/.test(t);
      // Fusão/Ritual por efeito: os lugares citados são das matérias, não do monstro Invocado
      if (procedimento && /material|tribut|using/.test(t)) {
        out.add(/ritual summons?\b/.test(t) ? "invoca-mao" : "invoca-extra");
        // matérias tiradas do Deck vão para o Cemitério
        if (l.deck) out.add("envia-deck");
      } else {
        if (l.deck) out.add("invoca-deck");
        if (l.extra || /(fusion|synchro|xyz|link) summons?\b/.test(t)) out.add("invoca-extra");
        if (l.mao || /ritual summons?\b/.test(t)) out.add("invoca-mao");
        if (l.gy) out.add("invoca-gy");
        if (l.banido) out.add("invoca-banido");
      }
    }
    if (/\bsend(s)?\b/.test(t) && /to the (gy|graveyard)/.test(t) && l.deck) out.add("envia-deck");
    if (/\bbanish/.test(t)) out.add(l.gy && !l.campo && !l.mao ? "gy-bane" : "bane");
    if (/\b(shuffle|return|place)s?\b/.test(t) && l.gy && (l.deck || l.extra)) out.add("gy-mao");
    if (/\b(shuffle|return)s?\b/.test(t) && l.campo && !l.gy && (l.mao || l.deck)) out.add("devolve");
    if (/\bdestroy/.test(t)) out.add("destroi");
    if (/\bnegate/.test(t)) out.add("nega");
  }
  return out;
}

const ZONA_DO_EFEITO: Partial<Record<Zona, ParsedEffect["zone"]>> = {
  mao: "Mão",
  cemiterio: "Cemitério",
  banido: "Banido",
  campo: "Campo",
};

/**
 * Efeitos que a carta pode estar ativando, pelo lugar onde está: na mão, os efeitos "da mão"; no
 * Cemitério, os do Cemitério; no campo, os de campo (Magias/Armadilhas: os efeitos de ativação).
 * Sem efeito para o lugar, todos os efeitos ativados (o jogador escolheu qual).
 */
export function efeitosNaZona(card: Card, zona: Zona): ParsedEffect[] {
  const ativados = readCard(card, false).effects.filter(isActivated);
  const monstro = categoryOf(card) === "monster";
  let doLugar: ParsedEffect[];
  if (!monstro) doLugar = ativados.filter((e) => (zona === "cemiterio" ? e.zone === "Cemitério" : e.zone !== "Cemitério" && e.zone !== "Banido"));
  else if (zona === "magia") doLugar = ativados.filter((e) => e.zone === "Zona de Pêndulo");
  else doLugar = ativados.filter((e) => e.zone === (ZONA_DO_EFEITO[zona] ?? "Campo"));
  return doLugar.length ? doLugar : ativados;
}

// ---------------------------------------------------------------- eventos

export type Lado = "eu" | "op";
export const outroLado = (l: Lado): Lado => (l === "eu" ? "op" : "eu");
export type Fase = "DP" | "SP" | "M1" | "BP" | "M2" | "EP";

/** Uma ação no tabuleiro (os mesmos passos do Criar combo, com quem fez e onde) */
export interface Evento {
  lado: Lado;
  tipo: "ativa" | "normal" | "invoca" | "baixa" | "move" | "compra";
  id: number;
  card?: Card;
  /** onde a carta estava (ativação) ou de onde veio (Invocação/movimento) */
  de: Zona;
  para?: Zona;
  metodo?: Metodo;
  /** ativação de Magia/Armadilha como carta (da mão ou virada agora), não efeito de carta já virada */
  cartaAtivada?: boolean;
}

/** Contagens do campo de um lado (para as condições das cartas) */
export interface LadoCampo {
  cartas: number;
  monstros: number;
  magias: number;
  /** monstros com efeito virados para cima */
  monstrosEfeito: number;
}

export interface Situacao {
  fase: Fase;
  /** de quem é o turno */
  turno: Lado;
  /** Invocações (Normal e Especial) de quem agiu neste turno, já com esta */
  invocacoes: number;
  especiais: number;
  /** quem agiu já ativou efeito de monstro na mão ou no Cemitério neste turno (Dominus Spark) */
  ativouMaoOuGY: boolean;
  agente: LadoCampo;
  respondente: LadoCampo & {
    /** cartas no Cemitério de quem responde (Dimension Shifter) */
    cemiterio?: number;
    /** ids do Main Deck de quem responde (quando conhecido: Crossout Designator) */
    deck?: number[];
    /** monstros Fada na mão (Herald of Orange Light) */
    fadasNaMao?: number;
  };
}

/** O que a ação faz, para as regras */
export interface Analise {
  acoes: Set<Acao>;
  monstro: boolean;
  magia: boolean;
  armadilha: boolean;
  /** Magia/Armadilha que fica no campo (Contínua, de Campo, de Equipamento) */
  permanente: boolean;
  /** efeito ativado por uma carta no campo */
  noCampo: boolean;
  /** Invocação (Normal ou Especial) */
  invocacao: boolean;
  especial: boolean;
  /** Invocação que não usa a corrente (procedimento: Normal, Extra Deck, Pêndulo): pode ser negada */
  procedimento: boolean;
  /** de onde veio a Invocação */
  origem?: Zona;
  /** a carta vai ao Cemitério para ativar (descartar/enviar a si mesma): alvo de Called by the Grave */
  vaiAoCemiterio: boolean;
  /** banir faz parte do custo */
  custoBane: boolean;
  /** textos dos efeitos considerados (em inglês) */
  efeitos: string[];
}

const PERMANENTES = new Set(["Continuous", "Field", "Equip"]);

export function analisar(ev: Evento): Analise {
  const c = ev.card;
  const cat = c ? categoryOf(c) : "monster";
  const monstro = cat === "monster";
  const efeitos = ev.tipo === "ativa" && c ? efeitosNaZona(c, ev.de) : [];
  const acoes = new Set<Acao>();
  for (const e of efeitos) {
    const res = e.resolution ?? e.text;
    for (const x of acoesDoTexto(res, e.costTarget ?? "")) acoes.add(x);
    // "Special Summon this card": vem de onde a carta está (mão, Cemitério ou banidas)
    if (/special summon this card/i.test(res) && !/this card from/i.test(res)) {
      if (ev.de === "mao") acoes.add("invoca-mao");
      if (ev.de === "cemiterio") acoes.add("invoca-gy");
      if (ev.de === "banido") acoes.add("invoca-banido");
    }
  }
  const custo = efeitos.map((e) => `${e.condition ?? ""} ${e.costTarget ?? ""}`.toLowerCase()).join(" ");
  const invocacao = ev.tipo === "normal" || ev.tipo === "invoca";
  const especial = ev.tipo === "invoca";
  return {
    acoes,
    monstro,
    magia: cat === "spell",
    armadilha: cat === "trap",
    permanente: !monstro && !!c && PERMANENTES.has(c.race),
    noCampo: ev.tipo === "ativa" && ["campo", "magia", "campo-magia"].includes(ev.de),
    invocacao,
    especial,
    // Normal, Extra Deck (Xyz/Link/Sincro por procedimento) e Pêndulo; Fusão e Ritual vêm de efeito
    procedimento: ev.tipo === "normal" || (especial && ev.de === "extra" && ev.metodo !== "fusao" && ev.metodo !== "ritual"),
    origem: invocacao ? ev.de : undefined,
    vaiAoCemiterio: ev.tipo === "ativa" && monstro && (ev.de === "cemiterio" || /(discard|send) this card|tribute this card/.test(custo)),
    custoBane: /banish/.test(custo),
    efeitos: efeitos.map((e) => e.text),
  };
}

// ---------------------------------------------------------------- regras das interrupções

/** Como a interrupção entra em jogo */
export type Origem = "mao" | "baixada" | "mao-ou-baixada" | "campo";

/** Uma indicação: por que a carta responde, e o que pode impedir agora */
export interface Indicacao {
  motivo: string;
  /** condição que o jogador precisa conferir */
  condicao?: string;
  /** não pode agora (ex.: só sem monstros no campo), mas vale saber */
  impedida?: string;
}

export interface Regra {
  /** nome oficial em inglês */
  nome: string;
  origem: Origem;
  /** "hand-trap", "armadilha", "magia-rapida" ou "campo" (efeito de monstro no campo) */
  tipo: "hand-trap" | "armadilha" | "magia-rapida" | "campo";
  quando: (ev: Evento, a: Analise, s: Situacao) => Indicacao | null;
}

/** Nome da carta da ação, para os textos */
export const nomeDoEvento = (ev: Evento) => (ev.card ? (ev.card.namePt ?? ev.card.name) : tr("a carta"));
