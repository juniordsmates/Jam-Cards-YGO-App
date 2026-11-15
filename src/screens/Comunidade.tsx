import { useEffect, useMemo, useState } from "react";
import ScreenShell from "./ScreenShell";
import BotaoLink from "../components/BotaoLink";
import Lateral from "../components/Lateral";
import GuiaDoDeck, { type Aba } from "../components/GuiaDoDeck";
import { initCardDb, useCardDb } from "../db/cardStore";
import { interacoesPorArquetipo, rankingDoArquetipo, type Duelista, type InteracoesArquetipo, type Leitura } from "../db/conquistas";
import type { DeckTemporario } from "../db/decks";
import { normalize } from "../db/search";
import { supabaseReady } from "../db/supabase";
import { conquistar } from "../db/minhasConquistas";
import type { Rota } from "../rotas";
import type { ComboTeste } from "./TesteJogo";
import { IDIOMA, t, LOCALE } from "../i18n";
import "./comunidade.css";

// Comunidade: escolha um arquétipo (os mesmos da busca de cartas; os do meta do TCG primeiro) e veja o
// guia dele (Ideias Iniciais, Ideias Avançadas, Combos, Interações e Artigos de Jogadores; antes era a
// tela Guia de Deck) e, no canto, quem mais compartilhou combos dele. A tag do arquétipo nos Combos da
// Comunidade vem de "Arquétipos vinculados", ao compartilhar o combo.

// até 5 comunidades favoritas, guardadas neste aparelho; aparecem no topo da lista
const FAVORITAS = "comunidade-favoritas";
const MAX_FAVORITAS = 5;
function lerFavoritas(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(FAVORITAS) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_FAVORITAS) : [];
  } catch {
    return [];
  }
}
function gravarFavoritas(lista: string[]) {
  try {
    localStorage.setItem(FAVORITAS, JSON.stringify(lista));
  } catch {
    // sem armazenamento: vale só enquanto a tela estiver aberta
  }
}

export default function Comunidade({
  onBack,
  inicial,
  onRota,
  onTestar,
}: {
  onBack: () => void;
  /** link compartilhado: #/comunidade/<arquétipo>/<aba do guia> (e os antigos #/guia/…) */
  inicial?: { arquetipo?: string; aba?: string };
  onRota?: (r: Rota) => void;
  /** "Testar" uma linha de combo do guia */
  onTestar?: (deck: DeckTemporario, combo: ComboTeste) => void;
}) {
  const db = useCardDb();
  useEffect(() => void initCardDb(), []);
  const meta = db.extras?.metaTcg;
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(inicial?.arquetipo ?? null);
  // aba do guia (vale ao trocar de arquétipo)
  const [aba, setAba] = useState<string | undefined>(inicial?.aba);

  // interações da comunidade por arquétipo (combos compartilhados e artigos aprovados)
  const [interacoes, setInteracoes] = useState<Map<string, InteracoesArquetipo>>(new Map());
  useEffect(() => {
    let vivo = true;
    void interacoesPorArquetipo().then((m) => vivo && setInteracoes(m));
    return () => void (vivo = false);
  }, []);

  const [favoritas, setFavoritas] = useState<string[]>(lerFavoritas);
  const ehFavorita = (a: string) => favoritas.some((f) => f.toLowerCase() === a.toLowerCase());
  const alternarFavorita = (a: string) => {
    const nova = ehFavorita(a) ? favoritas.filter((f) => f.toLowerCase() !== a.toLowerCase()) : [...favoritas, a].slice(0, MAX_FAVORITAS);
    setFavoritas(nova);
    gravarFavoritas(nova);
  };

  // quatro grupos, separados por uma linha:
  // 1. as favoritas do usuário (até 5);
  // 2. os 5 decks com mais representatividade no meta atual (fatia dos últimos 2 meses de torneios);
  // 3. os 5 com mais interações da comunidade (fora os dos grupos anteriores);
  // 4. o restante, em ordem alfabética.
  const grupos = useMemo(() => {
    const chave = (a: string) => a.toLowerCase();
    const usados = new Set<string>(favoritas.map(chave));
    const doMeta = [...(meta?.arquetipos ?? [])]
      .filter((a) => !usados.has(chave(a.arquetipo)))
      .sort((a, b) => b.pct2m - a.pct2m || b.pct6m - a.pct6m)
      .slice(0, 5)
      .map((a) => a.arquetipo);
    doMeta.forEach((a) => usados.add(chave(a)));
    const ativos = [...interacoes]
      .filter(([a, i]) => i.total > 0 && !usados.has(chave(a)))
      .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([a]) => a);
    ativos.forEach((a) => usados.add(chave(a)));
    // todos os arquétipos conhecidos: os da base de cartas e os do meta (alguns só existem no meta)
    const todos = new Map<string, string>();
    for (const a of [...db.archetypes, ...(meta?.arquetipos.map((x) => x.arquetipo) ?? [])]) if (!todos.has(chave(a))) todos.set(chave(a), a);
    // fora os nomes quebrados da base de cartas ("| supports_archetypes …", "-Eyes Dragon"); a ordem
    // ignora a pontuação do começo ("C" fica no C, /Assault Mode no A)
    const ordem = (a: string) => a.replace(/^[^\p{L}\p{N}]+/u, "");
    const resto = [...todos.values()]
      .filter((a) => !usados.has(chave(a)) && !/\||supports_archetypes/.test(a) && !/^-/.test(a))
      .sort((a, b) => ordem(a).localeCompare(ordem(b), LOCALE));
    return [
      { id: "favoritas", titulo: t("Favoritas"), itens: favoritas },
      { id: "meta", titulo: t("Mais jogados no meta atual"), itens: doMeta },
      { id: "comunidade", titulo: t("Mais ativos na comunidade"), itens: ativos },
      { id: "todos", titulo: t("Todos (A–Z)"), itens: resto },
    ];
  }, [meta, interacoes, db.archetypes, favoritas]);
  const lista = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);
  const nome = (a: string) => {
    const pt = IDIOMA === "pt" ? db.archetypePt.get(a) : undefined;
    return pt && pt.toLowerCase() !== a.toLowerCase() ? `${a} · ${pt}` : a;
  };
  // a pesquisa filtra dentro de cada grupo (os grupos vazios somem)
  const filtrados = useMemo(() => {
    const q = normalize(busca.trim());
    const bate = (a: string) => !q || normalize(a).includes(q) || normalize(db.archetypePt.get(a) ?? "").includes(q);
    return grupos.map((g) => ({ ...g, itens: g.itens.filter(bate) })).filter((g) => g.itens.length);
  }, [busca, grupos, db.archetypePt]);
  const encontrados = filtrados.reduce((s, g) => s + g.itens.length, 0);
  const arquetipo = escolhido ?? lista[0] ?? null;

  useEffect(() => {
    if (arquetipo) onRota?.({ tela: "comunidade", arquetipo, ...(aba ? { aba } : {}) });
  }, [arquetipo, aba]); // eslint-disable-line react-hooks/exhaustive-deps
  // conquista "Entrando na Comunidade": abriu um arquétipo (escolhido na lista ou pelo link)
  useEffect(() => {
    if (escolhido) conquistar("entrando_comunidade");
  }, [escolhido]);

  // quem mais compartilhou combos do arquétipo
  const [ranking, setRanking] = useState<Leitura<Duelista[]> | null>(null);
  useEffect(() => {
    if (!arquetipo || !supabaseReady()) return;
    let vivo = true;
    setRanking(null);
    void rankingDoArquetipo(arquetipo).then((r) => vivo && setRanking(r));
    return () => void (vivo = false);
  }, [arquetipo]);

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
          {busca && <p className="tags-note">{t("{0} encontrado(s)", [encontrados])}</p>}
          {filtrados.map((g, gi) => (
            <div key={g.id} className="cm-grupo">
              {gi > 0 && <hr className="cm-linha" />}
              <p className="cm-grupo-titulo">{g.titulo}</p>
              {g.itens.map((a) => {
                const m = meta?.arquetipos.find((x) => x.arquetipo === a);
                const i = interacoes.get(a);
                return (
                  <button key={a} className={a === arquetipo ? "active" : ""} onClick={() => setEscolhido(a)}>
                    <span className="cm-nome">{nome(a)}</span>
                    {g.id === "meta" && m && <small title={t("Fatia dos decks de torneio do TCG nos últimos 2 meses")}>{m.pct2m}%</small>}
                    {g.id === "comunidade" && i && <small title={t("{0} combo(s) compartilhado(s) · {1} artigo(s)", [i.combos, i.artigos])}>{i.total === 1 ? t("1 interação") : t("{0} interações", [i.total])}</small>}
                  </button>
                );
              })}
            </div>
          ))}
        </Lateral>

        <div className="cm-conteudo">
          {!arquetipo ? (
            <p className="tags-note">{t("Carregando…")}</p>
          ) : (
            <>
              <header className="cm-cabecalho">
                <div className="cm-titulo">
                  <h2>{nome(arquetipo)}</h2>
                  <div className="cm-acoes">
                    <BotaoLink rota={{ tela: "comunidade", arquetipo, ...(aba ? { aba } : {}) }} />
                    <button
                      className="ghost-btn cm-favoritar"
                      aria-pressed={ehFavorita(arquetipo)}
                      disabled={!ehFavorita(arquetipo) && favoritas.length >= MAX_FAVORITAS}
                      title={!ehFavorita(arquetipo) && favoritas.length >= MAX_FAVORITAS ? t("Você já tem 5 favoritas: tire uma para acrescentar outra.") : undefined}
                      onClick={() => alternarFavorita(arquetipo)}
                    >
                      {ehFavorita(arquetipo) ? t("★ Favorita") : t("☆ Favoritar")}
                    </button>
                  </div>
                </div>

                {/* top de quem compartilhou combos: compacto, no canto direito */}
                <aside className="cm-rank-mini" aria-label={t("Quem mais compartilha combos de {0}", [arquetipo])}>
                  <h3>{t("Top de combos compartilhados")}</h3>
                  {!supabaseReady() ? (
                    <p className="tags-note">{t("Contas ainda não configuradas neste app.")}</p>
                  ) : !ranking ? (
                    <p className="tags-note">{t("Carregando…")}</p>
                  ) : !ranking.ok ? (
                    <p className="db-warning">{ranking.indisponivel ? t("O Rank ainda não está ativo neste servidor (falta aplicar a atualização do banco das conquistas).") : ranking.erro}</p>
                  ) : !ranking.dados.length ? (
                    <p className="tags-note">{t("Ninguém compartilhou combos deste arquétipo ainda.")}</p>
                  ) : (
                    <ol>
                      {ranking.dados.slice(0, 5).map((d, i) => (
                        <li key={d.usuario_id} title={t("{0} combo(s) · {1} pts", [d.combos_compartilhados, d.pontos])}>
                          <span className="rank-pos">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`}</span>
                          <span className="rank-nome">@{d.usuario}</span>
                          <span className="rank-combos">{d.combos_compartilhados}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </aside>
              </header>

              <GuiaDoDeck key={arquetipo} arquetipo={arquetipo} abaInicial={aba} onAba={(a: Aba) => setAba(a)} onEscolher={setEscolhido} onTestar={onTestar} />
            </>
          )}
        </div>
      </div>
    </ScreenShell>
  );
}
