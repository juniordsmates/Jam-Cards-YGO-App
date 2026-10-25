import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardTile from "../components/CardTile";
import CardDetail from "../components/CardDetail";
import CardPreview from "../components/CardPreview";
import SearchFilters from "../components/SearchFilters";
import ActiveFilters from "../components/ActiveFilters";
import { SearchIcon } from "../icons";
import { checkForUpdate, initCardDb, useCardDb, useRelationIndex } from "../db/cardStore";
import { EMPTY_FILTERS, searchCards, type Filters, type SortKey } from "../db/search";
import type { Card } from "../db/types";
import "./card-search.css";

const PAGE = 60;

const SORTS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevância" },
  { value: "name", label: "Nome" },
  { value: "atk", label: "Maior ATK" },
  { value: "def", label: "Maior DEF" },
  { value: "level", label: "Maior nível" },
  { value: "new", label: "Mais recentes" },
  { value: "popular", label: "Mais populares" },
];

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** `onCombos`: abre a tela de combos (com a carta na mão, se vier do painel) */
export default function CardSearch({ onBack, onCombos }: { onBack: () => void; onCombos: (card?: Card) => void }) {
  const db = useCardDb();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Card | null>(null);
  // estado anterior (carta aberta + filtros da lista), para o botão Voltar do painel
  const [history, setHistory] = useState<{ card: Card; filters: Filters; pinned: Card | null }[]>([]);
  // carta aberta que não está na lista atual: fica fixada no início da grade, sem mexer nos filtros
  const [pinned, setPinned] = useState<Card | null>(null);
  // com o painel aberto, a coluna da esquerda alterna entre a carta e os filtros
  const [leftTab, setLeftTab] = useState<"carta" | "filtros">("carta");
  // carta a destacar e trazer à vista na grade
  const [focusId, setFocusId] = useState<number | null>(null);
  const deferred = useDeferredValue(filters);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ready = db.status === "ready";
  const results = useMemo(
    () => (ready ? searchCards(db.cards, deferred, db.archetypePt) : []),
    [ready, db.cards, deferred, db.archetypePt],
  );
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);
  const findCard = useCallback((name: string) => byName.get(name), [byName]);
  const archetypes = db.archetypes;
  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);

  const relations = useRelationIndex();
  const archetypeSet = useMemo(() => new Set(archetypes.map((a) => a.toLowerCase())), [archetypes]);
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of db.cards) for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts;
  }, [db.cards]);
  const formats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of db.cards) for (const f of c.formats ?? []) counts.set(f, (counts.get(f) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  }, [db.cards]);

  useEffect(() => void initCardDb(), []);
  useEffect(() => inputRef.current?.focus(), [ready]);

  // Nova busca: volta ao topo e à primeira página
  useEffect(() => {
    setLimit(PAGE);
    gridRef.current?.scrollTo({ top: 0 });
  }, [deferred]);

  // Rolagem infinita: carrega mais quando o fim da grade aparece. Recriar o observador
  // a cada página garante nova checagem mesmo se o fim continuar visível.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setLimit((l) => Math.min(l + PAGE, results.length)),
      { root: gridRef.current, rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready, results, limit]);

  const patch = useCallback((p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p })), []);
  const closeDetail = useCallback(() => {
    setSelected(null);
    setHistory([]);
    setFocusId(null);
    setPinned(null);
  }, []);

  // refs em vez de setState aninhado: o React pode repetir atualizadores no modo estrito
  const selectedRef = useRef<Card | null>(null);
  selectedRef.current = selected;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const historyRef = useRef(history);
  historyRef.current = history;
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const resultsRef = useRef(results);
  resultsRef.current = results;

  /** Guarda a carta aberta e a lista atual, para o Voltar desfazer o próximo passo */
  const remember = useCallback(() => {
    const current = selectedRef.current;
    if (current) setHistory((h) => [...h, { card: current, filters: filtersRef.current, pinned: pinnedRef.current }]);
  }, []);

  /** Muda a lista sem fechar o painel (Ver na busca, tag, arquétipo…) */
  const showInList = useCallback(
    (next: Filters | ((f: Filters) => Filters)) => {
      remember();
      setPinned(null);
      setFilters(next);
    },
    [remember],
  );

  /** Abre uma carta no painel e garante que ela apareça na lista */
  const openCard = useCallback(
    (card: Card, fromList = false) => {
      if (selectedRef.current?.id === card.id) return;
      remember();
      setSelected(card);
      setLeftTab("carta");
      setFocusId(card.id);
      // carta referenciada que não está na lista atual: aparece fixada no início da grade
      if (!fromList) setPinned(resultsRef.current.some((c) => c.id === card.id) ? null : card);
    },
    [remember],
  );

  const goBack = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setSelected(prev.card);
    setFilters(prev.filters);
    setPinned(prev.pinned);
    setFocusId(prev.card.id);
  }, []);

  // Popup de prévia: espera um pouco antes de abrir (evita piscar ao só passar o mouse);
  // com um popup já aberto, troca de carta quase na hora
  const [hover, setHover] = useState<{ card: Card; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const hoverOpen = useRef(false);
  hoverOpen.current = hover !== null;

  const onHover = useCallback((card: Card | null, el?: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (!card || !el) {
      // pequena tolerância para atravessar o espaço entre duas cartas sem fechar
      hoverTimer.current = window.setTimeout(() => setHover(null), 120);
      return;
    }
    hoverTimer.current = window.setTimeout(
      () => setHover({ card, rect: el.getBoundingClientRect() }),
      hoverOpen.current ? 60 : 350,
    );
  }, []);

  const hideHover = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    setHover(null);
  }, []);

  const select = useCallback(
    (card: Card) => {
      hideHover();
      openCard(card, true);
    },
    [hideHover, openCard],
  );

  // Traz a carta em foco à vista na grade (carregando mais páginas, se preciso)
  useEffect(() => {
    if (focusId === null) return;
    const index = results.findIndex((c) => c.id === focusId);
    if (index < 0) return;
    if (index >= limit) {
      setLimit(index + PAGE);
      return;
    }
    gridRef.current?.querySelector(`[data-card-id="${focusId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusId, results, limit]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  // filtros mudaram: a carta sob o cursor pode nem estar mais na lista
  useEffect(hideHover, [deferred, hideHover]);

  const status = (
    <span className="db-status">
      {db.updating ? (
        <>
          <span className="spinner small" /> {db.step ?? "Verificando atualizações…"}
        </>
      ) : db.meta ? (
        <>
          {fmt(db.cards.length)} cartas · base v{db.meta.version}
          <button className="link-btn" onClick={() => void checkForUpdate()} title="Procurar nova versão da base">
            Atualizar
          </button>
        </>
      ) : null}
    </span>
  );

  return (
    <ScreenShell
      title="Buscar Carta"
      accent="cyan"
      onBack={onBack}
      actions={
        <span className="search-actions">
          {status}
          <button className="ghost-btn combos-shortcut" onClick={() => onCombos()} title="Abrir a tela de combos">
            Combos
          </button>
        </span>
      }
      plain
    >
      {!ready ? (
        <div className="db-loading">
          {db.status === "error" ? (
            <>
              <p className="db-error">Não foi possível carregar a base de cartas.</p>
              <code>{db.error}</code>
              <button className="ghost-btn" onClick={() => void initCardDb()}>
                Tentar novamente
              </button>
            </>
          ) : (
            <>
              <span className="spinner" />
              <p>{db.step ?? "Carregando base de cartas…"}</p>
              {db.status === "downloading" && (
                <small>Primeiro acesso: a base completa é baixada uma vez e fica salva no dispositivo.</small>
              )}
            </>
          )}
        </div>
      ) : (
        <div className={`search ${selected ? "has-detail" : ""}`}>
          <div className="left-col">
            {selected && (
              <div className="left-tabs" role="tablist" aria-label="Coluna da esquerda">
                <button role="tab" aria-selected={leftTab === "carta"} className={leftTab === "carta" ? "active" : ""} onClick={() => setLeftTab("carta")}>
                  Carta
                </button>
                <button role="tab" aria-selected={leftTab === "filtros"} className={leftTab === "filtros" ? "active" : ""} onClick={() => setLeftTab("filtros")}>
                  Filtros
                </button>
              </div>
            )}
            {selected && leftTab === "carta" ? (
              <CardDetail
                card={selected}
                onClose={closeDetail}
                onTag={(id) => showInList((f) => ({ ...EMPTY_FILTERS, sort: f.sort, tags: [id] }))}
                findCard={findCard}
                isArchetype={(name) => archetypeSet.has(name.toLowerCase())}
                meta={db.extras?.meta}
                genesys={db.extras?.genesys}
                relations={relations}
                cards={db.cards}
                byId={byId}
                archetypePt={db.archetypePt}
                onOpen={(card) => openCard(card)}
                onCombos={onCombos}
                previous={history[history.length - 1]?.card}
                onBack={goBack}
                byName={byName}
                onShowSet={(label, ids, keepFilters) => {
                  const idSet = { label, ids };
                  showInList((f) => (keepFilters ? { ...f, idSet } : { ...EMPTY_FILTERS, idSet, sort: f.sort }));
                }}
                onArchetype={(name) =>
                  // todas as cartas do arquétipo, mais as que o suportam
                  showInList((f) => ({ ...EMPTY_FILTERS, sort: f.sort, archetype: name, includeSupport: true }))
                }
                onReference={(name, ref) => {
                  if (ref) openCard(ref);
                  // nome citado que não é carta nem arquétipo: busca por ele
                  else showInList((f) => ({ ...EMPTY_FILTERS, sort: f.sort, text: name }));
                }}
              />
            ) : (
              <SearchFilters
                filters={filters}
                archetypes={archetypes}
                tagDefs={db.tagDefs}
                tagCounts={tagCounts}
                formats={formats}
                archetypePt={db.archetypePt}
                onChange={patch}
              />
            )}
          </div>

          <div className="results">
            <div className="results-bar">
              <label className="search-input">
                <SearchIcon />
                <input
                  ref={inputRef}
                  type="search"
                  placeholder="Nome da carta (português ou inglês)"
                  value={filters.text}
                  onChange={(e) => patch({ text: e.target.value })}
                />
              </label>
              <label className="check">
                <input type="checkbox" checked={filters.inDesc} onChange={(e) => patch({ inDesc: e.target.checked })} />
                Buscar no texto
              </label>
              <select
                className="sort"
                value={filters.sort}
                onChange={(e) => patch({ sort: e.target.value as SortKey })}
                aria-label="Ordenar"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <p className="results-count">
              {fmt(results.length)} {results.length === 1 ? "carta encontrada" : "cartas encontradas"}
              {db.error && <span className="db-warning"> · Falha ao atualizar: {db.error}</span>}
            </p>

            <ActiveFilters filters={filters} tagDefs={db.tagDefs} onChange={patch} onClearAll={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })} />

            <div className="grid" ref={gridRef} onScroll={hover ? hideHover : undefined}>
              {pinned && !results.some((c) => c.id === pinned.id) && (
                <div className="pinned-slot">
                  <span className="pinned-label" title="Aberta no painel; não faz parte da lista atual">
                    Aberta no painel
                  </span>
                  <CardTile card={pinned} selected={pinned.id === selected?.id} onSelect={select} onHover={onHover} />
                </div>
              )}
              {results.length === 0 ? (
                <p className="empty">Nenhuma carta corresponde aos filtros.</p>
              ) : (
                results
                  .slice(0, limit)
                  .map((card) => (
                    <CardTile key={card.id} card={card} selected={card.id === selected?.id} onSelect={select} onHover={onHover} />
                  ))
              )}
              {limit < results.length && <div ref={sentinelRef} className="sentinel" />}
            </div>
          </div>
        </div>
      )}

      {/* o popup da lista funciona também com o painel aberto */}
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
