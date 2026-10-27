import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FontesButton, isFontesOpen } from "./Fontes";
import { isContaOpen } from "./Conta";
import { cardImage } from "../db/images";
import { readCard } from "../db/effects";
import CardEffects, { readingSummary } from "./CardEffects";
import CardStats from "./CardStats";
import CardInfo from "./CardInfo";
import CardPrices from "./CardPrices";
import MetaHistory from "./MetaHistory";
import CardRelations from "./CardRelations";
import { describeQuery, RELATION_LABELS, relationTargetIds, type RelationIndex } from "../db/relations";
import { MONSTER_RACES } from "../db/labels";
import type { Overlay } from "../db/overlay";
import { BAN_LABELS, frameColor, kindLabel } from "../db/labels";
import { useTagLookup } from "../db/cardStore";
import { displayName, type Card } from "../db/types";

type Props = {
  card: Card;
  onClose: () => void;
  /** filtra a busca pela tag clicada */
  onTag: (tagId: string) => void;
  /** procura uma carta pelo nome em inglês (para as cartas citadas no texto) */
  findCard: (name: string) => Card | undefined;
  /** clique numa carta citada: abre a carta, ou busca pelo nome se não for uma carta */
  onReference: (name: string, card?: Card) => void;
  /** o nome é de um arquétipo oficial? */
  isArchetype: (name: string) => boolean;
  /** busca o arquétipo (com cartas de suporte) */
  onArchetype: (name: string) => void;
  meta?: Overlay["meta"];
  genesys?: Overlay["genesys"];
  relations: RelationIndex | null;
  cards: Card[];
  byId: Map<number, Card>;
  byName: Map<string, Card>;
  /** carta anterior no histórico (para o botão Voltar) */
  previous?: Card;
  onBack: () => void;
  archetypePt: Map<string, string>;
  onOpen: (card: Card) => void;
  onShowSet: (label: string, ids: number[], keepFilters: boolean) => void;
  /** abre a tela de combos com esta carta na mão */
  onCombos: (card: Card) => void;
};

export default function CardDetail({
  card,
  onClose,
  onTag,
  findCard,
  onReference,
  isArchetype,
  onArchetype,
  meta,
  genesys,
  relations,
  cards,
  byId,
  byName,
  previous,
  onBack,
  archetypePt,
  onOpen,
  onCombos,
  onShowSet,
}: Props) {
  const [art, setArt] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [plainText, setPlainText] = useState(false);
  const [artFailed, setArtFailed] = useState(false);

  const drawerRef = useRef<HTMLElement>(null);

  // Trocou de carta (ex.: clique numa carta citada): volta ao topo e ao padrão
  useEffect(() => {
    setArt(0);
    setShowOriginal(false);
    setArtFailed(false);
    drawerRef.current?.scrollTo({ top: 0 });
  }, [card.id]);

  // Captura: fecha o painel antes de o Esc global voltar ao menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isFontesOpen() || isContaOpen()) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  const tagById = useTagLookup();
  const desc = showOriginal || !card.descPt ? card.desc : card.descPt;
  const reading = useMemo(() => readCard(card, !showOriginal), [card, showOriginal]);
  const summary = readingSummary(reading);
  const references = reading.references.map((name) => ({ name, card: findCard(name), archetype: isArchetype(name) }));
  const bans = Object.entries(card.ban ?? {}).filter(([, v]) => v) as [string, keyof typeof BAN_LABELS][];

  // Relações de cada efeito ("Invoca → Mago Negro"), mostradas dentro da leitura
  const effectLinks = (i: number) => {
    const rels = (relations?.out.get(card.id) ?? []).filter((r) => r.effect === i && r.type !== "cita");
    if (!rels.length) return null;
    return (
      <div className="effect-links">
        {rels.map((r) => {
          const label = RELATION_LABELS[r.type].out;
          if (r.target.kind === "card") {
            const target = byId.get(r.target.id);
            return (
              target && (
                <button key={`${r.type}${r.name}`} className="effect-link" onClick={() => onOpen(target)}>
                  <span>{label} →</span> {displayName(target)}
                </button>
              )
            );
          }
          const ids = relationTargetIds(r, cards);
          const t = r.target;
          const race = (x: string) => MONSTER_RACES[x] ?? x;
          const what =
            t.kind === "query"
              ? describeQuery(t.query, race)
              : t.kind === "archetype"
                ? `arquétipo ${archetypePt.get(t.name) ?? t.name}`
                : `${t.query ? describeQuery(t.query, race) : "cartas"} que citam "${archetypePt.get(t.name) ?? byName.get(t.name)?.namePt ?? t.name}"`;
          return (
            <button
              key={`${r.type}${r.name}${i}${what}`}
              className="effect-link"
              onClick={() => onShowSet(`${label} (${what}): ${displayName(card)}`, ids, false)}
            >
              <span>{label} →</span> {what} ({ids.length})
            </button>
          );
        })}
      </div>
    );
  };

  // Painel fixo na coluna da esquerda: não bloqueia a lista de cartas ao lado
  return (
    <aside
      ref={drawerRef}
      className="drawer docked"
      style={{ "--frame": frameColor(card.frame) } as CSSProperties}
      aria-label={`Detalhes: ${displayName(card)}`}
    >
      <div className="drawer-nav">
        {previous && (
          <button className="ghost-btn drawer-back" onClick={onBack} title={`Voltar para ${displayName(previous)}`}>
            ← <span>{displayName(previous)}</span>
          </button>
        )}
        <button className="ghost-btn drawer-combos" onClick={() => onCombos(card)} title="Abrir a tela de combos com esta carta na mão">
          Combos com esta carta
        </button>
        <button className="drawer-close ghost-btn" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="drawer-art">
        {artFailed ? (
          <div className="art-fallback">
            <strong>{displayName(card)}</strong>
            <span>Imagem indisponível</span>
          </div>
        ) : (
          <img src={cardImage(card.images[art] ?? card.id, "full")} alt={displayName(card)} onError={() => setArtFailed(true)} />
        )}
      </div>

      {card.images.length > 1 && (
        <div className="art-picker" aria-label="Artes alternativas">
          {card.images.map((imgId, i) => (
            <button
              key={imgId}
              className={i === art ? "active" : ""}
              onClick={() => {
                setArt(i);
                setArtFailed(false);
              }}
              aria-label={`Arte ${i + 1}`}
            >
              <img src={cardImage(imgId, "small")} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <header className="drawer-head">
        <h3>{displayName(card)}</h3>
        {card.namePt && <p className="drawer-en">{card.name}</p>}
        <p className="drawer-kind">{kindLabel(card)}</p>
      </header>

      <CardStats card={card} />

      <section className="drawer-section">
        <div className="section-title">
          <h4>{plainText ? "Texto" : "Leitura da carta"}</h4>
          <span className="section-actions">
            <button className="link-btn" onClick={() => setPlainText((v) => !v)}>
              {plainText ? "Ver leitura" : "Ver texto corrido"}
            </button>
            {card.descPt && (
              <button className="link-btn" onClick={() => setShowOriginal((v) => !v)}>
                {showOriginal ? "Português" : "Original (inglês)"}
              </button>
            )}
          </span>
        </div>
        {plainText ? (
          <p className="desc">{desc}</p>
        ) : (
          <>
            {summary && <p className="reading-summary">{summary}</p>}
            <CardEffects reading={reading} renderExtra={showOriginal ? undefined : effectLinks} />
          </>
        )}
      </section>

      <CardRelations
        card={card}
        index={relations}
        cards={cards}
        byId={byId}
        byName={byName}
        archetypePt={archetypePt}
        meta={meta}
        onOpen={onOpen}
        onShowSet={onShowSet}
      />

      {references.length > 0 && (
        <section className="drawer-section">
          <h4>Cartas citadas</h4>
          <div className="chips">
            {references.map(({ name, card: ref, archetype }) => (
              <button
                key={name}
                className={`chip ref-chip ${!ref && archetype ? "is-archetype" : ""}`}
                title={ref ? "Abrir esta carta" : archetype ? "Ver o arquétipo e as cartas de suporte" : "Buscar por este nome"}
                onClick={() => (!ref && archetype ? onArchetype(name) : onReference(name, ref))}
              >
                {!ref && archetype && <span className="ref-kind">Arquétipo</span>}
                {ref ? displayName(ref) : name}
              </button>
            ))}
          </div>
        </section>
      )}

      {card.tags && card.tags.length > 0 && (
        <section className="drawer-section">
          <h4>Tags</h4>
          <div className="chips">
            {card.tags.map((id) => {
              const tag = tagById(id);
              return (
                tag && (
                  <button key={id} className="chip tag-chip" title={`${tag.hint} — clique para buscar`} onClick={() => onTag(id)}>
                    {tag.label}
                  </button>
                )
              );
            })}
          </div>
          <p className="tags-note">Tags geradas por regras sobre o texto em inglês e revisadas na base curada.</p>
        </section>
      )}

      {(card.archetype || bans.length > 0) && (
        <section className="drawer-section tags">
          {card.archetype && (
            <button className="tag tag-btn" onClick={() => onArchetype(card.archetype!)} title="Ver o arquétipo e as cartas de suporte">
              Arquétipo: {card.archetype}
            </button>
          )}
          {bans.map(([fmt, status]) => (
            <span key={fmt} className={`tag ban-${status}`}>
              {fmt.toUpperCase()}: {BAN_LABELS[status]}
            </span>
          ))}
        </section>
      )}

      <CardInfo
        card={card}
        genesysPoints={genesys?.[card.id]}
        onTreatedAs={(name) => onReference(name, findCard(name))}
      />

      {card.archetype && meta && <MetaHistory archetype={card.archetype} meta={meta} />}

      <CardPrices card={card} />


      <FontesButton className="drawer-source" sites={["ygoprodeck", "yugioh-wiki"]} links={[{ nome: `${card.name} na YGOPRODeck`, url: card.url }]} />
    </aside>
  );
}
