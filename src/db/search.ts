import { categoryOf, displayName, type BanStatus, type Card, type Category } from "./types";
import { MONSTER_CLASSES } from "./labels";

/** Minúsculas, sem acentos e sem pontuação: "Mago Negro!" → "mago negro" */
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type SortKey = "relevance" | "name" | "atk" | "def" | "level" | "new" | "popular";

export interface Filters {
  text: string;
  inDesc: boolean;
  category: Category | "all";
  attributes: string[];
  race: string;
  monsterClass: string;
  spellTrapType: string;
  levelMin: string;
  levelMax: string;
  atkMin: string;
  atkMax: string;
  defMin: string;
  defMax: string;
  archetype: string;
  /** com arquétipo escolhido: incluir cartas de outros arquétipos que o citam */
  includeSupport: boolean;
  ban: BanStatus | "";
  /** formato (TCG, OCG, Master Duel…) */
  format: string;
  yearMin: string;
  yearMax: string;
  /** ids de tags; a carta precisa ter todas */
  tags: string[];
  /** conjunto fixo de cartas (ex.: "invocadas por Cortina de Mago Negro") */
  idSet: { label: string; ids: number[] } | null;
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = {
  text: "",
  inDesc: false,
  category: "all",
  attributes: [],
  race: "",
  monsterClass: "",
  spellTrapType: "",
  levelMin: "",
  levelMax: "",
  atkMin: "",
  atkMax: "",
  defMin: "",
  defMax: "",
  archetype: "",
  includeSupport: false,
  ban: "",
  format: "",
  yearMin: "",
  yearMax: "",
  tags: [],
  idSet: null,
  sort: "relevance",
};

// Texto dos efeitos normalizado sob demanda (só na primeira busca por texto)
let descIndex: WeakMap<Card, string> | undefined;
function descKey(card: Card) {
  descIndex ??= new WeakMap();
  let key = descIndex.get(card);
  if (key === undefined) {
    key = normalize(`${card.descPt ?? ""} ${card.desc}`);
    descIndex.set(card, key);
  }
  return key;
}

// Arquétipo (en/pt) e nomes citados no texto, para a busca achar cartas relacionadas:
// "dark magician" encontra a Cortina de Mago Negro, do arquétipo Dark Magician
let relatedIndex: WeakMap<Card, string> | undefined;
function relatedKey(card: Card) {
  relatedIndex ??= new WeakMap();
  let key = relatedIndex.get(card);
  if (key === undefined) {
    const quoted = [...`${card.desc} ${card.descPt ?? ""}`.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    key = normalize([card.archetype ?? "", card.archetypePt ?? "", ...quoted].join(" "));
    relatedIndex.set(card, key);
  }
  return key;
}

// Só o arquétipo (en/pt), para as listas de sugestão: "mago negro" acha as cartas Dark Magician
let archetypeIndex: WeakMap<Card, string> | undefined;
export function archetypeKey(card: Card) {
  archetypeIndex ??= new WeakMap();
  let key = archetypeIndex.get(card);
  if (key === undefined) {
    key = normalize(`${card.archetype ?? ""} ${card.archetypePt ?? ""}`);
    archetypeIndex.set(card, key);
  }
  return key;
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function inRange(value: number | undefined, min?: number, max?: number) {
  if (min === undefined && max === undefined) return true;
  if (value === undefined) return false;
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Primeiro lançamento (TCG ou OCG, o que vier antes), "AAAA-MM-DD" */
export const releaseDate = (c: Card) => [c.tcgDate, c.ocgDate].filter(Boolean).sort()[0];

/** archetypePt: nome do arquétipo em inglês → português (para aceitar os dois no filtro) */
export function searchCards(cards: Card[], f: Filters, archetypePt?: Map<string, string>): Card[] {
  const query = normalize(f.text);
  const terms = query ? query.split(" ") : [];
  const [lvMin, lvMax] = [num(f.levelMin), num(f.levelMax)];
  const [atkMin, atkMax] = [num(f.atkMin), num(f.atkMax)];
  const [defMin, defMax] = [num(f.defMin), num(f.defMax)];
  const classTest = MONSTER_CLASSES.find((c) => c.value === f.monsterClass)?.test;
  // o filtro aceita o nome em português; a comparação e o suporte usam o nome oficial
  const typed = f.archetype.trim().toLowerCase();
  const archetype = typed
    ? ([...(archetypePt ?? [])].find(([en, pt]) => en.toLowerCase() === typed || pt.toLowerCase() === typed)?.[0] ?? typed).toLowerCase()
    : "";
  const idSet = f.idSet ? new Set(f.idSet.ids) : undefined;
  const [yearMin, yearMax] = [num(f.yearMin), num(f.yearMax)];

  const result = cards.filter((c) => {
    const cat = categoryOf(c);
    if (f.category !== "all" && cat !== f.category) return false;

    if (idSet && !idSet.has(c.id)) return false;

    if (terms.length) {
      const haystack = `${c.key} ${relatedKey(c)}${f.inDesc ? ` ${descKey(c)}` : ""}`;
      if (!terms.every((t) => haystack.includes(t))) return false;
    }

    if (archetype && c.archetype?.toLowerCase() !== archetype) {
      // suporte: cartas que citam o arquétipo entre aspas no texto
      if (!f.includeSupport || !c.desc.toLowerCase().includes(`"${archetype}"`)) return false;
    }
    if (f.format && !c.formats?.includes(f.format)) return false;
    if (yearMin !== undefined || yearMax !== undefined) {
      const year = Number(releaseDate(c)?.slice(0, 4));
      if (!year || !inRange(year, yearMin, yearMax)) return false;
    }
    if (f.ban && c.ban?.tcg !== f.ban) return false;
    if (f.tags.length && !f.tags.every((t) => c.tags?.includes(t))) return false;

    if (f.category === "monster") {
      if (f.attributes.length && !f.attributes.includes(c.attribute ?? "")) return false;
      if (f.race && c.race !== f.race) return false;
      if (classTest && !classTest(c)) return false;
      if (!inRange(c.level ?? c.linkval, lvMin, lvMax)) return false;
      if (!inRange(c.atk, atkMin, atkMax)) return false;
      if (!inRange(c.def, defMin, defMax)) return false;
    }

    if ((f.category === "spell" || f.category === "trap") && f.spellTrapType) {
      if (c.race !== f.spellTrapType) return false;
    }

    return true;
  });

  const byName = (a: Card, b: Card) => collator.compare(displayName(a), displayName(b));
  const desc = (k: "atk" | "def" | "level") => (a: Card, b: Card) =>
    (b[k] ?? -1) - (a[k] ?? -1) || byName(a, b);

  switch (f.sort) {
    case "new":
      return result.sort((a, b) => (releaseDate(b) ?? "").localeCompare(releaseDate(a) ?? "") || byName(a, b));
    case "popular":
      return result.sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || byName(a, b));
    case "atk":
    case "def":
    case "level":
      return result.sort(desc(f.sort));
    case "relevance":
      if (!query && idSet) {
        const order = new Map(f.idSet!.ids.map((id, i) => [id, i]));
        return result.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
      }
      if (query) {
        // nome exato (pt ou en) > nome que começa com o termo > nome que contém os termos
        // > só relacionada (arquétipo ou carta citada no texto)
        const rank = (c: Card) => {
          const names = c.namePt ? [normalize(c.namePt), normalize(c.name)] : [normalize(c.name)];
          if (names.includes(query)) return 0;
          if (names.some((n) => n.startsWith(query))) return 1;
          return terms.every((t) => c.key.includes(t)) ? 2 : 3;
        };
        const ranks = new Map(result.map((c) => [c, rank(c)]));
        return result.sort((a, b) => ranks.get(a)! - ranks.get(b)! || byName(a, b));
      }
      return result.sort(byName);
    default:
      return result.sort(byName);
  }
}
