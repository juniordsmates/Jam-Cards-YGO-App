import { categoryOf, type Card } from "./types";
import { t } from "../i18n";

// Leitura estruturada do texto da carta, baseada na pontuação padrão da Konami (PSCT):
//   "Condição: Custo/Alvo; Efeito."
// A estrutura é lida no texto em inglês; o texto em português (mesma pontuação)
// é usado para exibição quando as frases batem uma a uma.

export type EffectKind =
  | "materiais"
  | "invocacao"
  | "rapido"
  | "gatilho"
  | "ignicao"
  | "continuo"
  | "ativacao"
  | "regra"
  | "restricao"
  | "ambientacao";

export const EFFECT_KIND_LABELS: Record<EffectKind, string> = {
  materiais: t("Materiais"),
  invocacao: t("Condição de invocação"),
  rapido: t("Efeito Rápido"),
  gatilho: t("Gatilho"),
  ignicao: t("Ignição"),
  continuo: t("Contínuo"),
  ativacao: t("Ativação"),
  regra: t("Regra"),
  restricao: t("Restrição"),
  ambientacao: t("Ambientação"),
};

export type Zone = "Mão" | "Campo" | "Cemitério" | "Banido" | "Zona de Pêndulo";

export interface ParsedEffect {
  kind: EffectKind;
  /** parte da carta Pêndulo a que o efeito pertence */
  section?: "Pêndulo" | "Monstro";
  /** frase completa exibida (pt quando disponível) */
  text: string;
  /** antes do ":" */
  condition?: string;
  /** entre ":" e ";" — custo e/ou alvo */
  costTarget?: string;
  hasCost?: boolean;
  hasTarget?: boolean;
  /** o que acontece (depois do ";", ou do ":" quando não há ";") */
  resolution?: string;
  /** "você pode" (opcional) x obrigatório; só para efeitos ativados */
  optional?: boolean;
  zone?: Zone;
  /** limite por turno: soft ("Uma vez por turno") ou hard ("Você só pode usar…") */
  opt?: "soft" | "hard";
  duration?: string;
  /** itens "●" (listas de opções) */
  bullets?: string[];
}

export interface CardReading {
  effects: ParsedEffect[];
  /** nomes entre aspas citados no texto (exceto a própria carta), em inglês */
  references: string[];
  /** true quando o texto exibido está em português */
  translated: boolean;
  /** número de trechos do texto em português (quando há tradução) */
  ptSegments?: number;
}

const ACTIVATED: EffectKind[] = ["rapido", "gatilho", "ignicao", "ativacao"];
const EXTRA_DECK = /^(fusion|synchro|xyz|link)/;

const DURATIONS: [RegExp, string][] = [
  [/until the end of (the|your) next turn|until the end of your opponent's next turn/i, t("Até o fim do próximo turno")],
  [/until the end of (this|the) turn/i, t("Até o fim do turno")],
  [/for the rest of (this|the) turn/i, t("Pelo resto do turno")],
  [/until the end phase/i, t("Até a End Phase")],
  [/until the end of the (battle phase|damage step)/i, t("Até o fim da fase de batalha")],
];

/** Divide em frases sem quebrar nomes entre aspas que contenham ponto ("A.I. …") */
function sentences(text: string): string[] {
  const quoted: string[] = [];
  const masked = text.replace(/"[^"]*"/g, (m) => `\u0000${quoted.push(m) - 1}\u0000`);
  return masked
    .split(/(?<=\.)\s+/)
    .map((s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => quoted[Number(i)]).trim())
    .filter(Boolean);
}

/** Separa "condição: custo/alvo; efeito" ignorando ":" e ";" dentro de aspas */
function splitPsct(s: string) {
  let depth = false;
  let colon = -1;
  let semi = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') depth = !depth;
    else if (!depth && ch === ":" && colon < 0 && semi < 0) colon = i;
    else if (!depth && ch === ";" && semi < 0) semi = i;
  }
  const condition = colon >= 0 ? s.slice(0, colon).trim() : undefined;
  const afterColon = colon >= 0 ? colon + 1 : 0;
  const costTarget = semi >= 0 ? s.slice(afterColon, semi).trim() : undefined;
  const resolution = (semi >= 0 ? s.slice(semi + 1) : s.slice(afterColon)).trim();
  return { condition, costTarget, resolution, activated: colon >= 0 || semi >= 0 };
}

/** Uma "linha lógica": frase normal ou lista de "●" pendurada na frase anterior */
interface Unit {
  text: string;
  bullets: string[];
  section?: ParsedEffect["section"];
  materials?: boolean;
  /** parte de uma lista "●" de efeitos (não de opções) */
  listOfEffects?: boolean;
}

function units(desc: string, card: Card): Unit[] {
  const out: Unit[] = [];
  const text = desc.replace(/\r\n?/g, "\n").trim();

  // Cartas Pêndulo: "[ Pendulum Effect ] … [ Monster Effect ]" (cabeçalhos sempre em inglês)
  const parts: { section?: Unit["section"]; body: string }[] = [];
  const pend = text.match(/\[\s*Pendulum Effect\s*\]([\s\S]*?)(?:-{5,}|\n\s*\n)?\s*\[\s*(Monster Effect|Flavor Text)\s*\]([\s\S]*)/i);
  if (pend) {
    parts.push({ section: "Pêndulo", body: pend[1].trim() });
    parts.push({ section: "Monstro", body: pend[3].trim() });
  } else {
    parts.push({ body: text });
  }

  for (const { section, body } of parts) {
    let lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    // Monstros do Deck Adicional: a primeira linha lista os materiais
    // (algumas cartas vêm da API com "materiais / efeitos" na mesma linha)
    if (EXTRA_DECK.test(card.frame) && section !== "Pêndulo" && lines.length && / \/ /.test(lines[0])) {
      const [materials, ...rest] = lines[0].split(" / ");
      lines = [materials, rest.join(" / "), ...lines.slice(1)];
    }
    if (EXTRA_DECK.test(card.frame) && section !== "Pêndulo" && lines.length > 1) {
      out.push({ text: lines[0], bullets: [], section, materials: true });
      lines = lines.slice(1);
    }
    for (const line of lines) {
      const last = out[out.length - 1];
      if (line.startsWith("●") && last) {
        const item = line.replace(/^●\s*/, "");
        // "You can only use each (of the following) effect(s)…" seguida dos efeitos em "●": cada item é
        // um efeito próprio. Depois de qualquer outra frase ("activate 1 of the following effects;"),
        // os itens são opções do efeito anterior.
        const isEffectList = last.listOfEffects || (/^(you can only|você só pode)/i.test(last.text) && !last.bullets.length);
        if (isEffectList) {
          for (const s of sentences(item)) out.push({ text: s, bullets: [], section, listOfEffects: true });
        } else {
          last.bullets.push(item);
        }
      } else {
        for (const s of sentences(line)) out.push({ text: s, bullets: [], section });
      }
    }
  }
  return out;
}

function classify(u: Unit, card: Card): ParsedEffect {
  const s = u.text;
  const base = { text: s, section: u.section, bullets: u.bullets.length ? u.bullets : undefined };
  if (u.materials) return { ...base, kind: "materiais" };
  if (card.frame === "normal" || (card.frame === "normal_pendulum" && u.section !== "Pêndulo")) {
    return { ...base, kind: "ambientacao" };
  }
  if (/^you can only (use|activate)\b/i.test(s)) return { ...base, kind: "restricao" };
  if (/^(cannot be (normal|special) summoned|must (first )?be|can only be special summoned)/i.test(s) ||
      /special summon this card \(from your (hand|gy|graveyard)\)/i.test(s)) {
    return { ...base, kind: "invocacao" };
  }
  if (/activate this card from your hand|you can activate this card|this card's activation cannot|cannot be activated/i.test(s) &&
      categoryOf(card) !== "monster") {
    return { ...base, kind: "regra" };
  }

  const p = splitPsct(s);
  const cat = categoryOf(card);
  const spellTrap = cat === "spell" || cat === "trap";
  const head = `${p.condition ?? ""} ${p.costTarget ?? ""}`;
  const thisInGy = /this card (is )?in your (gy|graveyard)|this card from your (gy|graveyard)|banish this card from your (gy|graveyard)/i.test(head);

  // "You cannot Summon… the turn you activate this card": restrição a quem usa, não outra ativação
  if (!p.activated && spellTrap && /^(you cannot|you can only|neither player can)\b/i.test(s)) {
    return { ...base, kind: "regra", resolution: s, duration: duration(s) };
  }

  if (!p.activated) {
    // Magias/Armadilhas de uso único sem ":"/";" ("Compre 2 cards.") são a própria ativação
    const lasting = /^(continuous|field|equip)$/i.test(card.race);
    const kind = spellTrap && !lasting && u.section !== "Pêndulo" ? "ativacao" : "continuo";
    return { ...base, kind, resolution: s, duration: duration(s) };
  }

  let kind: EffectKind;
  if (spellTrap && !thisInGy) kind = "ativacao";
  else if (/\(quick effect\)/i.test(head)) kind = "rapido";
  else if (/^(once per (turn|chain)[^:]*,\s*)?(if|when)\b/i.test(p.condition ?? "") &&
           !/^(once per turn, )?if (this card is in|you control|your opponent controls|you have|there (is|are)|only)/i.test(p.condition ?? "")) {
    kind = "gatilho";
  } else kind = "ignicao";

  const ct = p.costTarget ?? "";
  const hasTarget = /\btarget\b/i.test(ct);
  const withoutTarget = ct.replace(/(,? then )?(you can )?target\b.*$/i, "").replace(/^you can\s*/i, "").trim();
  const hasCost = withoutTarget.length > 0;

  let zone: Zone | undefined;
  if (u.section === "Pêndulo") zone = "Zona de Pêndulo";
  else if (/(discard|reveal) this card|this card (from|in) your hand|if this card is in your hand/i.test(head)) zone = "Mão";
  else if (thisInGy) zone = "Cemitério";
  else if (/this card is banished|this banished card/i.test(head)) zone = "Banido";
  // "…; Special Summon this card from your hand/GY": a pista de onde está vem no efeito
  else if (/special summon this card from your hand/i.test(p.resolution)) zone = "Mão";
  else if (/special summon this card from your (gy|graveyard)|add this card from your (gy|graveyard)/i.test(p.resolution)) zone = "Cemitério";
  else if (!spellTrap) zone = "Campo";

  return {
    ...base,
    kind,
    condition: cleanCondition(p.condition),
    costTarget: p.costTarget || undefined,
    hasCost,
    hasTarget,
    resolution: p.resolution,
    optional: kind === "ativacao" ? undefined : /\byou can\b/i.test(head) || /^you can\b/i.test(p.resolution),
    zone,
    opt: /\bonce per (turn|chain)\b/i.test(p.condition ?? "") ? "soft" : undefined,
    duration: duration(p.resolution),
  };
}

/** Tira "(Quick Effect)"/"(Efeito Rápido)" da condição: o selo do tipo já informa */
function cleanCondition(condition?: string) {
  const c = condition?.replace(/\s*\((quick effect|efeito rápido)\)\s*/gi, " ").trim().replace(/,$/, "");
  return c || undefined;
}

function duration(text: string) {
  return DURATIONS.find(([re]) => re.test(text))?.[1];
}

/** Aplica as frases "You can only use … once per turn" aos efeitos a que se referem */
function applyHardOpt(effects: ParsedEffect[]) {
  effects.forEach((e, i) => {
    if (e.kind !== "restricao") return;
    const s = e.text.toLowerCase();
    const activatedBefore = effects
      .slice(0, i)
      .map((x, j) => ({ x, j }))
      .filter(({ x }) => ACTIVATED.includes(x.kind) && x.section === e.section);
    let affected: ParsedEffect[] = [];
    if (/(each|1) of the following effects/.test(s)) {
      affected = effects.slice(i + 1).filter((x) => ACTIVATED.includes(x.kind) && x.section === e.section);
    } else if (/each (of the preceding|of its|pendulum|monster)? ?effects?|1 .* effect per turn|each effect/.test(s)) {
      affected = effects.filter((x) => ACTIVATED.includes(x.kind) && x.section === e.section);
    } else if (/(this|the previous|that|the preceding) effect/.test(s)) {
      affected = activatedBefore.slice(-1).map(({ x }) => x);
    } else {
      const nth = s.match(/the (1st|first|2nd|second|3rd|third)/);
      if (nth) {
        const idx = { "1st": 0, first: 0, "2nd": 1, second: 1, "3rd": 2, third: 2 }[nth[1]]!;
        const list = effects.filter((x) => ACTIVATED.includes(x.kind) && x.section === e.section);
        if (list[idx]) affected = [list[idx]];
      }
    }
    // Sem indicação de qual ("the effect of…", "each of these effects", "activate … once per turn"):
    // vale para todos os efeitos ativados desta parte da carta
    if (!affected.length && /per turn/.test(s)) {
      affected = effects.filter((x) => ACTIVATED.includes(x.kind) && x.section === e.section);
    }
    affected.forEach((x) => (x.opt = "hard"));
  });
}

/** Lê o texto da carta e devolve os efeitos estruturados (preferPt: exibir em português) */
export function readCard(card: Card, preferPt = true): CardReading {
  const enUnits = units(card.desc, card);
  const effects = enUnits.map((u) => classify(u, card));
  applyHardOpt(effects);

  // Usa o texto em português quando as frases batem uma a uma com o inglês
  let translated = false;
  let ptSegments: number | undefined;
  if (preferPt && card.descPt) {
    const ptUnits = units(card.descPt, card);
    ptSegments = ptUnits.length;
    if (ptUnits.length === enUnits.length) {
      translated = true;
      ptUnits.forEach((u, i) => {
        const e = effects[i];
        e.text = u.text;
        if (u.bullets.length) e.bullets = u.bullets;
        if (e.condition !== undefined || e.costTarget !== undefined || e.resolution !== undefined) {
          const p = splitPsct(u.text);
          if (e.condition !== undefined) e.condition = cleanCondition(p.condition);
          if (e.costTarget !== undefined) e.costTarget = p.costTarget;
          e.resolution = p.resolution;
        }
      });
    }
  }

  // Ajustes manuais da revisão (correcoes/cartas.json), numerados a partir de 1 como na exibição
  for (const [n, o] of Object.entries(card.effectOverrides ?? {})) {
    const e = effects[Number(n) - 1];
    if (!e) continue;
    if (o.tipo) e.kind = o.tipo as EffectKind;
    if (o.local) e.zone = o.local as Zone;
    if (o.opcional !== undefined) e.optional = o.opcional;
    if (o.limite !== undefined) e.opt = o.limite ?? undefined;
  }

  const references = [...new Set([...card.desc.matchAll(/"([^"]+)"/g)].map((m) => m[1]))].filter(
    (name) => name !== card.name,
  );

  return { effects, references, translated, ptSegments };
}

export const isActivated = (e: ParsedEffect) => ACTIVATED.includes(e.kind);
