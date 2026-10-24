import { ATTRIBUTES, BAN_LABELS, MONSTER_CLASSES, MONSTER_RACES, SPELL_TYPES, TRAP_TYPES } from "../db/labels";
import type { Filters } from "../db/search";
import type { TagDefinition } from "../db/overlay";

type Props = {
  filters: Filters;
  tagDefs: TagDefinition[];
  onChange: (patch: Partial<Filters>) => void;
  onClearAll: () => void;
};

const CATEGORY_LABELS = { monster: "Monstro", spell: "Magia", trap: "Armadilha", other: "Outras" } as const;

const range = (label: string, min: string, max: string) =>
  min && max ? `${label} ${min}–${max}` : min ? `${label} ≥ ${min}` : `${label} ≤ ${max}`;

/** Filtros em uso como chips removíveis, acima da grade */
export default function ActiveFilters({ filters: f, tagDefs, onChange, onClearAll }: Props) {
  const chips: { key: string; label: string; clear: Partial<Filters> }[] = [];

  if (f.idSet) chips.push({ key: "set", label: `${f.idSet.label} (${f.idSet.ids.length})`, clear: { idSet: null } });
  if (f.text.trim()) chips.push({ key: "text", label: `“${f.text.trim()}”${f.inDesc ? " no texto" : ""}`, clear: { text: "" } });
  if (f.category !== "all") {
    chips.push({ key: "cat", label: CATEGORY_LABELS[f.category], clear: { category: "all", spellTrapType: "" } });
  }
  if (f.spellTrapType) {
    const subtypes = f.category === "spell" ? SPELL_TYPES : TRAP_TYPES;
    chips.push({ key: "sub", label: subtypes[f.spellTrapType] ?? f.spellTrapType, clear: { spellTrapType: "" } });
  }
  for (const a of f.attributes) {
    chips.push({ key: `attr-${a}`, label: ATTRIBUTES[a] ?? a, clear: { attributes: f.attributes.filter((x) => x !== a) } });
  }
  if (f.race) chips.push({ key: "race", label: MONSTER_RACES[f.race] ?? f.race, clear: { race: "" } });
  if (f.monsterClass) {
    chips.push({ key: "class", label: MONSTER_CLASSES.find((c) => c.value === f.monsterClass)?.label ?? f.monsterClass, clear: { monsterClass: "" } });
  }
  if (f.levelMin || f.levelMax) chips.push({ key: "lv", label: range("Nível", f.levelMin, f.levelMax), clear: { levelMin: "", levelMax: "" } });
  if (f.atkMin || f.atkMax) chips.push({ key: "atk", label: range("ATK", f.atkMin, f.atkMax), clear: { atkMin: "", atkMax: "" } });
  if (f.defMin || f.defMax) chips.push({ key: "def", label: range("DEF", f.defMin, f.defMax), clear: { defMin: "", defMax: "" } });
  for (const t of f.tags) {
    chips.push({ key: `tag-${t}`, label: tagDefs.find((d) => d.id === t)?.label ?? t, clear: { tags: f.tags.filter((x) => x !== t) } });
  }
  if (f.archetype.trim()) {
    chips.push({ key: "arch", label: `Arquétipo: ${f.archetype.trim()}${f.includeSupport ? " + suporte" : ""}`, clear: { archetype: "", includeSupport: false } });
  }
  if (f.format) chips.push({ key: "format", label: f.format, clear: { format: "" } });
  if (f.yearMin || f.yearMax) chips.push({ key: "year", label: range("Lançamento", f.yearMin, f.yearMax), clear: { yearMin: "", yearMax: "" } });
  if (f.ban) chips.push({ key: "ban", label: `TCG: ${BAN_LABELS[f.ban]}`, clear: { ban: "" } });

  if (chips.length === 0) return null;

  return (
    <div className="active-filters" aria-label="Filtros ativos">
      {chips.map((c) => (
        <button key={c.key} className="active-chip" onClick={() => onChange(c.clear)} title="Remover filtro">
          {c.label}
          <span aria-hidden>✕</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button className="link-btn" onClick={onClearAll}>
          Limpar tudo
        </button>
      )}
    </div>
  );
}
