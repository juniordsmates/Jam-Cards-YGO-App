import type { BanStatus, Card } from "./types";
import { t as tr } from "../i18n";

// A API devolve tipos/atributos só em inglês; aqui ficam os rótulos em pt-BR

export const ATTRIBUTES: Record<string, string> = {
  DARK: tr("Trevas"),
  LIGHT: tr("Luz"),
  EARTH: tr("Terra"),
  WATER: tr("Água"),
  FIRE: tr("Fogo"),
  WIND: tr("Vento"),
  DIVINE: tr("Divino"),
};

export const MONSTER_RACES: Record<string, string> = {
  Aqua: tr("Aqua"),
  Beast: tr("Besta"),
  "Beast-Warrior": tr("Besta-Guerreira"),
  "Creator God": tr("Deus Criador"),
  Cyberse: tr("Ciberso"),
  Dinosaur: tr("Dinossauro"),
  "Divine-Beast": tr("Besta Divina"),
  Dragon: tr("Dragão"),
  Fairy: tr("Fada"),
  Fiend: tr("Demônio"),
  Fish: tr("Peixe"),
  Illusion: tr("Ilusão"),
  Insect: tr("Inseto"),
  Machine: tr("Máquina"),
  Plant: tr("Planta"),
  Psychic: tr("Psíquico"),
  Pyro: tr("Piro"),
  Reptile: tr("Réptil"),
  Rock: tr("Rocha"),
  "Sea Serpent": tr("Serpente Marinha"),
  Spellcaster: tr("Mago"),
  Thunder: tr("Trovão"),
  Warrior: tr("Guerreiro"),
  "Winged Beast": tr("Besta Alada"),
  Wyrm: tr("Wyrm"),
  Zombie: tr("Zumbi"),
};

export const SPELL_TYPES: Record<string, string> = {
  Normal: tr("Normal"),
  Continuous: tr("Contínua"),
  "Quick-Play": tr("Rápida"),
  Equip: tr("Equipamento"),
  Field: tr("Campo"),
  Ritual: tr("Ritual"),
};

export const TRAP_TYPES: Record<string, string> = {
  Normal: tr("Normal"),
  Continuous: tr("Contínua"),
  Counter: tr("Resposta"),
};

export const BAN_LABELS: Record<BanStatus, string> = {
  Forbidden: "Proibida",
  Limited: "Limitada",
  "Semi-Limited": "Semi-Limitada",
};

const TYPELINE: Record<string, string> = {
  ...MONSTER_RACES,
  Normal: tr("Normal"),
  Effect: tr("Efeito"),
  Tuner: tr("Regulador"),
  Fusion: tr("Fusão"),
  Synchro: tr("Sincro"),
  Xyz: tr("Xyz"),
  Link: tr("Link"),
  Ritual: tr("Ritual"),
  Pendulum: tr("Pêndulo"),
  Flip: tr("Virar"),
  Spirit: tr("Espírito"),
  Union: tr("União"),
  Gemini: tr("Gêmeos"),
  Toon: tr("Toon"),
};

export const MONSTER_CLASSES: { value: string; label: string; test: (c: Card) => boolean }[] = [
  { value: "normal", label: tr("Normal"), test: (c) => c.frame.startsWith("normal") },
  { value: "effect", label: tr("Efeito"), test: (c) => c.frame.startsWith("effect") },
  { value: "ritual", label: tr("Ritual"), test: (c) => c.frame.startsWith("ritual") },
  { value: "fusion", label: tr("Fusão"), test: (c) => c.frame.startsWith("fusion") },
  { value: "synchro", label: tr("Sincro"), test: (c) => c.frame.startsWith("synchro") },
  { value: "xyz", label: tr("Xyz"), test: (c) => c.frame.startsWith("xyz") },
  { value: "link", label: tr("Link"), test: (c) => c.frame === "link" },
  { value: "pendulum", label: tr("Pêndulo"), test: (c) => c.frame.endsWith("pendulum") },
  { value: "tuner", label: tr("Regulador"), test: (c) => c.type.includes("Tuner") },
  { value: "flip", label: tr("Virar"), test: (c) => c.type.includes("Flip") },
  { value: "spirit", label: tr("Espírito"), test: (c) => c.type.includes("Spirit") },
  { value: "union", label: tr("União"), test: (c) => c.type.includes("Union") },
  { value: "gemini", label: tr("Gêmeos"), test: (c) => c.type.includes("Gemini") },
  { value: "toon", label: tr("Toon"), test: (c) => c.type.includes("Toon") },
];

/** Linha de tipo em pt-BR: "[Mago / Normal]", "Magia Rápida", "Armadilha Contínua"… */
export function kindLabel(card: Card): string {
  switch (card.frame) {
    case "spell":
      return tr("Magia {0}", [SPELL_TYPES[card.race] ?? card.race]);
    case "trap":
      return tr("Armadilha {0}", [TRAP_TYPES[card.race] ?? card.race]);
    case "skill":
      return tr("Habilidade");
    case "token":
      return tr("Ficha");
    default:
      return `[${(card.typeline ?? [card.race]).map((t) => TYPELINE[t] ?? t).join(" / ")}]`;
  }
}

export const levelLabel = (card: Card) =>
  card.frame.startsWith("xyz") ? "Rank" : card.frame === "link" ? "Link" : tr("Nível");

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
