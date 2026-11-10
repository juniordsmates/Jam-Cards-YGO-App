// Duelos recentes do Simulador (para revisar) e aprendizado, etapa 1: o que cada duelo ensinou (linhas de combo e respostas do
// jogador, com a prova para refazer no motor) fica só neste aparelho, no IndexedDB. O envio para a
// IA aprender (com a autorização do jogador) vem depois.
import { idbGet, idbSetMany } from "../db/idb";
import type { Aprendizado } from "./sessao";

const CHAVE = "simulador-aprendizado-v1";
/** replays guardados: os últimos 5 de graça; até 10 (e exportar/importar) para quem é Premium */
export const REPLAYS_GRATIS = 5;
export const REPLAYS_PREMIUM = 10;

/** Nomes para a lista de replays: jogadores e decks */
export interface RotulosReplay {
  eu: string;
  oponente: string;
  meuDeck: string;
  deckOponente: string;
}

export interface DueloGuardado extends Aprendizado {
  quando: string;
  versaoMotor: string;
  versaoApp: string;
  rotulos?: RotulosReplay;
}

/** Guarda o duelo (replay para revisar depois) com o que ele ensinou; ficam só os `limite` mais recentes */
export async function guardarAprendizado(a: Aprendizado, versaoMotor: string, versaoApp: string, limite = REPLAYS_GRATIS, rotulos?: RotulosReplay) {
  if (!a.historico.length) return;
  const lista = (await idbGet<DueloGuardado[]>(CHAVE)) ?? [];
  lista.push({ ...a, quando: new Date().toISOString(), versaoMotor, versaoApp, ...(rotulos ? { rotulos } : {}) });
  await idbSetMany({ [CHAVE]: lista.slice(-limite) });
}

export const listarAprendizado = async () => (await idbGet<DueloGuardado[]>(CHAVE)) ?? [];

/** Replay em texto (arquivo .json) para guardar fora do app ou mandar a alguém */
export const exportarReplay = (d: DueloGuardado) => JSON.stringify({ formato: "jam-cards-replay", versao: 1, ...d }, (_, v) => (typeof v === "bigint" ? { $big: String(v) } : v));

/** Lê um replay exportado e guarda junto dos outros (confere o formato antes) */
export async function importarReplay(texto: string, limite: number): Promise<DueloGuardado> {
  const d = JSON.parse(texto, (_, v) => (v && typeof v === "object" && "$big" in v ? BigInt(v.$big) : v)) as DueloGuardado & { formato?: string };
  const decks = d?.partida?.decks;
  if (d?.formato !== "jam-cards-replay" || !Array.isArray(decks) || decks.length !== 2 || !Array.isArray(d.historico) || (d.humano !== 0 && d.humano !== 1) || !Array.isArray(d.partida.semente))
    throw new Error("Arquivo de replay inválido.");
  const { formato: _f, versao: _v, ...replay } = d as DueloGuardado & { formato?: string; versao?: number };
  const lista = (await idbGet<DueloGuardado[]>(CHAVE)) ?? [];
  const novo: DueloGuardado = { ...replay, linhas: replay.linhas ?? [], respostas: replay.respostas ?? [], quando: replay.quando ?? new Date().toISOString() };
  lista.push(novo);
  await idbSetMany({ [CHAVE]: lista.slice(-limite) });
  return novo;
}
