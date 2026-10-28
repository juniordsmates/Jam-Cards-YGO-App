import { useSyncExternalStore } from "react";
import { contaAtual } from "./conta";
import { legalIn, type GameFormat } from "./legality";
import { supabase } from "./supabase";
import { categoryOf, type Card } from "./types";
import type { Passo } from "./motor";

// Decks do Editor de Deck: guardados neste dispositivo e, com conta, também na conta (tabela decks).
// Regras: Main 40–60, Extra até 15, Side até 15, até 3 cópias por carta (somando as três partes),
// e o limite da banlist do formato escolhido (proibida 0, limitada 1, semi-limitada 2).

export type Parte = "main" | "extra" | "side";

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

function ler(): Estado {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? "") as Estado;
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

export function criarDeck(nome: string, base?: Pick<Deck, "main" | "extra" | "side">, temporario = false): Deck {
  const deck: Deck = {
    id: novoId(),
    nome: nome.trim() || "Deck sem nome",
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

/** Copia o deck para a conta (se houver login); guarda o id da conta no deck local */
async function sincronizar(deck: Deck) {
  const sb = supabase();
  if (!sb || !contaAtual()) return;
  const dados = { nome: deck.nome.slice(0, 80), main: deck.main.slice(0, 60), extra: deck.extra.slice(0, 15), side: deck.side.slice(0, 15) };
  if (deck.contaId) {
    await sb.from("decks").update(dados).eq("id", deck.contaId);
    return;
  }
  const { data } = await sb.from("decks").insert(dados).select("id").single();
  if (data?.id) gravar({ ...estado, decks: estado.decks.map((d) => (d.id === deck.id ? { ...d, contaId: data.id } : d)) });
}

/** Traz para este dispositivo os decks da conta que ainda não estão aqui */
export async function trazerDecksDaConta(): Promise<number> {
  const sb = supabase();
  if (!sb || !contaAtual()) return 0;
  const { data } = await sb.from("decks").select("id, nome, main, extra, side, atualizado_em").order("atualizado_em", { ascending: false });
  const locais = new Set(estado.decks.map((d) => d.contaId).filter(Boolean));
  const novos: Deck[] = (data ?? [])
    .filter((d) => !locais.has(d.id))
    .map((d) => ({ id: novoId(), nome: d.nome, main: d.main, extra: d.extra, side: d.side, contaId: d.id, atualizadoEm: d.atualizado_em }));
  if (novos.length) gravar({ ...estado, decks: [...estado.decks, ...novos], padrao: estado.padrao ?? novos[0].id });
  return novos.length;
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

export const copias = (deck: Pick<Deck, Parte>, id: number) => [...deck.main, ...deck.extra, ...deck.side].filter((x) => x === id).length;

/** Por que a carta não pode entrar nesta parte agora (ou null se pode) */
export function motivoBloqueio(deck: Deck, c: Card, parte: Parte, formato: GameFormat): string | null {
  if (c.frame === "skill" || c.frame === "token") return "Cartas de Habilidade e Fichas não entram em decks.";
  if (parte === "main" && ehExtra(c)) return "Monstros de Fusão, Sincro, Xyz e Link vão para o Extra Deck.";
  if (parte === "extra" && !ehExtra(c)) return "Só monstros de Fusão, Sincro, Xyz e Link vão para o Extra Deck.";
  if (deck[parte].length >= LIMITES[parte][1]) return `O ${parte === "main" ? "Main Deck" : parte === "extra" ? "Extra Deck" : "Side Deck"} já tem o máximo de ${LIMITES[parte][1]} cartas.`;
  const max = copiasPermitidas(c, formato);
  if (copias(deck, c.id) >= max) return max === 0 ? `Carta proibida ou não lançada no ${formato}.` : `Limite de ${max} ${max === 1 ? "cópia" : "cópias"} no ${formato}.`;
  return null;
}

/** Avisos do deck inteiro (tamanho e cartas acima do limite da banlist) */
export function avisos(deck: Deck, byId: Map<number, Card>, formato: GameFormat): string[] {
  const out: string[] = [];
  if (deck.main.length < LIMITES.main[0] && !deck.temporario) out.push(`Main Deck com ${deck.main.length} cartas (mínimo 40).`);
  const vistos = new Set<number>();
  for (const id of [...deck.main, ...deck.extra, ...deck.side]) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    const c = byId.get(id);
    if (!c) continue;
    const max = copiasPermitidas(c, formato);
    if (copias(deck, id) > max) out.push(`${c.namePt ?? c.name}: ${copias(deck, id)} cópias (máximo ${max} no ${formato}).`);
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

// ---------------------------------------------------------------- arquivo .ydk (Duelingbook, EDOPro, YGOPRODeck)

export function paraYdk(deck: Deck): string {
  return ["#created by Cartas", "#main", ...deck.main, "#extra", ...deck.extra, "!side", ...deck.side, ""].join("\n");
}

/** Lê um .ydk; ids de artes alternativas viram o id da carta; desconhecidos são contados */
export function deYdk(texto: string, idCanonico: (id: number) => number | undefined): { deck: Pick<Deck, Parte>; ignorados: number } {
  const deck: Pick<Deck, Parte> = { main: [], extra: [], side: [] };
  let parte: Parte = "main";
  let ignorados = 0;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (linha === "#main") parte = "main";
    else if (linha === "#extra") parte = "extra";
    else if (linha === "!side") parte = "side";
    else if (/^\d+$/.test(linha)) {
      const id = idCanonico(Number(linha));
      if (id) deck[parte].push(id);
      else ignorados++;
    }
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
 * Nome: arquétipo da carta principal + "Temporário". Se já existir, é atualizado (não duplica).
 */
export function deckDoCombo(
  linha: { mao: number[]; passos: Passo[]; campo: { monstros: number[]; magias: [number, boolean][] } },
  byId: Map<number, Card>,
  formato: GameFormat,
): Deck {
  const principal = byId.get(linha.mao[0]);
  const nome = `${principal?.archetype ?? (principal ? (principal.namePt ?? principal.name) : "Combo")} Temporário`;
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
  const existente = estado.decks.find((d) => d.temporario && d.nome === nome);
  if (existente) return salvarDeck({ ...existente, ...deck });
  return criarDeck(nome, deck, true);
}
