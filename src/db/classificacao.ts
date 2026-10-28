import { releasedIn, type GameFormat } from "./legality";
import type { BanStatus, Card } from "./types";

// Classificação de cada carta pelo papel no deck (tags da comunidade e de efeito, ver tags.ts):
// a mesma em todas as telas (selos nas cartas do Editor de Deck e do Teste de Jogo, caixa da mão).

export interface Papel {
  id: string;
  label: string;
  /** sigla do selo na carta */
  sigla: string;
  cor: string;
}

export const PAPEIS: Papel[] = [
  { id: "hand-trap", label: "Hand trap", sigla: "HT", cor: "#7c3aed" },
  { id: "starter", label: "Starter", sigla: "ST", cor: "#0e9f6e" },
  { id: "extender", label: "Extender", sigla: "EX", cor: "#0891b2" },
  { id: "board-breaker", label: "Board breaker", sigla: "BB", cor: "#d9480f" },
  { id: "floodgate", label: "Floodgate", sigla: "FG", cor: "#b91c1c" },
  { id: "staple", label: "Staple", sigla: "SP", cor: "#a16207" },
];

/** Papéis da carta, na ordem de PAPEIS */
export const papeisDa = (c: Card) => PAPEIS.filter((p) => c.tags?.includes(p.id));

/** Situação na banlist do formato; "Não lançada" quando a carta não existe nele */
export function banNoFormato(c: Card, formato: GameFormat): BanStatus | "fora" | undefined {
  if (!releasedIn(c, formato)) return "fora";
  return formato === "TCG" ? c.ban?.tcg : c.ban?.ocg;
}

/** Quantas cartas de cada papel há na lista (só os papéis presentes) e quantas não têm nenhum */
export function contarPapeis(cards: Card[]): { porPapel: { papel: Papel; n: number }[]; semPapel: number } {
  return {
    porPapel: PAPEIS.map((papel) => ({ papel, n: cards.filter((c) => c.tags?.includes(papel.id)).length })).filter((x) => x.n > 0),
    semPapel: cards.filter((c) => !papeisDa(c).length).length,
  };
}
