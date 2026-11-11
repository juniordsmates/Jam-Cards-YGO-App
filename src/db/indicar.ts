import { REGRAS, REGRA_POR_NOME } from "../data/interrupcoes";
import { isActivated, readCard, type ParsedEffect } from "./effects";
import { RESPOSTAS } from "../data/respostas";
import { analisar, outroLado, type Analise, type Evento, type Indicacao, type Regra, type Situacao } from "./indicacoes";
import { usoEmTorneio, type IndiceRespostas } from "./respostas";
import { categoryOf, type Card } from "./types";
import { t as tr } from "../i18n";

// Indicações de resposta do Teste Avançado: para cada ação, o que o outro lado pode fazer.
//   1. "Na mão/campo do oponente": as cartas que ele tem de verdade (pelas regras ou pelo texto)
//   2. "Podem responder": interrupções conhecidas (regras) e as confirmadas pelo motor de regras
//      nas linhas calculadas, legais no formato, das mais usadas em torneios
//   3. "Outras usadas em torneios": cartas ativáveis da mão (scripts oficiais) fora das regras

export interface CartaDoLado {
  id: number;
  card?: Card;
  onde: "mao" | "campo" | "baixada";
}

export type Fonte = "regra" | "motor" | "texto" | "scripts";

export interface ItemIndicacao extends Indicacao {
  id: number;
  card?: Card;
  /** fração dos decklists de torneio com a carta (0 a 1) */
  uso: number;
  /** em quantas linhas calculadas o motor confirmou esta resposta para esta carta */
  motor?: number;
  fonte: Fonte;
  tipo?: Regra["tipo"];
  /** onde o respondente tem a carta (só em "noJogo") */
  onde?: CartaDoLado["onde"];
}

export interface ResultadoIndicacoes {
  evento: Evento;
  analise: Analise;
  noJogo: ItemIndicacao[];
  gerais: ItemIndicacao[];
  outras: ItemIndicacao[];
}

export interface ContextoIndicacoes {
  byName: Map<string, Card>;
  byId: Map<number, Card>;
  uso?: { decks: number; cartas: Record<string, number> };
  respondedores?: Record<string, string[]>;
  indice?: IndiceRespostas | null;
  /** a carta pode ser usada no formato (banlist) */
  legal: (c: Card) => boolean;
}

/** Tipos de resposta (scripts) que interrompem alguma coisa */
const INTERROMPE = new Set(["nega-ativacao", "nega-efeito", "destroi", "bane", "devolve", "controle"]);
/** Carta de torneio em pelo menos 3% dos decklists */
const USO_OUTRAS = 0.03;

const usoDe = (ctx: ContextoIndicacoes, id: number) => usoEmTorneio(ctx.uso, id);
const ordem = (a: ItemIndicacao, b: ItemIndicacao) => Number(!!a.impedida) - Number(!!b.impedida) || b.uso - a.uso || (b.motor ?? 0) - (a.motor ?? 0);

/** A regra vale para a carta onde o respondente (lado) a tem? */
function lugarDaRegra(r: Regra, onde: CartaDoLado["onde"], s: Situacao, lado: Evento["lado"]): string | undefined {
  if (r.origem === "campo") return onde === "campo" ? undefined : tr("precisa estar virada para cima no campo");
  if (r.origem === "mao") return onde === "mao" ? undefined : tr("funciona da mão");
  if (r.origem === "baixada") return onde === "baixada" ? undefined : tr("precisa estar baixada no campo");
  // mão ou baixada: Magia Rápida da mão só no próprio turno
  if (onde === "campo") return tr("precisa estar na mão ou baixada");
  if (r.tipo === "magia-rapida" && onde === "mao" && s.turno !== lado) return tr("Magia Rápida: no turno do oponente, só baixada");
  return undefined;
}

export function indicar(ev: Evento, s: Situacao, respondente: CartaDoLado[], ctx: ContextoIndicacoes, analiseFeita?: Analise): ResultadoIndicacoes {
  const analise = analiseFeita ?? analisar(ev);
  // confirmadas pelo motor de regras para esta carta (ativação ou Invocação)
  const doMotor = ctx.indice
    ? ev.tipo === "ativa"
      ? ctx.indice.aoAtivar.get(ev.id)
      : ev.tipo === "normal" || ev.tipo === "invoca"
        ? ctx.indice.aoInvocar.get(ev.id)
        : undefined
    : undefined;

  // 1. cartas que o respondente tem
  const noJogo: ItemIndicacao[] = [];
  const vistas = new Set<string>();
  for (const c of respondente) {
    if (!c.card || vistas.has(`${c.id}:${c.onde}`)) continue;
    vistas.add(`${c.id}:${c.onde}`);
    const base = { id: c.id, card: c.card, uso: usoDe(ctx, c.id), onde: c.onde, motor: doMotor?.get(c.id) };
    const regra = REGRA_POR_NOME.get(c.card.name);
    if (regra) {
      const ind = regra.quando(ev, analise, s);
      if (!ind) continue;
      const fora = lugarDaRegra(regra, c.onde, s, outroLado(ev.lado));
      noJogo.push({ ...base, ...ind, impedida: ind.impedida ?? fora, fonte: "regra", tipo: regra.tipo });
      continue;
    }
    if (base.motor) {
      noJogo.push({ ...base, motivo: tr("o motor de regras confirmou esta resposta em {0} {1}", [base.motor, base.motor === 1 ? tr("linha") : tr("linhas")]), fonte: "motor" });
      continue;
    }
    // sem regra: pelo texto e pelos scripts (o jogador confere)
    const tipos = ctx.respondedores?.[c.id];
    if (c.onde === "mao" && tipos?.some((t) => INTERROMPE.has(t))) {
      noJogo.push({ ...base, motivo: RESPOSTAS[c.card.name] ?? tr("ativável da mão no turno do oponente"), condicao: tr("confira se responde a esta ação"), fonte: "scripts" });
    } else if (c.onde === "baixada" && (categoryOf(c.card) === "trap" || c.card.race === "Quick-Play")) {
      noJogo.push({ ...base, motivo: tr("carta baixada: pode ser ativada em resposta"), condicao: tr("confira o texto"), fonte: "texto" });
    } else if (c.onde === "campo" && c.card.tags?.includes("quick-effect") && c.card.tags.some((t) => ["negacao", "destroi", "bane", "devolve"].includes(t))) {
      noJogo.push({ ...base, motivo: tr("efeito rápido no campo que nega ou remove cartas"), condicao: tr("confira o texto"), fonte: "texto" });
    }
  }
  noJogo.sort(ordem);

  // 2. interrupções conhecidas e as do motor (independente de quem tem)
  const gerais = new Map<number, ItemIndicacao>();
  for (const r of REGRAS) {
    const card = ctx.byName.get(r.nome);
    if (!card || !ctx.legal(card)) continue;
    const ind = r.quando(ev, analise, s);
    if (ind) gerais.set(card.id, { id: card.id, card, uso: usoDe(ctx, card.id), motor: doMotor?.get(card.id), ...ind, fonte: "regra", tipo: r.tipo });
  }
  for (const [id, n] of doMotor ?? []) {
    const card = ctx.byId.get(id);
    if (!card || !ctx.legal(card)) continue;
    const ja = gerais.get(id);
    if (ja) ja.motor = n;
    else
      gerais.set(id, {
        id,
        card,
        uso: usoDe(ctx, id),
        motor: n,
        motivo: tr("{0} (o motor de regras confirmou em {1} {2})", [RESPOSTAS[card.name] ?? tr("responde aqui"), n, n === 1 ? tr("linha") : tr("linhas")]),
        fonte: "motor",
      });
  }

  // 3. outras cartas de mão usadas em torneios (só ativações): ficam como "confira"
  const outras: ItemIndicacao[] = [];
  if (ev.tipo === "ativa" && ctx.respondedores) {
    for (const [k, tipos] of Object.entries(ctx.respondedores)) {
      const id = Number(k);
      if (gerais.has(id) || !tipos.some((t) => INTERROMPE.has(t))) continue;
      const uso = usoDe(ctx, id);
      const card = ctx.byId.get(id);
      if (uso < USO_OUTRAS || !card || REGRA_POR_NOME.has(card.name) || !ctx.legal(card)) continue;
      outras.push({ id, card, uso, motivo: RESPOSTAS[card.name] ?? tr("ativável da mão no turno do oponente"), condicao: tr("confira se responde a esta ação"), fonte: "scripts" });
    }
    outras.sort(ordem);
  }

  return { evento: ev, analise, noJogo, gerais: [...gerais.values()].sort(ordem), outras: outras.slice(0, 5) };
}

// ---------------------------------------------------------------- respostas a uma carta (Buscar Carta)

/** Um grupo de respostas: a um efeito da carta, à Invocação dela ou a ela parada no campo */
export interface RespostasAoEfeito {
  /** "efeito", "ativacao" (a carta de Magia/Armadilha), "invocacao" ou "campo" */
  tipo: "efeito" | "ativacao" | "invocacao" | "campo";
  /** número do efeito (1, 2…), na ordem do texto */
  numero?: number;
  efeito?: ParsedEffect;
  itens: ItemIndicacao[];
}

/** Cartas que quebram campos (não respondem a uma ação): valem contra a carta parada no campo */
const CONTRA_MONSTRO = ["Dark Ruler No More", "Raigeki", "Lightning Storm", "Forbidden Droplet", "Book of Moon"];
const CONTRA_MAGIA_ARMADILHA = ["Harpie's Feather Duster", "Lightning Storm", "Cosmic Cyclone", "Typhoon", "Twin Twisters", "Mystical Space Typhoon"];

/**
 * Para a tela Buscar Carta: o que pode responder a cada efeito ativado da carta, à Invocação dela e
 * o que costuma ser usado contra ela no campo. Mesmas regras das Indicações de resposta do Teste
 * Avançado e as linhas do motor; das mais usadas em torneios.
 */
export function respostasDaCarta(card: Card, ctx: ContextoIndicacoes): RespostasAoEfeito[] {
  const out: RespostasAoEfeito[] = [];
  const cat = categoryOf(card);
  const monstro = cat === "monster";
  const doExtra = /^(fusion|synchro|xyz|link)/.test(card.frame);
  const vazio = { cartas: 0, monstros: 0, magias: 0, monstrosEfeito: 0 };
  // quem joga a carta está no próprio turno, com campo; quem responde, com o campo vazio
  const s: Situacao = {
    fase: "M1",
    turno: "op",
    invocacoes: 3,
    especiais: 2,
    // Dominus Spark depende do que já aconteceu no turno: não entra como resposta a uma carta solta
    ativouMaoOuGY: false,
    agente: { cartas: 3, monstros: 2, magias: 1, monstrosEfeito: 2 },
    respondente: { ...vazio, cemiterio: 0 },
  };
  const base = { lado: "op" as const, id: card.id, card };
  const lugar = (e: ParsedEffect): Evento["de"] =>
    !monstro ? (e.zone === "Cemitério" ? "cemiterio" : cat === "trap" ? "magia" : "mao")
      : e.zone === "Mão" ? "mao" : e.zone === "Cemitério" ? "cemiterio" : e.zone === "Banido" ? "banido" : e.zone === "Zona de Pêndulo" ? "magia" : "campo";
  const itensDe = (r: ResultadoIndicacoes) => [...r.gerais.filter((i) => !i.impedida), ...r.outras];

  const efeitos = readCard(card, false).effects;
  // linhas de regra que o leitor marca como efeito ("You can activate up to 2 … per turn")
  const soRegra = (e: ParsedEffect) => /^you can (only )?activate (up to )?(\d+|1|one|two)\b|once per turn\.?$/i.test((e.resolution ?? e.text).trim());
  // Magia/Armadilha sem efeito de ativação (ex.: Magia de Campo só contínua): a ativação da carta
  if (!monstro && !efeitos.some((e) => isActivated(e) && e.zone !== "Cemitério" && !soRegra(e))) {
    const ev: Evento = { ...base, tipo: "ativa", de: cat === "trap" ? "magia" : "mao", cartaAtivada: true };
    out.push({ tipo: "ativacao", itens: itensDe(indicar(ev, s, [], ctx, analisar(ev, []))) });
  }
  efeitos.forEach((e, i) => {
    if (!isActivated(e) || soRegra(e)) return;
    const ev: Evento = { ...base, tipo: "ativa", de: lugar(e), cartaAtivada: !monstro && e.zone !== "Cemitério" };
    const itens = itensDe(indicar(ev, s, [], ctx, analisar(ev, [e])));
    out.push({ tipo: "efeito", numero: i + 1, efeito: e, itens });
  });
  if (monstro && card.frame !== "token") {
    const ev: Evento = { ...base, tipo: "invoca", de: doExtra ? "extra" : "mao", metodo: doExtra ? metodoDoFrame(card.frame) : undefined };
    out.push({ tipo: "invocacao", itens: itensDe(indicar(ev, s, [], ctx)) });
  }
  // parada no campo: efeito de Magia/Armadilha já virada, e as cartas que quebram campo
  const fica = monstro || ["Continuous", "Field", "Equip"].includes(card.race);
  if (fica) {
    const itens: ItemIndicacao[] = [];
    if (!monstro) itens.push(...itensDe(indicar({ ...base, tipo: "ativa", de: card.race === "Field" ? "campo-magia" : "magia" }, s, [], ctx)));
    for (const nome of monstro ? CONTRA_MONSTRO : CONTRA_MAGIA_ARMADILHA) {
      const c = ctx.byName.get(nome);
      if (!c || !ctx.legal(c) || itens.some((x) => x.id === c.id)) continue;
      itens.push({ id: c.id, card: c, uso: usoDe(ctx, c.id), motivo: RESPOSTAS_CAMPO[nome], fonte: "regra" });
    }
    itens.sort((a, b) => b.uso - a.uso);
    out.push({ tipo: "campo", itens });
  }
  return out.filter((g) => g.itens.length);
}

const metodoDoFrame = (frame: string) =>
  frame.startsWith("xyz") ? ("xyz" as const) : frame.startsWith("link") ? ("link" as const) : frame.startsWith("synchro") ? ("sincro" as const) : ("fusao" as const);

const RESPOSTAS_CAMPO: Record<string, string> = {
  "Dark Ruler No More": tr("nega os efeitos de todos os monstros do oponente no turno"),
  Raigeki: tr("destrói todos os monstros do oponente"),
  "Lightning Storm": tr("sem cartas viradas para cima: destrói os monstros em ataque ou as Magias/Armadilhas do oponente"),
  "Forbidden Droplet": tr("nega os efeitos e corta o ATK pela metade de monstros do oponente"),
  "Book of Moon": tr("vira um monstro para baixo"),
  "Harpie's Feather Duster": tr("destrói todas as Magias/Armadilhas do oponente"),
  "Cosmic Cyclone": tr("bane uma Magia/Armadilha (1000 PV)"),
  Typhoon: tr("destrói uma Magia/Armadilha virada para cima (da mão, se o oponente tiver 2+ e você nenhuma)"),
  "Twin Twisters": tr("descarta 1 e destrói até 2 Magias/Armadilhas"),
  "Mystical Space Typhoon": tr("destrói uma Magia/Armadilha"),
};
