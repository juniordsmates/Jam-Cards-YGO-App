import type { ReactNode } from "react";
import { ATTRIBUTES, BAN_LABELS, MONSTER_CLASSES, MONSTER_RACES, SPELL_TYPES, TRAP_TYPES } from "../db/labels";
import { EMPTY_FILTERS, type Filters } from "../db/search";
import type { TagDefinition } from "../db/overlay";
import type { Category } from "../db/types";
import { t, LOCALE } from "../i18n";

type Props = {
  filters: Filters;
  archetypes: string[];
  tagDefs: TagDefinition[];
  /** quantas cartas da base têm cada tag */
  tagCounts: Map<string, number>;
  formats: string[];
  /** arquétipo em inglês → português */
  archetypePt: Map<string, string>;
  onChange: (patch: Partial<Filters>) => void;
};

const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all", label: t("Todas") },
  { value: "monster", label: t("Monstro") },
  { value: "spell", label: t("Magia") },
  { value: "trap", label: t("Armadilha") },
  { value: "other", label: t("Outras") },
];

const MONSTER_FILTERS: Partial<Filters> = {
  attributes: [],
  race: "",
  monsterClass: "",
  levelMin: "",
  levelMax: "",
  atkMin: "",
  atkMax: "",
  defMin: "",
  defMax: "",
};

const sortedEntries = (map: Record<string, string>) =>
  Object.entries(map).sort((a, b) => a[1].localeCompare(b[1], LOCALE));

const fmt = (n: number) => n.toLocaleString(LOCALE);

function Range({ label, min, max, onMin, onMax }: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="range">
        <input type="number" inputMode="numeric" placeholder={t("mín")} value={min} onChange={(e) => onMin(e.target.value)} aria-label={t("{0} mínimo", [label])} />
        <span>–</span>
        <input type="number" inputMode="numeric" placeholder={t("máx")} value={max} onChange={(e) => onMax(e.target.value)} aria-label={t("{0} máximo", [label])} />
      </div>
    </div>
  );
}

/** Seção recolhível; mostra quantos filtros dela estão ativos */
function Section({ title, active, defaultOpen, children }: {
  title: string;
  active: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="filter-section" open={defaultOpen || active > 0}>
      <summary>
        <span className="field-label">{title}</span>
        {active > 0 && <span className="section-count">{active}</span>}
      </summary>
      <div className="filter-section-body">{children}</div>
    </details>
  );
}

export default function SearchFilters({ filters: f, archetypes, tagDefs, tagCounts, formats, archetypePt, onChange }: Props) {
  const toggleAttr = (attr: string) =>
    onChange({
      attributes: f.attributes.includes(attr) ? f.attributes.filter((a) => a !== attr) : [...f.attributes, attr],
    });

  // Ao trocar de categoria, limpa os filtros que só valem para a anterior
  const setCategory = (category: Filters["category"]) => onChange({ ...MONSTER_FILTERS, spellTrapType: "", category });

  const toggleTag = (id: string) =>
    onChange({ tags: f.tags.includes(id) ? f.tags.filter((t) => t !== id) : [...f.tags, id] });

  const subtypes = f.category === "spell" ? SPELL_TYPES : f.category === "trap" ? TRAP_TYPES : null;
  const monsterActive = [
    f.attributes.length > 0, f.race, f.monsterClass, f.levelMin || f.levelMax, f.atkMin || f.atkMax, f.defMin || f.defMax,
  ].filter(Boolean).length;

  return (
    <aside className="filters" aria-label={t("Filtros")}>
      <div className="field">
        <span className="field-label">{t("Categoria")}</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.value} className={`chip ${f.category === c.value ? "active" : ""}`} onClick={() => setCategory(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {subtypes && (
        <div className="field">
          <span className="field-label">{t("Subtipo")}</span>
          <div className="chips">
            {Object.entries(subtypes).map(([value, label]) => (
              <button
                key={value}
                className={`chip ${f.spellTrapType === value ? "active" : ""}`}
                onClick={() => onChange({ spellTrapType: f.spellTrapType === value ? "" : value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {f.category === "monster" && (
        <Section title={t("Monstro")} active={monsterActive} defaultOpen>
          <div className="field">
            <span className="field-label">{t("Atributo")}</span>
            <div className="chips">
              {Object.entries(ATTRIBUTES).map(([value, label]) => (
                <button
                  key={value}
                  className={`chip attr attr-${value} ${f.attributes.includes(value) ? "active" : ""}`}
                  onClick={() => toggleAttr(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">{t("Tipo")}</span>
            <select value={f.race} onChange={(e) => onChange({ race: e.target.value })}>
              <option value="">{t("Todos")}</option>
              {sortedEntries(MONSTER_RACES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">{t("Classe")}</span>
            <select value={f.monsterClass} onChange={(e) => onChange({ monsterClass: e.target.value })}>
              <option value="">{t("Todas")}</option>
              {MONSTER_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          <Range label={t("Nível / Rank / Link")} min={f.levelMin} max={f.levelMax} onMin={(levelMin) => onChange({ levelMin })} onMax={(levelMax) => onChange({ levelMax })} />
          <Range label={t("ATK")} min={f.atkMin} max={f.atkMax} onMin={(atkMin) => onChange({ atkMin })} onMax={(atkMax) => onChange({ atkMax })} />
          <Range label={t("DEF")} min={f.defMin} max={f.defMax} onMin={(defMin) => onChange({ defMin })} onMax={(defMax) => onChange({ defMax })} />
        </Section>
      )}

      <Section title={t("Efeitos e termos")} active={f.tags.length}>
        {[...new Set(tagDefs.map((t) => t.group))].map((group) => (
          <div key={group} className="tag-group">
            <span className="tag-group-name">{group}</span>
            <div className="chips">
              {tagDefs
                .filter((t) => t.group === group)
                .map((t) => (
                  <button
                    key={t.id}
                    className={`chip tag-chip ${f.tags.includes(t.id) ? "active" : ""}`}
                    title={t.hint}
                    aria-pressed={f.tags.includes(t.id)}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.label}
                    <span className="chip-count">{fmt(tagCounts.get(t.id) ?? 0)}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title={t("Arquétipo")} active={f.archetype ? 1 : 0} defaultOpen>
        <label className="field">
          <input
            list="archetype-list"
            placeholder={t("Ex.: Mago Negro ou Dark Magician")}
            value={f.archetype}
            onChange={(e) => onChange({ archetype: e.target.value })}
            aria-label={t("Arquétipo")}
          />
          {/* aceita o nome oficial (inglês) ou em português */}
          <datalist id="archetype-list">
            {archetypes.map((a) => (
              <option key={a} value={a}>
                {archetypePt.get(a)}
              </option>
            ))}
            {[...archetypePt].map(([en, pt]) => (
              <option key={`pt-${en}`} value={pt}>
                {en}
              </option>
            ))}
          </datalist>
        </label>
        <label className="check" title={t("Inclui cartas de outros arquétipos que citam este no texto")}>
          <input type="checkbox" checked={f.includeSupport} onChange={(e) => onChange({ includeSupport: e.target.checked })} />
          {t("Incluir cartas de suporte")}</label>
      </Section>

      <Section title={t("Formato e lançamento")} active={[f.format, f.yearMin || f.yearMax].filter(Boolean).length}>
        <label className="field">
          <span className="field-label">{t("Formato")}</span>
          <select value={f.format} onChange={(e) => onChange({ format: e.target.value })}>
            <option value="">{t("Qualquer")}</option>
            {formats.map((fm) => (
              <option key={fm} value={fm}>{fm}</option>
            ))}
          </select>
        </label>
        <Range label={t("Ano de lançamento")} min={f.yearMin} max={f.yearMax} onMin={(yearMin) => onChange({ yearMin })} onMax={(yearMax) => onChange({ yearMax })} />
      </Section>

      <Section title={t("Banlist (TCG)")} active={f.ban ? 1 : 0}>
        <select value={f.ban} onChange={(e) => onChange({ ban: e.target.value as Filters["ban"] })} aria-label={t("Banlist (TCG)")}>
          <option value="">{t("Qualquer")}</option>
          {Object.entries(BAN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Section>

      <button className="ghost-btn clear-btn" onClick={() => onChange({ ...EMPTY_FILTERS, text: f.text, inDesc: f.inDesc, sort: f.sort })}>
        {t("Limpar filtros")}</button>
    </aside>
  );
}
