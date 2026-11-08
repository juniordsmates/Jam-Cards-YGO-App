import { useEffect, useMemo, useState, type FormEvent } from "react";
import ScreenShell from "./ScreenShell";
import BotaoLink from "../components/BotaoLink";
import { openConta } from "../components/Conta";
import { initCardDb, useCardDb } from "../db/cardStore";
import { useConta } from "../db/conta";
import { avisos, criarDeck, lerDeckList, ordenarParte, useDecks, type Deck } from "../db/decks";
import {
  analisarResultado,
  CATEGORIAS,
  cartaDeCapa,
  compartilharResultado,
  excluirResultado,
  listarResultados,
  resultadoPorId,
  resultadosParaAnalise,
  rotuloCategoria,
  rotuloTorneio,
  TIPOS_TORNEIO,
  type CategoriaEvento,
  type LeituraEventos,
  type ResultadoEvento,
} from "../db/eventos";
import { cardImage } from "../db/images";
import type { GameFormat } from "../db/legality";
import { normalize } from "../db/search";
import { displayName, type Card } from "../db/types";
import type { Rota } from "../rotas";
import { t, LOCALE } from "../i18n";
import "./eventos.css";

// Eventos: resultados de torneio compartilhados pelos jogadores, com a decklist, filtrados por
// formato (TCG, OCG) e categoria (Meta, Conceito, Local). Abas: Resultados, Compartilhar resultado
// e, para administradores, Análise de resultados (os Meta só aparecem depois de aprovados).

type Aba = "resultados" | "compartilhar" | "analise";
const FORMATOS: GameFormat[] = ["TCG", "OCG"];

interface Props {
  inicial?: Extract<Rota, { tela: "eventos" }>;
  onRota?: (r: Rota) => void;
  onBack: () => void;
}

export default function Eventos({ inicial, onRota, onBack }: Props) {
  const conta = useConta();
  const db = useCardDb();
  useEffect(() => void initCardDb(), []);
  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);

  const [aba, setAba] = useState<Aba>(inicial?.aba ?? "resultados");
  const [aberto, setAberto] = useState<string | null>(inicial?.resultado ?? null);
  // a aba de análise só existe para administradores
  const abaAtual: Aba = aba === "analise" && !conta?.admin ? "resultados" : aba;
  useEffect(() => {
    onRota?.(aberto ? { tela: "eventos", resultado: aberto } : abaAtual === "resultados" ? { tela: "eventos" } : { tela: "eventos", aba: abaAtual });
  }, [aberto, abaAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocarAba = (a: Aba) => {
    setAberto(null);
    setAba(a);
  };

  return (
    <ScreenShell
      title={t("Eventos")}
      accent="magenta"
      onBack={onBack}
      plain
      actions={
        <div className="format-switch ev-abas" role="tablist" aria-label={t("Eventos")}>
          <button role="tab" aria-selected={abaAtual === "resultados"} className={abaAtual === "resultados" ? "active" : ""} onClick={() => trocarAba("resultados")}>
            {t("Resultados")}
          </button>
          <button role="tab" aria-selected={abaAtual === "compartilhar"} className={abaAtual === "compartilhar" ? "active" : ""} onClick={() => trocarAba("compartilhar")}>
            {t("Compartilhar resultado")}
          </button>
          {conta?.admin && (
            <button role="tab" aria-selected={abaAtual === "analise"} className={abaAtual === "analise" ? "active" : ""} onClick={() => trocarAba("analise")}>
              {t("Análise de resultados")}
            </button>
          )}
        </div>
      }
    >
      <div className="eventos">
        {aberto ? (
          <Detalhe id={aberto} byId={byId} onVoltar={() => setAberto(null)} />
        ) : abaAtual === "resultados" ? (
          <Resultados byId={byId} onAbrir={setAberto} onCompartilhar={() => trocarAba("compartilhar")} />
        ) : abaAtual === "compartilhar" ? (
          <Compartilhar byId={byId} cards={db.cards} onVer={(id) => setAberto(id)} />
        ) : (
          <Analise byId={byId} onAbrir={setAberto} />
        )}
      </div>
    </ScreenShell>
  );
}

// ---------------------------------------------------------------- resultados

function Resultados({ byId, onAbrir, onCompartilhar }: { byId: Map<number, Card>; onAbrir: (id: string) => void; onCompartilhar: () => void }) {
  const [formato, setFormato] = useState<GameFormat>("TCG");
  const [categoria, setCategoria] = useState<CategoriaEvento | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<LeituraEventos<ResultadoEvento[]> | null>(null);
  useEffect(() => {
    let vivo = true;
    setLista(null);
    void listarResultados({ formato, categoria }).then((r) => vivo && setLista(r));
    return () => void (vivo = false);
  }, [formato, categoria]);

  const visiveis = useMemo(() => {
    if (!lista?.ok) return [];
    const q = normalize(busca.trim());
    if (!q) return lista.dados;
    return lista.dados.filter((r) => [r.nome_deck, r.jogador, r.nome_evento ?? "", rotuloTorneio(r.tipo_torneio)].some((x) => normalize(x).includes(q)));
  }, [lista, busca]);

  return (
    <>
      <div className="ev-filtros">
        <div className="format-switch" role="radiogroup" aria-label={t("Formato")}>
          {FORMATOS.map((f) => (
            <button key={f} role="radio" aria-checked={formato === f} className={formato === f ? "active" : ""} onClick={() => setFormato(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="format-switch" role="radiogroup" aria-label={t("Categoria")}>
          {(["todas", ...CATEGORIAS.map((c) => c.id)] as const).map((c) => (
            <button key={c} role="radio" aria-checked={categoria === c} className={categoria === c ? "active" : ""} onClick={() => setCategoria(c)}>
              {c === "todas" ? t("Todas") : rotuloCategoria(c)}
            </button>
          ))}
        </div>
        <input className="ev-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("Deck, jogador ou evento")} aria-label={t("Filtrar resultados")} />
      </div>

      {!lista ? (
        <p className="tags-note">{t("Carregando…")}</p>
      ) : !lista.ok ? (
        <p className="db-warning">{lista.indisponivel ? t("Os Eventos ainda não estão ativos neste servidor (falta aplicar a atualização do banco).") : lista.erro}</p>
      ) : !visiveis.length ? (
        <div className="ev-vazio">
          <p className="tags-note">{lista.dados.length ? t("Nenhum resultado com esse filtro.") : t("Ainda não há resultados {0} nesta categoria.", [formato])}</p>
          <button className="ghost-btn" onClick={onCompartilhar}>
            {t("Compartilhar o seu resultado")} →
          </button>
        </div>
      ) : (
        <ul className="ev-grade">
          {visiveis.map((r) => (
            <li key={r.id}>
              <CartaoResultado r={r} byId={byId} onAbrir={() => onAbrir(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const fmtData = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE) : "");

/** "1º de ~64 jogadores" */
const colocacao = (r: Pick<ResultadoEvento, "posicao" | "jogadores">) =>
  r.posicao ? (r.jogadores ? t("{0}º de ~{1} jogadores", [r.posicao, r.jogadores.toLocaleString(LOCALE)]) : t("{0}º lugar", [r.posicao])) : "";

function Situacao({ r }: { r: ResultadoEvento }) {
  if (r.status === "pendente") return <span className="ev-situacao ev-pendente">{t("Em avaliação")}</span>;
  if (r.status === "recusado") return <span className="ev-situacao ev-recusado">{t("Recusado")}</span>;
  return null;
}

function CartaoResultado({ r, byId, onAbrir }: { r: ResultadoEvento; byId: Map<number, Card>; onAbrir: () => void }) {
  const capa = cartaDeCapa(r.main);
  return (
    <button className="ev-cartao" onClick={onAbrir}>
      <span className="ev-capa">
        {capa && <img src={cardImage(capa, "cropped")} alt="" loading="lazy" />}
        <span className={`ev-categoria ev-cat-${r.categoria}`}>{rotuloCategoria(r.categoria)}</span>
      </span>
      <span className="ev-info">
        <strong>{r.nome_deck}</strong>
        <span>{r.jogador}</span>
        {r.categoria !== "conceito" && (
          <small>
            {colocacao(r)} · {r.nome_evento || rotuloTorneio(r.tipo_torneio)}
          </small>
        )}
        <small className="tags-note">
          {[r.formato, fmtData(r.data_evento) || fmtData(r.criado_em.slice(0, 10)), capa && byId.get(capa) ? displayName(byId.get(capa)!) : ""].filter(Boolean).join(" · ")}
        </small>
        <Situacao r={r} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- um resultado

function Detalhe({ id, byId, onVoltar }: { id: string; byId: Map<number, Card>; onVoltar: () => void }) {
  const conta = useConta();
  const [r, setR] = useState<ResultadoEvento | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    let vivo = true;
    void resultadoPorId(id).then((x) => vivo && setR(x));
    return () => void (vivo = false);
  }, [id]);

  if (r === undefined) return <p className="tags-note">{t("Carregando…")}</p>;
  if (!r)
    return (
      <div className="ev-vazio">
        <p className="tags-note">{t("Resultado não encontrado (pode ter sido excluído ou ainda estar em avaliação).")}</p>
        <button className="ghost-btn" onClick={onVoltar}>
          ← {t("Voltar aos resultados")}
        </button>
      </div>
    );

  const podeExcluir = conta && (conta.id === r.autor_id || conta.admin);
  const salvarNosDecks = () => {
    const d = criarDeck(r.nome_deck, { main: r.main, extra: r.extra, side: r.side });
    setMsg({ tipo: "ok", texto: t("Deck \"{0}\" salvo em Meus decks (Editor de Deck).", [d.nome]) });
  };
  const excluir = async () => {
    try {
      await excluirResultado(r.id);
      onVoltar();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <article className="ev-detalhe">
      <header className="ev-detalhe-topo">
        <button className="ghost-btn" onClick={onVoltar}>
          ← {t("Resultados")}
        </button>
        <div className="ev-detalhe-titulo">
          <h2>{r.nome_deck}</h2>
          <p>
            <strong>{r.jogador}</strong>
            {r.perfis?.usuario && <span className="tags-note"> · {t("enviado por @{0}", [r.perfis.usuario])}</span>}
          </p>
          <p className="ev-detalhe-evento">
            <span className={`ev-categoria ev-cat-${r.categoria}`}>{rotuloCategoria(r.categoria)}</span>
            <span>{r.formato}</span>
            {r.categoria !== "conceito" && <span>{colocacao(r)}</span>}
            {r.tipo_torneio && <span>{rotuloTorneio(r.tipo_torneio)}</span>}
            {r.nome_evento && <span>{r.nome_evento}</span>}
            {r.data_evento && <span>{fmtData(r.data_evento)}</span>}
            <Situacao r={r} />
          </p>
          {r.status === "pendente" && <p className="tags-note">{t("Resultados Meta passam por uma avaliação antes de serem publicados. Por enquanto, só você e os administradores veem este.")}</p>}
          {r.status === "recusado" && <p className="db-warning">{r.motivo_recusa ? t("Recusado: {0}", [r.motivo_recusa]) : t("Recusado na avaliação.")}</p>}
        </div>
        <div className="ev-detalhe-acoes">
          <BotaoLink rota={{ tela: "eventos", resultado: r.id }} bloqueado={r.status !== "aprovado" ? t("O link funciona depois que o resultado for publicado.") : undefined} />
          <button className="ghost-btn" onClick={salvarNosDecks}>
            {t("Salvar em Meus decks")}
          </button>
          {podeExcluir &&
            (confirmar ? (
              <>
                <button className="danger-btn" onClick={() => void excluir()}>
                  {t("Confirmar exclusão")}
                </button>
                <button className="ghost-btn" onClick={() => setConfirmar(false)}>
                  {t("Cancelar")}
                </button>
              </>
            ) : (
              <button className="ghost-btn" onClick={() => setConfirmar(true)}>
                {t("Excluir")}
              </button>
            ))}
        </div>
      </header>
      {msg && <p className={msg.tipo === "ok" ? "conta-ok" : "db-warning"}>{msg.texto}</p>}
      {r.observacoes && <p className="ev-observacoes">{r.observacoes}</p>}
      <ListaDoDeck main={r.main} extra={r.extra} side={r.side} byId={byId} />
    </article>
  );
}

function ListaDoDeck({ main, extra, side, byId }: { main: number[]; extra: number[]; side: number[]; byId: Map<number, Card> }) {
  const partes = [
    { nome: t("Main Deck"), ids: main },
    { nome: t("Extra Deck"), ids: extra },
    { nome: t("Side Deck"), ids: side },
  ].filter((p) => p.ids.length);
  return (
    <div className="ev-deck">
      {partes.map((p) => (
        <section key={p.nome}>
          <h3>
            {p.nome} <small className="tags-note">({p.ids.length})</small>
          </h3>
          <div className="ev-cartas">
            {ordenarParte(p.ids, byId).map((id, i) => {
              const c = byId.get(id);
              return <img key={`${id}-${i}`} src={cardImage(id, "small")} alt={c ? displayName(c) : `#${id}`} title={c ? displayName(c) : `#${id}`} loading="lazy" />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- compartilhar

function Compartilhar({ byId, cards, onVer }: { byId: Map<number, Card>; cards: Card[]; onVer: (id: string) => void }) {
  const conta = useConta();
  const { decks } = useDecks();
  const meusDecks = decks.filter((d) => !d.temporario);
  // ids de artes alternativas (dos .ydk) → id da carta
  const idCanonico = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of cards) for (const img of [c.id, ...c.images]) m.set(img, c.id);
    return (id: number) => m.get(id);
  }, [cards]);

  const [origem, setOrigem] = useState<"meus" | "importar">(meusDecks.length ? "meus" : "importar");
  const [deckId, setDeckId] = useState(meusDecks[0]?.id ?? "");
  const [texto, setTexto] = useState("");
  const [jogador, setJogador] = useState(conta?.usuario ?? "");
  const [nomeDeck, setNomeDeck] = useState(meusDecks[0]?.nome ?? "");
  const [formato, setFormato] = useState<GameFormat>("TCG");
  const [categoria, setCategoria] = useState<CategoriaEvento>("local");
  const [torneio, setTorneio] = useState("");
  const [nomeEvento, setNomeEvento] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [posicao, setPosicao] = useState("");
  const [jogadores, setJogadores] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string; id?: string } | null>(null);
  useEffect(() => {
    if (conta && !jogador) setJogador(conta.usuario);
  }, [conta?.usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  // a decklist escolhida (meus decks ou importada)
  const lista = useMemo((): Pick<Deck, "main" | "extra" | "side"> | null => {
    if (origem === "meus") {
      const d = meusDecks.find((x) => x.id === deckId);
      return d ? { main: d.main, extra: d.extra, side: d.side } : null;
    }
    if (!texto.trim()) return null;
    return lerDeckList(texto, idCanonico).deck;
  }, [origem, deckId, texto, decks, idCanonico]); // eslint-disable-line react-hooks/exhaustive-deps
  const problemas = useMemo(() => {
    if (!lista) return [];
    const p: string[] = [];
    if (lista.main.length < 40 || lista.main.length > 60) p.push(t("O Main Deck precisa ter de 40 a 60 cartas (tem {0}).", [lista.main.length]));
    if (lista.extra.length > 15) p.push(t("O Extra Deck pode ter até 15 cartas (tem {0}).", [lista.extra.length]));
    if (lista.side.length > 15) p.push(t("O Side Deck pode ter até 15 cartas (tem {0}).", [lista.side.length]));
    return p;
  }, [lista]);
  // banlist atual: só aviso (o torneio pode ter sido com outra lista)
  // (temporario: o tamanho do Main já é conferido acima)
  const avisosBanlist = useMemo(() => (lista ? avisos({ id: "", nome: "", atualizadoEm: "", temporario: true, ...lista }, byId, formato) : []), [lista, byId, formato]);

  const comTorneio = categoria !== "conceito";
  const nPos = Number(posicao);
  const nJog = Number(jogadores);
  const faltas: string[] = [];
  if (!lista) faltas.push(t("Escolha ou importe a decklist."));
  if (!jogador.trim()) faltas.push(t("Informe o nome do jogador."));
  if (!nomeDeck.trim()) faltas.push(t("Informe o nome do deck."));
  if (comTorneio) {
    if (!torneio) faltas.push(t("Escolha o tipo de torneio."));
    if (!Number.isInteger(nPos) || nPos < 1) faltas.push(t("Informe a posição final."));
    if (!Number.isInteger(nJog) || nJog < 2) faltas.push(t("Informe quantos jogadores, aproximadamente, participaram."));
    else if (Number.isInteger(nPos) && nPos > nJog) faltas.push(t("A posição não pode ser maior que o número de jogadores."));
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!lista || faltas.length || problemas.length) return;
    setEnviando(true);
    setMsg(null);
    try {
      const r = await compartilharResultado({
        jogador,
        nome_deck: nomeDeck,
        formato,
        categoria,
        tipo_torneio: comTorneio ? torneio : null,
        nome_evento: comTorneio ? nomeEvento : null,
        data_evento: data || null,
        posicao: comTorneio ? nPos : null,
        jogadores: comTorneio ? nJog : null,
        main: lista.main,
        extra: lista.extra,
        side: lista.side,
        observacoes,
      });
      setMsg({
        tipo: "ok",
        id: r.id,
        texto: r.status === "pendente" ? t("Enviado! Por ser Meta, o resultado vai passar por uma avaliação antes de ser publicado.") : t("Resultado publicado!"),
      });
      setObservacoes("");
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setEnviando(false);
    }
  };

  if (!conta)
    return (
      <div className="ev-vazio">
        <p>{t("Entre na sua conta para compartilhar o resultado de um evento com a sua decklist.")}</p>
        <button className="ghost-btn" onClick={() => openConta()}>
          {t("Entrar")}
        </button>
      </div>
    );

  return (
    <form className="ev-form" onSubmit={(e) => void enviar(e)}>
      <section className="ev-bloco">
        <h3>{t("1. Decklist")}</h3>
        <div className="format-switch" role="radiogroup" aria-label={t("Decklist")}>
          <button type="button" role="radio" aria-checked={origem === "meus"} className={origem === "meus" ? "active" : ""} onClick={() => setOrigem("meus")} disabled={!meusDecks.length}>
            {t("Meus decks")}
          </button>
          <button type="button" role="radio" aria-checked={origem === "importar"} className={origem === "importar" ? "active" : ""} onClick={() => setOrigem("importar")}>
            {t("Importar deck list")}
          </button>
        </div>
        {origem === "meus" ? (
          <label className="field">
            <span className="field-label">{t("Deck")}</span>
            <select
              value={deckId}
              onChange={(e) => {
                setDeckId(e.target.value);
                const d = meusDecks.find((x) => x.id === e.target.value);
                if (d) setNomeDeck(d.nome);
              }}
            >
              {meusDecks.map((d) => (
                <option key={d.id} value={d.id}>
                  {t("{0} ({1} + {2} + {3})", [d.nome, d.main.length, d.extra.length, d.side.length])}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span className="field-label">{t("Cole o link ydke:// ou o conteúdo do arquivo .ydk")}</span>
            <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ydke://…" />
          </label>
        )}
        {lista && (
          <p className="tags-note">
            {t("Main {0} · Extra {1} · Side {2}", [lista.main.length, lista.extra.length, lista.side.length])}
          </p>
        )}
        {problemas.map((p) => (
          <p key={p} className="db-warning">
            {p}
          </p>
        ))}
        {avisosBanlist.length > 0 && (
          <details className="ev-avisos">
            <summary>{t("{0} aviso(s) da banlist atual do {1} (o torneio pode ter usado outra lista)", [avisosBanlist.length, formato])}</summary>
            <ul>
              {avisosBanlist.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="ev-bloco">
        <h3>{t("2. Jogador e deck")}</h3>
        <div className="ev-campos">
          <label className="field">
            <span className="field-label">{t("Nome do jogador")}</span>
            <input value={jogador} maxLength={60} onChange={(e) => setJogador(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{t("Nome do deck")}</span>
            <input value={nomeDeck} maxLength={80} onChange={(e) => setNomeDeck(e.target.value)} placeholder={t("ex.: Kewl Tune Elfnote")} />
          </label>
        </div>
      </section>

      <section className="ev-bloco">
        <h3>{t("3. Evento")}</h3>
        <div className="ev-campos">
          <div className="field">
            <span className="field-label">{t("Formato")}</span>
            <div className="format-switch" role="radiogroup" aria-label={t("Formato")}>
              {FORMATOS.map((f) => (
                <button type="button" key={f} role="radio" aria-checked={formato === f} className={formato === f ? "active" : ""} onClick={() => setFormato(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">{t("Categoria")}</span>
            <div className="format-switch" role="radiogroup" aria-label={t("Categoria")}>
              {CATEGORIAS.map((c) => (
                <button type="button" key={c.id} role="radio" aria-checked={categoria === c.id} className={categoria === c.id ? "active" : ""} onClick={() => setCategoria(c.id)} title={c.hint}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="tags-note">{CATEGORIAS.find((c) => c.id === categoria)?.hint}</p>
        {categoria === "meta" && <p className="ev-aviso-meta">{t("Resultados Meta passam por uma avaliação antes de serem publicados.")}</p>}

        {comTorneio && (
          <div className="ev-campos">
            <label className="field">
              <span className="field-label">{t("Tipo de torneio")}</span>
              <select value={torneio} onChange={(e) => setTorneio(e.target.value)}>
                <option value="">{t("Escolha…")}</option>
                {TIPOS_TORNEIO.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t("Nome do evento (opcional)")}</span>
              <input value={nomeEvento} maxLength={120} onChange={(e) => setNomeEvento(e.target.value)} placeholder={t("ex.: YCS São Paulo 2026")} />
            </label>
            <label className="field">
              <span className="field-label">{t("Posição final")}</span>
              <input type="number" min={1} value={posicao} onChange={(e) => setPosicao(e.target.value)} placeholder="1" />
            </label>
            <label className="field">
              <span className="field-label">{t("Jogadores (aproximado)")}</span>
              <input type="number" min={2} value={jogadores} onChange={(e) => setJogadores(e.target.value)} placeholder="64" />
            </label>
          </div>
        )}
        <div className="ev-campos">
          <label className="field">
            <span className="field-label">{comTorneio ? t("Data do evento") : t("Data (opcional)")}</span>
            <input type="date" value={data} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="field ev-obs">
            <span className="field-label">{t("Observações (opcional)")}</span>
            <textarea rows={3} maxLength={1000} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder={t("Escolhas do Side, confrontos, ideias do deck…")} />
          </label>
        </div>
      </section>

      <div className="ev-enviar">
        {faltas.length > 0 && <small className="tags-note">{faltas[0]}</small>}
        <button type="submit" className="ghost-btn ev-btn-enviar" disabled={enviando || !!faltas.length || !!problemas.length}>
          {enviando ? t("Enviando…") : categoria === "meta" ? t("Enviar para avaliação") : t("Publicar resultado")}
        </button>
      </div>
      {msg && (
        <p className={msg.tipo === "ok" ? "conta-ok" : "db-warning"}>
          {msg.texto}{" "}
          {msg.id && (
            <button type="button" className="link-btn" onClick={() => onVer(msg.id!)}>
              {t("Ver resultado")}
            </button>
          )}
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------- análise (administradores)

function Analise({ byId, onAbrir }: { byId: Map<number, Card>; onAbrir: (id: string) => void }) {
  const [pendentes, setPendentes] = useState(true);
  const [lista, setLista] = useState<LeituraEventos<ResultadoEvento[]> | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setLista(null);
    void resultadosParaAnalise(pendentes).then((r) => vivo && setLista(r));
    return () => void (vivo = false);
  }, [pendentes, versao]);

  const decidir = async (id: string, aprovar: boolean) => {
    setErro(null);
    try {
      await analisarResultado(id, aprovar, motivos[id]);
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <div className="ev-filtros">
        <div className="format-switch" role="radiogroup" aria-label={t("Análise de resultados")}>
          <button role="radio" aria-checked={pendentes} className={pendentes ? "active" : ""} onClick={() => setPendentes(true)}>
            {t("Aguardando análise")}
          </button>
          <button role="radio" aria-checked={!pendentes} className={!pendentes ? "active" : ""} onClick={() => setPendentes(false)}>
            {t("Já analisados")}
          </button>
        </div>
        <p className="tags-note">{t("Resultados Meta só aparecem para todos depois de aprovados. Recusar tira o resultado da lista (o autor vê o motivo).")}</p>
      </div>
      {erro && <p className="db-warning">{erro}</p>}
      {!lista ? (
        <p className="tags-note">{t("Carregando…")}</p>
      ) : !lista.ok ? (
        <p className="db-warning">{lista.indisponivel ? t("Os Eventos ainda não estão ativos neste servidor (falta aplicar a atualização do banco).") : lista.erro}</p>
      ) : !lista.dados.length ? (
        <p className="tags-note">{pendentes ? t("Nenhum resultado aguardando análise.") : t("Nenhum resultado analisado ainda.")}</p>
      ) : (
        <ul className="ev-analise">
          {lista.dados.map((r) => (
            <li key={r.id} className="ev-bloco">
              <CartaoResultado r={r} byId={byId} onAbrir={() => onAbrir(r.id)} />
              <div className="ev-analise-acoes">
                <small className="tags-note">
                  {t("Enviado por @{0} em {1}", [r.perfis?.usuario ?? "?", new Date(r.criado_em).toLocaleString(LOCALE)])}
                  {r.status === "recusado" && r.motivo_recusa ? ` · ${t("Recusado: {0}", [r.motivo_recusa])}` : ""}
                </small>
                <input value={motivos[r.id] ?? ""} maxLength={300} onChange={(e) => setMotivos((m) => ({ ...m, [r.id]: e.target.value }))} placeholder={t("Motivo da recusa (opcional)")} aria-label={t("Motivo da recusa (opcional)")} />
                <div className="ev-analise-botoes">
                  {r.status !== "aprovado" && (
                    <button className="ghost-btn ev-aprovar" onClick={() => void decidir(r.id, true)}>
                      {t("Aprovar e publicar")}
                    </button>
                  )}
                  {r.status !== "recusado" && (
                    <button className="danger-btn" onClick={() => void decidir(r.id, false)}>
                      {t("Recusar")}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
