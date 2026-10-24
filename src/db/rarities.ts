// Raridades resumidas em sigla + cor (o nome completo fica no title).
// Cobre as raridades presentes na base da YGOPRODeck; nomes fora da lista viram sigla pelas iniciais.

export interface RarityInfo {
  code: string;
  color: string;
  /** nome completo, como veio da fonte */
  name: string;
}

const COLORS = {
  common: "#9a98a8",
  rare: "#6f7d8c",
  super: "#2f7dd1",
  ultra: "#c9971c",
  ultimate: "#8a6d1e",
  secret: "#8e44ad",
  gold: "#b8860b",
  platinum: "#5d6d7e",
  quarter: "#c0392b",
  starlight: "#d63384",
  collector: "#138d75",
  ghost: "#7f8c8d",
  print: "#95a5a6",
  foil: "#16a085",
  parallel: "#2e86c1",
  master: "#6c3483",
  pharaoh: "#a04000",
};

// chave em minúsculas (a base tem variações como "PLatinum Secret Rare")
const RARITIES: Record<string, [string, string]> = {
  "common": ["C", COLORS.common],
  "rare": ["R", COLORS.rare],
  "super rare": ["SR", COLORS.super],
  "ultra rare": ["UR", COLORS.ultra],
  "ultimate rare": ["UtR", COLORS.ultimate],
  "secret rare": ["ScR", COLORS.secret],
  "prismatic secret rare": ["PScR", COLORS.secret],
  "extra secret rare": ["EScR", COLORS.secret],
  "extra secret": ["EScR", COLORS.secret],
  "ultra secret rare": ["UScR", COLORS.secret],
  "10000 secret rare": ["10000ScR", COLORS.secret],
  "quarter century secret rare": ["QCSR", COLORS.quarter],
  "platinum secret rare": ["PlScR", COLORS.platinum],
  "platinum rare": ["PlR", COLORS.platinum],
  "gold secret rare": ["GScR", COLORS.gold],
  "gold rare": ["GUR", COLORS.gold],
  "premium gold rare": ["PGR", COLORS.gold],
  "starlight rare": ["StR", COLORS.starlight],
  "collector's rare": ["CR", COLORS.collector],
  "cr": ["CR", COLORS.collector],
  "ghost rare": ["GR", COLORS.ghost],
  "ghost/gold rare": ["GGR", COLORS.ghost],
  "short print": ["SP", COLORS.print],
  "super short print": ["SSP", COLORS.print],
  "starfoil rare": ["SFR", COLORS.foil],
  "starfoil": ["SFR", COLORS.foil],
  "shatterfoil rare": ["SHR", COLORS.foil],
  "mosaic rare": ["MSR", COLORS.foil],
  "normal parallel rare": ["NPR", COLORS.parallel],
  "super parallel rare": ["SPR", COLORS.parallel],
  "ultra parallel rare": ["UPR", COLORS.parallel],
  "duel terminal normal parallel rare": ["DNPR", COLORS.parallel],
  "duel terminal rare parallel rare": ["DRPR", COLORS.parallel],
  "duel terminal super parallel rare": ["DSPR", COLORS.parallel],
  "duel terminal ultra parallel rare": ["DUPR", COLORS.parallel],
  "duel terminal normal rare parallel rare": ["DNRPR", COLORS.parallel],
  "grand master rare": ["GMR", COLORS.master],
  "ultra rare (pharaoh's rare)": ["URPR", COLORS.pharaoh],
};

/** Sigla e cor de uma raridade ("Secret Rare" → ScR roxo) */
export function rarityInfo(name: string | undefined): RarityInfo {
  const raw = (name ?? "").trim();
  const known = RARITIES[raw.toLowerCase()];
  if (known) return { code: known[0], color: known[1], name: raw };
  // fora da lista ("New", "Reprint"…): iniciais em cinza
  const initials = raw
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase()))
    .join("");
  return { code: initials || "?", color: COLORS.common, name: raw || "Raridade desconhecida" };
}
