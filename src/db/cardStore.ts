import { useEffect, useState, useSyncExternalStore } from "react";
import { idbGet, idbSetMany } from "./idb";
import { buildCards, fetchAllCards, fetchDbVersion, fetchStapleIds } from "./ygoprodeck";
import { applyOverlay, fetchOverlay, type Overlay, type TagDefinition } from "./overlay";
import { archetypeNamesPt, buildRelations, type RelationIndex } from "./relations";
import type { Card } from "./types";

// Mude ao alterar o formato de Card para forçar um novo download
// v3: dados extras (formatos, datas…) e ids canônicos de cartas com artes alternativas
const CARDS_KEY = "cards-v3";
const META_KEY = "cards-meta-v3";
const OVERLAY_KEY = "overlay-v2";
// versões anteriores, apagadas ao salvar a nova
const OLD_KEYS = ["cards-v1", "cards-meta-v1", "cards-v2", "cards-meta-v2", "overlay-v1"];
const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

interface Meta {
  version: string;
  lastUpdate: string;
  checkedAt: number;
}

export interface CardDbState {
  status: "idle" | "loading" | "downloading" | "ready" | "error";
  /** etapa atual do download, para exibir ao usuário */
  step?: string;
  cards: Card[];
  meta?: Meta;
  /** definições das tags (da camada revisada, ou das regras locais) */
  tagDefs: TagDefinition[];
  /** data de geração da camada em uso; ausente = só regras locais */
  overlayDate?: string;
  /** dados extras da camada (arquétipos, metagame, Genesys, combos calculados); ausentes sem camada */
  extras?: Pick<Overlay, "arquetipos" | "meta" | "genesys" | "combos" | "uso" | "respondedores" | "metaTcg">;
  /** nomes oficiais dos arquétipos (da camada, ou os presentes nas cartas) */
  archetypes: string[];
  /** arquétipo em inglês → nome em português */
  archetypePt: Map<string, string>;
  /** atualização em segundo plano com a base atual ainda em uso */
  updating: boolean;
  error?: string;
}

let state: CardDbState = { status: "idle", cards: [], tagDefs: [], archetypes: [], archetypePt: new Map(), updating: false };
let overlay: Overlay | undefined;
const listeners = new Set<() => void>();

function set(patch: Partial<CardDbState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useCardDb = () => useSyncExternalStore(subscribe, () => state);

// Índice de relações entre cartas (~0,3 s), montado uma vez por base e compartilhado entre telas
let relationCache: { cards: Card[]; index: RelationIndex } | undefined;

/** Índice de relações; null enquanto é montado (logo depois de a tela aparecer, sem travá-la) */
export function useRelationIndex(): RelationIndex | null {
  const { cards, archetypes, status } = useCardDb();
  const cached = relationCache?.cards === cards ? relationCache.index : null;
  const [index, setIndex] = useState<RelationIndex | null>(cached);
  useEffect(() => {
    if (status !== "ready") return;
    if (relationCache?.cards === cards) {
      setIndex(relationCache.index);
      return;
    }
    setIndex(null);
    const t = window.setTimeout(() => {
      relationCache = { cards, index: buildRelations(cards, new Set(archetypes.map((a) => a.toLowerCase()))) };
      setIndex(relationCache.index);
    }, 300);
    return () => window.clearTimeout(t);
  }, [cards, archetypes, status]);
  return index;
}

/** Definição de uma tag pelo id (da camada revisada ou das regras locais) */
export const useTagLookup = () => {
  const defs = useCardDb().tagDefs;
  return (id: string) => defs.find((d) => d.id === id);
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Aplica a camada e publica as cartas (array novo, para a busca recalcular) */
function publish(cards: Card[], patch: Partial<CardDbState> = {}) {
  const tagDefs = applyOverlay(cards, overlay);
  const extras = overlay && { arquetipos: overlay.arquetipos ?? [], meta: overlay.meta, genesys: overlay.genesys ?? {}, combos: overlay.combos, uso: overlay.uso, respondedores: overlay.respondedores, metaTcg: overlay.metaTcg };
  const archetypes = extras?.arquetipos.length
    ? extras.arquetipos
    : [...new Set(cards.map((c) => c.archetype).filter(Boolean) as string[])].sort();
  const archetypePt = archetypeNamesPt(cards, new Set(archetypes.map((a) => a.toLowerCase())));
  for (const c of cards) c.archetypePt = c.archetype ? archetypePt.get(c.archetype) : undefined;
  set({ ...patch, cards: [...cards], tagDefs, overlayDate: overlay?.geradoEm, extras, archetypes, archetypePt });
}

/** Baixa a camada; se falhar, segue com a que já está salva (ou com as regras locais) */
async function refreshOverlay(): Promise<boolean> {
  try {
    const fresh = await fetchOverlay();
    if (fresh.geradoEm === overlay?.geradoEm) return false;
    overlay = fresh;
    await idbSetMany({ [OVERLAY_KEY]: fresh });
    return true;
  } catch (e) {
    console.warn("Camada de marcações indisponível:", errorMessage(e));
    return false;
  }
}

/** Carrega a base do disco ou, na primeira execução, baixa da API. Idempotente. */
export async function initCardDb() {
  if (state.status !== "idle" && state.status !== "error") return;
  set({ status: "loading", error: undefined });
  try {
    const [cards, meta, savedOverlay] = await Promise.all([
      idbGet<Card[]>(CARDS_KEY),
      idbGet<Meta>(META_KEY),
      idbGet<Overlay>(OVERLAY_KEY),
    ]);
    overlay = savedOverlay;
    if (cards?.length && meta) {
      publish(cards, { status: "ready", meta });
      // a base é conferida a cada 24 horas; a camada (marcações e combos calculados) a cada abertura
      if (Date.now() - meta.checkedAt > CHECK_INTERVAL) void checkForUpdate();
      else void refreshOverlay().then((changed) => changed && publish(state.cards));
    } else {
      await download(false);
    }
  } catch (e) {
    set({ status: "error", error: errorMessage(e), step: undefined });
  }
}

/** Atualiza a camada e consulta checkDBVer.php; só baixa a base de novo se a versão mudou */
export async function checkForUpdate(force = false) {
  if (state.status !== "ready" || state.updating) return;
  set({ updating: true });
  try {
    const overlayChanged = await refreshOverlay();
    const remote = await fetchDbVersion();
    if (force || remote.version !== state.meta?.version) {
      await download(true);
    } else {
      const meta = { ...state.meta!, checkedAt: Date.now() };
      await idbSetMany({ [META_KEY]: meta });
      if (overlayChanged) publish(state.cards, { meta, updating: false });
      else set({ meta, updating: false });
    }
  } catch (e) {
    // mantém a base atual; o erro aparece só como aviso
    set({ updating: false, error: errorMessage(e) });
  }
}

async function download(background: boolean) {
  const step = (s: string) => set(background ? { step: s } : { status: "downloading", step: s });

  step("Verificando versão da base…");
  const version = await fetchDbVersion();
  step("Baixando cartas…");
  const en = await fetchAllCards();
  step("Baixando traduções em português…");
  const pt = await fetchAllCards("pt");
  step("Baixando lista de staples…");
  const staples = new Set(await fetchStapleIds());
  step("Baixando marcações revisadas…");
  if (!background) await refreshOverlay();
  step("Organizando cartas…");
  const cards = buildCards(en, pt);
  for (const card of cards) if (staples.has(card.id)) card.staple = true;
  const meta: Meta = { ...version, checkedAt: Date.now() };
  step("Salvando no dispositivo…");
  await idbSetMany({ [CARDS_KEY]: cards, [META_KEY]: meta }, OLD_KEYS);

  publish(cards, { status: "ready", meta, updating: false, step: undefined, error: undefined });
}
