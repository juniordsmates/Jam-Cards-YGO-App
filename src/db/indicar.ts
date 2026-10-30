import { REGRAS, REGRA_POR_NOME } from "../data/interrupcoes";
import { RESPOSTAS } from "../data/respostas";
import { analisar, outroLado, type Analise, type Evento, type Indicacao, type Regra, type Situacao } from "./indicacoes";
import type { IndiceRespostas } from "./respostas";
import { categoryOf, type Card } from "./types";

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

const usoDe = (ctx: ContextoIndicacoes, id: number) => (ctx.uso ? (ctx.uso.cartas[id] ?? 0) / ctx.uso.decks : 0);
const ordem = (a: ItemIndicacao, b: ItemIndicacao) => Number(!!a.impedida) - Number(!!b.impedida) || b.uso - a.uso || (b.motor ?? 0) - (a.motor ?? 0);

/** A regra vale para a carta onde o respondente (lado) a tem? */
function lugarDaRegra(r: Regra, onde: CartaDoLado["onde"], s: Situacao, lado: Evento["lado"]): string | undefined {
  if (r.origem === "campo") return onde === "campo" ? undefined : "precisa estar virada para cima no campo";
  if (r.origem === "mao") return onde === "mao" ? undefined : "funciona da mão";
  if (r.origem === "baixada") return onde === "baixada" ? undefined : "precisa estar baixada no campo";
  // mão ou baixada: Magia Rápida da mão só no próprio turno
  if (onde === "campo") return "precisa estar na mão ou baixada";
  if (r.tipo === "magia-rapida" && onde === "mao" && s.turno !== lado) return "Magia Rápida: no turno do oponente, só baixada";
  return undefined;
}

export function indicar(ev: Evento, s: Situacao, respondente: CartaDoLado[], ctx: ContextoIndicacoes): ResultadoIndicacoes {
  const analise = analisar(ev);
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
      noJogo.push({ ...base, motivo: `o motor de regras confirmou esta resposta em ${base.motor} ${base.motor === 1 ? "linha" : "linhas"}`, fonte: "motor" });
      continue;
    }
    // sem regra: pelo texto e pelos scripts (o jogador confere)
    const tipos = ctx.respondedores?.[c.id];
    if (c.onde === "mao" && tipos?.some((t) => INTERROMPE.has(t))) {
      noJogo.push({ ...base, motivo: RESPOSTAS[c.card.name] ?? "ativável da mão no turno do oponente", condicao: "confira se responde a esta ação", fonte: "scripts" });
    } else if (c.onde === "baixada" && (categoryOf(c.card) === "trap" || c.card.race === "Quick-Play")) {
      noJogo.push({ ...base, motivo: "carta baixada: pode ser ativada em resposta", condicao: "confira o texto", fonte: "texto" });
    } else if (c.onde === "campo" && c.card.tags?.includes("quick-effect") && c.card.tags.some((t) => ["negacao", "destroi", "bane", "devolve"].includes(t))) {
      noJogo.push({ ...base, motivo: "efeito rápido no campo que nega ou remove cartas", condicao: "confira o texto", fonte: "texto" });
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
        motivo: `${RESPOSTAS[card.name] ?? "responde aqui"} (o motor de regras confirmou em ${n} ${n === 1 ? "linha" : "linhas"})`,
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
      outras.push({ id, card, uso, motivo: RESPOSTAS[card.name] ?? "ativável da mão no turno do oponente", condicao: "confira se responde a esta ação", fonte: "scripts" });
    }
    outras.sort(ordem);
  }

  return { evento: ev, analise, noJogo, gerais: [...gerais.values()].sort(ordem), outras: outras.slice(0, 5) };
}
