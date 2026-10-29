import { useEffect, useMemo, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardSelos, { PapeisDaCarta } from "../components/CardSelos";
import { initCardDb, useCardDb } from "../db/cardStore";
import {
  adicionarNaColecao,
  chaveItem,
  copiasPorCarta,
  EDICOES,
  ESTADOS,
  IDIOMAS,
  juntarColecaoDaConta,
  lerListaMYP,
  precoUSD,
  quantidadeValida,
  retirarDaColecao,
  useColecao,
  type ItemColecao,
  type LinhaImportada,
} from "../db/colecao";
import { useConta } from "../db/conta";
import { cardImage } from "../db/images";
import { kindLabel } from "../db/labels";
import { formatMoney, getExchangeRates, toBRL, type ExchangeRates } from "../db/prices";
import { EMPTY_FILTERS, normalize, searchCards, type Filters } from "../db/search";
import { bilingualName, displayName, type Card } from "../db/types";
import "./deck-editor.css";
import "./colecao.css";

const POR_PAGINA = 24;
const nomeEdicao = (id: string) => EDICOES.find((e) => e.id === id)?.label ?? "";
const nomeEstado = (id: string) => ESTADOS.find((e) => e.id === id)?.label ?? "";

/** Formulário de "Adicionar à coleção": detalhes começam em "Não aplicado"; a quantidade é digitada */
interface Novo {
  impressao: string; // "código|raridade" ou "" (não aplicado)
  idioma: string;
  edicao: string;
  estado: string;
  quantidade: string;
}
const NOVO: Novo = { impressao: "", idioma: "", edicao: "", estado: "", quantidade: "" };

export default function Colecao({ onBack }: { onBack: () => void }) {
  const db = useCardDb();
  const { itens } = useColecao();
  const conta = useConta();
  const [cotacao, setCotacao] = useState<ExchangeRates>();
  const [filtros, setFiltros] = useState<Filters>({ ...EMPTY_FILTERS, sort: "name" });
  const [pagina, setPagina] = useState(0);
  const [carta, setCarta] = useState<Card | null>(null);
  const [novo, setNovo] = useState<Novo>(NOVO);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  // "Retirar da coleção": item em confirmação e a quantidade digitada
  const [retirando, setRetirando] = useState<{ chave: string; quantidade: string } | null>(null);
  const [filtroLista, setFiltroLista] = useState({ texto: "", raridade: "" });
  // "Importar lista (MYP Cards)": texto colado ou arquivo, prévia e confirmação
  const [importacao, setImportacao] = useState<{ texto: string; previa: LinhaImportada[] | null } | null>(null);

  useEffect(() => void initCardDb(), []);
  useEffect(() => void getExchangeRates().then(setCotacao), []);
  // com conta: junta a coleção da conta com a deste computador
  useEffect(() => {
    if (conta) void juntarColecaoDaConta();
  }, [conta]);

  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  const resultados = useMemo(
    () => searchCards(db.cards, filtros, db.archetypePt).filter((c) => c.frame !== "skill" && c.frame !== "token"),
    [db.cards, filtros, db.archetypePt],
  );
  const paginas = Math.max(1, Math.ceil(resultados.length / POR_PAGINA));
  useEffect(() => setPagina(0), [filtros]);
  const copias = useMemo(() => copiasPorCarta(itens), [itens]);

  // ---------------------------------------------------------------- valores

  const valorBRL = (i: ItemColecao) => {
    const usd = precoUSD(i, byId.get(i.cartaId));
    const brl = usd === undefined ? undefined : toBRL(usd, "USD", cotacao);
    return brl === undefined ? undefined : brl * i.quantidade;
  };
  const resumo = useMemo(() => {
    let total = 0;
    let semPreco = 0;
    const porRaridade = new Map<string, { copias: number; valor: number }>();
    for (const i of itens) {
      const v = valorBRL(i);
      if (v === undefined) semPreco += i.quantidade;
      else total += v;
      const r = i.raridade || "Não aplicado";
      const x = porRaridade.get(r) ?? { copias: 0, valor: 0 };
      porRaridade.set(r, { copias: x.copias + i.quantidade, valor: x.valor + (v ?? 0) });
    }
    return {
      copias: itens.reduce((s, i) => s + i.quantidade, 0),
      cartas: copias.size,
      total,
      semPreco,
      porRaridade: [...porRaridade].sort((a, b) => b[1].valor - a[1].valor || b[1].copias - a[1].copias),
    };
  }, [itens, copias, byId, cotacao]); // eslint-disable-line react-hooks/exhaustive-deps

  // lista da coleção, com filtros por nome e raridade
  const lista = useMemo(() => {
    const termos = normalize(filtroLista.texto).split(" ").filter(Boolean);
    return itens
      .filter((i) => {
        const c = byId.get(i.cartaId);
        if (filtroLista.raridade && (i.raridade || "Não aplicado") !== filtroLista.raridade) return false;
        return !termos.length || (!!c && termos.every((t) => c.key.includes(t)));
      })
      .sort((a, b) => {
        const [ca, cb] = [byId.get(a.cartaId), byId.get(b.cartaId)];
        return (ca ? displayName(ca) : "").localeCompare(cb ? displayName(cb) : "", "pt-BR") || a.setCode.localeCompare(b.setCode);
      });
  }, [itens, byId, filtroLista]);

  // ---------------------------------------------------------------- ações

  const abrir = (c: Card) => {
    setCarta(c);
    setNovo(NOVO);
    setMensagem(null);
  };

  const adicionar = () => {
    if (!carta) return;
    const n = quantidadeValida(novo.quantidade);
    if (n === null) return setMensagem({ tipo: "erro", texto: "Digite a quantidade: de 1 a 99." });
    const [setCode = "", raridade = ""] = novo.impressao ? novo.impressao.split("|") : [];
    const erro = adicionarNaColecao({ cartaId: carta.id, setCode, raridade, idioma: novo.idioma, edicao: novo.edicao, estado: novo.estado }, n);
    if (erro) return setMensagem({ tipo: "erro", texto: erro });
    setMensagem({ tipo: "ok", texto: `${n} ${n === 1 ? "cópia adicionada" : "cópias adicionadas"}: ${displayName(carta)}.` });
    setNovo({ ...novo, quantidade: "" });
  };

  const confirmarRetirada = (item: ItemColecao) => {
    if (!retirando) return;
    const n = quantidadeValida(retirando.quantidade, item.quantidade);
    if (n === null) return setMensagem({ tipo: "erro", texto: `Digite quantas cópias retirar: de 1 a ${item.quantidade}.` });
    const erro = retirarDaColecao(retirando.chave, n);
    if (erro) return setMensagem({ tipo: "erro", texto: erro });
    const c = byId.get(item.cartaId);
    setMensagem({ tipo: "ok", texto: `${n} ${n === 1 ? "cópia retirada" : "cópias retiradas"}: ${c ? displayName(c) : item.cartaId}.` });
    setRetirando(null);
  };

  const lerImportacao = (texto: string) => setImportacao({ texto, previa: lerListaMYP(texto, db.cards) });
  const confirmarImportacao = () => {
    if (!importacao?.previa) return;
    let cartas = 0;
    const falhas: string[] = [];
    for (const l of importacao.previa) {
      if (!l.detalhes) continue;
      const erro = adicionarNaColecao(l.detalhes, l.quantidade);
      if (erro) falhas.push(`${l.linha}: ${erro}`);
      else cartas += l.quantidade;
    }
    const ignoradas = importacao.previa.filter((l) => l.erro).length;
    setImportacao(null);
    setMensagem({
      tipo: falhas.length ? "erro" : "ok",
      texto: `Importadas ${cartas} cópias.${ignoradas ? ` ${ignoradas} linha(s) não reconhecida(s) ficaram de fora.` : ""}${falhas.length ? ` Não entraram: ${falhas.join(" · ")}` : ""}`,
    });
  };

  // ---------------------------------------------------------------- render

  const ready = db.status === "ready";
  const moeda = (v: number) => formatMoney(v, "BRL");

  const thumb = (c: Card) => (
    <div key={c.id} className={`de-thumb ${carta?.id === c.id ? "col-ativa" : ""}`} onClick={() => abrir(c)} title={`${bilingualName(c)} — clique para adicionar à coleção`} data-card-id={c.id}>
      <img src={cardImage(c.id, "small")} alt={displayName(c)} loading="lazy" draggable={false} />
      <CardSelos card={c} formato="TCG" />
      {copias.get(c.id) ? <span className="selo-possuo">possuo {copias.get(c.id)}</span> : null}
    </div>
  );

  return (
    <ScreenShell title="Minha Coleção" accent="magenta" onBack={onBack} plain>
      {!ready ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? "Carregando base de cartas…"}</p>
        </div>
      ) : (
        <div className="deck-editor colecao">
          {/* ---------------- esquerda: resumo e carta */}
          <aside className="de-left">
            <section className="de-bloco col-resumo" aria-label="Resumo da coleção">
              <h3 className="de-bloco-titulo">Resumo</h3>
              <dl>
                <dt>Cópias</dt>
                <dd>{resumo.copias.toLocaleString("pt-BR")}</dd>
                <dt>Cartas diferentes</dt>
                <dd>{resumo.cartas.toLocaleString("pt-BR")}</dd>
                <dt>Valor total</dt>
                <dd className="col-total">{cotacao ? moeda(resumo.total) : "—"}</dd>
              </dl>
              {resumo.semPreco > 0 && <p className="tags-note">{resumo.semPreco} cópia(s) sem preço na YGOPRODeck ficaram fora do total.</p>}
              {resumo.porRaridade.length > 0 && (
                <table className="col-raridades">
                  <tbody>
                    {resumo.porRaridade.map(([r, x]) => (
                      <tr key={r}>
                        <td>{r}</td>
                        <td>{x.copias}</td>
                        <td>{cotacao ? moeda(x.valor) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="tags-note">
                Preço da impressão na YGOPRODeck (TCGplayer, em dólar) convertido pela cotação do dia
                {cotacao ? ` (US$ 1 = ${moeda(cotacao.USD)})` : ""}.{conta ? " Coleção guardada também na sua conta." : " Sem login, a coleção fica só neste computador."}
              </p>
            </section>
            <section className="de-bloco de-carta" aria-label="Carta">
              {carta ? (
                <div className="de-preview">
                  <img src={cardImage(carta.id, "full")} alt={displayName(carta)} />
                  <div className="de-preview-texto">
                    <strong>{displayName(carta)}</strong>
                    <small>{kindLabel(carta)}</small>
                    <PapeisDaCarta card={carta} />
                  </div>
                </div>
              ) : (
                <p className="tags-note">Escolha uma carta na busca para ver as impressões e adicionar à coleção.</p>
              )}
            </section>
          </aside>

          {/* ---------------- centro: a coleção */}
          <section className="de-centro col-lista">
            <div className="col-cabecalho">
              <h3>Minha coleção</h3>
              <input placeholder="Filtrar por nome" value={filtroLista.texto} onChange={(e) => setFiltroLista({ ...filtroLista, texto: e.target.value })} aria-label="Filtrar a coleção" />
              <button className="ghost-btn col-importar" onClick={() => setImportacao(importacao ? null : { texto: "", previa: null })}>
                Importar lista (MYP Cards)
              </button>
              <select value={filtroLista.raridade} onChange={(e) => setFiltroLista({ ...filtroLista, raridade: e.target.value })} aria-label="Raridade">
                <option value="">Raridade: todas</option>
                {resumo.porRaridade.map(([r]) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {importacao && (
              <div className="de-painel col-importacao">
                {!importacao.previa ? (
                  <>
                    <label className="ghost-btn de-arquivo">
                      Escolher arquivo (.txt)
                      <input type="file" accept=".txt,.csv" onChange={(e) => void e.target.files?.[0]?.text().then(lerImportacao)} />
                    </label>
                    <textarea
                      rows={6}
                      placeholder={"Ou cole a lista exportada da MYP Cards, uma carta por linha:\n1 #Mago Negro [GFTP] GFTP-EN128\n1 #Black Chaos (Starlight Rare) [CORI] CORI-EN001"}
                      value={importacao.texto}
                      onChange={(e) => setImportacao({ ...importacao, texto: e.target.value })}
                      aria-label="Lista da MYP Cards"
                    />
                    <div className="dialog-actions">
                      <button className="ghost-btn" onClick={() => setImportacao(null)}>
                        Cancelar
                      </button>
                      <button className="ghost-btn" disabled={!importacao.texto.trim()} onClick={() => lerImportacao(importacao.texto)}>
                        Ler lista
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>
                      Prévia: {importacao.previa.filter((l) => l.detalhes).length} reconhecida(s), {importacao.previa.filter((l) => l.erro).length} não reconhecida(s)
                    </strong>
                    <table className="col-tabela">
                      <tbody>
                        {importacao.previa.map((l, i) => {
                          const c = l.detalhes && byId.get(l.detalhes.cartaId);
                          return (
                            <tr key={i} className={l.erro ? "col-erro" : undefined}>
                              <td className="col-num">{l.quantidade || "—"}</td>
                              <td>{c ? displayName(c) : l.linha}</td>
                              <td>
                                {l.erro ??
                                  [l.detalhes!.setCode && `${l.detalhes!.setCode}${l.detalhes!.raridade ? ` · ${l.detalhes!.raridade}` : ""}`, l.detalhes!.idioma]
                                    .filter(Boolean)
                                    .join(" · ")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="tags-note">Raridade sem indicação na lista e com mais de uma opção no mesmo código fica "Não aplicado". Itens iguais aos que já estão na coleção somam.</p>
                    <div className="dialog-actions">
                      <button className="ghost-btn" onClick={() => setImportacao({ ...importacao, previa: null })}>
                        Voltar
                      </button>
                      <button className="ghost-btn col-adicionar-btn" disabled={!importacao.previa.some((l) => l.detalhes)} onClick={confirmarImportacao}>
                        Importar para a coleção
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {mensagem && <p className={mensagem.tipo === "erro" ? "db-warning" : "conta-ok"}>{mensagem.texto}</p>}
            {!itens.length ? (
              <div className="combos-empty">
                <p>Sua coleção está vazia.</p>
                <small>Busque uma carta à direita, escolha a impressão (ou deixe "Não aplicado"), digite a quantidade e clique em Adicionar à coleção.</small>
              </div>
            ) : (
              <table className="col-tabela">
                <thead>
                  <tr>
                    <th>Carta</th>
                    <th>Impressão</th>
                    <th>Detalhes</th>
                    <th>Qtd.</th>
                    <th>Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((i) => {
                    const c = byId.get(i.cartaId);
                    const chave = chaveItem(i);
                    const v = valorBRL(i);
                    const detalhes = [i.idioma, nomeEdicao(i.edicao), nomeEstado(i.estado)].filter(Boolean).join(" · ");
                    return (
                      <tr key={chave}>
                        <td>
                          <button className="link-btn" onClick={() => c && abrir(c)} title={c ? bilingualName(c) : undefined}>
                            {c ? displayName(c) : `#${i.cartaId}`}
                          </button>
                        </td>
                        <td>{i.setCode ? `${i.setCode} · ${i.raridade}` : <span className="col-na">Não aplicado</span>}</td>
                        <td>{detalhes || <span className="col-na">Não aplicado</span>}</td>
                        <td className="col-num">{i.quantidade}</td>
                        <td className="col-num">{v === undefined ? "—" : moeda(v)}</td>
                        <td className="col-acoes">
                          {retirando?.chave === chave ? (
                            <span className="col-retirar">
                              <input
                                autoFocus
                                inputMode="numeric"
                                placeholder={`1 a ${i.quantidade}`}
                                value={retirando.quantidade}
                                onChange={(e) => setRetirando({ chave, quantidade: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                                onKeyDown={(e) => e.key === "Enter" && confirmarRetirada(i)}
                                aria-label="Quantidade a retirar"
                              />
                              <button className="danger-btn" onClick={() => confirmarRetirada(i)}>
                                Confirmar
                              </button>
                              <button className="ghost-btn" onClick={() => setRetirando(null)}>
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button className="ghost-btn col-retirar-btn" onClick={() => setRetirando({ chave, quantidade: "" })}>
                              Retirar da coleção
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {/* ---------------- direita: busca e "Adicionar à coleção" */}
          <aside className="de-busca">
            <h3>Busca</h3>
            <input placeholder="Nome" value={filtros.text} onChange={(e) => setFiltros({ ...filtros, text: e.target.value, inDesc: false })} aria-label="Nome" />
            <select value={filtros.category} onChange={(e) => setFiltros({ ...filtros, category: e.target.value as Filters["category"] })} aria-label="Carta">
              <option value="all">Carta: todas</option>
              <option value="monster">Monstro</option>
              <option value="spell">Magia</option>
              <option value="trap">Armadilha</option>
            </select>

            {carta && (
              <div className="de-painel col-adicionar" aria-label="Adicionar à coleção">
                <strong>{displayName(carta)}</strong>
                <label className="field">
                  <span className="field-label">Impressão</span>
                  <select value={novo.impressao} onChange={(e) => setNovo({ ...novo, impressao: e.target.value })} aria-label="Impressão">
                    <option value="">Não aplicado</option>
                    {carta.sets.map((s) => (
                      <option key={`${s.code}|${s.rarity}`} value={`${s.code}|${s.rarity}`}>
                        {s.code} · {s.rarity}
                        {Number(s.price) > 0 ? ` · US$ ${Number(s.price).toFixed(2)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Idioma</span>
                  <select value={novo.idioma} onChange={(e) => setNovo({ ...novo, idioma: e.target.value })} aria-label="Idioma">
                    <option value="">Não aplicado</option>
                    {IDIOMAS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Edição</span>
                  <select value={novo.edicao} onChange={(e) => setNovo({ ...novo, edicao: e.target.value })} aria-label="Edição">
                    <option value="">Não aplicado</option>
                    {EDICOES.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Estado</span>
                  <select value={novo.estado} onChange={(e) => setNovo({ ...novo, estado: e.target.value })} aria-label="Estado">
                    <option value="">Não aplicado</option>
                    {ESTADOS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Quantidade (1 a 99)</span>
                  <input
                    inputMode="numeric"
                    placeholder="Digite a quantidade"
                    value={novo.quantidade}
                    onChange={(e) => setNovo({ ...novo, quantidade: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                    onKeyDown={(e) => e.key === "Enter" && adicionar()}
                    aria-label="Quantidade"
                  />
                </label>
                <button className="ghost-btn col-adicionar-btn" disabled={quantidadeValida(novo.quantidade) === null} onClick={adicionar}>
                  Adicionar à coleção
                </button>
              </div>
            )}

            <div className="de-paginacao">
              <button className="link-btn" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior">
                ◀
              </button>
              <span>
                {resultados.length ? pagina + 1 : 0} / {resultados.length ? paginas : 0} · {resultados.length.toLocaleString("pt-BR")} cartas
              </span>
              <button className="link-btn" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)} aria-label="Próxima página">
                ▶
              </button>
            </div>
            <div className="de-grade de-resultados">{resultados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map(thumb)}</div>
          </aside>
        </div>
      )}
    </ScreenShell>
  );
}
