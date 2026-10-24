import { categoryOf, type Card } from "./types";
import { exclusiveTo } from "./legality";

// Tags derivadas do texto em inglês (padronizado pela Konami, mais confiável que o pt).
// Para criar uma tag nova: acrescente um item em TAGS. Para corrigir uma carta
// específica que a regra erra: use TAG_OVERRIDES.

export type TagGroup = "Negação" | "Remoção" | "Vantagem" | "Ação" | "Defesa" | "Restrição" | "Comunidade" | "Metagame" | "Formato";

export interface TagDef {
  id: string;
  label: string;
  group: TagGroup;
  /** explicação curta, exibida ao passar o mouse */
  hint: string;
  test: (ctx: TagContext) => boolean;
}

export interface TagContext {
  card: Card;
  monster: boolean;
  /** texto em inglês com espaços normalizados */
  text: string;
  /** texto sem as proteções "cannot be negated" (evita falso positivo em negação) */
  negText: string;
  /** frases do texto (separadas por ponto) */
  sentences: string[];
  /** nomes entre aspas no texto, exceto a própria carta */
  references: string[];
  extra: TagExtra;
}

/** Dados de fora do texto da carta (só o pipeline tem; no app ficam vazios) */
export interface TagExtra {
  /** nomes oficiais dos arquétipos, em minúsculas */
  archetypes?: Set<string>;
  /** arquétipos com 2%+ dos decks colocados no OCG no último trimestre / em algum dos últimos 8 */
  metaAtual?: Set<string>;
  metaRecente?: Set<string>;
}

const NOT_NEGATED = /(cannot|can't|could not) be negated|(cannot|can't) negate/gi;
// "Special Summon it, but negate its effects" é desvantagem, não negação
const DRAWBACK_NEGATION = /\(?,? ?but (negate (its|their) effects|(its|their) effects (are|is) negated)\)?|with (its|their) effects negated/gi;

const anySentence = (ctx: TagContext, test: (s: string) => boolean) => ctx.sentences.some(test);

const negEffectActive = /\bnegate (?!the activation|the (normal |special |flip |tribute )?summon)[^.;:]{0,80}?\beffects?\b/i;
const negEffectPassive = /effects? (are|is) negated|(has|have) (its|their) effects? negated/i;
const negActivation = /\bnegate (the|its|that|their)( [a-z]+)?( summon or)? activations?\b/i;
const negSummon = /\bnegate the (normal |special |flip |tribute |fusion |synchro |xyz |link |pendulum )?summon/i;

const HAND_COST = /discard this card|(send|banish|reveal) this card from your hand|special summon this card from your hand/i;
const OPPONENT_TIMING =
  /\(quick effect\)|during (either player's|your opponent's) (turn|main phase|battle phase|standby phase|end phase|draw phase)|when (a card or effect is activated|your opponent)|during the (main|battle) phase/i;

// Restrições contínuas ao oponente; ignora efeitos de um turno ou "em resposta"
const FLOODGATE =
  /(your opponent|neither player|players|each player) (cannot|can't)( [a-z-]+){0,2} (activate|special summon|normal summon|set|add|declare an attack|conduct)|neither player can (activate|special summon|normal summon|set|add|declare)|(your opponent|each player|players) can only (control|special summon|activate|summon|declare)/i;
const TEMPORARY = /in response|this turn|until the end|that turn|next turn|damage step|for the rest/i;

export const TAGS: TagDef[] = [
  // ---------- Negação ----------
  {
    id: "negacao",
    label: "Negação",
    group: "Negação",
    hint: "Nega efeitos, ativações ou invocações (qualquer tipo de negação)",
    test: (ctx) =>
      negEffectActive.test(ctx.negText) ||
      negActivation.test(ctx.negText) ||
      negSummon.test(ctx.negText) ||
      TAGS_BY_ID.get("nega-efeito")!.test(ctx),
  },
  {
    id: "nega-efeito",
    label: "Nega efeito",
    group: "Negação",
    hint: 'Nega efeitos de cartas ("negate its effects", "negate the effects of…")',
    test: (ctx) =>
      negEffectActive.test(ctx.negText) ||
      // forma passiva só quando afeta o oponente e não é desvantagem de invocação
      anySentence(ctx, (s) => negEffectPassive.test(s) && /opponent/i.test(s) && !/summon/i.test(s)),
  },
  {
    id: "nega-ativacao",
    label: "Nega ativação",
    group: "Negação",
    hint: 'Nega a ativação de cartas ou efeitos ("negate the activation")',
    test: (ctx) => negActivation.test(ctx.negText),
  },
  {
    id: "nega-invocacao",
    label: "Nega invocação",
    group: "Negação",
    hint: 'Nega invocações ("negate the Summon")',
    test: (ctx) => negSummon.test(ctx.negText),
  },
  {
    id: "omni-negate",
    label: "Omni-negate",
    group: "Negação",
    hint: "Nega qualquer carta ou efeito ativado, sem restrição de tipo",
    test: (ctx) =>
      anySentence(
        ctx,
        (s) =>
          /when (a|your opponent activates a) card or effect( is activated)?( \(quick effect\))?:/i.test(s) &&
          !/that includes/i.test(s) &&
          /\bnegate\b/i.test(s),
      ),
  },
  {
    id: "inegavel",
    label: "Não pode ser negado",
    group: "Negação",
    hint: 'Tem ativação ou efeito que "cannot be negated"',
    test: (ctx) => /(cannot|can't) be negated/i.test(ctx.text),
  },

  // ---------- Comunidade ----------
  {
    id: "staple",
    label: "Staple",
    group: "Comunidade",
    hint: "Carta genérica usada em muitos decks (lista da YGOPRODeck)",
    test: (ctx) => ctx.card.staple === true,
  },
  {
    id: "hand-trap",
    label: "Hand trap",
    group: "Comunidade",
    hint: "Monstro usado da mão, inclusive no turno do oponente",
    test: (ctx) => ctx.monster && anySentence(ctx, (s) => HAND_COST.test(s) && OPPONENT_TIMING.test(s)),
  },
  {
    id: "quick-effect",
    label: "Quick effect",
    group: "Comunidade",
    hint: "Monstro com efeito rápido (pode ser ativado no turno do oponente)",
    test: (ctx) => ctx.monster && /\(quick effect\)/i.test(ctx.text),
  },
  {
    id: "hopt",
    label: "HOPT",
    group: "Comunidade",
    hint: 'Hard once per turn: "You can only use this effect of … once per turn"',
    test: (ctx) => /you can only (use|activate) (each|this|the|1)\b[^.]{0,80}?(once per turn|per turn)/i.test(ctx.text),
  },
  {
    id: "floodgate",
    label: "Floodgate",
    group: "Restrição",
    hint: "Restrição contínua que impede o oponente de invocar, ativar etc.",
    test: (ctx) => anySentence(ctx, (s) => FLOODGATE.test(s) && !TEMPORARY.test(s)),
  },

  // ---------- Remoção ----------
  {
    id: "destroi",
    label: "Destrói",
    group: "Remoção",
    hint: "Destrói cartas (exceto a si mesma)",
    test: (ctx) => /\bdestroy\b(?! this card)/i.test(ctx.text),
  },
  {
    id: "bane",
    label: "Bane do oponente",
    group: "Remoção",
    hint: "Bane cartas do campo, mão, cemitério ou Deck Adicional do oponente",
    test: (ctx) =>
      /\bbanish\b[^.;]{0,80}?(your opponent controls|on the field|your opponent's (hand|gy|field|extra deck|deck))|your opponent must banish/i.test(ctx.text),
  },
  {
    id: "devolve",
    label: "Devolve à mão",
    group: "Remoção",
    hint: "Devolve cartas do campo para a mão (bounce)",
    test: (ctx) =>
      anySentence(
        ctx,
        (s) =>
          /\breturn\b[^.;]{0,80}?to (the|its|their) (owner's )?hand/i.test(s) &&
          /on the field|your opponent controls|face-up (card|monster)/i.test(s),
      ),
  },
  {
    id: "board-breaker",
    label: "Board breaker",
    group: "Remoção",
    hint: "Remove várias cartas do oponente de uma vez",
    test: (ctx) =>
      /\b(destroy|banish|return|send|shuffle) (all|as many)\b[^.;]{0,60}?(your opponent controls|on the field|your opponent's field)|your opponent must (banish|send|destroy|shuffle)/i.test(ctx.text),
  },

  // ---------- Vantagem ----------
  {
    id: "busca",
    label: "Busca no deck",
    group: "Vantagem",
    hint: "Adiciona cartas do Deck à mão (searcher)",
    test: (ctx) => /\badd\b[^.;]{0,100}?from your deck to your hand/i.test(ctx.text),
  },
  {
    id: "compra",
    label: "Compra cartas",
    group: "Vantagem",
    hint: "Faz comprar cartas",
    test: (ctx) => /\bdraw (1|2|3|4|5|one|two|three|cards equal)\b/i.test(ctx.text),
  },
  {
    id: "recursao",
    label: "Recursão",
    group: "Vantagem",
    hint: "Recupera cartas do cemitério (para a mão ou o campo)",
    test: (ctx) =>
      /\b(add|special summon)\b[^.;]{0,80}?from (your|either|either player's) (gy|graveyard)|\bfrom your (gy|graveyard) to your hand|\btarget\b[^.;]{0,60}?in (your|either|either player's) (gy|graveyard)[^.]{0,30}?; (special summon|add) (it|them|that)/i.test(ctx.text),
  },
  {
    id: "invoca-deck",
    label: "Invoca do deck",
    group: "Vantagem",
    hint: "Invoca por Invocação-Especial monstros do Deck",
    test: (ctx) => /\bspecial summon\b[^.;]{0,80}?from your deck\b/i.test(ctx.text),
  },
  // ---------- Ação ----------
  {
    id: "mill",
    label: "Mill",
    group: "Ação",
    hint: "Envia cartas do Deck para o Cemitério",
    test: (ctx) => /\bsend\b[^.;]{0,80}?from (your|either player's|their) deck to the (gy|graveyard)/i.test(ctx.text),
  },
  {
    id: "burn",
    label: "Burn",
    group: "Ação",
    hint: "Causa dano direto aos PV do oponente por efeito",
    test: (ctx) => /\binflict\b[^.;]{0,60}?damage to (your opponent|each player|them)|\binflict \d+ damage\b/i.test(ctx.text),
  },
  {
    id: "ganho-pv",
    label: "Ganho de PV",
    group: "Ação",
    hint: "Faz você ganhar Pontos de Vida",
    test: (ctx) => /\b(you )?gain\b[^.;]{0,40}?\b(lp|life points)\b/i.test(ctx.text),
  },
  {
    id: "fichas",
    label: "Gera fichas",
    group: "Ação",
    hint: "Invoca Fichas (Tokens)",
    test: (ctx) => /\bspecial summon\b[^.;]{0,80}?\btokens?\b/i.test(ctx.text),
  },
  {
    id: "altera-atk",
    label: "Altera ATK/DEF",
    group: "Ação",
    hint: "Aumenta, reduz ou muda ATK/DEF",
    test: (ctx) => /\b(gains?|loses?)\b[^.;]{0,30}?\b(atk|def)\b|\b(atk|def)( and def)? (becomes?|is halved|is doubled)|\bchange (its|their|that monster's) (atk|def)/i.test(ctx.text),
  },
  {
    id: "rouba-controle",
    label: "Rouba controle",
    group: "Ação",
    hint: "Toma o controle de monstros do oponente",
    test: (ctx) => /\b(take|gain) control of\b/i.test(ctx.text),
  },

  // ---------- Remoção (recursos do oponente) ----------
  {
    id: "ataque-mao",
    label: "Ataque à mão",
    group: "Remoção",
    hint: "Faz o oponente descartar, revela ou mexe na mão dele",
    test: (ctx) =>
      /your opponent (discards|must discard|reveals)|discard[^.;]{0,40}?from your opponent's hand|look at your opponent's hand|(card|cards) in your opponent's hand/i.test(ctx.text),
  },
  {
    id: "ataque-cemiterio",
    label: "Ataque ao cemitério",
    group: "Remoção",
    hint: "Bane ou impede cartas no Cemitério do oponente",
    test: (ctx) =>
      /\bbanish\b[^.;]{0,60}?(from|in) (your opponent's|either|any|either player's) (gy|graveyard)|\btarget\b[^.;]{0,60}?in (your opponent's|either|any|either player's) (gy|graveyard)[^.;]{0,10}; banish (it|them|that)|cards? in your opponent's (gy|graveyard) cannot|send it to the (gy|graveyard), banish it instead/i.test(ctx.text),
  },

  // ---------- Defesa ----------
  {
    id: "protecao",
    label: "Proteção",
    group: "Defesa",
    hint: "Protege cartas de destruição, de alvo ou de efeitos",
    test: (ctx) =>
      /cannot be (destroyed|targeted|banished|tributed)|unaffected by|cannot target (this card|it|them|cards you control)/i.test(ctx.negText),
  },
  {
    id: "efeito-cemiterio",
    label: "Efeito no cemitério",
    group: "Defesa",
    hint: "Tem efeito que funciona a partir do Cemitério ou ao ser enviado para ele",
    test: (ctx) =>
      /this card (is )?in your (gy|graveyard)|banish this card from your (gy|graveyard)|this card from your (gy|graveyard)|if this card is sent to the (gy|graveyard)|if this card in your (gy|graveyard)/i.test(ctx.text),
  },
  {
    id: "armadilha-batalha",
    label: "Armadilha de batalha",
    group: "Defesa",
    hint: "Armadilha usada na Fase de Batalha (ex.: contra ataques)",
    test: (ctx) =>
      ctx.card.frame === "trap" && /declares an attack|attack declaration|during the battle phase|during damage calculation|attacking monster/i.test(ctx.text),
  },

  // ---------- Restrição ----------
  {
    id: "restricao-propria",
    label: "Restrição a você",
    group: "Restrição",
    hint: 'Impõe uma restrição a quem usa a carta (ex.: "você não pode Invocar, exceto…")',
    test: (ctx) =>
      /\byou cannot (special summon|normal summon|summon|activate|conduct|declare|set)\b|\byou can only (special summon|activate) (once|monsters|cards)\b/i.test(ctx.text),
  },

  // ---------- Comunidade (termos de estratégia) ----------
  {
    id: "starter",
    label: "Starter",
    group: "Comunidade",
    hint: "Provável início de combo: busca ou invoca do Deck a partir da mão, da Invocação-Normal ou como Magia",
    test: (ctx) => {
      const getsFromDeck = (s: string) => /\b(add|special summon)\b[^.;]{0,100}?from your deck\b/i.test(s);
      if (ctx.card.frame === "spell") return ctx.card.race !== "Continuous" && ctx.card.race !== "Field" && getsFromDeck(ctx.text);
      return ctx.monster && anySentence(ctx, (s) =>
        getsFromDeck(s) && /(if|when) this card is [^:]{0,30}?normal[^:]{0,30}?summoned|(discard|reveal) this card|this card (is )?in your hand|special summon this card from your hand/i.test(s));
    },
  },
  {
    id: "extender",
    label: "Extender",
    group: "Comunidade",
    hint: "Monstro que se Invoca por Invocação-Especial da mão ou do Cemitério, dando mais material ao combo",
    test: (ctx) =>
      ctx.monster && /special summon this card( \((from your|in) [^)]*\)| from your (hand|gy|graveyard))/i.test(ctx.text),
  },
  {
    id: "generica",
    label: "Genérica",
    group: "Comunidade",
    hint: "Não pertence a arquétipo nem cita outras cartas: cabe em qualquer deck",
    test: (ctx) => !ctx.card.archetype && ctx.references.length === 0 && !ctx.card.frame.startsWith("normal"),
  },
  {
    id: "suporte-arquetipo",
    label: "Suporte a arquétipo",
    group: "Comunidade",
    hint: "Cita outro arquétipo no texto, sem pertencer a ele",
    test: (ctx) =>
      !!ctx.extra.archetypes &&
      ctx.references.some((r) => ctx.extra.archetypes!.has(r.toLowerCase()) && r.toLowerCase() !== ctx.card.archetype?.toLowerCase()),
  },

  // ---------- Metagame ----------
  {
    id: "meta-ocg-atual",
    label: "Meta OCG atual",
    group: "Metagame",
    hint: "O arquétipo teve 2%+ dos decks colocados em torneios do OCG no último trimestre (Road of the King)",
    test: (ctx) => !!ctx.card.archetype && !!ctx.extra.metaAtual?.has(ctx.card.archetype),
  },
  {
    id: "exclusiva-tcg",
    label: "Exclusiva TCG",
    group: "Formato",
    hint: "Lançada só no TCG (Ocidente) até agora",
    test: (ctx) => exclusiveTo(ctx.card) === "TCG",
  },
  {
    id: "exclusiva-ocg",
    label: "Exclusiva OCG",
    group: "Formato",
    hint: "Lançada só no OCG (Ásia) até agora",
    test: (ctx) => exclusiveTo(ctx.card) === "OCG",
  },
  {
    id: "meta-ocg-recente",
    label: "Meta OCG (2 anos)",
    group: "Metagame",
    hint: "O arquétipo teve 2%+ dos decks colocados no OCG em algum trimestre dos últimos 2 anos (Road of the King)",
    test: (ctx) => !!ctx.card.archetype && !!ctx.extra.metaRecente?.has(ctx.card.archetype),
  },
];

const TAGS_BY_ID = new Map(TAGS.map((t) => [t.id, t]));
export const tagById = (id: string) => TAGS_BY_ID.get(id);
export const TAG_GROUPS: TagGroup[] = ["Negação", "Remoção", "Vantagem", "Ação", "Defesa", "Restrição", "Comunidade", "Metagame", "Formato"];

/** Correções manuais por id da carta, para os casos em que a regra erra */
export const TAG_OVERRIDES: Record<string, { add?: number[]; remove?: number[] }> = {};

/** Calcula as tags de todas as cartas (rodado ao carregar a base) */
export function applyTags(cards: Card[], extra: TagExtra = {}) {
  const adds = new Map<number, string[]>();
  const removes = new Map<number, Set<string>>();
  for (const [tag, o] of Object.entries(TAG_OVERRIDES)) {
    o.add?.forEach((id) => adds.set(id, [...(adds.get(id) ?? []), tag]));
    o.remove?.forEach((id) => removes.set(id, (removes.get(id) ?? new Set()).add(tag)));
  }

  for (const card of cards) {
    if (card.frame === "skill" || card.frame === "token") {
      card.tags = [];
      continue;
    }
    const text = card.desc.replace(/\s+/g, " ");
    const ctx: TagContext = {
      card,
      monster: categoryOf(card) === "monster",
      text,
      negText: text.replace(NOT_NEGATED, "").replace(DRAWBACK_NEGATION, ""),
      // itens "●" ficam na mesma frase da linha que os introduz ("…1 of these effects. ● Add…")
      sentences: text.split(/(?<=\.)\s+(?!●)/),
      references: [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((n) => n !== card.name),
      extra,
    };
    const removed = removes.get(card.id);
    const tags = TAGS.filter((t) => !removed?.has(t.id) && t.test(ctx)).map((t) => t.id);
    for (const extra of adds.get(card.id) ?? []) if (!tags.includes(extra)) tags.push(extra);
    card.tags = tags;
  }
}
