import type { BanStatus, Card } from "./types";

// A API devolve tipos/atributos só em inglês; aqui ficam os rótulos em pt-BR

export const ATTRIBUTES: Record<string, string> = {
  DARK: "Trevas",
  LIGHT: "Luz",
  EARTH: "Terra",
  WATER: "Água",
  FIRE: "Fogo",
  WIND: "Vento",
  DIVINE: "Divino",
};

export const MONSTER_RACES: Record<string, string> = {
  Aqua: "Aqua",
  Beast: "Besta",
  "Beast-Warrior": "Besta-Guerreira",
  "Creator God": "Deus Criador",
  Cyberse: "Ciberso",
  Dinosaur: "Dinossauro",
  "Divine-Beast": "Besta Divina",
  Dragon: "Dragão",
  Fairy: "Fada",
  Fiend: "Demônio",
  Fish: "Peixe",
  Illusion: "Ilusão",
  Insect: "Inseto",
  Machine: "Máquina",
  Plant: "Planta",
  Psychic: "Psíquico",
  Pyro: "Piro",
  Reptile: "Réptil",
  Rock: "Rocha",
  "Sea Serpent": "Serpente Marinha",
  Spellcaster: "Mago",
  Thunder: "Trovão",
  Warrior: "Guerreiro",
  "Winged Beast": "Besta Alada",
  Wyrm: "Wyrm",
  Zombie: "Zumbi",
};

export const SPELL_TYPES: Record<string, string> = {
  Normal: "Normal",
  Continuous: "Contínua",
  "Quick-Play": "Rápida",
  Equip: "Equipamento",
  Field: "Campo",
  Ritual: "Ritual",
};

export const TRAP_TYPES: Record<string, string> = {
  Normal: "Normal",
  Continuous: "Contínua",
  Counter: "Resposta",
};

export const BAN_LABELS: Record<BanStatus, string> = {
  Forbidden: "Proibida",
  Limited: "Limitada",
  "Semi-Limited": "Semi-Limitada",
};

const TYPELINE: Record<string, string> = {
  ...MONSTER_RACES,
  Normal: "Normal",
  Effect: "Efeito",
  Tuner: "Regulador",
  Fusion: "Fusão",
  Synchro: "Sincro",
  Xyz: "Xyz",
  Link: "Link",
  Ritual: "Ritual",
  Pendulum: "Pêndulo",
  Flip: "Virar",
  Spirit: "Espírito",
  Union: "União",
  Gemini: "Gêmeos",
  Toon: "Toon",
};

export const MONSTER_CLASSES: { value: string; label: string; test: (c: Card) => boolean }[] = [
  { value: "normal", label: "Normal", test: (c) => c.frame.startsWith("normal") },
  { value: "effect", label: "Efeito", test: (c) => c.frame.startsWith("effect") },
  { value: "ritual", label: "Ritual", test: (c) => c.frame.startsWith("ritual") },
  { value: "fusion", label: "Fusão", test: (c) => c.frame.startsWith("fusion") },
  { value: "synchro", label: "Sincro", test: (c) => c.frame.startsWith("synchro") },
  { value: "xyz", label: "Xyz", test: (c) => c.frame.startsWith("xyz") },
  { value: "link", label: "Link", test: (c) => c.frame === "link" },
  { value: "pendulum", label: "Pêndulo", test: (c) => c.frame.endsWith("pendulum") },
  { value: "tuner", label: "Regulador", test: (c) => c.type.includes("Tuner") },
  { value: "flip", label: "Virar", test: (c) => c.type.includes("Flip") },
  { value: "spirit", label: "Espírito", test: (c) => c.type.includes("Spirit") },
  { value: "union", label: "União", test: (c) => c.type.includes("Union") },
  { value: "gemini", label: "Gêmeos", test: (c) => c.type.includes("Gemini") },
  { value: "toon", label: "Toon", test: (c) => c.type.includes("Toon") },
];

/** Linha de tipo em pt-BR: "[Mago / Normal]", "Magia Rápida", "Armadilha Contínua"… */
export function kindLabel(card: Card): string {
  switch (card.frame) {
    case "spell":
      return `Magia ${SPELL_TYPES[card.race] ?? card.race}`;
    case "trap":
      return `Armadilha ${TRAP_TYPES[card.race] ?? card.race}`;
    case "skill":
      return "Habilidade";
    case "token":
      return "Ficha";
    default:
      return `[${(card.typeline ?? [card.race]).map((t) => TYPELINE[t] ?? t).join(" / ")}]`;
  }
}

export const levelLabel = (card: Card) =>
  card.frame.startsWith("xyz") ? "Rank" : card.frame === "link" ? "Link" : "Nível";

/** Cor de destaque por tipo de moldura, usada na borda das cartas */
export const FRAME_COLORS: Record<string, string> = {
  normal: "#d4a32a",
  effect: "#e8702a",
  ritual: "#5aa8ff",
  fusion: "#b26bff",
  synchro: "#9aa0b8",
  xyz: "#9a9ac0",
  link: "#3d8bff",
  spell: "#0e9f7e",
  trap: "#d6337f",
  token: "#8a8a9e",
  skill: "#3fc0ff",
};

export const frameColor = (frame: string) => FRAME_COLORS[frame.replace("_pendulum", "")] ?? "#00a5c4";
