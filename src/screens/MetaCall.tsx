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
import {
  catalogoDeDecks,
  deckDoArquetipo,
  decksDoFormato,
  perfilDoDeck,
  recomendar,
  sugerirListas,
  type Alvo,
  type DeckConsultavel,
  type DeckDoMeta,
  type PerfilDeck,
  type Recomendacao,
} from "../db/metaCall";
import { normalize } from "../db/search";
import { useContextoRespostas } from "../db/respostas";
import { displayName, type Card } from "../db/types";
import "./meta-call.css";
import BotaoLink from "../components/BotaoLink";
import type { Rota } from "../rotas";
import { IDIOMA, t, LOCALE } from "../i18n";
import Lateral from "../components/Lateral";
import DeckNoMeta from "../components/DeckNoMeta";

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
const n1 = (x: number) => x.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/** O deck do jogador como "núcleo": cada carta com as cópias que tem */
function nucleoDoDeck(d: Deck): DeckDoMeta {
  const conta = (ids: number[]) => {
    const m = new Map<number, number>();
    for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m].map(([id, copias]) => ({ id, pct: 1, copias }));
  };
  return { arquetipo: d.nome, pct: 0, pctRecente: 0, nucleo: { main: conta(d.main), extra: conta(d.extra), side: [] }, fonte: "arquetipo" };
}

export default function MetaCall({
  onBack,
  inicial,
  onRota,
}: {
  onBack: () => void;
  /** link compartilhado: formato e decks com o % de cada um */
  inicial?: { formato?: GameFormat; decks?: Record<string, number> };
  /** o endereço acompanha a seleção */
  onRota?: (r: Rota) => void;
}) {
  const db = useCardDb();
  useEffect(() => void initCardDb(), []);
  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);
  const ctx = useContextoRespostas(byId);
  const extras = db.extras;
  const { decks: meusDecks } = useDecks();
  const colecao = useColecao();
  const possuo = useMemo(() => copiasPorCarta(colecao.itens), [colecao.itens]);

  // um link com decks vale no lugar da seleção salva (o seu deck continua o salvo)
  const [escolha, setEscolha] = useState<Escolha>(() => {
    const salva = lerEscolha();
    return inicial?.decks ? { ...salva, formato: inicial.formato ?? "TCG", pesos: inicial.decks } : salva;
  });
  useEffect(() => {
    const decks = Object.fromEntries(Object.entries(escolha.pesos).filter(([, p]) => p > 0));
    onRota?.({ tela: "metacall", formato: escolha.formato, decks: Object.keys(decks).length ? decks : undefined });
  }, [escolha.formato, escolha.pesos]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const decks = useMemo(() => decksDoFormato(extras, escolha.formato, db.cards, extras?.uso), [extras, escolha.formato, db.cards]);
  // decks consultados (fora da lista do meta): qualquer arquétipo, relevante agora ou no passado
  const catalogo = useMemo(() => catalogoDeDecks(extras), [extras]);
  const [consulta, setConsulta] = useState("");
  const [relevancia, setRelevancia] = useState<"todos" | DeckConsultavel["relevancia"]>("todos");
  const pesos = escolha.pesos;
  const consultados = useMemo(
    () =>
      Object.keys(escolha.pesos)
        .filter((a) => (escolha.pesos[a] ?? 0) > 0 && !decks.some((d) => d.arquetipo.toLowerCase() === a.toLowerCase()))
        .map((a) => deckDoArquetipo(a, extras, db.cards, escolha.formato, extras?.uso)),
    [escolha.pesos, escolha.formato, decks, extras, db.cards],
  );
  const escolhidos = [...consultados, ...decks].filter((d) => (pesos[d.arquetipo] ?? 0) > 0);
  const resultados = useMemo(() => {
    const q = normalize(consulta);
    if (q.length < 2 && relevancia === "todos") return [];
    const ordem = { agora: 0, passado: 1, outro: 2 };
    return catalogo
      .filter((d) => relevancia === "todos" || d.relevancia === relevancia)
      // começo de palavra: "ange" acha Angelechy, não "Change"
      .filter((d) => !q || ` ${normalize(`${d.arquetipo} ${db.archetypePt.get(d.arquetipo) ?? ""}`).replace(/[-!.]/g, " ")}`.includes(` ${q}`))
      .sort((a, b) => ordem[a.relevancia] - ordem[b.relevancia] || (b.tcg?.pct ?? 0) - (a.tcg?.pct ?? 0) || (b.ocg?.pico ?? 0) - (a.ocg?.pico ?? 0) || a.arquetipo.localeCompare(b.arquetipo))
      .slice(0, 15);
  }, [consulta, relevancia, catalogo, db.archetypePt]);
  /** % inicial de um deck consultado: o do meta (TCG ou OCG) ou 5% */
  const pesoInicial = (d: DeckConsultavel) => Math.max(1, Math.round((escolha.formato === "TCG" ? d.tcg?.pct : d.ocg?.atual) || d.tcg?.pct || d.ocg?.atual || 5));

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
  // "Aplicar Deck" (canto superior): o deck marcado na lista só vale depois do botão
  const [deckMarcado, setDeckMarcado] = useState(escolha.meuDeck ?? "");
  const meuPerfil = useMemo(() => (meuDeck ? perfilDoDeck(nucleoDoDeck(meuDeck), byId, undefined, ctx) : undefined), [meuDeck, byId, ctx]);
  const meusIds = useMemo(() => new Set(meuDeck ? [...meuDeck.main, ...meuDeck.extra, ...meuDeck.side] : []), [meuDeck]);

  const sel = useMemo(() => escolhidos.map((deck) => ({ deck, peso: pesos[deck.arquetipo], perfil: perfilDe(deck) })), [escolhidos, pesos, perfilDe]);
  const recs = useMemo(
    () => (sel.length ? recomendar({ decks: sel, formato: escolha.formato, byName, byId, uso: extras?.uso, meuDeck: meuPerfil, meusIds }) : []),
    [sel, escolha.formato, byName, extras?.uso, meuPerfil, meusIds],
  );
  const listas = useMemo(() => sugerirListas(recs), [recs]);
  // "Aplicar Deck": as cartas do catálogo que estão no seu deck (Main e Side), com a nota contra cada deck escolhido
  const recsDoDeck = useMemo(() => {
    if (!meuDeck || !sel.length) return [];
    const apenas = new Set([...meuDeck.main, ...meuDeck.side].map((id) => byId.get(id)?.id ?? id));
    return recomendar({ decks: sel, formato: escolha.formato, byName, byId, uso: extras?.uso, meuDeck: meuPerfil, apenas });
  }, [meuDeck, sel, escolha.formato, byName, byId, extras?.uso, meuPerfil]);
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
    const texto = `${titulo}\n${itens.map(({ r, n }) => t("{0}x {1}", [n, r.card.name])).join("\n")}`;
    void navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(titulo);
      setTimeout(() => setCopiado(null), 2000);
    });
  };
  const nome = (id: number) => (byId.get(id) ? displayName(byId.get(id)!) : `#${id}`);
  /** um choke point: o passo do combo (motor) ou a carta do deck, o que a recomendação faz ali e a frequência */
  const alvo = (a: Alvo, i: number) => {
    const id = a.id ?? (a.passo && "c" in a.passo ? (Array.isArray(a.passo.c) ? a.passo.c[0] : a.passo.c) : undefined);
    const card = id !== undefined ? byId.get(id) : undefined;
    const texto = a.passo ? passoNoIdioma(a.passo, nome, IDIOMA) : id !== undefined ? nome(id) : "";
    return (
      <li key={i} className={`mc-alvo mc-alvo-${a.fonte}`}>
        {card ? <img src={cardImage(card.id, "small")} alt="" loading="lazy" {...comPrevia(card)} /> : <span className="mc-alvo-img" />}
        <span>
          <strong>{texto}</strong>
          <small>
            {a.motivo} · {a.peso}
            {a.fonte === "motor" && <span title={t("Calculado com as linhas do motor de regras")}> ⚙</span>}
          </small>
        </span>
      </li>
    );
  };

  const pronto = db.status === "ready";
  return (
    <ScreenShell
      title={t("Meta Call")}
      accent="cyan"
      onBack={onBack}
      plain
      actions={
        <span className="mc-aplicar" title={t("Com o seu deck: mostra quais cartas dele (e do Side) servem contra os decks esperados e a chance de abrir cada uma; também avisa cartas que travam você e confere requisitos (Fadas, Sincros, Fusões).")}>
          <select value={deckMarcado} onChange={(e) => setDeckMarcado(e.target.value)} aria-label={t("Meu deck")}>
            <option value="">{t("— meu deck —")}</option>
            {meusDecks
              .filter((d) => !d.temporario)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
          </select>
          <button className="ghost-btn" disabled={deckMarcado === (escolha.meuDeck ?? "")} onClick={() => salvar({ ...escolha, meuDeck: deckMarcado || undefined })}>
            {t("Aplicar Deck")}
          </button>
        </span>
      }
    >
      {!pronto ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? t("Carregando base de cartas…")}</p>
        </div>
      ) : (
        <div className="meta-call">
          {/* ---------------- esquerda: decks esperados */}
          <Lateral className="mc-decks" titulo={t("Decks esperados")}>
            <div className="format-switch combos-format" role="radiogroup" aria-label={t("Formato")}>
              {FORMATS.map((f) => (
                <button key={f} role="radio" aria-checked={escolha.formato === f} className={escolha.formato === f ? "active" : ""} onClick={() => salvar({ ...escolha, formato: f, pesos: {} })}>
                  {f}
                </button>
              ))}
            </div>
            <p className="tags-note">
              {t("{0} Marque os decks que espera no torneio e ajuste o % de cada um.", [escolha.formato === "TCG"
                ? t("{0} decklists de torneio do TCG nos últimos 6 meses.", [extras?.metaTcg?.decks.toLocaleString(LOCALE) ?? "—"])
                : t("OCG: participação pelo Road of the King (dois últimos trimestres); o perfil de cada deck é estimado pelas cartas do arquétipo.")])}</p>
            <div className="mc-atalhos">
              <button className="ghost-btn" onClick={() => topo(5)}>
                {t("Top 5")}</button>
              <button className="ghost-btn" onClick={() => topo(10)}>
                {t("Top 10")}</button>
              <button className="ghost-btn" onClick={() => salvar({ ...escolha, pesos: {} })}>
                {t("Limpar")}</button>
            </div>
            <div className="mc-consulta">
              <label className="field">
                <span className="field-label">{t("Consultar deck")}</span>
                <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder={t("ex.: Angelechy")} aria-label={t("Consultar deck")} />
              </label>
              <div className="left-tabs mc-relevancia" role="tablist" aria-label={t("Relevância no meta")}>
                {(["todos", "agora", "passado"] as const).map((r) => (
                  <button key={r} className={relevancia === r ? "active" : ""} onClick={() => setRelevancia(r)}>
                    {r === "todos" ? t("Todos") : r === "agora" ? t("Relevantes agora") : t("Já foram relevantes")}
                  </button>
                ))}
              </div>
              {resultados.length > 0 && (
                <ul className="mc-resultados">
                  {resultados.map((d) => {
                    const on = (pesos[d.arquetipo] ?? 0) > 0;
                    return (
                      <li key={d.arquetipo}>
                        <span className="mc-resultado-nome">
                          <strong>{d.arquetipo}</strong>
                          {IDIOMA === "pt" && db.archetypePt.get(d.arquetipo) && <small> · {db.archetypePt.get(d.arquetipo)}</small>}
                        </span>
                        <span className="mc-resultado-info">
                          {d.tcg && <span title={t("TCG: decklists de torneio dos últimos 6 meses")}>{t("TCG {0}% · {1}% recente", [n1(d.tcg.pct), n1(d.tcg.recente)])}</span>}
                          {d.ocg && d.ocg.pico > 0 && (
                            <span title={t("OCG: participação nos decks colocados por trimestre (Road of the King)")}>
                              {t("OCG pico {0}% em {1}", [n1(d.ocg.pico), d.ocg.periodoPico])}
                              {d.ocg.atual > 0 && ` · ${t("atual {0}%", [n1(d.ocg.atual)])}`}
                            </span>
                          )}
                          {d.relevancia === "outro" && <span>{t("sem dados de torneio: perfil pelas cartas")}</span>}
                        </span>
                        <button className={`ghost-btn mc-add ${on ? "on" : ""}`} onClick={() => definirPeso(d.arquetipo, on ? 0 : pesoInicial(d))}>
                          {on ? t("✓ Adicionado") : t("+ Adicionar")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {(consulta.length >= 2 || relevancia !== "todos") && !resultados.length && <p className="tags-note">{t("Nenhum arquétipo encontrado.")}</p>}
            </div>
            {!decks.length && <p className="db-warning">{t("O metagame ainda não foi baixado. Ele chega com a camada de dados do app.")}</p>}
            {consultados.length > 0 && <p className="field-label mc-sub">{t("Consultados")}</p>}
            <ul className="mc-lista">
              {[...consultados, ...decks].map((d, j) => {
                const i = j - consultados.length;
                const on = (pesos[d.arquetipo] ?? 0) > 0;
                const tend = d.pctRecente - d.pct;
                return (
                  <li key={d.arquetipo} className={on ? "on" : ""}>
                    <label>
                      <input type="checkbox" checked={on} onChange={(e) => marcar(d, e.target.checked)} />
                      <span className="mc-pos">{i >= 0 ? i + 1 : "•"}</span>
                      <span className="mc-nome">{d.arquetipo}</span>
                      {d.pct > 0 ? (
                        <small title={t("{0}% no período; {1}% no mais recente", [n1(d.pct), n1(d.pctRecente)])}>
                          {n1(d.pct)}%{Math.abs(tend) >= 1 && <span className={tend > 0 ? "sobe" : "desce"}>{tend > 0 ? " ▲" : " ▼"}</span>}
                        </small>
                      ) : (
                        <small title={t("Perfil estimado pelas cartas do arquétipo (sem decklists deste formato).")}>{t("estimado")}</small>
                      )}
                    </label>
                    {on && (
                      <span className="mc-peso">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={pesos[d.arquetipo]}
                          onChange={(e) => definirPeso(d.arquetipo, Number(e.target.value) || 0)}
                          aria-label={t("% esperado de {0}", [d.arquetipo])}
                        />
                        %
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Lateral>

          {/* ---------------- direita: leitura dos decks e recomendação */}
          <section className="mc-resultado">
            {!sel.length ? (
              <div className="mc-vazio">
                <h3>{t("Qual é o meta do seu torneio?")}</h3>
                {meuDeck && <p className="tags-note">{t("Deck aplicado: {0}. Marque os decks esperados para ver quais cartas dele servem contra eles.", [meuDeck.nome])}</p>}
                <p>
                  {t("Escolha os decks que você espera enfrentar (ou use")}{" "}<strong>{t("Top 5")}</strong>{t("). O Meta Call lê o que cada deck faz — buscas, Invocações, Cemitério, efeitos no campo, campo final —, cruza com as linhas do motor de regras e com o que os jogadores de torneio usam, e indica as melhores cartas contra eles.")}</p>
              </div>
            ) : (
              <>
                <BotaoLink
                  rota={{ tela: "metacall", formato: escolha.formato, decks: Object.fromEntries(Object.entries(pesos).filter(([, p]) => p > 0)) }}
                  className="mc-link"
                />
                {meuDeck && <DeckNoMeta key={meuDeck.id} deck={meuDeck} arquetipos={sel.map((x) => x.deck.arquetipo)} recs={recsDoDeck} byId={byId} comPrevia={comPrevia} sideSugerido={listas.side} />}
                <h3 className="mc-titulo">
                  {t("{0} {1} · soma {2}%", [sel.length, sel.length === 1 ? t("deck esperado") : t("decks esperados"), somaPesos])}{somaPesos !== 100 && <small> {" "}{t("(os % valem como proporção entre eles)")}</small>}
                </h3>

                <div className="mc-perfis">
                  {sel.map(({ deck, peso, perfil: p }) => (
                    <details key={deck.arquetipo} className="mc-perfil">
                      <summary>
                        <strong>{deck.arquetipo}</strong> <small>{t("{0} do torneio", [pct(peso / (somaPesos || 1))])}</small>
                      </summary>
                      <ul className="mc-tracos">
                        <li>{t("Busca no Deck: {0}", [pct(p.busca)])}</li>
                        <li>{t("Invoca do Deck: {0}", [pct(p.invocaDeck)])}</li>
                        <li>{t("Usa o Cemitério: {0}", [pct(Math.max(p.usaGY, p.efeitoGY))])}</li>
                        <li>{t("Efeitos de monstro no campo: {0}", [pct(p.efeitoCampo)])}</li>
                        <li>{t("Magias/Armadilhas: {0}", [pct(p.magias + p.armadilhas)])}</li>
                        {p.linhas && (
                          <li>
                            {t("Por combo ({0} linhas do motor): {1} Invocações, {2} buscas, campo final de", [p.linhas.n, n1(p.linhas.invocacoes), n1(p.linhas.buscas)])}{" "}
                            {t("{0} cartas", [n1(p.linhas.monstrosFinais + p.linhas.magiasFinais)])}</li>
                        )}
                      </ul>
                      {p.pontos.length > 0 && (
                        <p className="mc-linha">
                          <span className="field-label">{t("Onde parar")}</span>{" "}
                          {p.pontos.map((pt, i) => (
                            <span key={i}>
                              {i > 0 && " · "}
                              {passoNoIdioma(pt.passo, nome, "pt")} <small>{t("({0} respostas)", [pt.respostas])}</small>
                            </span>
                          ))}
                        </p>
                      )}
                      {p.handTraps.length > 0 && (
                        <p className="mc-linha">
                          <span className="field-label">{t("Joga")}</span>{" "}
                          {p.handTraps.slice(0, 6).map((h, i) => (
                            <span key={`${h.id}-${h.side}`}>
                              {i > 0 && ", "}
                              {nome(h.id)} {pct(h.pct)}
                              {h.side ? t(" (Side)") : ""}
                            </span>
                          ))}
                        </p>
                      )}
                      {p.chefes.length > 0 && (
                        <p className="mc-linha">
                          <span className="field-label">{t("Chefes no campo")}</span> {p.chefes.map((c) => nome(c.id)).join(", ")}
                        </p>
                      )}
                      {deck.fonte === "arquetipo" && <p className="tags-note">{t("Perfil estimado pelas cartas do arquétipo (sem decklists deste formato).")}</p>}
                    </details>
                  ))}
                </div>

                <div className="mc-listas">
                  {[
                    { titulo: t("Main: interrupções"), itens: listas.main, dica: t("Boas contra todos os decks escolhidos") },
                    { titulo: t("Side Deck (15)"), itens: listas.side, dica: t("Para trocar entre as partidas, conforme o oponente") },
                  ].map((l) => (
                    <div key={l.titulo} className="mc-sugestao">
                      <div className="mc-sugestao-cab">
                        <h4>
                          {l.titulo} <small>{t("{0} cartas", [l.itens.reduce((s, x) => s + x.n, 0)])}</small>
                        </h4>
                        <button className="link-btn" disabled={!l.itens.length} onClick={() => copiar(l.titulo, l.itens)}>
                          {copiado === l.titulo ? t("Copiado!") : t("Copiar")}
                        </button>
                      </div>
                      <p className="tags-note">{l.dica}</p>
                      <ul>
                        {l.itens.map(({ r, n }) => (
                          <li key={r.id} {...comPrevia(r.card)}>
                            <strong>{t("{0}×", [n])}</strong> {displayName(r.card)}
                            {(possuo.get(r.id) ?? 0) > 0 && <small className="mc-possuo"> {" "}{t("possuo")}{" "}{possuo.get(r.id)}</small>}
                            {meusIds.has(r.id) && <small className="mc-possuo"> {" "}{t("no seu deck")}</small>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="left-tabs mc-cats" role="tablist" aria-label={t("Tipo de carta")}>
                  <button className={categoria === "todas" ? "active" : ""} onClick={() => setCategoria("todas")}>
                    {t("Todas ({0})", [recs.length])}</button>
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
                            {r.maximo < 3 && <span className="mc-selo mc-selo-ban">{t("máx. {0}", [r.maximo])}</span>}
                            {(possuo.get(r.id) ?? 0) > 0 && <span className="mc-selo mc-selo-possuo">{t("possuo")}{" "}{possuo.get(r.id)}</span>}
                            {meusIds.has(r.id) && <span className="mc-selo mc-selo-possuo">{t("no seu deck")}</span>}
                          </div>
                          <small className="mc-papel">{r.item.papel}</small>
                          <div className="mc-nota" title={t("Nota final: 70% o confronto com os decks escolhidos e 30% o uso real em torneios")}>
                            <span className="mc-barra">
                              <span style={{ width: pct(r.total) }} />
                            </span>
                            <strong>{Math.round(r.total * 100)}</strong>
                            <small>
                              {t("contra estes decks {0} · uso em torneios {1}", [Math.round(r.contra * 100), pct(r.uso)])}
                              {r.noSide > 0.05 && t(" · no Side de {0} deles", [pct(r.noSide)])}
                            </small>
                          </div>
                          <div className="mc-por-deck">
                            {r.porDeck.map((d) => (
                              <span key={d.arquetipo} className="mc-chip" title={d.motivo} style={{ ["--nota" as string]: d.nota }}>
                                {d.arquetipo} <strong>{Math.round(d.nota * 100)}</strong>
                                {d.motor && <small title={t("Calculado com as linhas do motor de regras")}> ⚙</small>}
                              </span>
                            ))}
                          </div>
                          <small className="mc-motivo">
                            {t("Melhor contra")}{" "}<strong>{melhor.arquetipo}</strong>: {melhor.motivo}.
                            {r.porDeck.length > 1 && pior.nota < 0.3 && (
                              <>
                                {" "}{t("Fraca contra")}{" "}<strong>{pior.arquetipo}</strong>.
                              </>
                            )}
                          </small>
                          {r.requisito && <small className="mc-requisito">{t("Requisito: {0}.", [r.requisito])}</small>}
                          {r.aviso && <small className="mc-aviso">{t("Atenção: {0}.", [r.aviso])}</small>}
                          {aberta === r.id ? (
                            <ul className="mc-detalhe">
                              {r.porDeck.map((d) => (
                                <li key={d.arquetipo}>
                                  <strong>{d.arquetipo}</strong> ({Math.round(d.nota * 100)}): {d.motivo}
                                  {d.alvos.length > 0 && (
                                    <>
                                      <span className="field-label mc-alvos-titulo">{t("Choke points: onde ela acerta o deck")}</span>
                                      <ul className="mc-alvos">{d.alvos.map((a, i) => alvo(a, i))}</ul>
                                    </>
                                  )}
                                </li>
                              ))}
                              <li>
                                <button className="link-btn" onClick={() => setAberta(null)}>
                                  {t("Fechar detalhes")}</button>
                              </li>
                            </ul>
                          ) : (
                            <button className="link-btn mc-ver" onClick={() => setAberta(r.id)}>
                              {r.porDeck.length > 1 ? t("Ver o motivo e os choke points em cada deck") : t("Ver os choke points")}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="tags-note">
                  {t("Nota de cada deck: o que o motor do deck faz (lido do texto oficial das cartas do núcleo de torneio) e, com ⚙, as linhas do motor de regras — em que passo a carta já pode responder e quanto do combo ela corta. A banlist do {0} define as cartas e as cópias. É uma indicação para estudar o meta, não uma garantia: confira o texto das cartas.", [escolha.formato])}</p>
              </>
            )}
          </section>
        </div>
      )}
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
