import { readCard } from "./effects";
import { categoryOf, type Card } from "./types";

// Relacionamentos entre cartas, lidos do texto em inglês. Cada relação tem um sentido
// (de quem tem o texto → para quem é alvo) e é consultável nos dois sentidos:
// "Cortina de Mago Negro invoca Mago Negro" e "Mago Negro é invocado por Cortina de Mago Negro".
// O alvo pode ser uma carta citada, um arquétipo, "cartas que citam X" ou uma descrição
// genérica ("1 monstro Mago de TREVAS"), sempre com as restrições do texto (Nível, tipo…).

export type RelationType = "invoca" | "busca" | "baixa" | "material" | "exclusiva" | "ritual" | "cita";

/** Restrições de uma descrição de carta: "1 Level 3 "Prophecy" monster", "1 DARK Spellcaster monster"… */
export interface CardQuery {
  category?: "monster" | "spell" | "trap" | "spelltrap";
  attribute?: string;
  race?: string;
  /** Tuner, Normal, Fusion, Ritual… */
  monsterType?: string;
  /** subtipo de Magia/Armadilha: Continuous, Quick-Play, Field, Equip, Counter… */
  subtype?: string;
  levelMin?: number;
  levelMax?: number;
  atkMin?: number;
  atkMax?: number;
  defMax?: number;
  /** "da mão/Deck/GY": monstros do Deck Adicional não entram */
  mainDeckOnly?: boolean;
  /** de onde o efeito tira a carta ("from your hand or Deck") */
  zones?: Zone[];
}

export type Zone = "hand" | "deck" | "gy" | "banished" | "extra";

/** Como a invocação é feita: só "special" sofre as restrições de condição de invocação do alvo */
export type SummonMethod = "special" | "ritual" | "fusion" | "synchro" | "xyz" | "link";

export type RelationTarget =
  | { kind: "card"; id: number }
  /** cartas de um arquétipo ('"Invoked" monster') */
  | { kind: "archetype"; name: string; query?: CardQuery }
  /** cartas que citam um nome no texto ('a Spell/Trap that mentions "Dark Magician"') */
  | { kind: "mentions"; name: string; query?: CardQuery }
  /** descrição genérica, sem nome ('1 DARK Spellcaster monster') */
  | { kind: "query"; query: CardQuery };

export interface Relation {
  type: RelationType;
  /** carta que tem o texto */
  from: number;
  /** índice do efeito (na leitura da carta) em que a relação aparece */
  effect: number;
  /** nome citado, em inglês (vazio para descrições genéricas) */
  name: string;
  target: RelationTarget;
  /** só para "invoca": método da invocação */
  method?: SummonMethod;
  /** "ignoring its Summoning conditions": vale até para alvos que só se invocam do próprio jeito */
  ignoreConditions?: boolean;
}

/** Rótulos nos dois sentidos: de quem tem o texto (saída) e de quem é alvo (entrada) */
export const RELATION_LABELS: Record<RelationType, { out: string; in: string }> = {
  invoca: { out: "Invoca", in: "Invocada por" },
  busca: { out: "Busca", in: "Buscada por" },
  baixa: { out: "Baixa no campo", in: "Baixada no campo por" },
  material: { out: "Materiais", in: "Material de" },
  exclusiva: { out: "Só pode ser invocada com", in: "Necessária para invocar" },
  ritual: { out: "Invocada por Ritual com", in: "Invoca por Ritual" },
  cita: { out: "Cita", in: "Citada por" },
};

const ATTRIBUTES = ["LIGHT", "DARK", "EARTH", "WATER", "FIRE", "WIND", "DIVINE"];
// mais longos primeiro: "Beast-Warrior" antes de "Beast"
const RACES = [
  "Beast-Warrior", "Winged Beast", "Sea Serpent", "Divine-Beast", "Creator God", "Spellcaster", "Dinosaur",
  "Cyberse", "Illusion", "Machine", "Reptile", "Thunder", "Warrior", "Psychic", "Insect", "Zombie", "Dragon",
  "Beast", "Fairy", "Fiend", "Plant", "Aqua", "Fish", "Pyro", "Rock", "Wyrm",
];
const MONSTER_TYPES = ["Tuner", "Fusion", "Synchro", "Xyz", "Link", "Ritual", "Pendulum", "Flip", "Gemini", "Spirit", "Toon", "Union"];
const NOUN = /\b(monsters?|tuners?|spell\/traps?|spells?|traps?|cards?)\b/i;

/** Lê as restrições de um trecho descritivo ("1 Level 3 … monster with 1500 or less ATK from your Deck") */
export function parseQuery(text: string): CardQuery {
  const q: CardQuery = {};
  const noun = text.match(NOUN)?.[1].toLowerCase();
  if (noun?.startsWith("monster") || noun?.startsWith("tuner")) q.category = "monster";
  else if (noun?.startsWith("spell/trap")) q.category = "spelltrap";
  else if (noun?.startsWith("spell")) q.category = "spell";
  else if (noun?.startsWith("trap")) q.category = "trap";

  const sub = text.match(/\b(Continuous|Quick-Play|Field|Equip|Counter|Ritual) (Spells?|Traps?|Spell\/Traps?)\b/i);
  if (sub) {
    q.subtype = sub[1][0].toUpperCase() + sub[1].slice(1);
    q.category = /trap/i.test(sub[2]) && !/spell/i.test(sub[2]) ? "trap" : /spell\/trap/i.test(sub[2]) ? "spelltrap" : "spell";
  }
  q.attribute = ATTRIBUTES.find((a) => new RegExp(`\\b${a}\\b`).test(text));
  q.race = RACES.find((r) => new RegExp(`\\b${r}(-Type)?\\b`, "i").test(text));
  q.monsterType =
    q.subtype === "Ritual"
      ? undefined
      : MONSTER_TYPES.find((t) => new RegExp(`\\b${t}\\b(?! Summon| Spells?| Traps?)`).test(text)) ?? (/\bNormal Monster/.test(text) ? "Normal" : undefined);

  const lv = text.match(/\bLevel (\d+) or (lower|less|higher|more)\b/i);
  if (lv) {
    if (/lower|less/i.test(lv[2])) q.levelMax = Number(lv[1]);
    else q.levelMin = Number(lv[1]);
  } else {
    const exact = text.match(/\bLevel (\d+)\b/i);
    if (exact) q.levelMin = q.levelMax = Number(exact[1]);
  }
  const atk = text.match(/\b(\d+) or (less|lower|more|higher) ATK\b/i);
  if (atk) {
    if (/less|lower/i.test(atk[2])) q.atkMax = Number(atk[1]);
    else q.atkMin = Number(atk[1]);
  }
  const def = text.match(/\b(\d+) or (less|lower) DEF\b/i);
  if (def) q.defMax = Number(def[1]);
  const atkEq = !atk && text.match(/\bwith (?:exactly )?(\d+) (?:original )?ATK\b/i);
  if (atkEq) q.atkMin = q.atkMax = Number(atkEq[1]);
  if (q.category === "monster" && /\bfrom (your|their|either player's) (hand|deck|gy|graveyard)/i.test(text) && !/extra deck/i.test(text)) {
    q.mainDeckOnly = true;
  }
  const from = text.match(/\bfrom (?:your|their|either player's|the|your opponent's) ([^,;.]*)/i)?.[1] ?? "";
  const zones: Zone[] = [];
  if (/\bhand\b/i.test(from)) zones.push("hand");
  if (/\bextra deck\b/i.test(from)) zones.push("extra");
  if (/(?<!extra )\bdeck\b/i.test(from)) zones.push("deck");
  if (/\b(gy|graveyard)\b/i.test(from)) zones.push("gy");
  if (/\bbanish/i.test(from) || /\bbanished\b/i.test(text)) zones.push("banished");
  if (/\bexcavat/i.test(text) && !zones.includes("deck")) zones.push("deck");
  if (zones.length) q.zones = zones;
  for (const k of Object.keys(q) as (keyof CardQuery)[]) if (q[k] === undefined) delete q[k];
  return q;
}

/** A descrição é específica o bastante para listar cartas? ("1 monstro" sozinho não é) */
const isSpecific = (q: CardQuery) =>
  !!(q.attribute || q.race || q.monsterType || q.subtype) ||
  [q.levelMin, q.levelMax, q.atkMin, q.atkMax, q.defMax].some((v) => v !== undefined);

export function matchesQuery(c: Card, q: CardQuery | undefined): boolean {
  if (!q) return true;
  const cat = categoryOf(c);
  if (q.category === "spelltrap" ? cat !== "spell" && cat !== "trap" : q.category && cat !== q.category) return false;
  if (q.subtype && c.race !== q.subtype) return false;
  if (q.attribute && c.attribute !== q.attribute) return false;
  if (q.race && c.race !== q.race) return false;
  if (q.monsterType) {
    const t = q.monsterType;
    const ok =
      t === "Normal"
        ? c.frame.startsWith("normal")
        : (c.typeline ?? []).includes(t) || c.type.includes(t) || c.frame.startsWith(t.toLowerCase());
    if (!ok) return false;
  }
  if (q.levelMin !== undefined && (c.level ?? -1) < q.levelMin) return false;
  if (q.levelMax !== undefined && (c.level ?? 99) > q.levelMax) return false;
  if (q.atkMin !== undefined && (c.atk ?? -1) < q.atkMin) return false;
  if (q.atkMax !== undefined && (c.atk ?? 99999) > q.atkMax) return false;
  if (q.defMax !== undefined && (c.def ?? 99999) > q.defMax) return false;
  if (q.mainDeckOnly && /^(fusion|synchro|xyz|link)/.test(c.frame)) return false;
  return true;
}

/**
 * Condição de invocação da carta (regras do jogo):
 * - "never": "Cannot be Special Summoned."
 * - "nomi":  só pelo próprio método ("Must be Special/Fusion/Ritual… Summoned …"), nem do Cemitério
 * - "semi":  precisa ser invocada corretamente antes ("Must first be…", Ritual e Deck Adicional);
 *            efeito genérico só a revive do Cemitério/banidos
 * - "free":  qualquer efeito pode invocá-la
 */
export type SummonRule = "free" | "semi" | "nomi" | "never";

const ruleCache = new WeakMap<Card, SummonRule>();
export function summonRule(c: Card): SummonRule {
  let rule = ruleCache.get(c);
  if (rule) return rule;
  const text = c.desc.replace(/\s+/g, " ");
  if (/(^|\. )Cannot be Special Summoned\.(?! )|(^|\. )Cannot be Special Summoned\.$/i.test(text)) rule = "never";
  else if (/\bmust be (special|ritual|fusion|synchro|xyz|link) summoned\b/i.test(text)) rule = "nomi";
  else if (/\bmust first be (special|ritual|fusion|synchro|xyz|link) summoned\b/i.test(text)) rule = "semi";
  else if (/^(ritual|fusion|synchro|xyz|link)/.test(c.frame)) rule = "semi";
  else rule = "free";
  ruleCache.set(c, rule);
  return rule;
}

/** O alvo pode ser invocado por este método, destas zonas, respeitando a condição dele? */
export function canBeSummoned(c: Card, method: SummonMethod = "special", zones?: Zone[]): boolean {
  if (categoryOf(c) !== "monster") return false;
  const rule = summonRule(c);
  if (rule === "never") return false;
  if (method !== "special") {
    // Ritual/Fusão/Sincro/Xyz/Link: o alvo tem que ser desse tipo
    return c.frame.startsWith(method);
  }
  if (rule === "nomi") return false;
  // semi: só reviver (Cemitério/banidos), nunca da mão ou do Deck
  if (rule === "semi") return !!zones?.some((z) => z === "gy" || z === "banished");
  return true;
}

// Palavra logo depois das aspas que indica arquétipo ('"Invoked" monster', '"HERO" cards')
const ARCHETYPE_WORD =
  /^\s*(monsters?|cards?|spells?|traps?|spell\/traps?|normal|effect|ritual|fusion|synchro|xyz|link|pendulum|tuner|non-tuner|quick-play|continuous|field|equip|counter)\b/i;
const VERB =
  /\b((?:special|ritual|fusion|synchro|xyz|link|pendulum) summon|used to ritual summon|add|send|banish|target|destroy|discard|tribute|reveal|shuffle|return|equip|negate|place)\b/gi;

/** "place … in your Pendulum Zone / face-up in your Field Zone": coloca no campo (não "on top of the Deck") */
const PLACE_ON_FIELD = /\b(in|to|on) (your|their) (pendulum zone|field zone|spell & trap zone|field)\b|\bface-up (in|on) your\b/i;

/** "You can Set 1 …" logo antes do alvo (e nenhum outro verbo depois) */
const SET_BEFORE = /\bset (?:up to )?(?:\d+|one|two)\b[^;:."]*$/i;

/** Verbo mais próximo antes do alvo define o tipo da relação */
const IGNORING = /\bignoring (its|their) summoning conditions\b/i;

function summonMethod(prefix: string): SummonMethod {
  const verbs = [...prefix.matchAll(VERB)];
  const last = verbs[verbs.length - 1]?.[1].toLowerCase() ?? "";
  const m = last.match(/^(?:used to )?(ritual|fusion|synchro|xyz|link) summon/);
  return (m?.[1] as SummonMethod) ?? "special";
}

function relationType(prefix: string, effectKind: string): RelationType {
  if (effectKind === "materiais") return "material";
  if (/\britual summon this card\b/i.test(prefix)) return "ritual";
  if (/\b(must (first )?be|can only be|cannot be normal summoned)[^"]*summoned\b/i.test(prefix) && /\b(with|by|using|tributing)\b/i.test(prefix)) {
    return "exclusiva";
  }
  const verbs = [...prefix.matchAll(VERB)];
  const last = verbs[verbs.length - 1]?.[1].toLowerCase();
  // "Special/Ritual/Fusion… Summon <alvo>" invoca; "Special Summon this card" não
  const lastMatch = verbs[verbs.length - 1];
  const afterVerb = lastMatch ? prefix.slice(lastMatch.index! + lastMatch[0].length) : "";
  if (last && / summon$/.test(last) && !/^\s*this card\b/i.test(afterVerb)) return "invoca";
  if (last === "add") return "busca";
  if (last === "place" && PLACE_ON_FIELD.test(afterVerb)) return "baixa";
  if (SET_BEFORE.test(prefix) && (!lastMatch || prefix.search(SET_BEFORE) > lastMatch.index!)) return "baixa";
  return "cita";
}

/**
 * "Target 1 … in your GY; Special Summon it" / "…; add it to your hand": o que o efeito
 * faz com o alvo vem depois do ";". Devolve o tipo e as zonas, ou undefined se não for o caso.
 */
function targetFollowUp(clause: string, rest: string): { type: RelationType; zones: Zone[] } | undefined {
  if (!/\btarget\b/i.test(clause)) return undefined;
  const after = rest.slice(rest.indexOf(";") + 1);
  if (rest.indexOf(";") < 0) return undefined;
  const m = after.match(/^[^.]*?\b(special summon|add) (it|them|that (?:target|monster|card)|those (?:targets|monsters|cards))\b/i);
  if (!m) return undefined;
  const where = `${clause} ${rest.slice(0, rest.indexOf(";"))}`;
  const zones: Zone[] = [];
  if (/\b(gy|graveyard)\b/i.test(where)) zones.push("gy");
  if (/\bbanish(ed|ment)\b/i.test(where)) zones.push("banished");
  if (!zones.length) return undefined; // alvo no campo: é devolver/mexer, não recuperar
  return { type: m[1].toLowerCase() === "add" ? "busca" : "invoca", zones };
}

/** Trecho descritivo em volta de um nome citado: do último verbo até o nome, e logo depois dele */
function descriptorAround(before: string, after: string) {
  const verbs = [...before.matchAll(VERB)];
  const last = verbs[verbs.length - 1];
  const head = last ? before.slice(last.index! + last[0].length) : before.slice(-60);
  const tail = after.match(/^[^;:.]*/)?.[0] ?? "";
  return `${head.replace(/"[^"]*"/g, "")} ${tail}`;
}

export interface RelationIndex {
  out: Map<number, Relation[]>;
  inCard: Map<number, Relation[]>;
  inArchetype: Map<string, Relation[]>;
  inMentions: Map<string, Relation[]>;
  /** relações com descrição genérica (checadas carta a carta) */
  queries: Relation[];
}

export function buildRelations(cards: Card[], archetypes: Set<string>): RelationIndex {
  const names = new Map(cards.map((c) => [c.name, c.id]));
  // textos antigos às vezes mudam maiúsculas ("Elemental Hero Neos" × "Elemental HERO Neos")
  const namesLower = new Map(cards.map((c) => [c.name.toLowerCase(), c.id]));
  const index: RelationIndex = { out: new Map(), inCard: new Map(), inArchetype: new Map(), inMentions: new Map(), queries: [] };
  const push = <K>(map: Map<K, Relation[]>, key: K, r: Relation) => {
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  };

  for (const card of cards) {
    if (card.frame === "skill" || card.frame === "token") continue;
    const { effects } = readCard(card, false);
    const seen = new Set<string>();
    const add = (r: Relation, key: string) => {
      key = `${r.effect}|${key}`;
      if (seen.has(key)) return;
      seen.add(key);
      push(index.out, card.id, r);
      if (r.target.kind === "card") push(index.inCard, r.target.id, r);
      else if (r.target.kind === "archetype") push(index.inArchetype, r.target.name.toLowerCase(), r);
      else if (r.target.kind === "mentions") push(index.inMentions, r.target.name, r);
      else index.queries.push(r);
    };

    effects.forEach((effect, i) => {
      if (effect.kind === "restricao") return; // "You can only use … of "X"" cita a própria carta
      const text = [effect.text, ...(effect.bullets ?? [])].join(" ");

      // 1) nomes entre aspas
      for (const m of text.matchAll(/"([^"]+)"/g)) {
        const name = m[1];
        const before = text.slice(0, m.index);
        const mentionsSelf = name === card.name && /\b(lists?|mentions?)( the card)?\s*$/i.test(before);
        if (name === card.name && !mentionsSelf) continue;
        const after = text.slice(m.index! + m[0].length);
        const clause = before.slice(Math.max(before.lastIndexOf(";"), before.lastIndexOf(":"), before.lastIndexOf(". ")) + 1);
        const query = parseQuery(descriptorAround(clause, after));
        const hasQuery = Object.keys(query).length > 0;

        let target: RelationTarget | undefined;
        if (/\b(lists?|mentions?)( the card)?\s*$/i.test(clause.replace(/"[^"]*"(,| or| and)?\s*/g, ""))) {
          target = { kind: "mentions", name, ...(hasQuery && { query }) };
        } else if (ARCHETYPE_WORD.test(after) && (archetypes.has(name.toLowerCase()) || !names.has(name))) {
          // '"Goblin Biker" Spell/Trap': arquétipo pelo nome, mesmo fora da lista oficial
          target = { kind: "archetype", name, ...(hasQuery && { query }) };
        } else if (names.has(name) || namesLower.has(name.toLowerCase())) {
          target = { kind: "card", id: names.get(name) ?? namesLower.get(name.toLowerCase())! };
        } else if (archetypes.has(name.toLowerCase())) {
          target = { kind: "archetype", name, ...(hasQuery && { query }) };
        }
        if (!target) continue;

        let kind = relationType(clause, effect.kind);
        if (kind === "cita" && /\bplace\b[^;:."]*$/i.test(clause) && PLACE_ON_FIELD.test(after.match(/^[^;:.]*/)?.[0] ?? "")) kind = "baixa";
        // "target 1 "X" card in your GY; add it to your hand": recuperação, não só citação
        const follow = kind === "cita" ? targetFollowUp(clause, after) : undefined;
        if (follow) {
          kind = follow.type;
          if (target.kind !== "card") target.query = { ...target.query, zones: follow.zones };
        }
        // com "cartas que citam X", só faz sentido buscar ou invocar; o resto vira citação
        const type = target.kind === "mentions" && kind !== "busca" && kind !== "invoca" ? "cita" : kind;
        const r: Relation = { type, from: card.id, effect: i, name, target };
        if (type === "invoca") r.method = summonMethod(clause);
        if (type === "invoca" && IGNORING.test(text)) r.ignoreConditions = true;
        add(r, `${type}|${name}|${target.kind}`);
        if (type === "invoca" && /\badd (it |them )?to your hand,? or special summon\b/i.test(clause)) {
          add({ type: "busca", from: card.id, effect: i, name, target }, `busca|${name}|${target.kind}`);
        }
      }

      // 2) descrições genéricas sem nome: "Special Summon 1 DARK Spellcaster monster from your hand or Deck"
      // aspas viram \u0000; "Special Summon this card" / "add it" viram marcador, para não esconder o próximo alvo da frase
      const quotesMasked = text.replace(/"[^"]*"/g, "\u0000");
      const masked = quotesMasked.replace(/\b(special summon|add) (this card|it|them)\b/gi, "\u0001");

      // 3) "target 1 monster with 0 ATK in your GY; Special Summon it"
      // (o "Special Summon it" depois do ";" é justamente o que interessa aqui: usa o texto sem o marcador)
      for (const m of quotesMasked.matchAll(/\btarget (?:up to )?(?:\d+|one|two|three)? ?([^;:.\u0000]*?\b(?:monsters?|cards?|spells?|traps?)\b[^;:.\u0000]*);/gi)) {
        const follow = targetFollowUp(m[0], quotesMasked.slice(m.index! + m[0].length - 1));
        if (!follow) continue;
        const query = { ...parseQuery(m[1]), zones: follow.zones };
        if (!isSpecific(query)) continue;
        const r: Relation = { type: follow.type, from: card.id, effect: i, name: "", target: { kind: "query", query } };
        if (follow.type === "invoca") {
          r.method = "special";
          if (IGNORING.test(text)) r.ignoreConditions = true;
        }
        add(r, `${follow.type}|t|${JSON.stringify(query)}`);
      }

      for (const m of masked.matchAll(
        /\b((?:special|ritual|fusion|synchro|xyz|link) summon|add|set|place)\b([^;:.\u0000]*?\b(?:monsters?|tuners?|spell\/traps?|spells?|traps?|cards?)\b[^;:.\u0000]*)/gi,
      )) {
        const phrase = m[2];
        if (/\bthis card\b|\bthat (monster|card|target)\b|\bit\b/i.test(phrase.slice(0, 40))) continue;
        // restrições ("You cannot Special Summon monsters, except FIRE monsters") não são invocação
        if (/\b(cannot|can't|can only|only)\s*$/i.test(masked.slice(Math.max(0, m.index! - 16), m.index))) continue;
        // "…, except "Aratama"": a exceção não faz parte da descrição do alvo
        const query = parseQuery(phrase.split(/,?\s+except\b/i)[0]);
        const verb = m[1].toLowerCase();
        const isSetOrPlace = verb === "set" || verb === "place";
        if (isSetOrPlace) {
          // "Set 1 excavated Trap": basta ser Magia/Armadilha; "place" só quando vai para o campo
          if (verb === "place" && !PLACE_ON_FIELD.test(phrase)) continue;
          if (!/^\s*(?:up to )?(?:\d+|one|two|any number of)\b/i.test(phrase)) continue; // "Set card", "set it" etc.
          if (query.category === "monster" && !/pendulum/i.test(phrase)) continue; // baixar monstro é outra coisa
          if (!isSpecific(query) && !query.category) continue;
          add({ type: "baixa", from: card.id, effect: i, name: "", target: { kind: "query", query } }, `baixa|q|${JSON.stringify(query)}`);
          continue;
        }
        if (!isSpecific(query)) continue;
        const type: RelationType = verb === "add" ? "busca" : "invoca";
        const r: Relation = { type, from: card.id, effect: i, name: "", target: { kind: "query", query } };
        if (type === "invoca") r.method = (verb.split(" ")[0] as SummonMethod) ?? "special";
        if (type === "invoca" && IGNORING.test(text)) r.ignoreConditions = true;
        add(r, `${type}|q|${JSON.stringify(query)}|${r.method ?? ""}`);
        if (type === "busca" && /^\s*(it |them )?to your hand,? or special summon\b/i.test(phrase)) {
          add({ type: "invoca", method: "special", from: card.id, effect: i, name: "", target: { kind: "query", query } }, `invoca|q|${JSON.stringify(query)}|special`);
        }
      }
    });
  }
  return index;
}

/** Tipos de relação que só fazem sentido com monstros como alvo (por arquétipo) */
const MONSTER_ONLY: RelationType[] = ["invoca", "material", "ritual", "exclusiva"];

const targetAccepts = (r: Relation, c: Card) => {
  // carta citada pelo nome: o texto foi feito para ela (ex.: "Special Summon 1 "Dark Magician"")
  if (r.target.kind === "card") return r.target.id === c.id;
  if (MONSTER_ONLY.includes(r.type) && categoryOf(c) !== "monster") return false;
  // alvo descrito ("1 DARK Spellcaster monster"): respeita a condição de invocação do alvo
  if (r.type === "invoca") {
    const ok = r.ignoreConditions ? summonRule(c) !== "never" : canBeSummoned(c, r.method, r.target.query?.zones);
    if (!ok) return false;
  }
  return matchesQuery(c, r.target.query);
};

/** Relações em que a carta é o alvo. `generic` separa as que vêm de descrições sem nome. */
export function incomingRelations(index: RelationIndex, card: Card): { named: Relation[]; generic: Relation[] } {
  // por arquétipo: o oficial da carta e qualquer termo citado que apareça no nome dela
  const byArchetype = [...index.inArchetype].flatMap(([term, rels]) =>
    card.archetype?.toLowerCase() === term || card.name.toLowerCase().includes(term) ? rels : [],
  );
  const quoted = [...new Set([...card.desc.matchAll(/"([^"]+)"/g)].map((m) => m[1]))];
  const byMention = quoted.flatMap((n) => index.inMentions.get(n) ?? []);
  const named = [...(index.inCard.get(card.id) ?? []), ...byArchetype, ...byMention].filter(
    (r) => r.from !== card.id && targetAccepts(r, card),
  );
  const generic = index.queries.filter((r) => r.from !== card.id && targetAccepts(r, card));
  return { named, generic };
}

// alvos de cada relação, por base de cartas (a mesma relação é consultada muitas vezes nos combos)
const targetCache = new WeakMap<Card[], WeakMap<Relation, number[]>>();

/** Ids das cartas que uma relação alcança (o alvo direto, ou as cartas que atendem à descrição) */
export function relationTargetIds(r: Relation, cards: Card[]): number[] {
  if (r.target.kind === "card") return [r.target.id];
  let byRelation = targetCache.get(cards);
  if (!byRelation) targetCache.set(cards, (byRelation = new WeakMap()));
  const cached = byRelation.get(r);
  if (cached) return cached;
  const ids = computeTargetIds(r, cards);
  byRelation.set(r, ids);
  return ids;
}

function computeTargetIds(r: Relation, cards: Card[]): number[] {
  if (r.target.kind === "card") return [r.target.id];
  const t = r.target;
  return cards
    .filter((c) => {
      if (c.id === r.from || c.frame === "skill" || c.frame === "token") return false;
      // membro do arquétipo: classificado nele ou com o termo no nome (regra do jogo)
      if (t.kind === "archetype" && c.archetype?.toLowerCase() !== t.name.toLowerCase() && !c.name.includes(t.name)) return false;
      if (t.kind === "mentions" && !c.desc.includes(`"${t.name}"`)) return false;
      return targetAccepts(r, c);
    })
    .map((c) => c.id);
}

const ATTRIBUTE_PT: Record<string, string> = { LIGHT: "LUZ", DARK: "TREVAS", EARTH: "TERRA", WATER: "ÁGUA", FIRE: "FOGO", WIND: "VENTO", DIVINE: "DIVINO" };

/** Descrição em português: "monstro Mago de TREVAS de Nível 4 ou menos" (raças traduzidas por quem chama) */
export function describeQuery(q: CardQuery, raceLabel: (race: string) => string = (r) => r): string {
  const noun = { monster: "monstro", spell: "Magia", trap: "Armadilha", spelltrap: "Magia/Armadilha" }[q.category ?? "monster"];
  const SUBTYPE_PT: Record<string, string> = { Continuous: "Contínua", "Quick-Play": "Rápida", Field: "de Campo", Equip: "de Equipamento", Counter: "de Resposta", Ritual: "de Ritual" };
  const parts = [noun];
  if (q.subtype) parts.push(SUBTYPE_PT[q.subtype] ?? q.subtype);
  if (q.monsterType) parts.push(q.monsterType);
  if (q.race) parts.push(raceLabel(q.race));
  if (q.attribute) parts.push(`de ${ATTRIBUTE_PT[q.attribute] ?? q.attribute}`);
  if (q.levelMin !== undefined && q.levelMin === q.levelMax) parts.push(`de Nível ${q.levelMin}`);
  else if (q.levelMax !== undefined) parts.push(`de Nível ${q.levelMax} ou menos`);
  else if (q.levelMin !== undefined) parts.push(`de Nível ${q.levelMin} ou mais`);
  if (q.atkMin !== undefined && q.atkMin === q.atkMax) parts.push(`com ${q.atkMin} de ATK`);
  else {
    if (q.atkMax !== undefined) parts.push(`com ${q.atkMax} ou menos de ATK`);
    if (q.atkMin !== undefined) parts.push(`com ${q.atkMin} ou mais de ATK`);
  }
  if (q.defMax !== undefined) parts.push(`com ${q.defMax} ou menos de DEF`);
  return parts.join(" ");
}

/**
 * Nome em português de cada arquétipo, pelo pareamento das aspas: "Dark Magician" no
 * texto em inglês corresponde a "Mago Negro" na mesma posição do texto em português.
 * A carta com o mesmo nome do arquétipo (ex.: a própria "Dark Magician") pesa mais.
 */
export function archetypeNamesPt(cards: Card[], archetypes: Set<string>): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  const vote = (en: string, pt: string, weight: number) => {
    if (!archetypes.has(en.toLowerCase()) || !pt || pt === en) return;
    const m = votes.get(en) ?? new Map<string, number>();
    m.set(pt, (m.get(pt) ?? 0) + weight);
    votes.set(en, m);
  };

  for (const c of cards) {
    if (c.namePt) vote(c.name, c.namePt, 5);
    if (!c.descPt) continue;
    const en = [...c.desc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const pt = [...c.descPt.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (en.length !== pt.length) continue;
    en.forEach((name, i) => vote(name, pt[i], 1));
  }

  const result = new Map<string, string>();
  for (const [en, m] of votes) {
    const [best, score] = [...m].sort((a, b) => b[1] - a[1])[0];
    if (score >= 2) result.set(en, best);
  }
  return result;
}
