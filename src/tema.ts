import { useSyncExternalStore } from "react";

// Modo claro ou escuro: escolhido no canto superior direito do menu e guardado neste computador.
// O tema é o atributo data-tema do <html> (as cores ficam nas variáveis de styles.css). O index.html
// aplica o tema salvo antes do app carregar, para a tela não piscar clara ao abrir no modo escuro.

export type Tema = "claro" | "escuro";

const SALVO = "cartas-tema";

function lerTema(): Tema {
  try {
    const s = localStorage.getItem(SALVO);
    if (s === "claro" || s === "escuro") return s;
  } catch {
    // armazenamento indisponível
  }
  // primeira abertura: o tema do sistema
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

let atual: Tema = lerTema();
const ouvintes = new Set<() => void>();

function aplicar() {
  document.documentElement.dataset.tema = atual;
}
aplicar();

/** Troca o tema na hora (sem recarregar) e guarda a escolha */
export function definirTema(t: Tema) {
  atual = t;
  try {
    localStorage.setItem(SALVO, t);
  } catch {
    // sem armazenamento, o tema vale só até fechar
  }
  aplicar();
  ouvintes.forEach((f) => f());
}

export function useTema(): Tema {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
  );
}
