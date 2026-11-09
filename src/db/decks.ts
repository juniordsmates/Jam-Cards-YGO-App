import { useSyncExternalStore } from "react";
import { contaAtual } from "./conta";
import { legalIn, type GameFormat } from "./legality";
import { supabase } from "./supabase";
import { categoryOf, type Card } from "./types";
import type { Passo } from "./motor";
import { t, LOCALE } from "../i18n";

// Decks do Editor de Deck: guardados neste dispositivo e, com conta, também na conta (tabela decks).
// Regras: Main 40–60, Extra até 15, Side até 15, até 3 cópias por carta (somando as três partes),
// e o limite da banlist do formato escolhido (proibida 0, limitada 1, semi-limitada 2).
// Um deck por nome: salvar com um nome que já existe salva por cima dele (aqui e na conta).

export type Parte = "main" | "extra" | "side";

/** Deck montado para testar um combo, ainda fora de Meus decks */
export type DeckTemporario = Pick<Deck, "nome" | "main" | "extra" | "side">;

export interface Deck {
  id: string;
  nome: string;
  main: number[];
  extra: number[];
  side: number[];
  /** id do mesmo deck na conta (Supabase), quando sincronizado */
  contaId?: string;
  /** deck criado pela tela de Combos para testar uma linha: sem mínimo de cartas */
  temporario?: boolean;
  atualizadoEm: string;
}

interface Estado {
  decks: Deck[];
  padrao?: string;
}

const STORAGE = "cartas-decks";
const LIMITES = { main: [40, 60], extra: [0, 15], side: [0, 15] } as const;

/** Mesmo nome de deck: sem diferenciar maiúsculas, acentos de caixa ou espaços nas pontas */
const chaveNome = (nome: string) => nome.trim().toLocaleLowerCase(LOCALE);

/** Deixa um deck por nome (o salvo por último); decks repetidos vinham de salvamentos em dobro */
function semRepetidos(e: Estado): Estado {
  const porNome = new Map<string, Deck>();
  for (const d of e.decks) {
    const atual = porNome.get(chaveNome(d.nome));
    if (!atual || d.atualizadoEm > atual.atualizadoEm) porNome.set(chaveNome(d.nome), { ...d, contaId: d.contaId ?? atual?.contaId });
  }
  const decks = e.decks.filter((d) => porNome.get(chaveNome(d.nome))?.id === d.id).map((d) => porNome.get(chaveNome(d.nome))!);
  if (decks.length === e.decks.length) return e;
  const padrao = e.decks.find((d) => d.id === e.padrao);
  return { decks, padrao: padrao ? porNome.get(chaveNome(padrao.nome))?.id : decks[0]?.id };
}

function ler(): Estado {
  try {
    return semRepetidos(JSON.parse(localStorage.getItem(STORAGE) ?? "") as Estado);
  } catch {
    return { decks: [] };
  }
}

let estado: Estado = ler();
const listeners = new Set<() => void>();
function gravar(novo: Estado) {
  estado = novo;
  try {
    localStorage.setItem(STORAGE, JSON.stringify(novo));
  } catch {
    // armazenamento indisponível: os decks valem só nesta sessão
  }
  listeners.forEach((l) => l());
}

export const useDecks = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => estado,
  );

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Deck deste computador com o mesmo nome (sem diferenciar maiúsculas), fora o de id `exceto` */
export const deckComNome = (nome: string, exceto?: string) =>
  estado.decks.find((d) => d.id !== exceto && chaveNome(d.nome) === chaveNome(nome));

/**
 * Cria um deck. Se já existe um com o mesmo nome, não duplica: com conteúdo (`base`), salva por
 * cima do existente; sem conteúdo (botão Novo), só devolve o existente.
 */
export function criarDeck(nome: string, base?: Pick<Deck, "main" | "extra" | "side">, temporario = false): Deck {
  const existente = deckComNome(nome.trim() || t("Deck sem nome"));
  if (existente) return base ? salvarDeck({ ...existente, ...base }) : existente;
  const deck: Deck = {
    id: novoId(),
    nome: nome.trim() || t("Deck sem nome"),
    main: [],
    extra: [],
    side: [],
    ...base,
    ...(temporario ? { temporario: true } : {}),
    atualizadoEm: new Date().toISOString(),
  };
  gravar({ ...estado, decks: [...estado.decks, deck], padrao: estado.padrao ?? deck.id });
  return deck;
}

export function salvarDeck(deck: Deck) {
  const atual = { ...deck, atualizadoEm: new Date().toISOString() };
  gravar({ ...estado, decks: estado.decks.map((d) => (d.id === deck.id ? atual : d)) });
  void sincronizar(atual);
  return atual;
}

export function excluirDeck(id: string) {
  const deck = estado.decks.find((d) => d.id === id);
  const decks = estado.decks.filter((d) => d.id !== id);
  gravar({ decks, padrao: estado.padrao === id ? decks[0]?.id : estado.padrao });
  if (deck?.contaId) void supabase()?.from("decks").delete().eq("id", deck.contaId);
}

export const definirPadrao = (id: string) => gravar({ ...estado, padrao: id });

// ---------------------------------------------------------------- conta

// uma sincronização por vez: dois "Salvar" seguidos não podem criar o deck duas vezes na conta
let fila: Promise<unknown> = Promise.resolve();
const emFila = <T>(f: () => Promise<T>): Promise<T> => {
  const p = fila.then(f, f);
  fila = p.catch(() => undefined);
  return p;
};

const vincular = (id: string, contaId: string) =>
  gravar({ ...estado, decks: estado.decks.map((d) => (d.id === id ? { ...d, contaId } : d)) });

/** Copia o deck para a conta (se houver login); guarda o id da conta no deck local */
function sincronizar(deck: Deck) {
  return emFila(async () => {
    const sb = supabase();
    if (!sb || !contaAtual()) return;
    // lê de novo: o deck pode ter ganhado o id da conta numa sincronização anterior da fila
    const atual = estado.decks.find((d) => d.id === deck.id);
    if (!atual) return;
    const dados = { nome: atual.nome.slice(0, 80), main: atual.main.slice(0, 60), extra: atual.extra.slice(0, 15), side: atual.side.slice(0, 15) };
    let contaId = atual.contaId;
    if (!contaId) {
      // já existe na conta um deck com esse nome (de outro computador): salva por cima dele
      const { data } = await sb.from("decks").select("id, nome");
      contaId = (data ?? []).find((d) => chaveNome(d.nome) === chaveNome(atual.nome))?.id;
    }
    if (contaId) {
      await sb.from("decks").update(dados).eq("id", contaId);
      if (!atual.contaId) vincular(atual.id, contaId);
      return;
    }
    const { data } = await sb.from("decks").insert(dados).select("id").single();
    if (data?.id) vincular(atual.id, data.id);
  });
}

/**
 * Traz para este dispositivo os decks da conta que ainda não estão aqui. Deck com o mesmo nome
 * de um daqui é o mesmo deck: fica um só, com o conteúdo salvo por último, e as cópias
 * repetidas na conta são apagadas.
 */
export function trazerDecksDaConta(): Promise<number> {
  return emFila(async () => {
    const sb = supabase();
    if (!sb || !contaAtual()) return 0;
    const { data } = await sb.from("decks").select("id, nome, main, extra, side, atualizado_em").order("atualizado_em", { ascending: false });
    let decks = [...estado.decks];
    const repetidos: string[] = [];
    let novos = 0;
    for (const r of data ?? []) {
      const local = decks.find((d) => d.contaId === r.id) ?? decks.find((d) => chaveNome(d.nome) === chaveNome(r.nome));
      if (!local) {
        decks.push({ id: novoId(), nome: r.nome, main: r.main, extra: r.extra, side: r.side, contaId: r.id, atualizadoEm: r.atualizado_em });
        novos++;
      } else if (local.contaId && local.contaId !== r.id) repetidos.push(r.id);
      else if (!local.contaId) {
        const maisNovo = r.atualizado_em > local.atualizadoEm;
        decks = decks.map((d) => (d.id !== local.id ? d : maisNovo ? { ...d, main: r.main, extra: r.extra, side: r.side, contaId: r.id, atualizadoEm: r.atualizado_em } : { ...d, contaId: r.id }));
      }
    }
    if (decks.length !== estado.decks.length || decks.some((d, i) => d !== estado.decks[i])) gravar({ ...estado, decks, padrao: estado.padrao ?? decks[0]?.id });
    if (repetidos.length) await sb.from("decks").delete().in("id", repetidos);
    return novos;
  });
}

// ---------------------------------------------------------------- regras

/** Monstros de Fusão, Sincro, Xyz e Link vão para o Extra Deck */
export const ehExtra = (c: Card) => /^(fusion|synchro|xyz|link)/.test(c.frame);

/** Cópias permitidas pela banlist do formato */
export function copiasPermitidas(c: Card, formato: GameFormat): number {
  if (!legalIn(c, formato)) return 0;
  const ban = formato === "TCG" ? c.ban?.tcg : c.ban?.ocg;
  return ban === "Limited" ? 1 : ban === "Semi-Limited" ? 2 : 3;
}

/** Máximo de cópias por carta: a banlist do formato ou, com o limite desativado, só a regra do jogo (3) */
const maximoDe = (c: Card, formato: GameFormat, semLimite: boolean) => (semLimite ? 3 : copiasPermitidas(c, formato));

export const copias = (deck: Pick<Deck, Parte>, id: number) => [...deck.main, ...deck.extra, ...deck.side].filter((x) => x === id).length;

/**
 * Por que a carta não pode entrar nesta parte agora (ou null se pode). `semLimite`: "Desativar
 * limite de cartas" no editor (sem banlist e sem conferir se a carta saiu no formato).
 */
export function motivoBloqueio(deck: Deck, c: Card, parte: Parte, formato: GameFormat, semLimite = false): string | null {
  if (c.frame === "skill" || c.frame === "token") return t("Cartas de Habilidade e Fichas não entram em decks.");
  if (parte === "main" && ehExtra(c)) return t("Monstros de Fusão, Sincro, Xyz e Link vão para o Extra Deck.");
  if (parte === "extra" && !ehExtra(c)) return t("Só monstros de Fusão, Sincro, Xyz e Link vão para o Extra Deck.");
  if (deck[parte].length >= LIMITES[parte][1]) return t("O {0} já tem o máximo de {1} cartas.", [parte === "main" ? t("Main Deck") : parte === "extra" ? t("Extra Deck") : t("Side Deck"), LIMITES[parte][1]]);
  const max = maximoDe(c, formato, semLimite);
  if (copias(deck, c.id) >= max)
    return semLimite ? t("Máximo de 3 cópias por carta.") : max === 0 ? t("Carta proibida ou não lançada no {0}.", [formato]) : t("Limite de {0} {1} no {2}.", [max, max === 1 ? t("cópia") : t("cópias"), formato]);
  return null;
}

/** Avisos do deck inteiro (tamanho e cartas acima do limite da banlist) */
export function avisos(deck: Deck, byId: Map<number, Card>, formato: GameFormat, semLimite = false): string[] {
  const out: string[] = [];
  if (deck.main.length < LIMITES.main[0] && !deck.temporario) out.push(t("Main Deck com {0} cartas (mínimo 40).", [deck.main.length]));
  const vistos = new Set<number>();
  for (const id of [...deck.main, ...deck.extra, ...deck.side]) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    const c = byId.get(id);
    if (!c) continue;
    const max = maximoDe(c, formato, semLimite);
    if (copias(deck, id) > max) out.push(t("{0}: {1} cópias (máximo {2}{3}).", [c.namePt ?? c.name, copias(deck, id), max, semLimite ? t(" por carta") : t(" no {0}", [formato])]));
  }
  return out;
}

/** Contagem do Main Deck por categoria (monstros, magias, armadilhas) */
export function contagem(ids: number[], byId: Map<number, Card>) {
  const n = { monster: 0, spell: 0, trap: 0 };
  for (const id of ids) {
    const c = byId.get(id);
    const cat = c ? categoryOf(c) : "other";
    if (cat !== "other") n[cat]++;
  }
  return n;
}

// ---------------------------------------------------------------- importar deck list (.ydk e ydke://)

/** Lê os ids de um link ydke:// (EDOPro, Duelingbook): main!extra!side em base64, 4 bytes por id */
function idsDeYdke(parte: string): number[] {
  const bin = atob(parte);
  const ids: number[] = [];
  for (let i = 0; i + 3 < bin.length; i += 4)
    ids.push((bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8) | (bin.charCodeAt(i + 2) << 16) | (bin.charCodeAt(i + 3) << 24)) >>> 0);
  return ids;
}

/**
 * Lê uma deck list: arquivo .ydk (#main, #extra, !side) ou link ydke://. Ids de artes alternativas
 * viram o id da carta; ids desconhecidos são contados. O Side vem separado (o editor não usa).
 */
export function lerDeckList(texto: string, idCanonico: (id: number) => number | undefined): { deck: Pick<Deck, Parte>; ignorados: number } {
  const deck: Pick<Deck, Parte> = { main: [], extra: [], side: [] };
  let ignorados = 0;
  const incluir = (parte: Parte, bruto: number) => {
    const id = idCanonico(bruto);
    if (id) deck[parte].push(id);
    else ignorados++;
  };
  const ydke = texto.trim().match(/^ydke:\/\/([^!]*)!([^!]*)!([^!]*)!?/);
  if (ydke) {
    try {
      (["main", "extra", "side"] as Parte[]).forEach((parte, i) => idsDeYdke(ydke[i + 1]).forEach((id) => incluir(parte, id)));
    } catch {
      // link quebrado: nenhuma carta reconhecida
    }
    return { deck, ignorados };
  }
  let parte: Parte = "main";
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (linha === "#main") parte = "main";
    else if (linha === "#extra") parte = "extra";
    else if (linha === "!side") parte = "side";
    else if (/^\d+$/.test(linha)) incluir(parte, Number(linha));
  }
  return { deck, ignorados };
}

/** Ordem do deck como no Duelingbook: monstros, magias, armadilhas; dentro, por nome */
export function ordenarParte(ids: number[], byId: Map<number, Card>): number[] {
  const ordem = { monster: 0, spell: 1, trap: 2, other: 3 };
  return [...ids].sort((a, b) => {
    const ca = byId.get(a);
    const cb = byId.get(b);
    if (!ca || !cb) return 0;
    return ordem[categoryOf(ca)] - ordem[categoryOf(cb)] || ca.name.localeCompare(cb.name) || a - b;
  });
}

// ---------------------------------------------------------------- deck temporário de um combo

/**
 * Deck para testar uma linha de combo: a mão inicial e as cartas que a linha usa (no Main o que
 * sai da mão/Deck, no Extra o que é invocado do Extra Deck), com o limite de cópias da banlist.
 * Nome: arquétipo da carta principal + "Temporário". Não é salvo: o Teste de Jogo usa o deck em
 * memória, e ele só vai para Meus decks se o usuário pedir (botão Importar Deck).
 */
export function deckDoCombo(
  linha: { mao: number[]; passos: Passo[]; campo: { monstros: number[]; magias: [number, boolean][] } },
  byId: Map<number, Card>,
  formato: GameFormat,
): DeckTemporario {
  const principal = byId.get(linha.mao[0]);
  const nome = t("{0} Temporário", [principal?.archetype ?? (principal ? (principal.namePt ?? principal.name) : t("Combo"))]);
  const ids: number[] = [...linha.mao];
  for (const p of linha.passos) {
    if (p.t === "compra" || p.t === "texto") ids.push(...p.c);
    else {
      ids.push(p.c);
      if ("mat" in p && p.mat) ids.push(...p.mat);
    }
  }
  ids.push(...linha.campo.monstros, ...linha.campo.magias.map(([c]) => c));
  const deck: Pick<Deck, Parte> = { main: [], extra: [], side: [] };
  const vistos = new Map<number, number>();
  for (const id of ids) {
    const c = byId.get(id);
    if (!c || c.frame === "token" || c.frame === "skill") continue;
    // cada carta entra uma vez por aparição distinta na mão; nas demais, uma cópia basta
    const ja = vistos.get(id) ?? 0;
    const naMao = linha.mao.filter((x) => x === id).length;
    if (ja >= Math.max(1, naMao) || ja >= copiasPermitidas(c, formato)) continue;
    const parte: Parte = ehExtra(c) ? "extra" : "main";
    if (deck[parte].length >= LIMITES[parte][1]) continue;
    deck[parte].push(id);
    vistos.set(id, ja + 1);
  }
  return { nome, ...deck };
}
