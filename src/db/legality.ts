import type { Card } from "./types";

// Legalidade por formato. O campo "formats" da YGOPRODeck é incompleto (ex.: Mitsurugi Prayers
// não lista OCG, mas está na banlist do OCG), então uma carta conta como lançada num formato se
// aparecer em qualquer um destes sinais: formats, data de lançamento ou banlist do formato.

export type GameFormat = "TCG" | "OCG";

export function releasedIn(c: Card, format: GameFormat): boolean {
  if (format === "TCG") return !!(c.formats?.includes("TCG") || c.tcgDate || c.ban?.tcg);
  return !!(c.formats?.includes("OCG") || c.ocgDate || c.ban?.ocg);
}

/** Pode ser usada no formato: lançada e não proibida */
export function legalIn(c: Card, format: GameFormat): boolean {
  if (c.frame === "skill" || c.frame === "token") return false;
  const ban = format === "TCG" ? c.ban?.tcg : c.ban?.ocg;
  return releasedIn(c, format) && ban !== "Forbidden";
}

/** Exclusiva de um formato (lançada só nele) */
export function exclusiveTo(c: Card): GameFormat | undefined {
  const tcg = releasedIn(c, "TCG");
  const ocg = releasedIn(c, "OCG");
  if (tcg && !ocg) return "TCG";
  if (ocg && !tcg) return "OCG";
  return undefined;
}
