// Aprendizado do Simulador, etapa 1: o que cada duelo ensinou (linhas de combo e respostas do
// jogador, com a prova para refazer no motor) fica só neste aparelho, no IndexedDB. O envio para a
// IA aprender (com a autorização do jogador) vem depois.
import { idbGet, idbSetMany } from "../db/idb";
import type { Aprendizado } from "./sessao";

const CHAVE = "simulador-aprendizado-v1";
/** duelos guardados (os mais antigos saem) */
const MAXIMO = 50;

export interface DueloGuardado extends Aprendizado {
  quando: string;
  versaoMotor: string;
  versaoApp: string;
}

/** Guarda o que o duelo ensinou (nada é guardado se não houve linha nem resposta) */
export async function guardarAprendizado(a: Aprendizado, versaoMotor: string, versaoApp: string) {
  if (!a.linhas.length && !a.respostas.length) return;
  const lista = (await idbGet<DueloGuardado[]>(CHAVE)) ?? [];
  lista.push({ ...a, quando: new Date().toISOString(), versaoMotor, versaoApp });
  await idbSetMany({ [CHAVE]: lista.slice(-MAXIMO) });
}

export const listarAprendizado = async () => (await idbGet<DueloGuardado[]>(CHAVE)) ?? [];
