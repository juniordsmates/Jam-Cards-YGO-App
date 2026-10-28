import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import ScreenShell from "./ScreenShell";
import { initCardDb, useCardDb } from "../db/cardStore";
import { useConta } from "../db/conta";
import {
  avisos,
  contagem,
  copiasPermitidas,
  criarDeck,
  definirPadrao,
  deYdk,
  ehExtra,
  excluirDeck,
  motivoBloqueio,
  ordenarParte,
  paraYdk,
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
import { categoryOf, displayName, type Card } from "../db/types";
import { isDesktop } from "../platform";
import TesteJogo, { type ComboTeste } from "./TesteJogo";
import "./deck-editor.css";

const POR_PAGINA = 24;
// sem Side Deck no editor (o arquivo .ydk ainda lê e grava a seção, vazia)
const PARTES: { id: Parte; label: string }[] = [
  { id: "main", label: "Deck" },
  { id: "extra", label: "Extra" },
];

/** Selo da banlist no canto da carta: 0 proibida (ou fora do formato), 1 limitada, 2 semi-limitada */
function Selo({ card, formato }: { card: Card; formato: GameFormat }) {
  const n = copiasPermitidas(card, formato);
  if (n === 3) return null;
  return <span className={`de-selo de-selo-${n}`}>{n}</span>;
}

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
  const [deckId, setDeckId] = useState<string | undefined>(inicial.deckId ?? padrao ?? decks[0]?.id);
  // cópia de trabalho: as mudanças só vão para os decks salvos em "Salvar"
  const [trabalho, setTrabalho] = useState<Deck | null>(null);
  const [preview, setPreview] = useState<Card | null>(null);
  const [filtros, setFiltros] = useState<Filters>({ ...EMPTY_FILTERS, sort: "name" });
  const [pagina, setPagina] = useState(0);
  const [nomeando, setNomeando] = useState<Nomeando>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [painel, setPainel] = useState<"importar" | "exportar" | null>(null);
  const [textoImport, setTextoImport] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const arrastando = useRef<{ id: number; de?: Parte; indice?: number } | null>(null);
  // Teste de Jogo (Solo Mode) com o deck aberto
  const [testando, setTestando] = useState(!!inicial.testar);

  useEffect(() => void initCardDb(), []);
  // com conta: traz os decks salvos nela que ainda não estão neste computador
  useEffect(() => {
    if (conta) void trazerDecksDaConta();
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

  const resultados = useMemo(() => searchCards(db.cards, filtros, db.archetypePt).filter((c) => c.frame !== "skill" && c.frame !== "token"), [db.cards, filtros, db.archetypePt]);
  const paginas = Math.max(1, Math.ceil(resultados.length / POR_PAGINA));
  useEffect(() => setPagina(0), [filtros]);

  const alterado = !!trabalho && !!salvo && JSON.stringify([trabalho.main, trabalho.extra, trabalho.side]) !== JSON.stringify([salvo.main, salvo.extra, salvo.side]);
  const avisar = (tipo: "ok" | "erro", texto: string) => setMensagem({ tipo, texto });

  // ---------------------------------------------------------------- edição

  const adicionar = (c: Card, parte?: Parte, indice?: number) => {
    const destino: Parte = parte ?? (ehExtra(c) ? "extra" : "main");
    // sem deck aberto: a primeira carta cria "Novo deck" já com ela
    const deck: Deck = trabalho ?? { id: "", nome: "Novo deck", main: [], extra: [], side: [], atualizadoEm: "" };
    const motivo = motivoBloqueio(deck, c, destino, formato);
    if (motivo) return avisar("erro", motivo);
    const lista = [...deck[destino]];
    lista.splice(indice ?? lista.length, 0, c.id);
    setMensagem(null);
    if (!trabalho) return setDeckId(criarDeck("Novo deck", { main: [], extra: [], side: [], [destino]: lista }).id);
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
    const motivo = motivoBloqueio({ ...semEla, main: semEla.main, extra: semEla.extra, side: semEla.side, [para]: semEla[para] } as Deck, c, para, formato);
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
    if (nomeando.modo === "novo") setDeckId(criarDeck(nome).id);
    else if (nomeando.modo === "salvarComo" && trabalho) setDeckId(criarDeck(nome, { main: trabalho.main, extra: trabalho.extra, side: trabalho.side }).id);
    else if (nomeando.modo === "renomear" && trabalho) {
      const d = salvarDeck({ ...(salvo ?? trabalho), nome });
      setTrabalho({ ...trabalho, nome: d.nome });
    }
    setNomeando(null);
  };

  const salvar = () => {
    if (!trabalho) return;
    salvarDeck(trabalho);
    avisar("ok", conta ? "Deck salvo neste computador e na sua conta." : "Deck salvo neste computador.");
  };

  // trocar de deck com alterações não salvas pede confirmação na própria tela
  const [trocaPendente, setTrocaPendente] = useState<string | null>(null);
  const trocarDeck = (id: string, forcar = false) => {
    if (alterado && !forcar) return setTrocaPendente(id);
    setTrocaPendente(null);
    setDeckId(id);
    setMensagem(null);
  };

  const importar = (texto: string) => {
    const { deck, ignorados } = deYdk(texto, idCanonico);
    if (!deck.main.length && !deck.extra.length && !deck.side.length) return avisar("erro", "Nenhuma carta reconhecida. Use o formato .ydk (#main, #extra, !side).");
    // sem deck aberto, cria um deck com o conteúdo importado; com deck aberto, substitui (sem salvar)
    const semSide = { ...deck, side: [] };
    if (!trabalho) setDeckId(criarDeck("Deck importado", semSide).id);
    else setTrabalho({ ...trabalho, ...semSide });
    setPainel(null);
    setTextoImport("");
    avisar("ok", `Importado: ${deck.main.length} no Main e ${deck.extra.length} no Extra${deck.side.length ? ` (Side ignorado: ${deck.side.length})` : ""}${ignorados ? ` (${ignorados} cartas não reconhecidas)` : ""}.${trabalho ? " Clique em Salvar." : ""}`);
  };

  const lerArquivo = (f?: File | null) => {
    if (!f) return;
    void f.text().then(importar);
  };

  const ydk = trabalho ? paraYdk(trabalho) : "";
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([ydk], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(trabalho?.nome ?? "deck").replace(/[^\w\- ]+/g, "")}.ydk`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------- render

  const ready = db.status === "ready";
  const n = trabalho ? contagem(trabalho.main, byId) : { monster: 0, spell: 0, trap: 0 };
  const listaAvisos = trabalho ? avisos(trabalho, byId, formato) : [];
  const atualizar = (patch: Partial<Filters>) => setFiltros((f) => ({ ...f, ...patch }));

  // função de desenho (não componente): o React não recria a carta a cada redesenho (hover),
  // o que quebraria arrastos e cliques começados nela
  const thumb = (id: number, parte?: Parte, indice?: number, key?: string) => {
    const c = byId.get(id);
    if (!c) return <div key={key} className="de-thumb de-desconhecida">#{id}</div>;
    return (
      <div
        key={key}
        className="de-thumb"
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
        title={parte ? `${displayName(c)} — botão direito retira` : `${displayName(c)} — clique adiciona ao Deck (ou ao Extra)`}
        data-card-id={c.id}
      >
        <img src={cardImage(c.id, "small")} alt={displayName(c)} loading="lazy" draggable={false} />
        <Selo card={c} formato={formato} />
      </div>
    );
  };

  return (
    <ScreenShell
      title={testando ? "Teste de Jogo" : "Editor de Deck"}
      accent="magenta"
      onBack={onBack}
      actions={
        <span className="de-topo">
          {!testando && (
            <button className="ghost-btn de-teste" disabled={!trabalho?.main.length} onClick={() => setTestando(true)} title="Teste de Jogo (Solo Mode) com este deck">
              ▶ Teste de Jogo
            </button>
          )}
        <div className="format-switch combos-format" role="radiogroup" aria-label="Formato">
          {FORMATS.map((f) => (
            <button key={f} role="radio" aria-checked={formato === f} className={formato === f ? "active" : ""} onClick={() => setFormato(f)}>
              {f}
            </button>
          ))}
        </div>
        </span>
      }
      plain
    >
      {!ready ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? "Carregando base de cartas…"}</p>
        </div>
      ) : testando && trabalho ? (
        <TesteJogo nome={trabalho.nome} main={trabalho.main} extra={trabalho.extra} byId={byId} onFechar={() => setTestando(false)} combo={inicial.combo} />
      ) : (
        <div className="deck-editor">
          {/* ---------------- esquerda: carta e controles */}
          <aside className="de-left">
            <div className="de-preview">
              {preview ? (
                <>
                  <img src={cardImage(preview.id, "full")} alt={displayName(preview)} />
                  <div className="de-preview-texto">
                    <strong>{displayName(preview)}</strong>
                    <small>
                      {kindLabel(preview)}
                      {categoryOf(preview) === "monster" && levelLabel(preview) && ` · ${levelLabel(preview)}`}
                      {categoryOf(preview) === "monster" && ` · ATK ${preview.atk ?? "?"}${preview.frame === "link" ? "" : ` / DEF ${preview.def ?? "?"}`}`}
                    </small>
                    <p>{preview.descPt ?? preview.desc}</p>
                  </div>
                </>
              ) : (
                <p className="tags-note">Passe o mouse sobre uma carta para ver os detalhes.</p>
              )}
            </div>

            <div className="de-controles">
              <select value={deckId ?? ""} onChange={(e) => trocarDeck(e.target.value)} aria-label="Deck">
                {!decks.length && <option value="">Nenhum deck</option>}
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                    {d.id === padrao ? " (padrão)" : ""}
                  </option>
                ))}
              </select>
              {nomeando ? (
                <div className="de-nome">
                  <input
                    autoFocus
                    value={nomeando.valor}
                    placeholder="Nome do deck"
                    maxLength={80}
                    onChange={(e) => setNomeando({ ...nomeando, valor: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && confirmarNome()}
                    aria-label="Nome do deck"
                  />
                  <button className="ghost-btn" onClick={confirmarNome}>
                    OK
                  </button>
                  <button className="ghost-btn" onClick={() => setNomeando(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="de-botoes">
                  <button className="ghost-btn" onClick={() => setNomeando({ modo: "novo", valor: "" })}>Novo</button>
                  <button className="ghost-btn" disabled={!trabalho} onClick={() => setNomeando({ modo: "renomear", valor: trabalho?.nome ?? "" })}>Renomear</button>
                  <button className="ghost-btn de-salvar" disabled={!trabalho} onClick={salvar}>
                    Salvar{alterado ? " •" : ""}
                  </button>
                  <button className="ghost-btn" disabled={!trabalho} onClick={() => setNomeando({ modo: "salvarComo", valor: `${trabalho?.nome ?? ""} (cópia)` })}>Salvar como</button>
                  <button className="ghost-btn" onClick={() => setPainel(painel === "importar" ? null : "importar")}>Importar</button>
                  <button className="ghost-btn" disabled={!trabalho} onClick={() => setPainel(painel === "exportar" ? null : "exportar")}>Exportar</button>
                  <button className="ghost-btn" disabled={!trabalho} onClick={() => trabalho && setTrabalho({ ...trabalho, main: [], extra: [], side: [] })}>Limpar</button>
                  <button className="ghost-btn" disabled={!trabalho || trabalho.id === padrao} onClick={() => trabalho && definirPadrao(trabalho.id)}>Definir padrão</button>
                  {confirmarExclusao ? (
                    <button
                      className="danger-btn"
                      onClick={() => {
                        if (trabalho) excluirDeck(trabalho.id);
                        setDeckId(undefined);
                        setConfirmarExclusao(false);
                      }}
                    >
                      Confirmar exclusão
                    </button>
                  ) : (
                    <button className="ghost-btn" disabled={!trabalho} onClick={() => setConfirmarExclusao(true)}>Excluir</button>
                  )}
                </div>
              )}

              {painel === "importar" && (
                <div className="de-painel">
                  <label className="ghost-btn de-arquivo">
                    Escolher arquivo .ydk
                    <input type="file" accept=".ydk,.txt" onChange={(e) => lerArquivo(e.target.files?.[0])} />
                  </label>
                  <textarea rows={5} placeholder={"Ou cole o conteúdo do .ydk:\n#main\n…\n#extra\n…\n!side\n…"} value={textoImport} onChange={(e) => setTextoImport(e.target.value)} aria-label="Conteúdo do .ydk" />
                  <button className="ghost-btn" disabled={!textoImport.trim()} onClick={() => importar(textoImport)}>Importar texto</button>
                </div>
              )}
              {painel === "exportar" && trabalho && (
                <div className="de-painel">
                  <textarea rows={5} readOnly value={ydk} aria-label="Deck em .ydk" />
                  <div className="de-botoes">
                    <button className="ghost-btn" onClick={() => void navigator.clipboard?.writeText(ydk).then(() => avisar("ok", "Lista .ydk copiada."))}>Copiar</button>
                    {!isDesktop && <button className="ghost-btn" onClick={baixar}>Baixar .ydk</button>}
                  </div>
                  <p className="tags-note">Formato .ydk: abre no Duelingbook, EDOPro, YGOPRODeck e Master Duel (por importadores).</p>
                </div>
              )}
              {trocaPendente && (
                <div className="de-painel">
                  <p className="db-warning">Há alterações não salvas neste deck.</p>
                  <div className="de-botoes">
                    <button className="ghost-btn" onClick={() => { salvar(); trocarDeck(trocaPendente, true); }}>Salvar e trocar</button>
                    <button className="ghost-btn" onClick={() => trocarDeck(trocaPendente, true)}>Descartar e trocar</button>
                    <button className="ghost-btn" onClick={() => setTrocaPendente(null)}>Cancelar</button>
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
          </aside>

          {/* ---------------- centro: Main, Side e Extra */}
          <section className="de-centro">
            {!trabalho ? (
              <div className="combos-empty">
                <p>Nenhum deck aberto.</p>
                <small>Clique em Novo, importe um .ydk ou simplesmente clique numa carta da busca para começar.</small>
              </div>
            ) : (
              <>
                <div className="de-titulo">
                  <strong>{trabalho.nome}</strong>
                  {alterado && <small> · alterações não salvas</small>}
                </div>
                {PARTES.map(({ id: parte, label }) => (
                  <div key={parte} className={`de-parte de-${parte}`} onDragOver={(e) => e.preventDefault()} onDrop={soltar(parte)}>
                    <div className="de-lateral">
                      <span className="de-rotulo">{label}</span>
                      <span className="de-total" title="Total">{trabalho[parte].length}</span>
                      {parte === "main" && (
                        <>
                          <span className="de-n de-n-monster" title="Monstros">{n.monster}</span>
                          <span className="de-n de-n-spell" title="Magias">{n.spell}</span>
                          <span className="de-n de-n-trap" title="Armadilhas">{n.trap}</span>
                          <button className="link-btn de-ordenar" onClick={() => setTrabalho({ ...trabalho, main: ordenarParte(trabalho.main, byId) })} title="Ordenar: monstros, magias, armadilhas">
                            A-Z
                          </button>
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
          <aside className="de-busca" onDragOver={(e) => e.preventDefault()} onDrop={soltarFora}>
            <h3>Busca</h3>
            <input placeholder="Nome" value={filtros.inDesc ? "" : filtros.text} onChange={(e) => atualizar({ text: e.target.value, inDesc: false })} aria-label="Nome" />
            <input placeholder="Texto da carta" value={filtros.inDesc ? filtros.text : ""} onChange={(e) => atualizar({ text: e.target.value, inDesc: true })} aria-label="Texto da carta" />
            <div className="de-linha">
              <select value={filtros.category} onChange={(e) => atualizar({ category: e.target.value as Filters["category"], monsterClass: "", spellTrapType: "", race: "", attributes: [] })} aria-label="Carta">
                <option value="all">Carta: todas</option>
                <option value="monster">Monstro</option>
                <option value="spell">Magia</option>
                <option value="trap">Armadilha</option>
              </select>
              {filtros.category === "monster" ? (
                <select value={filtros.monsterClass} onChange={(e) => atualizar({ monsterClass: e.target.value })} aria-label="Tipo de monstro">
                  <option value="">Tipo: todos</option>
                  {MONSTER_CLASSES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              ) : filtros.category === "spell" || filtros.category === "trap" ? (
                <select value={filtros.spellTrapType} onChange={(e) => atualizar({ spellTrapType: e.target.value })} aria-label="Tipo">
                  <option value="">Tipo: todos</option>
                  {Object.entries(filtros.category === "spell" ? SPELL_TYPES : TRAP_TYPES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              ) : (
                <select disabled aria-label="Tipo"><option>Tipo</option></select>
              )}
            </div>
            {filtros.category === "monster" && (
              <div className="de-linha">
                <select value={filtros.race} onChange={(e) => atualizar({ race: e.target.value })} aria-label="Tipo do monstro">
                  <option value="">Raça: todas</option>
                  {Object.entries(MONSTER_RACES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <select value={filtros.attributes[0] ?? ""} onChange={(e) => atualizar({ attributes: e.target.value ? [e.target.value] : [] })} aria-label="Atributo">
                  <option value="">Atributo: todos</option>
                  {Object.entries(ATTRIBUTES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            )}
            {filtros.category === "monster" && (
              <>
                <div className="de-faixa">
                  <input inputMode="numeric" value={filtros.levelMin} onChange={(e) => atualizar({ levelMin: e.target.value })} aria-label="Nível mínimo" />
                  <span>≤ Nível/Rank/Link ≤</span>
                  <input inputMode="numeric" value={filtros.levelMax} onChange={(e) => atualizar({ levelMax: e.target.value })} aria-label="Nível máximo" />
                </div>
                <div className="de-faixa">
                  <input inputMode="numeric" value={filtros.atkMin} onChange={(e) => atualizar({ atkMin: e.target.value })} aria-label="ATK mínimo" />
                  <span>≤ ATK ≤</span>
                  <input inputMode="numeric" value={filtros.atkMax} onChange={(e) => atualizar({ atkMax: e.target.value })} aria-label="ATK máximo" />
                </div>
                <div className="de-faixa">
                  <input inputMode="numeric" value={filtros.defMin} onChange={(e) => atualizar({ defMin: e.target.value })} aria-label="DEF mínima" />
                  <span>≤ DEF ≤</span>
                  <input inputMode="numeric" value={filtros.defMax} onChange={(e) => atualizar({ defMax: e.target.value })} aria-label="DEF máxima" />
                </div>
              </>
            )}
            <div className="de-linha">
              <select value={filtros.ban} onChange={(e) => atualizar({ ban: e.target.value as Filters["ban"] })} aria-label="Limite">
                <option value="">Limite: todos</option>
                <option value="Forbidden">Proibida</option>
                <option value="Limited">Limitada</option>
                <option value="Semi-Limited">Semi-limitada</option>
              </select>
              <select value={filtros.sort} onChange={(e) => atualizar({ sort: e.target.value as SortKey })} aria-label="Ordem">
                <option value="name">Ordem: nome</option>
                <option value="popular">Mais populares</option>
                <option value="new">Mais recentes</option>
                <option value="atk">ATK</option>
                <option value="def">DEF</option>
                <option value="level">Nível</option>
              </select>
            </div>
            <div className="de-paginacao">
              <button className="ghost-btn" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior">◀</button>
              <span>
                {resultados.length ? pagina + 1 : 0} / {resultados.length ? paginas : 0} · {resultados.length.toLocaleString("pt-BR")} cartas
              </span>
              <button className="ghost-btn" disabled={pagina >= paginas - 1} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima página">▶</button>
            </div>
            <div className="de-resultados">
              {resultados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((c) => thumb(c.id, undefined, undefined, String(c.id)))}
            </div>
            <p className="tags-note">Clique adiciona ao Deck (ou ao Extra). Arraste para mover; solte aqui para retirar.</p>
          </aside>
        </div>
      )}
    </ScreenShell>
  );
}
