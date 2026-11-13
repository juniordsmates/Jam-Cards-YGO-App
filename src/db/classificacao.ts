import { releasedIn, type GameFormat } from "./legality";
import type { BanStatus, Card } from "./types";
import { t } from "../i18n";
import { categoriasManuais } from "./categoriasManuais";

// Classificação de cada carta pelo papel no deck (tags da comunidade e de efeito, ver tags.ts):
// a mesma em todas as telas (selos nas cartas do Editor de Deck e do Teste de Jogo, caixa da mão).
// O usuário pode trocar a de uma carta (botão direito → "Categorizar", src/db/categoriasManuais.ts).

export interface Papel {
  id: string;
  label: string;
  /** sigla do selo na carta */
  sigla: string;
  cor: string;
}

export const PAPEIS: Papel[] = [
  { id: "hand-trap", label: t("Hand trap"), sigla: "HT", cor: "#7c3aed" },
  { id: "starter", label: t("Starter"), sigla: "ST", cor: "#0e9f6e" },
  { id: "extender", label: t("Extender"), sigla: "EX", cor: "#0891b2" },
  { id: "board-breaker", label: t("Board breaker"), sigla: "BB", cor: "#d9480f" },
  { id: "floodgate", label: t("Floodgate"), sigla: "FG", cor: "#b91c1c" },
  { id: "staple", label: t("Staple"), sigla: "SP", cor: "#a16207" },
  // carta que o combo precisa ter no Deck, mas que é ruim abrir na mão (só por escolha do usuário em "Categorizar")
  { id: "brick", label: t("Brick"), sigla: "BR", cor: "#9f1239" },
];

/** Papéis automáticos da carta (tags), na ordem de PAPEIS */
export const papeisAutomaticos = (c: Card) => PAPEIS.filter((p) => c.tags?.includes(p.id));

/** Papéis da carta, na ordem de PAPEIS: os escolhidos pelo usuário ou, sem eles, os automáticos */
export function papeisDa(c: Card): Papel[] {
  const manuais = categoriasManuais(c.id);
  return manuais ? PAPEIS.filter((p) => manuais.includes(p.id)) : papeisAutomaticos(c);
}

/** Situação na banlist do formato; "Não lançada" quando a carta não existe nele */
export function banNoFormato(c: Card, formato: GameFormat): BanStatus | "fora" | undefined {
  if (!releasedIn(c, formato)) return "fora";
  return formato === "TCG" ? c.ban?.tcg : c.ban?.ocg;
}

/** Quantas cartas de cada papel há na lista (só os papéis presentes) e quantas não têm nenhum */
export function contarPapeis(cards: Card[]): { porPapel: { papel: Papel; n: number }[]; semPapel: number } {
  return {
    porPapel: PAPEIS.map((papel) => ({ papel, n: cards.filter((c) => papeisDa(c).includes(papel)).length })).filter((x) => x.n > 0),
    semPapel: cards.filter((c) => !papeisDa(c).length).length,
  };
}
