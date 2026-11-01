import { useCardDb } from "./cardStore";
import { displayName, type Card } from "./types";
import { RESPOSTAS } from "../data/respostas";
import { respostasDaLinha, uniqueLines, type CombosCalculados } from "./motor";
import { t, LOCALE } from "../i18n";

// Ordem e classificação das respostas (cartas que o oponente pode ativar):
//   1. mais usadas em torneios (decklists recentes da YGOPRODeck), da mais usada para a menos
//   2. hand trap e staple    3. hand trap    4. staple    5. todas as outras
// No combo, cada passo mostra até 5; no painel da carta, até 15; o "+" abre a lista completa.

export type Classe = "torneio" | "ht-staple" | "hand-trap" | "staple" | "outras";

export const CLASSES: { id: Classe; label: string }[] = [
  { id: "torneio", label: t("Mais usadas em torneios") },
  { id: "ht-staple", label: t("Hand trap e staple") },
  { id: "hand-trap", label: t("Hand trap") },
  { id: "staple", label: t("Staple") },
  { id: "outras", label: t("Outras") },
];

export const TIPOS: Record<string, string> = {
  "nega-ativacao": t("Nega a ativação"),
  "nega-efeito": t("Nega o efeito"),
  destroi: t("Destrói"),
  bane: t("Bane"),
  devolve: t("Devolve"),
  compra: t("Compra cartas"),
  envia: t("Envia ao Cemitério"),
  invoca: t("Invoca"),
  controle: t("Toma o controle"),
  outros: t("Outros"),
};

/** Carta em pelo menos 1% dos decklists de torneio conta como "mais usada" */
const USO_MINIMO = 0.01;

export interface Resposta {
  id: number;
  card?: Card;
  classe: Classe;
  /** fração dos decklists de torneio com a carta (0 a 1) */
  uso: number;
  tipos: string[];
  /** o que a carta faz, quando conhecido */
  descricao?: string;
}

export interface ContextoRespostas {
  byId: Map<number, Card>;
  uso?: { decks: number; cartas: Record<string, number> };
  respondedores?: Record<string, string[]>;
}

const ORDEM: Record<Classe, number> = { torneio: 0, "ht-staple": 1, "hand-trap": 2, staple: 3, outras: 4 };

export function resposta(id: number, ctx: ContextoRespostas): Resposta {
  const card = ctx.byId.get(id);
  const uso = ctx.uso ? (ctx.uso.cartas[id] ?? 0) / ctx.uso.decks : 0;
  const ht = !!card?.tags?.includes("hand-trap");
  const st = !!card?.staple;
  const classe: Classe = uso >= USO_MINIMO ? "torneio" : ht && st ? "ht-staple" : ht ? "hand-trap" : st ? "staple" : "outras";
  return { id, card, classe, uso, tipos: ctx.respondedores?.[id] ?? ["outros"], descricao: card ? RESPOSTAS[card.name] : undefined };
}

/** Ordem padrão: classe (1 a 5), depois uso em torneios, depois nome */
export function ordenarRespostas(ids: number[], ctx: ContextoRespostas): Resposta[] {
  return [...new Set(ids)]
    .map((id) => resposta(id, ctx))
    .sort(
      (a, b) =>
        ORDEM[a.classe] - ORDEM[b.classe] ||
        b.uso - a.uso ||
        (a.card ? displayName(a.card) : "").localeCompare(b.card ? displayName(b.card) : "", LOCALE),
    );
}

/** Contexto das respostas a partir da base carregada */
export function useContextoRespostas(byId: Map<number, Card>): ContextoRespostas {
  const extras = useCardDb().extras;
  return { byId, uso: extras?.uso, respondedores: extras?.respondedores };
}

// ---------------------------------------------------------------- índice do motor de regras

export type Contagem = Map<number, number>;

export interface IndiceRespostas {
  /** carta → quem pode responder quando ela ativa / é invocada (nº de linhas) */
  aoAtivar: Map<number, Contagem>;
  aoInvocar: Map<number, Contagem>;
  /** interrupção → cartas que ela pode responder (nº de linhas) */
  responde: Map<number, Contagem>;
}

let cache: { combos: CombosCalculados; indice: IndiceRespostas } | undefined;

/** Índice das respostas em todas as linhas calculadas (montado uma vez por camada) */
export function indiceDeRespostas(combos: CombosCalculados): IndiceRespostas {
  if (cache?.combos === combos) return cache.indice;
  const indice: IndiceRespostas = { aoAtivar: new Map(), aoInvocar: new Map(), responde: new Map() };
  const somar = (m: Map<number, Contagem>, a: number, b: number) => {
    const c = m.get(a) ?? new Map<number, number>();
    c.set(b, (c.get(b) ?? 0) + 1);
    m.set(a, c);
  };
  for (const l of uniqueLines(combos.linhas)) {
    const { porPasso } = respostasDaLinha(l);
    // cada par (carta, resposta) conta uma vez por linha
    const vistos = new Set<string>();
    for (const p of l.passos) {
      if (p.t !== "ativa" && p.t !== "normal" && p.t !== "invoca") continue;
      for (const r of porPasso(p)) {
        const key = `${p.t === "ativa" ? "a" : "i"}:${p.c}:${r}`;
        if (vistos.has(key)) continue;
        vistos.add(key);
        somar(p.t === "ativa" ? indice.aoAtivar : indice.aoInvocar, p.c, r);
        somar(indice.responde, r, p.c);
      }
    }
  }
  cache = { combos, indice };
  return indice;
}

