import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardPreview from "../components/CardPreview";
import CardPicker from "../components/CardPicker";
import ComboSearch, { ComboCard } from "../components/ComboSearch";
import ComboDeVideo from "../components/ComboDeVideo";
import { FontesButton } from "../components/Fontes";
import KnownCombos from "../components/KnownCombos";
import VerifiedCombos from "../components/VerifiedCombos";
import { KNOWN_COMBOS } from "../data/combos";
import { initCardDb, useCardDb } from "../db/cardStore";
import { FORMATS, legalIn, type GameFormat } from "../db/legality";
import { cardsOfLine, linesForHand, semCartaDoCalculo, uniqueLines, type LinhaCombo } from "../db/motor";
import { deckDoCombo, type DeckTemporario } from "../db/decks";
import type { ComboTeste } from "./TesteJogo";
import { comboPorId, combosDaComunidade, type ComboBase } from "../db/baseCombos";
import BotaoLink from "../components/BotaoLink";
import type { Rota } from "../rotas";
import { supabaseReady } from "../db/supabase";
import { exportarTodos, useCombosLocais } from "../db/combosLocais";
import { temRecursosAvancados, useConta } from "../db/conta";
import { bilingualName, displayName, type Card } from "../db/types";
import "./combos.css";
import { t, LOCALE } from "../i18n";
import Lateral from "../components/Lateral";

/** Nome do arquétipo (oficial, em inglês) com o nome em português ao lado, quando é outro */
function arquetipoBilingue(en: string, cards: Card[]) {
  const pt = cards.find((c) => c.archetype?.toLowerCase() === en.toLowerCase())?.archetypePt;
  return pt && pt.toLowerCase() !== en.toLowerCase() ? `${en} · ${pt}` : en;
}

/**
 * Combos da Comunidade (criados no Teste de Jogo e compartilhados): os que começam com a mão
 * escolhida ou, sem mão, os mais recentes; com autor, data e validade na banlist do formato
 */
function CombosComunidade({
  mao,
  byId,
  format,
  onHover,
  onTestar,
}: {
  mao: number[];
  byId: Map<number, Card>;
  format: GameFormat;
  onHover: (card: Card | null, el?: HTMLElement) => void;
  onTestar?: (combo: ComboBase) => void;
}) {
  const [lista, setLista] = useState<ComboBase[]>([]);
  const conta = useConta();
  // combos só neste aparelho (Usuário Padrão), com a mesma regra da mão
  const todosLocais = useCombosLocais();
  const locais = todosLocais.filter((c) => mao.every((id) => c.iniciais.includes(id)));
  const [exportacao, setExportacao] = useState<{ tipo: "ok" | "erro" | "enviando"; texto: string } | null>(null);
  const exportarLocais = async (compartilhar: boolean) => {
    setExportacao({ tipo: "enviando", texto: t("Exportando…") });
    const r = await exportarTodos(compartilhar, byId);
    setExportacao(
      r.erros.length
        ? { tipo: "erro", texto: t("{0} exportado(s); falharam: {1}", [r.enviados, r.erros.join(" · ")]) }
        : { tipo: "ok", texto: t("{0} combo(s) exportado(s) para a base{1}.", [r.enviados, compartilhar ? t(" e compartilhado(s)") : ""]) },
    );
  };
  const chave = mao.join(",");
  useEffect(() => {
    let vivo = true;
    combosDaComunidade(chave ? chave.split(",").map(Number) : [], chave ? 20 : 8)
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [chave]);
  if ((!supabaseReady() || !lista.length) && !locais.length) return null;
  const destaque = new Set(mao);
  return (
    <section className="combos-comunidade">
      {locais.length > 0 && (
        <div className="combos-locais">
          <h3>{t("Meus combos neste aparelho ({0})", [locais.length])}</h3>
          <p className="tags-note">
            {t("Criados como Usuário Padrão: ficam só aqui. {0}", [temRecursosAvancados(conta) ? t("Exporte para levá-los à base (Combos da Comunidade).") : t("Usuários Avançado ou Mentor podem exportá-los para a base.")])}
          </p>
          {temRecursosAvancados(conta) && todosLocais.length > 0 && (
            <div className="combos-exportar-todos">
              <button className="ghost-btn" disabled={exportacao?.tipo === "enviando"} onClick={() => void exportarLocais(false)}>
                {t("Exportar todos ({0})", [todosLocais.length])}</button>
              <button className="ghost-btn" disabled={exportacao?.tipo === "enviando"} onClick={() => void exportarLocais(true)}>
                {t("Exportar e compartilhar todos")}</button>
            </div>
          )}
          {exportacao && <p className={exportacao.tipo === "erro" ? "db-warning" : "conta-ok"}>{exportacao.texto}</p>}
          {locais.map((c) => (
            <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={destaque} format={format} onTestar={onTestar} />
          ))}
        </div>
      )}
      {supabaseReady() && lista.length > 0 && (
      <>
      <h3>{mao.length ? t("Combos da Comunidade com esta mão") : t("Combos da Comunidade recentes")}</h3>
      {lista.map((c) => (
        <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={destaque} format={format} onTestar={onTestar} />
      ))}
      <p className="tags-note">{t("Criados por usuários no Teste de Jogo e compartilhados: confira antes de usar.")}</p>
      </>
      )}
    </section>
  );
}

/** `initialHand`: cartas já na mão ao abrir (vindas da busca) */
export default function Combos({
  onBack,
  initialHand = [],
  onTestar,
  comboId,
  maoIds,
  onRota,
}: {
  onBack: () => void;
  initialHand?: Card[];
  /** link compartilhado: um Combo da Comunidade (#/combo/<id>) */
  comboId?: string;
  /** link compartilhado: a mão inicial (#/combos/mao/<ids>) */
  maoIds?: number[];
  /** o endereço acompanha a mão escolhida */
  onRota?: (r: Rota) => void;
  /** abre o Teste de Jogo com um deck temporário da linha */
  onTestar?: (deck: DeckTemporario, combo: ComboTeste) => void;
}) {
  const db = useCardDb();
  const [format, setFormat] = useState<GameFormat>("TCG");
  const [hand, setHand] = useState<Card[]>(initialHand);
  // "mao": o que a mão inicial alcança; "search": Combo Search (iniciais e/ou finais, com IA);
  // "video": combo lido de um vídeo do YouTube pelo Gemini (experimental)
  const [modo, setModo] = useState<"mao" | "search" | "video">("mao");
  // interrupções de mão que o oponente poderia ativar em cada passo (calculado no pipeline)
  const [respostas, setRespostas] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => void initCardDb(), []);
  useEffect(() => inputRef.current?.focus(), [db.status]);

  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);

  // link da mão (#/combos/mao/…): as cartas entram assim que a base carregar
  const maoDoLink = useRef(false);
  useEffect(() => {
    if (maoDoLink.current || !maoIds?.length || !byId.size) return;
    maoDoLink.current = true;
    setHand(maoIds.map((id) => byId.get(id)).filter((c): c is Card => !!c));
  }, [maoIds, byId]);
  // link de um combo (#/combo/<id>): busca na base (só os compartilhados, ou os do próprio autor)
  const [compartilhado, setCompartilhado] = useState<{ status: "carregando" | "ok" | "nao" | "erro"; combo?: ComboBase; erro?: string } | null>(comboId ? { status: "carregando" } : null);
  useEffect(() => {
    if (!comboId) return setCompartilhado(null);
    let vivo = true;
    setCompartilhado({ status: "carregando" });
    comboPorId(comboId)
      .then((c) => vivo && setCompartilhado(c ? { status: "ok", combo: c } : { status: "nao" }))
      .catch((e) => vivo && setCompartilhado({ status: "erro", erro: e instanceof Error ? e.message : String(e) }));
    return () => {
      vivo = false;
    };
  }, [comboId]);
  // o endereço mostra a mão escolhida (o do combo compartilhado fica até a mão mudar)
  const primeiraMao = useRef(true);
  useEffect(() => {
    if (primeiraMao.current) {
      primeiraMao.current = false;
      if (comboId) return;
    }
    onRota?.({ tela: "combos", mao: hand.map((c) => c.id) });
  }, [hand]); // eslint-disable-line react-hooks/exhaustive-deps
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);

  const combos = db.extras?.combos;
  const known = useMemo(() => new Map(KNOWN_COMBOS.map((k) => [k.id, k])), []);

  // Uma linha vale em qualquer formato em que todas as cartas dela existam (e não sejam proibidas):
  // só uma carta exclusiva do OCG (ou proibida no TCG) deixa a linha só no OCG, e vice-versa.
  const fits = useCallback(
    (l: LinhaCombo) =>
      cardsOfLine(l).every((id) => {
        const c = byId.get(id);
        return !c || legalIn(c, format);
      }),
    [format, byId],
  );
  // linhas calculadas no motor cuja mão inicial está na mão escolhida
  const lines = useMemo(
    () => uniqueLines(linesForHand(combos, hand.map((c) => c.id)).filter(fits)).sort((x, y) => y.pontos - x.pontos),
    [combos, hand, fits],
  );
  // linhas que passam pelas cartas escolhidas sem começar com elas: como chegar nelas e o que fazer depois
  const reach = useMemo(() => {
    if (!combos || !hand.length) return [];
    const ids = hand.map((c) => c.id);
    const start = new Set(lines);
    return uniqueLines(combos.linhas.filter((l) => !start.has(l) && fits(l) && ids.some((id) => !l.mao.includes(id) && cardsOfLine(l).includes(id))))
      .sort((x, y) => y.pontos - x.pontos)
      .slice(0, 12);
  }, [combos, hand, lines, fits]);
  const handNames = hand.map((c) => displayName(c)).join(", ");

  // linhas escritas pela comunidade só aparecem quando o motor as confirmou
  const confirmed = KNOWN_COMBOS.filter((k) => lines.some((l) => l.comunidade === k.id));

  // cartas que iniciam combos calculados sozinhas (atalhos na tela vazia), por deck
  const starters = useMemo(() => {
    if (!combos) return [];
    return combos.decks.map((d, i) => ({
      deck: d,
      cards: [...new Set(combos.linhas.filter((l) => l.deck === i && l.mao.length === 1 && fits(l)).map((l) => l.mao[0]))]
        .map((id) => byId.get(id))
        .filter((c): c is Card => !!c),
    })).filter((s) => s.cards.length);
  }, [combos, byId, fits]);

  // prévia ao passar o mouse (mesmo popup da busca)
  const [hover, setHover] = useState<{ card: Card; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const onHover = useCallback((card: Card | null, el?: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (!card || !el) return setHover(null);
    hoverTimer.current = window.setTimeout(() => setHover({ card, rect: el.getBoundingClientRect() }), 300);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const addCard = (c: Card) => {
    setHand((h) => [...h, c]);
    inputRef.current?.focus();
  };

  const ready = db.status === "ready";
  // Teste de Jogo de uma linha: deck temporário "<arquétipo> Temporário" com as cartas dela
  const testar = onTestar
    ? (l: LinhaCombo) => {
        const linha = semCartaDoCalculo(l);
        onTestar(deckDoCombo(linha, byId, format), { mao: linha.mao, passos: linha.passos, campo: linha.campo, qualquer: linha.qualquer });
      }
    : undefined;
  // o mesmo para um Combo da Comunidade
  const testarDaComunidade = onTestar
    ? (c: ComboBase) => {
        onTestar(deckDoCombo({ mao: c.iniciais, passos: c.dados.passos, campo: c.dados.campo }, byId, format), { mao: c.iniciais, passos: c.dados.passos, campo: c.dados.campo });
      }
    : undefined;
  // "Editar e Importar" (combo lido de vídeo): Teste de Jogo já no combo, para refazer os passos e
  // salvar pelo Criar combo com o título e o link do vídeo
  const editarEImportar = onTestar
    ? (c: ComboBase) => {
        onTestar(deckDoCombo({ mao: c.iniciais, passos: c.dados.passos, campo: c.dados.campo }, byId, format), { mao: c.iniciais, passos: c.dados.passos, titulo: c.titulo, fontes: c.dados.fontes, iniciar: true });
      }
    : undefined;
  const legal = useCallback((id: number) => {
    const c = byId.get(id);
    return !c || legalIn(c, format);
  }, [byId, format]);
  const toggleRespostas = (
    <label className="respostas-toggle">
      <input type="checkbox" checked={respostas} onChange={(e) => setRespostas(e.target.checked)} /> {" "}{t("Mostrar respostas do oponente")}</label>
  );

  // alternância entre os dois modos, no topo da coluna da esquerda
  const modos = (
    <div className="left-tabs combos-modos" role="tablist" aria-label={t("Modo")}>
      <button role="tab" aria-selected={modo === "mao"} className={modo === "mao" ? "active" : ""} onClick={() => setModo("mao")}>
        {t("Mão inicial")}</button>
      <button role="tab" aria-selected={modo === "search"} className={modo === "search" ? "active" : ""} onClick={() => setModo("search")}>
        {t("Combo Search")}</button>
      <button role="tab" aria-selected={modo === "video"} className={modo === "video" ? "active" : ""} onClick={() => setModo("video")} title={t("Experimental: o Gemini lê o combo de um vídeo do YouTube")}>
        {t("Vídeo")}</button>
    </div>
  );

  return (
    <ScreenShell
      title={t("Combos")}
      accent="magenta"
      onBack={onBack}
      actions={
        // canto superior direito: o formato vale para a mão, as sugestões e as linhas
        <div className="format-switch combos-format" role="radiogroup" aria-label={t("Formato")}>
          {FORMATS.map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={format === f}
              className={format === f ? "active" : ""}
              onClick={() => setFormat(f)}
              title={t("Combos em que todas as cartas existem no {0} e não são proibidas nele", [f])}
            >
              {f}
            </button>
          ))}
        </div>
      }
      plain
    >
      {!ready ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? t("Carregando base de cartas…")}</p>
        </div>
      ) : (
        modo === "video" ? (
          <ComboDeVideo tabs={modos} all={db.cards} byId={byId} format={format} onHover={onHover} onEditar={editarEImportar} />
        ) : modo === "search" ? (
          <ComboSearch tabs={modos} extra={toggleRespostas} respostas={respostas} legal={legal} all={db.cards} byId={byId} format={format} combos={combos} known={known} fits={fits} onHover={onHover} />
        ) : (
        <div className="combos">
          <Lateral como="section" className="combos-setup" titulo={t("Mão inicial")} inicialAberta={!hand.length}>
            {modos}
            <CardPicker
              label={t("Mão inicial")}
              cards={hand}
              onChange={setHand}
              all={db.cards}
              format={format}
              inputRef={inputRef}
              placeholder={t("Escolha uma carta (ex.: Mitsurugi Prayers)")}
              placeholderMore={t("Acrescentar outra carta à mão…")}
            />
            {hand.length > 0 && <BotaoLink rota={{ tela: "combos", mao: hand.map((c) => c.id) }} className="combos-link" />}
            {toggleRespostas}
          </Lateral>

          <section className="combos-result">
            {compartilhado && (
              <section className="combo-compartilhado">
                <h3>{t("Combo compartilhado")}</h3>
                {compartilhado.status === "carregando" && <p className="tags-note">{t("Carregando o combo…")}</p>}
                {compartilhado.status === "ok" && compartilhado.combo && (
                  <ComboCard combo={compartilhado.combo} byId={byId} onHover={onHover} highlight={new Set()} format={format} onTestar={testarDaComunidade} />
                )}
                {compartilhado.status === "nao" && <p className="db-warning">{t("Este combo não existe ou não foi compartilhado pelo autor.")}</p>}
                {compartilhado.status === "erro" && <p className="db-warning">{t("Não foi possível carregar o combo: {0}", [compartilhado.erro])}</p>}
              </section>
            )}
            {!combos ? (
              <div className="combos-empty">
                <p>{t("Os combos calculados ainda não foram baixados.")}</p>
                <small>{t("Eles chegam com a camada de marcações da base; confira a conexão e abra a tela de novo.")}</small>
              </div>
            ) : !hand.length ? (
              <div className="combos-empty">
                <p>{t("Escolha uma ou mais cartas para a mão inicial.")}</p>
                <small>
                  {t("Só aparecem linhas que o App conseguiu jogar, com as regras do EDOPro, usando decklists reais de torneio: custos, condições de ativação, travas, “uma vez por turno” e o limite de Invocação-Normal são aplicados pelos scripts oficiais das cartas, no primeiro turno e com o oponente passando.")}</small>
                {starters.map((s) => (
                  <div key={s.deck.url} className="starter-chips">
                    <span className="field-label">{arquetipoBilingue(s.deck.busca, s.cards)}</span>
                    {s.cards.map((c) => (
                      <button key={c.id} className="chip" onClick={() => addCard(c)} title={bilingualName(c)}>
                        {displayName(c)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : !lines.length && !reach.length ? (
              <div className="combos-empty">
                <p>{t("Nenhum combo calculado com esta mão, nem chegando nela, no {0}.", [format])}</p>
                <small>
                  {t("O App testa cada carta dos decks abaixo sozinha na mão (e as mãos das linhas da comunidade), com a banlist atual de cada formato. Uma mão sem linha aqui não chegou a um campo com Invocação do Extra Deck ou 3+ Invocações, ou a linha usa carta proibida ou não lançada no {0}.", [format])}</small>
                <ul className="combos-decks">
                  {combos.decks.map((d) => (
                    <li key={d.url}>
                      {d.nome}
                      {d.evento && <small> · {d.evento}</small>}
                    </li>
                  ))}
                </ul>
                <FontesButton sites={["ygoprodeck", "project-ignis"]} links={combos.decks.map((d) => ({ nome: `Deck: ${d.nome}`, url: d.url }))} />
              </div>
            ) : (
              <>
                <VerifiedCombos
                  title={t("Combos começando com a mão")}
                  lines={lines}
                  combos={combos}
                  byId={byId}
                  known={known}
                  onHover={onHover}
                  respostas={respostas}
                  legal={legal}
                  onTestar={testar}
                />
                <VerifiedCombos
                  title={t("Combos que chegam em {0}", [handNames])}
                  lines={reach}
                  highlight={hand.map((c) => c.id)}
                  combos={combos}
                  byId={byId}
                  known={known}
                  onHover={onHover}
                  respostas={respostas}
                  legal={legal}
                  onTestar={testar}
                />
                {confirmed.length > 0 && (
                  <KnownCombos
                    title={t("Linhas da comunidade conferidas com o App")}
                    combos={confirmed}
                    byName={byName}
                    format={format}
                    onHover={onHover}
                  />
                )}
                <p className="tags-note combos-disclaimer">
                  {t("Calculado com o App em {0} (scripts {1}). O cálculo não simula interrupções do oponente.", [new Date(combos.geradoEm).toLocaleDateString(LOCALE), combos.motor.scripts])}{" "}<FontesButton sites={["project-ignis", "ygoprodeck"]} />
                </p>
              </>
            )}
            <CombosComunidade mao={hand.map((c) => c.id)} byId={byId} format={format} onHover={onHover} onTestar={testarDaComunidade} />
          </section>
        </div>
        )
      )}
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
