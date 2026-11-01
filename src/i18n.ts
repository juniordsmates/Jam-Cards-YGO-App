import { EN } from "./i18n/en";
import { ES } from "./i18n/es";

// Idioma do app (Português, English, Español): escolhido no canto superior direito do menu e guardado
// neste computador. Os textos do código ficam em português e passam por t(): em inglês e espanhol,
// t() procura a tradução nos dicionários (src/i18n/en.ts e es.ts, com o texto em português como
// chave). Trocar o idioma recarrega o app, então até os textos montados ao carregar os módulos
// (rótulos, listas) saem no idioma novo.

export type Idioma = "pt" | "en" | "es";

export const IDIOMAS_APP: { id: Idioma; label: string; curto: string }[] = [
  { id: "pt", label: "Português", curto: "PT" },
  { id: "en", label: "English", curto: "EN" },
  { id: "es", label: "Español", curto: "ES" },
];

const SALVO = "cartas-idioma";

function lerIdioma(): Idioma {
  try {
    const s = localStorage.getItem(SALVO);
    if (s === "pt" || s === "en" || s === "es") return s;
  } catch {
    // armazenamento indisponível
  }
  // primeira abertura: o idioma do sistema (português quando não for inglês nem espanhol)
  const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "pt";
  return nav.startsWith("en") ? "en" : nav.startsWith("es") ? "es" : "pt";
}

/** Idioma desta sessão (fixo até recarregar) */
export const IDIOMA: Idioma = lerIdioma();

/** Locale para datas e números */
export const LOCALE = IDIOMA === "en" ? "en-US" : IDIOMA === "es" ? "es-ES" : "pt-BR";

/** Troca o idioma e recarrega o app */
export function definirIdioma(i: Idioma) {
  if (i === IDIOMA) return;
  try {
    localStorage.setItem(SALVO, i);
  } catch {
    // sem armazenamento, o idioma vale só até fechar
  }
  window.location.reload();
}

const DICIONARIO: Record<string, string> | null = IDIOMA === "en" ? EN : IDIOMA === "es" ? ES : null;

/**
 * Texto no idioma do app. `vars`: valores dos marcadores {0}, {1}… (ou {nome}) do texto.
 * Sem tradução, fica o português.
 */
export function t(texto: string, vars?: readonly unknown[] | Record<string, unknown>): string {
  const base = DICIONARIO?.[texto] ?? texto;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = (vars as Record<string, unknown>)[k];
    return v === undefined || v === null ? m : String(v);
  });
}
