import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import ScreenShell from "./ScreenShell";
import CardPreview from "../components/CardPreview";
import { CATEGORIAS, type CategoriaMeta } from "../data/metaCall";
import { initCardDb, useCardDb } from "../db/cardStore";
import { copiasPorCarta, useColecao } from "../db/colecao";
import { useDecks, type Deck } from "../db/decks";
import { passoNoIdioma } from "../db/guiaDeck";
import { cardImage } from "../db/images";
import { FORMATS, type GameFormat } from "../db/legality";
import { decksDoFormato, perfilDoDeck, recomendar, sugerirListas, type DeckDoMeta, type PerfilDeck, type Recomendacao } from "../db/metaCall";
import { useContextoRespostas } from "../db/respostas";
import { displayName, type Card } from "../db/types";
import "./meta-call.css";

// Meta Call: escolha os decks esperados no torneio (e quanto de cada um) e veja as cartas boas
// contra eles — hand traps, respostas, cartas para jogar em segundo e de Side —, com o motivo em
// cada deck, o uso real em torneios e uma sugestão de Main e de Side. Detalhes do cálculo em
// src/db/metaCall.ts e src/data/metaCall.ts.

const SALVO = "cartas-meta-call";

interface Escolha {
  formato: GameFormat;
  /** arquétipo → % esperado no torneio */
  pesos: Record<string, number>;
  meuDeck?: string;
}

function lerEscolha(): Escolha {
  try {
    const e = JSON.parse(localStorage.getItem(SALVO) ?? "") as Escolha;
    if (e && typeof e.pesos === "object" && FORMATS.includes(e.formato)) return e;
  } catch {
    // sem escolha salva
  }
  return { formato: "TCG", pesos: {} };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n1 = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** O deck do jogador como "núcleo": cada carta com as cópias que tem */
function nucleoDoDeck(d: Deck): DeckDoMeta {
  const conta = (ids: number[]) => {
    const m = new Map<number, number>();
    for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m].map(([id, copias]) => ({ id, pct: 1, copias }));
  };
  return { arquetipo: d.nome, pct: 0, pctRecente: 0, nucleo: { main: conta(d.main), extra: conta(d.extra), side: [] }, fonte: "arquetipo" };
}

export default function MetaCall({ onBack }: { onBack: () => void }) {
  const db = useCardDb();
  useEffect(() => void initCardDb(), []);
  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);
  const ctx = useContextoRespostas(byId);
  const extras = db.extras;
  const { decks: meusDecks } = useDecks();
  const colecao = useColecao();
  const possuo = useMemo(() => copiasPorCarta(colecao.itens), [colecao.itens]);

  const [escolha, setEscolha] = useState<Escolha>(lerEscolha);
  const salvar = (e: Escolha) => {
    setEscolha(e);
    try {
      localStorage.setItem(SALVO, JSON.stringify(e));
    } catch {
      // armazenamento indisponível: vale só nesta sessão
    }
  };
  const [categoria, setCategoria] = useState<CategoriaMeta | "todas">("todas");
  const [aberta, setAberta] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const decks = useMemo(() => decksDoFormato(extras, escolha.formato, db.cards), [extras, escolha.formato, db.cards]);
  const pesos = escolha.pesos;
  const escolhidos = decks.filter((d) => (pesos[d.arquetipo] ?? 0) > 0);

  // perfis: um por deck (o cálculo lê o texto das cartas; fica em cache por deck)
  // (cache novo quando a base ou a camada mudam)
  const perfis = useMemo(() => new Map<string, PerfilDeck>(), [extras, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const perfilDe = useCallback(
    (d: DeckDoMeta) => {
      const k = `${escolha.formato}:${d.arquetipo}`;
      let p = perfis.get(k);
      if (!p) perfis.set(k, (p = perfilDoDeck(d, byId, extras?.combos, ctx)));
      return p;
    },
    [perfis, byId, extras?.combos, ctx, escolha.formato],
  );

  const meuDeck = meusDecks.find((d) => d.id === escolha.meuDeck);
  const meuPerfil = useMemo(() => (meuDeck ? perfilDoDeck(nucleoDoDeck(meuDeck), byId, undefined, ctx) : undefined), [meuDeck, byId, ctx]);
  const meusIds = useMemo(() => new Set(meuDeck ? [...meuDeck.main, ...meuDeck.extra, ...meuDeck.side] : []), [meuDeck]);

  const sel = useMemo(() => escolhidos.map((deck) => ({ deck, peso: pesos[deck.arquetipo], perfil: perfilDe(deck) })), [escolhidos, pesos, perfilDe]);
  const recs = useMemo(
    () => (sel.length ? recomendar({ decks: sel, formato: escolha.formato, byName, uso: extras?.uso, meuDeck: meuPerfil, meusIds }) : []),
    [sel, escolha.formato, byName, extras?.uso, meuPerfil, meusIds],
  );
  const listas = useMemo(() => sugerirListas(recs), [recs]);
  const visiveis = recs.filter((r) => categoria === "todas" || r.categoria === categoria);
  const somaPesos = sel.reduce((s, d) => s + d.peso, 0);

  // prévia ao passar o mouse
  const [hover, setHover] = useState<{ card: Card; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const onHover = useCallback((card: Card | null, el?: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (!card || !el) return setHover(null);
    hoverTimer.current = window.setTimeout(() => setHover({ card, rect: el.getBoundingClientRect() }), 300);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  const comPrevia = (c: Card) => ({
    onPointerEnter: (e: PointerEvent<HTMLElement>) => e.pointerType === "mouse" && onHover(c, e.currentTarget),
    onPointerLeave: () => onHover(null),
  });

  const definirPeso = (arq: string, v: number) => salvar({ ...escolha, pesos: { ...pesos, [arq]: Math.max(0, Math.min(100, Math.round(v))) } });
  const marcar = (d: DeckDoMeta, on: boolean) => definirPeso(d.arquetipo, on ? Math.max(1, Math.round(d.pct)) : 0);
  const topo = (n: number) => salvar({ ...escolha, pesos: Object.fromEntries(decks.slice(0, n).map((d) => [d.arquetipo, Math.max(1, Math.round(d.pct))])) });

  const copiar = (titulo: string, itens: { r: Recomendacao; n: number }[]) => {
    const texto = `${titulo}\n${itens.map(({ r, n }) => `${n}x ${r.card.name}`).join("\n")}`;
    void navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(titulo);
      setTimeout(() => setCopiado(null), 2000);
    });
  };
  const nome = (id: number) => (byId.get(id) ? displayName(byId.get(id)!) : `#${id}`);

  const pronto = db.status === "ready";
  return (
    <ScreenShell title="Meta Call" accent="cyan" onBack={onBack} plain>
      {!pronto ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? "Carregando base de cartas…"}</p>
        </div>
      ) : (
        <div className="meta-call">
          {/* ---------------- esquerda: decks esperados */}
          <aside className="mc-decks">
            <div className="format-switch combos-format" role="radiogroup" aria-label="Formato">
              {FORMATS.map((f) => (
                <button key={f} role="radio" aria-checked={escolha.formato === f} className={escolha.formato === f ? "active" : ""} onClick={() => salvar({ ...escolha, formato: f, pesos: {} })}>
                  {f}
                </button>
              ))}
            </div>
            <p className="tags-note">
              {escolha.formato === "TCG"
                ? `${extras?.metaTcg?.decks.toLocaleString("pt-BR") ?? "—"} decklists de torneio do TCG nos últimos 6 meses.`
                : "OCG: participação pelo Road of the King (dois últimos trimestres); o perfil de cada deck é estimado pelas cartas do arquétipo."}{" "}
              Marque os decks que espera no torneio e ajuste o % de cada um.
            </p>
            <div className="mc-atalhos">
              <button className="ghost-btn" onClick={() => topo(5)}>
                Top 5
              </button>
              <button className="ghost-btn" onClick={() => topo(10)}>
                Top 10
              </button>
              <button className="ghost-btn" onClick={() => salvar({ ...escolha, pesos: {} })}>
                Limpar
              </button>
            </div>
            {!decks.length && <p className="db-warning">O metagame ainda não foi baixado. Ele chega com a camada de dados do app.</p>}
            <ul className="mc-lista">
              {decks.map((d, i) => {
                const on = (pesos[d.arquetipo] ?? 0) > 0;
                const tend = d.pctRecente - d.pct;
                return (
                  <li key={d.arquetipo} className={on ? "on" : ""}>
                    <label>
                      <input type="checkbox" checked={on} onChange={(e) => marcar(d, e.target.checked)} />
                      <span className="mc-pos">{i + 1}</span>
                      <span className="mc-nome">{d.arquetipo}</span>
                      <small title={`${n1(d.pct)}% no período; ${n1(d.pctRecente)}% no mais recente`}>
                        {n1(d.pct)}%{Math.abs(tend) >= 1 && <span className={tend > 0 ? "sobe" : "desce"}>{tend > 0 ? " ▲" : " ▼"}</span>}
                      </small>
                    </label>
                    {on && (
                      <span className="mc-peso">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={pesos[d.arquetipo]}
                          onChange={(e) => definirPeso(d.arquetipo, Number(e.target.value) || 0)}
                          aria-label={`% esperado de ${d.arquetipo}`}
                        />
                        %
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <label className="field mc-meu">
              <span className="field-label">Meu deck (opcional)</span>
              <select value={escolha.meuDeck ?? ""} onChange={(e) => salvar({ ...escolha, meuDeck: e.target.value || undefined })}>
                <option value="">— nenhum —</option>
                {meusDecks
                  .filter((d) => !d.temporario)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
              </select>
              <small className="tags-note">Com o seu deck: avisa cartas que também travam você e confere requisitos (Fadas, Sincros, Fusões).</small>
            </label>
          </aside>

          {/* ---------------- direita: leitura dos decks e recomendação */}
          <section className="mc-resultado">
            {!sel.length ? (
              <div className="mc-vazio">
                <h3>Qual é o meta do seu torneio?</h3>
                <p>
                  Escolha os decks que você espera enfrentar (ou use <strong>Top 5</strong>). O Meta Call lê o que cada deck faz — buscas,
                  Invocações, Cemitério, efeitos no campo, campo final —, cruza com as linhas do motor de regras e com o que os jogadores de torneio
                  usam, e indica as melhores cartas contra eles.
                </p>
              </div>
            ) : (
              <>
                <h3 className="mc-titulo">
                  {sel.length} {sel.length === 1 ? "deck esperado" : "decks esperados"} · soma {somaPesos}%
                  {somaPesos !== 100 && <small> (os % valem como proporção entre eles)</small>}
                </h3>

                <div className="mc-perfis">
                  {sel.map(({ deck, peso, perfil: p }) => (
                    <details key={deck.arquetipo} className="mc-perfil">
                      <summary>
                        <strong>{deck.arquetipo}</strong> <small>{pct(peso / (somaPesos || 1))} do torneio</small>
                      </summary>
                      <ul className="mc-tracos">
                        <li>Busca no Deck: {pct(p.busca)}</li>
                        <li>Invoca do Deck: {pct(p.invocaDeck)}</li>
                        <li>Usa o Cemitério: {pct(Math.max(p.usaGY, p.efeitoGY))}</li>
                        <li>Efeitos de monstro no campo: {pct(p.efeitoCampo)}</li>
                        <li>Magias/Armadilhas: {pct(p.magias + p.armadilhas)}</li>
                        {p.linhas && (
                          <li>
                            Por combo ({p.linhas.n} linhas do motor): {n1(p.linhas.invocacoes)} Invocações, {n1(p.linhas.buscas)} buscas, campo final de{" "}
                            {n1(p.linhas.monstrosFinais + p.linhas.magiasFinais)} cartas
                          </li>
                        )}
                      </ul>
                      {p.pontos.length > 0 && (
                        <p className="mc-linha">
                          <span className="field-label">Onde parar</span>{" "}
                          {p.pontos.map((pt, i) => (
                            <span key={i}>
                              {i > 0 && " · "}
                              {passoNoIdioma(pt.passo, nome, "pt")} <small>({pt.respostas} respostas)</small>
                            </span>
                          ))}
                        </p>
                      )}
                      {p.handTraps.length > 0 && (
                        <p className="mc-linha">
                          <span className="field-label">Joga</span>{" "}
                          {p.handTraps.slice(0, 6).map((h, i) => (
                            <span key={`${h.id}-${h.side}`}>
                              {i > 0 && ", "}
                              {nome(h.id)} {pct(h.pct)}
                              {h.side ? " (Side)" : ""}
                            </span>
                          ))}
                        </p>
                      )}
                      {p.chefes.length > 0 && (
                        <p className="mc-linha">
                          <span className="field-label">Chefes no campo</span> {p.chefes.map((c) => nome(c.id)).join(", ")}
                        </p>
                      )}
                      {deck.fonte === "arquetipo" && <p className="tags-note">Perfil estimado pelas cartas do arquétipo (sem decklists deste formato).</p>}
                    </details>
                  ))}
                </div>

                <div className="mc-listas">
                  {[
                    { titulo: "Main: interrupções", itens: listas.main, dica: "Boas contra todos os decks escolhidos" },
                    { titulo: "Side Deck (15)", itens: listas.side, dica: "Para trocar entre as partidas, conforme o oponente" },
                  ].map((l) => (
                    <div key={l.titulo} className="mc-sugestao">
                      <div className="mc-sugestao-cab">
                        <h4>
                          {l.titulo} <small>{l.itens.reduce((s, x) => s + x.n, 0)} cartas</small>
                        </h4>
                        <button className="link-btn" disabled={!l.itens.length} onClick={() => copiar(l.titulo, l.itens)}>
                          {copiado === l.titulo ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                      <p className="tags-note">{l.dica}</p>
                      <ul>
                        {l.itens.map(({ r, n }) => (
                          <li key={r.id} {...comPrevia(r.card)}>
                            <strong>{n}×</strong> {displayName(r.card)}
                            {(possuo.get(r.id) ?? 0) > 0 && <small className="mc-possuo"> possuo {possuo.get(r.id)}</small>}
                            {meusIds.has(r.id) && <small className="mc-possuo"> no seu deck</small>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="left-tabs mc-cats" role="tablist" aria-label="Tipo de carta">
                  <button className={categoria === "todas" ? "active" : ""} onClick={() => setCategoria("todas")}>
                    Todas ({recs.length})
                  </button>
                  {CATEGORIAS.map((c) => (
                    <button key={c.id} className={categoria === c.id ? "active" : ""} onClick={() => setCategoria(c.id)} title={c.hint}>
                      {c.label} ({recs.filter((r) => r.categoria === c.id).length})
                    </button>
                  ))}
                </div>

                <ol className="mc-recs">
                  {visiveis.map((r) => {
                    const melhor = [...r.porDeck].sort((a, b) => b.nota - a.nota)[0];
                    const pior = [...r.porDeck].sort((a, b) => a.nota - b.nota)[0];
                    return (
                      <li key={r.id} className="mc-rec">
                        <img src={cardImage(r.id, "small")} alt="" loading="lazy" {...comPrevia(r.card)} />
                        <div className="mc-rec-corpo">
                          <div className="mc-rec-topo">
                            <strong {...comPrevia(r.card)}>{displayName(r.card)}</strong>
                            <span className="mc-selo">{CATEGORIAS.find((c) => c.id === r.categoria)?.label}</span>
                            {r.maximo < 3 && <span className="mc-selo mc-selo-ban">máx. {r.maximo}</span>}
                            {(possuo.get(r.id) ?? 0) > 0 && <span className="mc-selo mc-selo-possuo">possuo {possuo.get(r.id)}</span>}
                            {meusIds.has(r.id) && <span className="mc-selo mc-selo-possuo">no seu deck</span>}
                          </div>
                          <small className="mc-papel">{r.item.papel}</small>
                          <div className="mc-nota" title="Nota final: 70% o confronto com os decks escolhidos e 30% o uso real em torneios">
                            <span className="mc-barra">
                              <span style={{ width: pct(r.total) }} />
                            </span>
                            <strong>{Math.round(r.total * 100)}</strong>
                            <small>
                              contra estes decks {Math.round(r.contra * 100)} · uso em torneios {pct(r.uso)}
                              {r.noSide > 0.05 && ` · no Side de ${pct(r.noSide)} deles`}
                            </small>
                          </div>
                          <div className="mc-por-deck">
                            {r.porDeck.map((d) => (
                              <span key={d.arquetipo} className="mc-chip" title={d.motivo} style={{ ["--nota" as string]: d.nota }}>
                                {d.arquetipo} <strong>{Math.round(d.nota * 100)}</strong>
                                {d.motor && <small title="Calculado com as linhas do motor de regras"> ⚙</small>}
                              </span>
                            ))}
                          </div>
                          <small className="mc-motivo">
                            Melhor contra <strong>{melhor.arquetipo}</strong>: {melhor.motivo}.
                            {r.porDeck.length > 1 && pior.nota < 0.3 && (
                              <>
                                {" "}
                                Fraca contra <strong>{pior.arquetipo}</strong>.
                              </>
                            )}
                          </small>
                          {r.requisito && <small className="mc-requisito">Requisito: {r.requisito}.</small>}
                          {r.aviso && <small className="mc-aviso">Atenção: {r.aviso}.</small>}
                          {aberta === r.id ? (
                            <ul className="mc-detalhe">
                              {r.porDeck.map((d) => (
                                <li key={d.arquetipo}>
                                  <strong>{d.arquetipo}</strong> ({Math.round(d.nota * 100)}): {d.motivo}
                                </li>
                              ))}
                              <li>
                                <button className="link-btn" onClick={() => setAberta(null)}>
                                  Fechar detalhes
                                </button>
                              </li>
                            </ul>
                          ) : (
                            r.porDeck.length > 1 && (
                              <button className="link-btn mc-ver" onClick={() => setAberta(r.id)}>
                                Ver o motivo em cada deck
                              </button>
                            )
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="tags-note">
                  Nota de cada deck: o que o motor do deck faz (lido do texto oficial das cartas do núcleo de torneio) e, com ⚙, as linhas do motor
                  de regras — em que passo a carta já pode responder e quanto do combo ela corta. A banlist do {escolha.formato} define as cartas e
                  as cópias. É uma indicação para estudar o meta, não uma garantia: confira o texto das cartas.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
