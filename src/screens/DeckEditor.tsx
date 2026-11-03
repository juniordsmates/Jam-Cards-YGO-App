import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import ScreenShell from "./ScreenShell";
import { initCardDb, useCardDb } from "../db/cardStore";
import { temRecursosAvancados, useConta } from "../db/conta";
import { copiasPorCarta, juntarColecaoDaConta, useColecao } from "../db/colecao";
import {
  avisos,
  contagem,
  criarDeck,
  deckComNome,
  definirPadrao,
  ehExtra,
  excluirDeck,
  lerDeckList,
  motivoBloqueio,
  ordenarParte,
  salvarDeck,
  trazerDecksDaConta,
  useDecks,
  type Deck,
  type Parte,
} from "../db/decks";
import { cardImage } from "../db/images";
import { ATTRIBUTES, kindLabel, levelLabel, MONSTER_CLASSES, MONSTER_RACES, SPELL_TYPES, TRAP_TYPES } from "../db/labels";
import { FORMATS, type GameFormat } from "../db/legality";
import { EMPTY_FILTERS, searchCards, type Filters, type SortKey } from "../db/search";
import { bilingualName, categoryOf, displayName, type Card } from "../db/types";
import CardSelos, { PapeisDaCarta } from "../components/CardSelos";
import TesteJogo, { type ComboTeste } from "./TesteJogo";
import "./deck-editor.css";
import { t, LOCALE } from "../i18n";
import Lateral from "../components/Lateral";

const POR_PAGINA = 24;
// grade do deck: 10 cartas por linha no Main (4 a 6 linhas, até 60) e as 15 do Extra numa linha só
const COLUNAS_MAIN = 10;
const COLUNAS_EXTRA = 15;
const VAO = 4; // espaço entre as cartas (px)
const PROPORCAO = 86 / 59; // altura / largura da carta
const SEM_LIMITE = "cartas-editor-sem-limite";
const ESTOQUE = "cartas-editor-estoque";

/** Estoque de cartas (Minha Coleção) no editor: não aplicar, listar todas ou só as que possuo */
type Estoque = "nao" | "todas" | "possuo";
const ESTOQUES: { id: Estoque; label: string }[] = [
  { id: "nao", label: t("Não Aplicar Estoque de Cartas") },
  { id: "todas", label: t("Listar todas as cartas") },
  { id: "possuo", label: t("Listar apenas cartas que possuo") },
];
// sem Side Deck no editor
const PARTES: { id: Parte; label: string }[] = [
  { id: "main", label: t("Deck") },
  { id: "extra", label: t("Extra") },
];

type Nomeando = { modo: "novo" | "renomear" | "salvarComo"; valor: string } | null;

/** Como o editor abre: direto no Teste de Jogo, num deck e (vindo de Combos) com uma linha */
export interface EditorInicial {
  deckId?: string;
  testar?: boolean;
  combo?: ComboTeste;
}

export default function DeckEditor({ onBack, inicial = {} }: { onBack: () => void; inicial?: EditorInicial }) {
  const db = useCardDb();
  const conta = useConta();
  const { decks, padrao } = useDecks();
  const [formato, setFormato] = useState<GameFormat>("TCG");
  // "Desativar limite de cartas": sem banlist e sem conferir o formato (fica salvo neste computador)
  const [semLimite, setSemLimite] = useState(() => {
    try {
      return localStorage.getItem(SEM_LIMITE) === "1";
    } catch {
      return false;
    }
  });
  // estoque: compara o deck com Minha Coleção (fica salvo neste computador)
  const [estoque, setEstoque] = useState<Estoque>(() => {
    try {
      const v = localStorage.getItem(ESTOQUE);
      return v === "todas" || v === "possuo" ? v : "nao";
    } catch {
      return "nao";
    }
  });
  const escolherEstoque = (v: Estoque) => {
    setEstoque(v);
    try {
      localStorage.setItem(ESTOQUE, v);
    } catch {
      // armazenamento indisponível: vale só nesta sessão
    }
  };
  const { itens: itensColecao } = useColecao();
  const naColecao = useMemo(() => copiasPorCarta(itensColecao), [itensColecao]);
  const alternarSemLimite = (v: boolean) => {
    setSemLimite(v);
    try {
      localStorage.setItem(SEM_LIMITE, v ? "1" : "0");
    } catch {
      // armazenamento indisponível: vale só nesta sessão
    }
  };
  const [deckId, setDeckId] = useState<string | undefined>(inicial.deckId ?? padrao ?? decks[0]?.id);
  // cópia de trabalho: as mudanças só vão para os decks salvos em "Salvar"
  const [trabalho, setTrabalho] = useState<Deck | null>(null);
  const [preview, setPreview] = useState<Card | null>(null);
  const [filtros, setFiltros] = useState<Filters>({ ...EMPTY_FILTERS, sort: "name" });
  const [pagina, setPagina] = useState(0);
  const [nomeando, setNomeando] = useState<Nomeando>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  // tamanho das cartas do deck: o maior em que Main e Extra cabem inteiros no centro, sem rolar
  const centroRef = useRef<HTMLElement>(null);
  const [cartaPx, setCartaPx] = useState({ main: 60, extra: 50, linhas: 4 });
  // "Importar deck list": painel com arquivo .ydk ou texto/link colado
  const [importando, setImportando] = useState(false);
  const [textoImport, setTextoImport] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const arrastando = useRef<{ id: number; de?: Parte; indice?: number } | null>(null);
  // Teste de Jogo (Solo Mode) com o deck aberto
  const [testando, setTestando] = useState(!!inicial.testar);
  // Teste Avançado (campo do oponente e Indicações de resposta): Usuário Avançado ou Mentor
  const [avancado, setAvancado] = useState(false);
  const podeAvancado = temRecursosAvancados(conta);
  const abrirTeste = (modo: "simples" | "avancado") => {
    setAvancado(modo === "avancado");
    setTestando(true);
  };

  useEffect(() => void initCardDb(), []);
  // com conta: traz os decks salvos nela que ainda não estão neste computador
  useEffect(() => {
    if (conta) void trazerDecksDaConta();
    if (conta) void juntarColecaoDaConta();
  }, [conta]);

  const salvo = decks.find((d) => d.id === deckId) ?? null;
  useEffect(() => {
    if (!deckId && decks[0]) setDeckId(padrao ?? decks[0].id);
  }, [decks, deckId, padrao]);
  useEffect(() => setTrabalho(salvo ? { ...salvo, main: [...salvo.main], extra: [...salvo.extra], side: [...salvo.side] } : null), [salvo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => {
    const m = new Map(db.cards.map((c) => [c.id, c]));
    return m;
  }, [db.cards]);

  // ids de artes alternativas (dos .ydk) → id da carta
  const idCanonico = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of db.cards) for (const img of [c.id, ...c.images]) m.set(img, c.id);
    return (id: number) => m.get(id);
  }, [db.cards]);

  const resultados = useMemo(
    () =>
      searchCards(db.cards, filtros, db.archetypePt).filter(
        (c) => c.frame !== "skill" && c.frame !== "token" && (estoque !== "possuo" || (naColecao.get(c.id) ?? 0) > 0),
      ),
    [db.cards, filtros, db.archetypePt, estoque, naColecao],
  );
  const paginas = Math.max(1, Math.ceil(resultados.length / POR_PAGINA));
  useEffect(() => setPagina(0), [filtros]);

  const alterado = !!trabalho && !!salvo && JSON.stringify([trabalho.main, trabalho.extra, trabalho.side]) !== JSON.stringify([salvo.main, salvo.extra, salvo.side]);
  const avisar = (tipo: "ok" | "erro", texto: string) => setMensagem({ tipo, texto });

  // ---------------------------------------------------------------- edição

  const adicionar = (c: Card, parte?: Parte, indice?: number) => {
    const destino: Parte = parte ?? (ehExtra(c) ? "extra" : "main");
    // sem deck aberto: a primeira carta cria "Novo deck" já com ela
    const deck: Deck = trabalho ?? { id: "", nome: "Novo deck", main: [], extra: [], side: [], atualizadoEm: "" };
    const motivo = motivoBloqueio(deck, c, destino, formato, semLimite);
    if (motivo) return avisar("erro", motivo);
    const lista = [...deck[destino]];
    lista.splice(indice ?? lista.length, 0, c.id);
    setMensagem(null);
    if (!trabalho) return setDeckId(criarDeck(t("Novo deck"), { main: [], extra: [], side: [], [destino]: lista }).id);
    setTrabalho({ ...deck, [destino]: lista });
  };

  const remover = (parte: Parte, indice: number) => {
    if (!trabalho) return;
    setTrabalho({ ...trabalho, [parte]: trabalho[parte].filter((_, i) => i !== indice) });
  };

  const mover = (de: Parte, indice: number, para: Parte, destinoIndice?: number) => {
    if (!trabalho) return;
    const id = trabalho[de][indice];
    const c = byId.get(id);
    if (!c) return;
    if (de === para) {
      const lista = trabalho[de].filter((_, i) => i !== indice);
      lista.splice(Math.min(destinoIndice ?? lista.length, lista.length), 0, id);
      return setTrabalho({ ...trabalho, [de]: lista });
    }
    // mover entre partes: a carta sai de uma e precisa caber na outra (as cópias não mudam)
    const semEla = { ...trabalho, [de]: trabalho[de].filter((_, i) => i !== indice) };
    const motivo = motivoBloqueio({ ...semEla, main: semEla.main, extra: semEla.extra, side: semEla.side, [para]: semEla[para] } as Deck, c, para, formato, semLimite);
    if (motivo && !motivo.startsWith("Limite de") && !motivo.startsWith("Carta proibida")) return avisar("erro", motivo);
    const lista = [...semEla[para]];
    lista.splice(destinoIndice ?? lista.length, 0, id);
    setTrabalho({ ...semEla, [para]: lista });
  };

  // ---------------------------------------------------------------- arrastar e soltar

  const arrastar = (id: number, de?: Parte, indice?: number) => (e: DragEvent) => {
    arrastando.current = { id, de, indice };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };
  const soltar = (para: Parte, destinoIndice?: number) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const a = arrastando.current;
    arrastando.current = null;
    if (!a) return;
    if (a.de !== undefined && a.indice !== undefined) mover(a.de, a.indice, para, destinoIndice);
    else {
      const c = byId.get(a.id);
      if (c) adicionar(c, para, destinoIndice);
    }
  };
  /** Soltar a carta do deck fora das partes (na busca) a retira do deck */
  const soltarFora = (e: DragEvent) => {
    e.preventDefault();
    const a = arrastando.current;
    arrastando.current = null;
    if (a?.de !== undefined && a.indice !== undefined) remover(a.de, a.indice);
  };

  // ---------------------------------------------------------------- deck

  const confirmarNome = () => {
    if (!nomeando) return;
    const nome = nomeando.valor.trim();
    if (!nome) return;
    const existente = deckComNome(nome, nomeando.modo === "renomear" ? trabalho?.id : undefined);
    if (nomeando.modo === "novo") setDeckId(criarDeck(nome).id);
    else if (nomeando.modo === "salvarComo" && trabalho) setDeckId(criarDeck(nome, { main: trabalho.main, extra: trabalho.extra, side: trabalho.side }).id);
    else if (nomeando.modo === "renomear" && trabalho && existente) {
      // renomear para um nome que já existe: este deck vai por cima do existente
      salvarDeck({ ...existente, main: trabalho.main, extra: trabalho.extra, side: trabalho.side });
      excluirDeck(trabalho.id);
      setDeckId(existente.id);
    } else if (nomeando.modo === "renomear" && trabalho) {
      const d = salvarDeck({ ...(salvo ?? trabalho), nome });
      setTrabalho({ ...trabalho, nome: d.nome });
    }
    if (existente) avisar("ok", nomeando.modo === "novo" ? t("Já existe um deck \"{0}\": ele foi aberto.", [existente.nome]) : t("Salvo por cima do deck \"{0}\", que já existia.", [existente.nome]));
    setNomeando(null);
  };

  const salvar = () => {
    if (!trabalho) return;
    salvarDeck(trabalho);
    avisar("ok", conta ? t("Deck salvo neste computador e na sua conta.") : t("Deck salvo neste computador."));
  };

  /**
   * Importa uma deck list (.ydk ou ydke://) como deck novo, com o nome do arquivo; se já existir um
   * deck com esse nome, salva por cima dele (um deck por nome). O Side é ignorado.
   */
  const importarDeckList = (texto: string, nomeArquivo?: string) => {
    const { deck, ignorados } = lerDeckList(texto, idCanonico);
    if (!deck.main.length && !deck.extra.length) return avisar("erro", "Nenhuma carta reconhecida. Use um arquivo .ydk (#main, #extra, !side) ou um link ydke://.");
    const nome = nomeArquivo?.replace(/\.(ydk|txt)$/i, "").trim() || t("Deck importado");
    const novo = criarDeck(nome, { main: deck.main, extra: deck.extra, side: [] });
    setDeckId(novo.id);
    setTrabalho({ ...novo, main: [...novo.main], extra: [...novo.extra], side: [] });
    setImportando(false);
    setTextoImport("");
    avisar(
      "ok",
      t("Importado \"{0}\": {1} no Main e {2} no Extra{3}{4}.", [novo.nome, deck.main.length, deck.extra.length, deck.side.length ? t(" (Side ignorado: {0})", [deck.side.length]) : "", ignorados ? t(" ({0} cartas não reconhecidas)", [ignorados]) : ""]),
    );
  };
  const lerArquivo = (f?: File | null) => {
    if (f) void f.text().then((t) => importarDeckList(t, f.name));
  };

  // trocar de deck com alterações não salvas pede confirmação na própria tela
  const [trocaPendente, setTrocaPendente] = useState<string | null>(null);
  const trocarDeck = (id: string, forcar = false) => {
    if (alterado && !forcar) return setTrocaPendente(id);
    setTrocaPendente(null);
    setDeckId(id);
    setMensagem(null);
  };

  // ---------------------------------------------------------------- tamanho das cartas do deck

  const qtdMain = trabalho?.main.length ?? 0;
  useLayoutEffect(() => {
    const centro = centroRef.current;
    if (!centro) return;
    const medir = () => {
      const grade = centro.querySelector<HTMLElement>(".de-main .de-grade");
      const titulo = centro.querySelector<HTMLElement>(".de-titulo");
      if (!grade) return;
      const linhas = Math.max(4, Math.ceil(qtdMain / COLUNAS_MAIN));
      const largura = grade.clientWidth;
      const estilo = getComputedStyle(centro);
      // fora do centro: espaçamento interno do painel, título, vãos entre blocos e o respiro de cada bloco
      const altura =
        centro.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom) - (titulo?.offsetHeight ?? 0) - 2 * 10 - 4 * 8;
      let extra = Math.floor((largura - (COLUNAS_EXTRA - 1) * VAO) / COLUNAS_EXTRA);
      let main = Math.floor((largura - (COLUNAS_MAIN - 1) * VAO) / COLUNAS_MAIN);
      // tela larga (três colunas): a altura também limita; no celular (uma coluna), só a largura
      if (window.innerWidth > 1100) {
        const cabeAltura = (altura - extra * PROPORCAO - (linhas - 1) * VAO) / linhas / PROPORCAO;
        main = Math.min(main, Math.floor(cabeAltura));
        extra = Math.min(extra, main);
      }
      setCartaPx({ main: Math.max(10, main), extra: Math.max(10, extra), linhas });
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(centro);
    return () => obs.disconnect();
    // o centro só existe com a base carregada e fora do Teste de Jogo
  }, [qtdMain, trabalho?.id, db.status, testando]);

  // ---------------------------------------------------------------- render

  const ready = db.status === "ready";
  const n = trabalho ? contagem(trabalho.main, byId) : { monster: 0, spell: 0, trap: 0 };
  const listaAvisos = trabalho ? avisos(trabalho, byId, formato, semLimite) : [];
  const atualizar = (patch: Partial<Filters>) => setFiltros((f) => ({ ...f, ...patch }));

  // função de desenho (não componente): o React não recria a carta a cada redesenho (hover),
  // o que quebraria arrastos e cliques começados nela
  // estoque (Minha Coleção): no deck, a cópia além das que o usuário possui fica escurecida (conta
  // só a quantidade, somando as raridades; Main antes do Extra); na busca, a carta sem cópia livre
  const possuo = (id: number) => naColecao.get(id) ?? 0;
  const noDeck = (id: number) => (trabalho ? [...trabalho.main, ...trabalho.extra].filter((x) => x === id).length : 0);
  const semEstoque = (id: number, parte?: Parte, indice?: number) => {
    if (estoque === "nao") return false;
    if (!parte || indice === undefined || !trabalho) return possuo(id) - noDeck(id) <= 0;
    const antes = parte === "main" ? trabalho.main.slice(0, indice) : [...trabalho.main, ...trabalho.extra.slice(0, indice)];
    return antes.filter((x) => x === id).length >= possuo(id);
  };

  const thumb = (id: number, parte?: Parte, indice?: number, key?: string) => {
    const c = byId.get(id);
    if (!c) return <div key={key} className="de-thumb de-desconhecida">#{id}</div>;
    const faltando = semEstoque(id, parte, indice);
    return (
      <div
        key={key}
        className={`de-thumb ${faltando ? "de-sem-estoque" : ""}`}
        draggable
        onDragStart={arrastar(id, parte, indice)}
        onDragOver={parte ? (e) => e.preventDefault() : undefined}
        onDrop={parte ? soltar(parte, indice) : undefined}
        onMouseEnter={() => setPreview(c)}
        onClick={() => (parte ? setPreview(c) : adicionar(c))}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault();
          if (parte && indice !== undefined) remover(parte, indice);
          else adicionar(c);
        }}
        title={parte ? t("{0} — botão direito retira", [bilingualName(c)]) : t("{0} — clique adiciona ao Deck (ou ao Extra)", [bilingualName(c)])}
        data-card-id={c.id}
      >
        <img src={cardImage(c.id, "small")} alt={displayName(c)} loading="lazy" draggable={false} />
        <CardSelos card={c} formato={formato} />
        {estoque !== "nao" && !parte && <span className="selo-possuo">{t("possuo {0}", [possuo(id)])}</span>}
      </div>
    );
  };

  return (
    <ScreenShell
      title={testando ? (avancado && podeAvancado ? t("Teste Avançado") : t("Teste de Jogo")) : t("Editor de Deck")}
      accent="magenta"
      onBack={onBack}
      actions={
        <span className="de-topo">
          {!testando && (
            <button className="ghost-btn de-teste" disabled={!trabalho?.main.length} onClick={() => abrirTeste("simples")} title={t("Teste de Jogo (Solo Mode) com este deck")}>
              {t("▶ Teste de Jogo")}</button>
          )}
          {!testando && (
            <button
              className="ghost-btn de-teste de-teste-avancado"
              disabled={!trabalho?.main.length || !podeAvancado}
              onClick={() => abrirTeste("avancado")}
              title={podeAvancado ? t("Teste com o campo do oponente e as Indicações de resposta") : t("Teste Avançado: disponível para Usuário Avançado ou Mentor")}
            >
              {t("▶ Teste Avançado")}</button>
          )}
        <span className="de-formato">
          <div className="format-switch combos-format" role="radiogroup" aria-label={t("Formato")}>
            {FORMATS.map((f) => (
              <button key={f} role="radio" aria-checked={formato === f} className={formato === f ? "active" : ""} onClick={() => setFormato(f)}>
                {f}
              </button>
            ))}
          </div>
          {!testando && (
            <label className="de-sem-limite" title={t("Sem banlist (proibidas, limitadas, semi-limitadas) e sem conferir se a carta saiu no TCG/OCG; continua o máximo de 3 cópias por carta")}>
              <input type="checkbox" checked={semLimite} onChange={(e) => alternarSemLimite(e.target.checked)} /> {" "}{t("Desativar limite de cartas")}</label>
          )}
          {!testando && (
            <select className="de-estoque" value={estoque} onChange={(e) => escolherEstoque(e.target.value as Estoque)} aria-label={t("Estoque de cartas")} title={t("Compara o deck com Minha Coleção")}>
              {ESTOQUES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          )}
        </span>
        </span>
      }
      plain
    >
      {!ready ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? t("Carregando base de cartas…")}</p>
        </div>
      ) : testando && trabalho ? (
        <TesteJogo
          nome={trabalho.nome}
          main={trabalho.main}
          extra={trabalho.extra}
          byId={byId}
          formato={formato}
          onFechar={() => setTestando(false)}
          combo={inicial.combo}
          avancado={avancado && podeAvancado}
          onModo={setAvancado}
        />
      ) : (
        <div className="deck-editor">
          {/* ---------------- esquerda: carta e controles */}
          <Lateral className="de-left" titulo={t("Deck")}>
            {/* opções do deck (escolher, criar, salvar…), num bloco separado da carta */}
            <section className="de-bloco de-opcoes" aria-label={t("Opções do deck")}>
              <h3 className="de-bloco-titulo">{t("Deck")}</h3>
              <div className="de-controles">
                <select value={deckId ?? ""} onChange={(e) => trocarDeck(e.target.value)} aria-label={t("Deck")}>
                  {!decks.length && <option value="">{t("Nenhum deck")}</option>}
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                      {d.id === padrao ? t(" (padrão)") : ""}
                    </option>
                  ))}
                </select>
                {nomeando ? (
                  <div className="de-nome">
                    <input
                      autoFocus
                      value={nomeando.valor}
                      placeholder={t("Nome do deck")}
                      maxLength={80}
                      onChange={(e) => setNomeando({ ...nomeando, valor: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && confirmarNome()}
                      aria-label={t("Nome do deck")}
                    />
                    <button className="ghost-btn" onClick={confirmarNome}>
                      {t("OK")}</button>
                    <button className="ghost-btn" onClick={() => setNomeando(null)}>
                      {t("Cancelar")}</button>
                  </div>
                ) : (
                  <div className="de-botoes">
                    <button className="ghost-btn" onClick={() => setNomeando({ modo: "novo", valor: "" })}>{t("Novo")}</button>
                    <button className="ghost-btn" disabled={!trabalho} onClick={() => setNomeando({ modo: "renomear", valor: trabalho?.nome ?? "" })}>{t("Renomear")}</button>
                    <button className="ghost-btn de-salvar" disabled={!trabalho} onClick={salvar}>
                      {t("Salvar{0}", [alterado ? " •" : ""])}
                    </button>
                    <button className="ghost-btn" disabled={!trabalho} onClick={() => setNomeando({ modo: "salvarComo", valor: `${trabalho?.nome ?? ""} (cópia)` })}>{t("Salvar como")}</button>
                    <button className="ghost-btn de-importar" onClick={() => setImportando(!importando)}>{t("Importar deck list")}</button>
                  <button className="ghost-btn" disabled={!trabalho || trabalho.id === padrao} onClick={() => trabalho && definirPadrao(trabalho.id)}>{t("Definir padrão")}</button>
                    {confirmarExclusao ? (
                      <button
                        className="danger-btn"
                        onClick={() => {
                          if (trabalho) excluirDeck(trabalho.id);
                          setDeckId(undefined);
                          setConfirmarExclusao(false);
                        }}
                      >
                        {t("Confirmar exclusão")}</button>
                    ) : (
                      <button className="ghost-btn" disabled={!trabalho} onClick={() => setConfirmarExclusao(true)}>{t("Excluir")}</button>
                    )}
                  </div>
                )}

                {importando && (
                <div className="de-painel">
                  <label className="ghost-btn de-arquivo">
                    {t("Escolher arquivo .ydk")}<input type="file" accept=".ydk,.txt" onChange={(e) => lerArquivo(e.target.files?.[0])} />
                  </label>
                  <textarea
                    rows={4}
                    placeholder={"Ou cole o conteúdo do .ydk ou um link ydke://"}
                    value={textoImport}
                    onChange={(e) => setTextoImport(e.target.value)}
                    aria-label={t("Deck list")}
                  />
                  <button className="ghost-btn" disabled={!textoImport.trim()} onClick={() => importarDeckList(textoImport)}>
                    {t("Importar")}</button>
                  <p className="tags-note">{t("Vira um deck novo (com o nome do arquivo). O Side é ignorado.")}</p>
                </div>
              )}
              {trocaPendente && (
                  <div className="de-painel">
                    <p className="db-warning">{t("Há alterações não salvas neste deck.")}</p>
                    <div className="de-botoes">
                      <button className="ghost-btn" onClick={() => { salvar(); trocarDeck(trocaPendente, true); }}>{t("Salvar e trocar")}</button>
                      <button className="ghost-btn" onClick={() => trocarDeck(trocaPendente, true)}>{t("Descartar e trocar")}</button>
                      <button className="ghost-btn" onClick={() => setTrocaPendente(null)}>{t("Cancelar")}</button>
                    </div>
                  </div>
                )}
                {mensagem && <p className={mensagem.tipo === "erro" ? "db-warning" : "conta-ok"}>{mensagem.texto}</p>}
                {listaAvisos.length > 0 && (
                  <ul className="de-avisos">
                    {listaAvisos.slice(0, 6).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* apresentação da carta em foco (passar o mouse ou clicar) */}
            <section className="de-bloco de-carta" aria-label={t("Carta")}>
              <div className="de-preview">
                {preview ? (
                  <>
                    <img src={cardImage(preview.id, "full")} alt={displayName(preview)} />
                    <div className="de-preview-texto">
                      <strong>{displayName(preview)}</strong>
                      <small>
                        {kindLabel(preview)}
                        {categoryOf(preview) === "monster" && levelLabel(preview) && ` · ${levelLabel(preview)}`}
                        {categoryOf(preview) === "monster" && t(" · ATK {0}{1}", [preview.atk ?? "?", preview.frame === "link" ? "" : t(" / DEF {0}", [preview.def ?? "?"])])}
                      </small>
                      <PapeisDaCarta card={preview} />
                      <p>{preview.descPt ?? preview.desc}</p>
                    </div>
                  </>
                ) : (
                  <p className="tags-note">{t("Passe o mouse sobre uma carta para ver os detalhes.")}</p>
                )}
              </div>
            </section>
          </Lateral>

          {/* ---------------- centro: Main, Side e Extra */}
          <section
            className="de-centro"
            ref={centroRef}
            style={{ "--carta-main": `${cartaPx.main}px`, "--carta-extra": `${cartaPx.extra}px`, "--linhas-main": cartaPx.linhas } as CSSProperties}
          >
            {!trabalho ? (
              <div className="combos-empty">
                <p>{t("Nenhum deck aberto.")}</p>
                <small>{t("Clique em Novo ou simplesmente clique numa carta da busca para começar.")}</small>
              </div>
            ) : (
              <>
                <div className="de-titulo">
                  <strong>{trabalho.nome}</strong>
                  {alterado && <small> {" "}{t("· alterações não salvas")}</small>}
                </div>
                {PARTES.map(({ id: parte, label }) => (
                  <div key={parte} className={`de-parte de-${parte}`} onDragOver={(e) => e.preventDefault()} onDrop={soltar(parte)}>
                    <div className="de-lateral">
                      <span className="de-rotulo">{label}</span>
                      <span className="de-total" title={t("Total")}>{trabalho[parte].length}</span>
                      {parte === "main" && (
                        <>
                          <span className="de-n de-n-monster" title={t("Monstros")}>{n.monster}</span>
                          <span className="de-n de-n-spell" title={t("Magias")}>{n.spell}</span>
                          <span className="de-n de-n-trap" title={t("Armadilhas")}>{n.trap}</span>
                          <button className="link-btn de-ordenar" onClick={() => setTrabalho({ ...trabalho, main: ordenarParte(trabalho.main, byId) })} title={t("Ordenar: monstros, magias, armadilhas")}>
                            {t("A-Z")}</button>
                        </>
                      )}
                    </div>
                    <div className="de-grade">
                      {trabalho[parte].map((id, i) => thumb(id, parte, i, `${parte}-${i}-${id}`))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>

          {/* ---------------- direita: busca */}
          <Lateral lado="dir" className="de-busca" titulo={t("Buscar cartas")} onDragOver={(e) => e.preventDefault()} onDrop={soltarFora}>
            <h3>{t("Busca")}</h3>
            <input placeholder={t("Nome")} value={filtros.inDesc ? "" : filtros.text} onChange={(e) => atualizar({ text: e.target.value, inDesc: false })} aria-label={t("Nome")} />
            <input placeholder={t("Texto da carta")} value={filtros.inDesc ? filtros.text : ""} onChange={(e) => atualizar({ text: e.target.value, inDesc: true })} aria-label={t("Texto da carta")} />
            <div className="de-linha">
              <select value={filtros.category} onChange={(e) => atualizar({ category: e.target.value as Filters["category"], monsterClass: "", spellTrapType: "", race: "", attributes: [] })} aria-label={t("Carta")}>
                <option value="all">{t("Carta: todas")}</option>
                <option value="monster">{t("Monstro")}</option>
                <option value="spell">{t("Magia")}</option>
                <option value="trap">{t("Armadilha")}</option>
              </select>
              {filtros.category === "monster" ? (
                <select value={filtros.monsterClass} onChange={(e) => atualizar({ monsterClass: e.target.value })} aria-label={t("Tipo de monstro")}>
                  <option value="">{t("Tipo: todos")}</option>
                  {MONSTER_CLASSES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              ) : filtros.category === "spell" || filtros.category === "trap" ? (
                <select value={filtros.spellTrapType} onChange={(e) => atualizar({ spellTrapType: e.target.value })} aria-label={t("Tipo")}>
                  <option value="">{t("Tipo: todos")}</option>
                  {Object.entries(filtros.category === "spell" ? SPELL_TYPES : TRAP_TYPES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              ) : (
                <select disabled aria-label={t("Tipo")}><option>{t("Tipo")}</option></select>
              )}
            </div>
            {filtros.category === "monster" && (
              <div className="de-linha">
                <select value={filtros.race} onChange={(e) => atualizar({ race: e.target.value })} aria-label={t("Tipo do monstro")}>
                  <option value="">{t("Raça: todas")}</option>
                  {Object.entries(MONSTER_RACES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <select value={filtros.attributes[0] ?? ""} onChange={(e) => atualizar({ attributes: e.target.value ? [e.target.value] : [] })} aria-label={t("Atributo")}>
                  <option value="">{t("Atributo: todos")}</option>
                  {Object.entries(ATTRIBUTES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            )}
            {filtros.category === "monster" && (
              <>
                <div className="de-faixa">
                  <input inputMode="numeric" value={filtros.levelMin} onChange={(e) => atualizar({ levelMin: e.target.value })} aria-label={t("Nível mínimo")} />
                  <span>{t("≤ Nível/Rank/Link ≤")}</span>
                  <input inputMode="numeric" value={filtros.levelMax} onChange={(e) => atualizar({ levelMax: e.target.value })} aria-label={t("Nível máximo")} />
                </div>
                <div className="de-faixa">
                  <input inputMode="numeric" value={filtros.atkMin} onChange={(e) => atualizar({ atkMin: e.target.value })} aria-label={t("ATK mínimo")} />
                  <span>{t("≤ ATK ≤")}</span>
                  <input inputMode="numeric" value={filtros.atkMax} onChange={(e) => atualizar({ atkMax: e.target.value })} aria-label={t("ATK máximo")} />
                </div>
                <div className="de-faixa">
                  <input inputMode="numeric" value={filtros.defMin} onChange={(e) => atualizar({ defMin: e.target.value })} aria-label={t("DEF mínima")} />
                  <span>{t("≤ DEF ≤")}</span>
                  <input inputMode="numeric" value={filtros.defMax} onChange={(e) => atualizar({ defMax: e.target.value })} aria-label={t("DEF máxima")} />
                </div>
              </>
            )}
            <div className="de-linha">
              <select value={filtros.ban} onChange={(e) => atualizar({ ban: e.target.value as Filters["ban"] })} aria-label={t("Limite")}>
                <option value="">{t("Limite: todos")}</option>
                <option value="Forbidden">{t("Proibida")}</option>
                <option value="Limited">{t("Limitada")}</option>
                <option value="Semi-Limited">{t("Semi-limitada")}</option>
              </select>
              <select value={filtros.sort} onChange={(e) => atualizar({ sort: e.target.value as SortKey })} aria-label={t("Ordem")}>
                <option value="name">{t("Ordem: nome")}</option>
                <option value="popular">{t("Mais populares")}</option>
                <option value="new">{t("Mais recentes")}</option>
                <option value="atk">{t("ATK")}</option>
                <option value="def">{t("DEF")}</option>
                <option value="level">{t("Nível")}</option>
              </select>
            </div>
            <div className="de-paginacao">
              <button className="ghost-btn" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} aria-label={t("Página anterior")}>◀</button>
              <span>
                {t("{0} / {1} · {2} cartas", [resultados.length ? pagina + 1 : 0, resultados.length ? paginas : 0, resultados.length.toLocaleString(LOCALE)])}</span>
              <button className="ghost-btn" disabled={pagina >= paginas - 1} onClick={() => setPagina((p) => p + 1)} aria-label={t("Próxima página")}>▶</button>
            </div>
            <div className="de-resultados">
              {resultados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((c) => thumb(c.id, undefined, undefined, String(c.id)))}
            </div>
            <p className="tags-note">{t("Clique adiciona ao Deck (ou ao Extra). Arraste para mover; solte aqui para retirar.")}</p>
          </Lateral>
        </div>
      )}
    </ScreenShell>
  );
}
