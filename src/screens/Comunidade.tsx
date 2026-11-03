import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardPreview from "../components/CardPreview";
import { ComboCard } from "../components/ComboSearch";
import BotaoLink from "../components/BotaoLink";
import Lateral from "../components/Lateral";
import { GUIAS_ESCRITOS, type Idioma } from "../data/guias";
import { combosDoArquetipo, type ComboBase } from "../db/baseCombos";
import { initCardDb, useCardDb } from "../db/cardStore";
import { rankingDoArquetipo, type Duelista, type Leitura } from "../db/conquistas";
import { linhasDoArquetipo } from "../db/guiaDeck";
import { normalize } from "../db/search";
import { supabaseReady } from "../db/supabase";
import { displayName, type Card } from "../db/types";
import type { Rota } from "../rotas";
import { IDIOMA, t } from "../i18n";
import "./comunidade.css";

// Comunidade: escolha um arquétipo (os mesmos da busca de cartas; os do meta do TCG primeiro) e
// veja quem mais compartilhou combos dele, os Combos da Comunidade com a tag do arquétipo e o
// resumo do Guia de Deck. A tag vem de "Arquétipos vinculados", ao compartilhar o combo.

export default function Comunidade({
  onBack,
  inicial,
  onRota,
  onGuia,
}: {
  onBack: () => void;
  /** link compartilhado: #/comunidade/<arquétipo> */
  inicial?: { arquetipo?: string };
  onRota?: (r: Rota) => void;
  /** abre o Guia de Deck do arquétipo, na aba indicada */
  onGuia: (arquetipo: string, aba: "iniciais" | "combos") => void;
}) {
  const db = useCardDb();
  useEffect(() => void initCardDb(), []);
  const meta = db.extras?.metaTcg;
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(inicial?.arquetipo ?? null);

  // arquétipos: os do meta (com a fatia de uso) e depois os demais em ordem alfabética
  const lista = useMemo(() => {
    const doMeta = meta?.arquetipos.map((a) => a.arquetipo) ?? [];
    const noMeta = new Set(doMeta.map((a) => a.toLowerCase()));
    return [...doMeta, ...db.archetypes.filter((a) => !noMeta.has(a.toLowerCase())).sort((a, b) => a.localeCompare(b))];
  }, [meta, db.archetypes]);
  const nome = (a: string) => {
    const pt = IDIOMA === "pt" ? db.archetypePt.get(a) : undefined;
    return pt && pt.toLowerCase() !== a.toLowerCase() ? `${a} · ${pt}` : a;
  };
  const filtrados = useMemo(() => {
    const q = normalize(busca.trim());
    if (!q) return lista.slice(0, 60);
    return lista.filter((a) => normalize(a).includes(q) || normalize(db.archetypePt.get(a) ?? "").includes(q)).slice(0, 80);
  }, [busca, lista, db.archetypePt]);
  const arquetipo = escolhido ?? lista[0] ?? null;
  const daMeta = meta?.arquetipos.find((a) => a.arquetipo.toLowerCase() === arquetipo?.toLowerCase());

  useEffect(() => {
    if (arquetipo) onRota?.({ tela: "comunidade", arquetipo });
  }, [arquetipo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ranking e combos do arquétipo
  const [ranking, setRanking] = useState<Leitura<Duelista[]> | null>(null);
  const [combos, setCombos] = useState<{ status: "carregando" | "ok" | "erro"; lista: ComboBase[]; erro?: string }>({ status: "carregando", lista: [] });
  useEffect(() => {
    if (!arquetipo || !supabaseReady()) return;
    let vivo = true;
    setRanking(null);
    setCombos({ status: "carregando", lista: [] });
    void rankingDoArquetipo(arquetipo).then((r) => vivo && setRanking(r));
    combosDoArquetipo(arquetipo, 30)
      .then((l) => vivo && setCombos({ status: "ok", lista: l }))
      .catch((e) => vivo && setCombos({ status: "erro", lista: [], erro: e instanceof Error ? e.message : String(e) }));
    return () => void (vivo = false);
  }, [arquetipo]);

  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);
  const linhasApp = useMemo(() => (arquetipo ? linhasDoArquetipo(db.extras?.combos, arquetipo) : []), [db.extras?.combos, arquetipo]);
  const escrito = GUIAS_ESCRITOS.find((g) => g.arquetipo.toLowerCase() === arquetipo?.toLowerCase());
  const texto = escrito?.textos[IDIOMA as Idioma];
  // texto do guia sem a marcação ([[Carta]] vira o nome no idioma do app; **negrito** vira texto)
  const simples = (s: string) => s.replace(/\[\[([^\]]+)\]\]/g, (_, n: string) => (byName.get(n) ? displayName(byName.get(n)!) : n)).replace(/\*\*([^*]+)\*\*/g, "$1");

  // prévia de carta ao passar o mouse (a mesma das outras telas)
  const [hover, setHover] = useState<{ card: Card; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const onHover = useCallback((card: Card | null, el?: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (!card || !el) return setHover(null);
    hoverTimer.current = window.setTimeout(() => setHover({ card, rect: el.getBoundingClientRect() }), 300);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  return (
    <ScreenShell title={t("Comunidade")} accent="magenta" onBack={onBack} plain>
      <div className="comunidade">
        <Lateral como="nav" className="cm-lista" titulo={t("Arquétipos")} fecharCom={arquetipo} aria-label={t("Arquétipos")}>
          <input
            className="cm-busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Pesquisar arquétipo (ex.: Kewl Tune)")}
            aria-label={t("Pesquisar arquétipo")}
          />
          <p className="tags-note">{busca ? t("{0} encontrado(s)", [filtrados.length]) : t("Os do meta do TCG primeiro; pesquise para ver todos.")}</p>
          {filtrados.map((a) => {
            const m = meta?.arquetipos.find((x) => x.arquetipo === a);
            return (
              <button key={a} className={a === arquetipo ? "active" : ""} onClick={() => setEscolhido(a)}>
                <span className="cm-nome">{nome(a)}</span>
                {m && <small>{m.pct6m}%</small>}
              </button>
            );
          })}
        </Lateral>

        <div className="cm-conteudo">
          {!arquetipo ? (
            <p className="tags-note">{t("Carregando…")}</p>
          ) : (
            <>
              <header className="cm-cabecalho">
                <h2>{nome(arquetipo)}</h2>
                <BotaoLink rota={{ tela: "comunidade", arquetipo }} />
                {daMeta && <p className="tags-note">{t("{0}% dos decks do TCG nos últimos 6 meses", [daMeta.pct6m])}</p>}
              </header>

              <section className="cm-bloco">
                <h3>{t("Quem mais compartilha combos de {0}", [arquetipo])}</h3>
                {!supabaseReady() ? (
                  <p className="tags-note">{t("Contas ainda não configuradas neste app.")}</p>
                ) : !ranking ? (
                  <p className="tags-note">{t("Carregando…")}</p>
                ) : !ranking.ok ? (
                  <p className="db-warning">{ranking.indisponivel ? t("O Rank ainda não está ativo neste servidor (falta aplicar a atualização do banco das conquistas).") : ranking.erro}</p>
                ) : !ranking.dados.length ? (
                  <p className="tags-note">{t("Ninguém compartilhou combos deste arquétipo ainda.")}</p>
                ) : (
                  <ol className="rank-tabela rank-tabela-curta">
                    {ranking.dados.map((d, i) => (
                      <li key={d.usuario_id}>
                        <span className="rank-pos">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`}</span>
                        <span className="rank-nome">@{d.usuario}</span>
                        <span className="rank-combos">{t("{0} combo(s)", [d.combos_compartilhados])}</span>
                        <span className="rank-pts">{t("{0} pts", [d.pontos])}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="cm-bloco">
                <h3>{t("Combos")}</h3>
                <p className="tags-note">
                  {t("Combos da Comunidade com a tag do arquétipo (vinculada ao compartilhar).")}{" "}
                  {linhasApp.length > 0 && t("O App também calculou {0} linha(s) com decklists de torneio.", [linhasApp.length])}
                </p>
                {linhasApp.length > 0 && daMeta && (
                  <button className="ghost-btn" onClick={() => onGuia(arquetipo, "combos")}>
                    {t("Ver as linhas do App no Guia de Deck")} →
                  </button>
                )}
                {combos.status === "carregando" && supabaseReady() && <p className="tags-note">{t("Carregando…")}</p>}
                {combos.status === "erro" && <p className="db-warning">{combos.erro}</p>}
                {combos.status === "ok" && !combos.lista.length && <p className="tags-note">{t("Ainda não há Combos da Comunidade com este arquétipo.")}</p>}
                {combos.lista.map((c) => (
                  <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={new Set()} format="TCG" />
                ))}
              </section>

              <section className="cm-bloco">
                <h3>{t("Guia de Deck")}</h3>
                {!daMeta ? (
                  <p className="tags-note">{t("Este arquétipo não está entre os decks do meta do TCG; ainda não tem Guia de Deck.")}</p>
                ) : (
                  <>
                    {texto ? (
                      <>
                        <p>{simples(texto.resumo)}</p>
                        <ul className="cm-topicos">
                          {[...texto.iniciais, ...texto.avancadas].map((b) => (
                            <li key={b.titulo}>{b.titulo}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="tags-note">{t("Ainda não há texto escrito para este deck; o guia mostra o núcleo, as listas de torneio, os combos e as interações.")}</p>
                    )}
                    <div className="cm-acoes">
                      <button className="ghost-btn" onClick={() => onGuia(arquetipo, "iniciais")}>
                        {t("Abrir o Guia de Deck")} →
                      </button>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
