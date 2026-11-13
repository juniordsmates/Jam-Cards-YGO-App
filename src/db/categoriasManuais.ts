import { useSyncExternalStore } from "react";

// Categorias escolhidas pelo usuário (botão direito → "Categorizar"): até 3 papéis por carta, que
// substituem a classificação automática (tags) em todas as telas. Ficam neste aparelho.

const CHAVE = "cartas-categorias-manuais";
/** máximo de categorias por carta */
export const MAX_CATEGORIAS = 3;

type Mapa = Record<string, string[]>;

/** categorias que mudaram de id (a "Combo Garnets" virou "Brick") */
const RENOMEADAS: Record<string, string> = { "combo-garnet": "brick" };

function ler(): Mapa {
  try {
    const m = JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Mapa;
    if (!m || typeof m !== "object") return {};
    return Object.fromEntries(Object.entries(m).map(([id, papeis]) => [id, papeis.map((x) => RENOMEADAS[x] ?? x)]));
  } catch {
    return {};
  }
}

let mapa: Mapa = ler();
const ouvintes = new Set<() => void>();

/** categorias manuais da carta (undefined: usa a classificação automática) */
export const categoriasManuais = (id: number): string[] | undefined => mapa[id];

/** grava as categorias da carta (null: volta à classificação automática) */
export function definirCategorias(id: number, papeis: string[] | null) {
  const novo = { ...mapa };
  if (papeis === null) delete novo[id];
  else novo[id] = papeis.slice(0, MAX_CATEGORIAS);
  mapa = novo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(mapa));
  } catch {
    // sem armazenamento: vale até fechar o app
  }
  ouvintes.forEach((f) => f());
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

/** redesenha quando o usuário muda alguma categoria (o valor é o mapa inteiro) */
export const useCategoriasManuais = () => useSyncExternalStore(assinar, () => mapa, () => mapa);
