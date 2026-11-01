import { useEffect, useMemo, useState, type ReactNode } from "react";
import CardPicker from "./CardPicker";
import { openConta } from "./Conta";
import BotaoLink from "./BotaoLink";
import { FontesButton } from "./Fontes";
import VerifiedCombos, { groupSteps, join, Name, StepText } from "./VerifiedCombos";
import type { KnownCombo } from "../data/combos";
import {
  buscarNaBase,
  copiasDoCombo,
  editarCombo,
  excluirCombo,
  gravarBuscaIA,
  salvarComoComunidade,
  validadeNoFormato,
  type ComboBase,
} from "../db/baseCombos";
import { temRecursosAvancados, useConta } from "../db/conta";
import { editarComboLocal, ehLocal, excluirComboLocal, exportarComboLocal, salvarComboLocal } from "../db/combosLocais";
import { buscarCombosComIA, getConfigIA, iaConfigurada, provedor, type SugestaoIA } from "../db/ia";
import type { GameFormat } from "../db/legality";
import { cardsOfLine, passoEmTexto, uniqueLines, type CombosCalculados, type LinhaCombo } from "../db/motor";
import { normalize } from "../db/search";
import { supabaseReady } from "../db/supabase";
import { displayName, type Card } from "../db/types";
import { t, LOCALE } from "../i18n";

type Hover = (card: Card | null, el?: HTMLElement) => void;

type Props = {
  /** alternância de modo da tela de Combos (fica no topo da coluna da esquerda) */
  tabs: ReactNode;
  /** controles extras da coluna da esquerda (ex.: mostrar respostas) */
  extra?: ReactNode;
  respostas?: boolean;
  legal?: (id: number) => boolean;
  all: Card[];
  byId: Map<number, Card>;
  format: GameFormat;
  combos?: CombosCalculados;
  known: Map<string, KnownCombo>;
  /** a linha vale no formato escolhido */
  fits: (l: LinhaCombo) => boolean;
  onHover: Hover;
};

/** Consulta congelada no clique em Buscar */
interface Consulta {
  iniciais: Card[];
  finais: Card[];
}

const ORIGEM_LABEL: Record<ComboBase["origem"], string> = {
  app: t("Calculado com o App"),
  comunidade: t("Combo da Comunidade"),
  ia: t("Sugestão de IA · não conferida"),
};

/**
 * Um combo da base (comunidade ou IA), com a opção de publicar como Combo da Comunidade.
 * Com `format`, mostra se o combo vale na banlist atual desse formato; com `onTestar`, o botão
 * Teste de Jogo (deck temporário com as cartas dele).
 */
export function ComboCard({
  combo: recebido,
  byId,
  onHover,
  highlight,
  format,
  onTestar,
  rotuloTestar = t("▶ Teste de Jogo"),
}: {
  combo: ComboBase;
  byId: Map<number, Card>;
  onHover: Hover;
  highlight: Set<number>;
  format?: GameFormat;
  onTestar?: (combo: ComboBase) => void;
  /** texto do botão de onTestar (padrão "▶ Teste de Jogo") */
  rotuloTestar?: string;
}) {
  const conta = useConta();
  // cópia local: a edição e a exclusão pelo autor aparecem na hora, sem buscar a lista de novo
  const [combo, setCombo] = useState(recebido);
  useEffect(() => setCombo(recebido), [recebido]);
  const [excluido, setExcluido] = useState(false);
  const [form, setForm] = useState<{ autor: string; titulo: string; obs: string } | null>(null);
  const [edicao, setEdicao] = useState<{ titulo: string; obs: string; compartilhar: boolean; passos: ComboBase["dados"]["passos"] } | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  // combo só neste aparelho (Usuário Padrão): "Exportar" envia para a base
  const local = ehLocal(combo);
  const avancado = temRecursosAvancados(conta);
  const [exportando, setExportando] = useState<{ compartilhar: boolean; enviando: boolean } | null>(null);
  // só quem criou o Combo da Comunidade pode editar ou excluir (o banco também confere)
  const meu = local || (!!conta && combo.origem === "comunidade" && combo.autor_id === conta.id);
  const d = combo.dados;
  const groups = groupSteps(d.passos);
  const validade = format ? validadeNoFormato(copiasDoCombo(combo), byId, format) : null;

  const salvarEdicao = async () => {
    if (!edicao) return;
    try {
      setCombo(
        local
          ? editarComboLocal(combo, { titulo: edicao.titulo, observacoes: edicao.obs, passos: edicao.passos })
          : await editarCombo(combo, { titulo: edicao.titulo, observacoes: edicao.obs, compartilhar: edicao.compartilhar, passos: edicao.passos }),
      );
      setEdicao(null);
      setEstado({ tipo: "ok", texto: t("Combo atualizado.") });
    } catch (e) {
      setEstado({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };
  const excluir = async () => {
    try {
      if (local) excluirComboLocal(combo.id);
      else await excluirCombo(combo.id);
      setExcluido(true);
    } catch (e) {
      setConfirmarExclusao(false);
      setEstado({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  const salvar = async () => {
    if (!form) return;
    try {
      // Usuário Padrão: o combo fica só neste aparelho (pode ser exportado depois)
      if (!avancado) {
        salvarComboLocal(
          { autorId: conta?.id ?? null, autorNome: form.autor, titulo: form.titulo, observacoes: form.obs },
          { iniciais: combo.iniciais, finais: combo.finais, arquetipos: combo.arquetipos, dados: { ...d, modelo: undefined } },
        );
        setEstado({ tipo: "ok", texto: t("Salvo neste aparelho (Usuário Padrão). Para enviar à base depois, use Exportar no combo.") });
        setForm(null);
        return;
      }
      await salvarComoComunidade(combo, { autorNome: form.autor, titulo: form.titulo, observacoes: form.obs });
      setEstado({ tipo: "ok", texto: t("Salvo como Combo da Comunidade.") });
      setForm(null);
    } catch (e) {
      setEstado({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  const exportar = async () => {
    if (!exportando) return;
    setExportando({ ...exportando, enviando: true });
    try {
      await exportarComboLocal(combo, exportando.compartilhar);
      setExcluido(true);
    } catch (e) {
      setExportando(null);
      setEstado({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  if (excluido && local && exportando) return <p className="conta-ok combo-excluido">{t("Combo “{0}” exportado para a base.", [combo.titulo])}</p>;
  if (excluido) return <p className="conta-ok combo-excluido">{t("Combo “{0}” excluído.", [combo.titulo])}</p>;

  return (
    <details className={`kc vc base-combo origem-${combo.origem}`} open>
      <summary>
        <span className="kc-title">{combo.titulo}</span>
        <span className="kc-hand">
          {t("Mão:")}{" "}{combo.iniciais.length ? join(combo.iniciais.map((id) => <Name key={id} id={id} byId={byId} onHover={onHover} />), " + ") : "—"}
          {combo.arquetipos.length > 0 && ` · ${combo.arquetipos.join(", ")}`}
        </span>
        <span className={`vc-badge badge-${combo.origem}`}>
          {ORIGEM_LABEL[combo.origem]}
          {combo.origem === "comunidade" && combo.autor_nome && ` · ${combo.autor_nome}`}
          {combo.origem === "comunidade" && ` · ${new Date(combo.criado_em).toLocaleDateString(LOCALE)}`}
          {local ? t(" · neste aparelho") : combo.origem === "comunidade" && !combo.publico && t(" · só você vê")}
          {combo.conferido_em && t(" · conferido com o App")}
        </span>
        {validade && (
          <span
            className={`vc-badge combo-validade ${validade.valido ? "valido" : "invalido"}`}
            title={validade.valido ? t("Todas as cartas e cópias permitidas na banlist atual do {0}.", [format]) : validade.problemas.join("\n")}
          >
            {validade.valido ? t("Válido no {0}", [format]) : t("Fora da banlist do {0}", [format])}
          </span>
        )}
        {(combo.origem === "comunidade" || combo.origem === "ia") && (
          <BotaoLink
            rota={{ tela: "combos", combo: combo.id }}
            bloqueado={local ? t("Combo só neste aparelho: exporte para a base para ter um link") : !/^[0-9a-f-]{36}$/i.test(combo.id) ? t("Este combo ainda não está na base") : undefined}
            aviso={!local && !combo.publico ? t("Só você vê este combo: em Editar, marque Compartilhar para o link abrir para outras pessoas.") : undefined}
            className="combo-link"
          />
        )}
        {onTestar && (
          <button
            className="ghost-btn vc-testar"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTestar(combo);
            }}
          >
            {rotuloTestar}
          </button>
        )}
      </summary>
      {validade && !validade.valido && <p className="db-warning combo-problemas">{validade.problemas.join(" · ")}</p>}
      <ol className="kc-steps vc-steps">
        {groups.map(({ step, subs }, i) => (
          <li key={i} className={[step, ...subs].some((p) => "c" in p && (Array.isArray(p.c) ? p.c.some((c) => highlight.has(c)) : highlight.has(p.c))) ? "vc-hit" : undefined}>
            <StepText p={step} byId={byId} onHover={onHover} />
            {subs.length > 0 && (
              <ul className="vc-subs">
                {subs.map((p, j) => (
                  <li key={j}>
                    <StepText p={p} byId={byId} onHover={onHover} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {(d.campo.monstros.length > 0 || d.campo.magias.length > 0) && (
        <div className="kc-board">
          <span className="field-label">{t("Campo final")}</span>
          <span className="kc-board-cards">
            {d.campo.monstros.map((id, i) => (
              <Name key={`m${id}-${i}`} id={id} byId={byId} onHover={onHover} />
            ))}
            {d.campo.magias.map(([id], i) => (
              <Name key={`s${id}-${i}`} id={id} byId={byId} onHover={onHover} />
            ))}
          </span>
        </div>
      )}
      {d.observacoes && <p className="vc-community">{d.observacoes}</p>}
      <p className="tags-note">
        {combo.origem === "ia" && t("Sugerido por IA{0}: confira antes de usar. ", [combo.dados.modelo ? ` (${combo.dados.modelo})` : ""])}
        <FontesButton links={(d.fontes ?? []).map((f) => ({ nome: f.nome, url: f.url }))} />
        {meu && !edicao && (
          <>
            {" · "}
            <button
              className="link-btn combo-editar"
              onClick={() => {
                setEstado(null);
                setEdicao({ titulo: combo.titulo, obs: d.observacoes ?? "", compartilhar: combo.publico, passos: d.passos });
              }}
            >
              {t("Editar")}</button>
            {" · "}
            {confirmarExclusao ? (
              <>
                <button className="link-btn combo-excluir-ok" onClick={() => void excluir()}>
                  {t("Confirmar exclusão")}</button>{" "}
                <button className="link-btn" onClick={() => setConfirmarExclusao(false)}>
                  {t("Cancelar")}</button>
              </>
            ) : (
              <button className="link-btn combo-excluir" onClick={() => setConfirmarExclusao(true)}>
                {t("Excluir")}</button>
            )}
            {local && !exportando && (
              <>
                {" · "}
                <button
                  className="link-btn combo-exportar"
                  disabled={!avancado}
                  title={avancado ? t("Envia este combo para a base (Combos da Comunidade)") : t("Exportar para a base: disponível para Usuário Avançado ou Mentor")}
                  onClick={() => setExportando({ compartilhar: false, enviando: false })}
                >
                  {t("Exportar")}</button>
                {!avancado && <small> {" "}{t("(exportar: Usuário Avançado ou Mentor)")}</small>}
              </>
            )}
          </>
        )}
        {combo.origem !== "comunidade" && !local && supabaseReady() && !form && estado?.tipo !== "ok" && (
          <>
            {" · "}
            <button
              className="link-btn salvar-comunidade"
              onClick={() => (conta ? setForm({ autor: conta.usuario, titulo: combo.titulo, obs: d.observacoes ?? "" }) : openConta())}
            >
              {t("Salvar como Combo da Comunidade")}</button>
          </>
        )}
      </p>
      {edicao && (
        <div className="comunidade-form combo-edicao">
          <label className="field">
            <span className="field-label">{t("Título")}</span>
            <input value={edicao.titulo} maxLength={120} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} aria-label={t("Título do combo")} />
          </label>
          <span className="field-label">{t("Passos")}</span>
          <ol className="combo-edicao-passos">
            {edicao.passos.map((p, i) => (
              <li key={i}>
                <StepText p={p} byId={byId} onHover={onHover} />
                <button
                  className="link-btn"
                  onClick={() => setEdicao({ ...edicao, passos: edicao.passos.filter((_, j) => j !== i) })}
                  aria-label={t("Tirar o passo {0}", [i + 1])}
                  title={t("Tirar este passo")}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <label className="field">
            <span className="field-label">{t("Observações")}</span>
            <textarea rows={3} maxLength={2000} value={edicao.obs} onChange={(e) => setEdicao({ ...edicao, obs: e.target.value })} />
          </label>
          {!local && <label className="respostas-toggle">
            <input type="checkbox" checked={edicao.compartilhar} onChange={(e) => setEdicao({ ...edicao, compartilhar: e.target.checked })} /> {" "}{t("Compartilhar com todos na aba Combos")}</label>}
          <div className="dialog-actions">
            <button className="ghost-btn" onClick={() => setEdicao(null)}>
              {t("Cancelar")}</button>
            <button className="ghost-btn" disabled={!edicao.titulo.trim() || !edicao.passos.length} onClick={() => void salvarEdicao()}>
              {t("Salvar")}</button>
          </div>
        </div>
      )}
      {exportando && (
        <div className="comunidade-form combo-exportacao">
          <p className="tags-note">{t("O combo sai deste aparelho e vai para a base, como Combo da Comunidade seu.")}</p>
          <label className="respostas-toggle">
            <input type="checkbox" checked={exportando.compartilhar} onChange={(e) => setExportando({ ...exportando, compartilhar: e.target.checked })} /> {" "}{t("Compartilhar com todos na aba Combos")}</label>
          <div className="dialog-actions">
            <button className="ghost-btn" onClick={() => setExportando(null)}>
              {t("Cancelar")}</button>
            <button className="ghost-btn combo-exportar-ok" disabled={exportando.enviando} onClick={() => void exportar()}>
              {exportando.enviando ? t("Exportando…") : t("Exportar")}
            </button>
          </div>
        </div>
      )}
      {form && (
        <div className="comunidade-form">
          <label className="field">
            <span className="field-label">{t("Nome do autor")}</span>
            <input value={form.autor} maxLength={60} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">{t("Título")}</span>
            <input value={form.titulo} maxLength={120} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">{t("Observações")}</span>
            <textarea rows={3} maxLength={2000} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
          </label>
          <div className="dialog-actions">
            <button className="ghost-btn" onClick={() => setForm(null)}>
              {t("Cancelar")}</button>
            <button className="ghost-btn" disabled={!form.autor.trim() || !form.titulo.trim()} onClick={() => void salvar()}>
              {t("Publicar")}</button>
          </div>
        </div>
      )}
      {estado && <p className={estado.tipo === "erro" ? "db-warning" : "conta-ok"}>{estado.texto}</p>}
    </details>
  );
}

/**
 * Combo Search: 0+ cartas iniciais e/ou 1+ cartas finais. Procura na base do App (linhas
 * calculadas), na base de combos (comunidade e buscas anteriores) e, com a chave do usuário, com IA.
 */
export default function ComboSearch({ tabs, extra, respostas, legal, all, byId, format, combos, known, fits, onHover }: Props) {
  const conta = useConta();
  const [iniciais, setIniciais] = useState<Card[]>([]);
  const [finais, setFinais] = useState<Card[]>([]);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [base, setBase] = useState<{ carregando: boolean; combos: ComboBase[]; erro?: string }>({ carregando: false, combos: [] });
  const [ia, setIa] = useState<{ status: "parado" | "buscando" | "pronto" | "erro"; progresso?: string; combos: ComboBase[]; resposta?: string; erro?: string; aviso?: string }>({
    status: "parado",
    combos: [],
  });

  // carta pelo nome em inglês ou português (para os nomes que a IA usa)
  const porNome = useMemo(() => {
    const m = new Map<string, Card>();
    for (const c of all) {
      if (c.frame === "skill" || c.frame === "token") continue;
      m.set(normalize(c.name), c);
      if (c.namePt) m.set(normalize(c.namePt), c);
    }
    return m;
  }, [all]);
  const acharCarta = (nome: string) => porNome.get(normalize(nome));

  // linhas calculadas pelo App: iniciais na mão e finais em algum ponto da linha
  const linhasApp = useMemo(() => {
    if (!combos || !consulta) return [];
    const ini = consulta.iniciais.map((c) => c.id);
    const fin = consulta.finais.map((c) => c.id);
    return uniqueLines(
      combos.linhas.filter((l) => {
        if (!fits(l)) return false;
        const todas = cardsOfLine(l);
        return ini.every((id) => l.mao.includes(id)) && fin.every((id) => todas.includes(id));
      }),
    )
      .sort((x, y) => y.pontos - x.pontos)
      .slice(0, 12);
  }, [combos, consulta, fits]);

  const buscar = () => {
    const c = { iniciais, finais };
    setConsulta(c);
    setIa({ status: "parado", combos: [] });
    if (!supabaseReady()) return;
    setBase({ carregando: true, combos: [] });
    buscarNaBase(c.iniciais.map((x) => x.id), c.finais.map((x) => x.id))
      .then((r) => setBase({ carregando: false, combos: r }))
      .catch((e) => setBase({ carregando: false, combos: [], erro: e instanceof Error ? e.message : String(e) }));
  };

  // combos já registrados que envolvem as cartas, em texto (o que o app envia para a IA)
  const combosDoApp = (cartas: Card[]) => {
    const ids = cartas.map((c) => c.id);
    const nome = (id: number) => (id === 0 ? "Ficha" : byId.get(id)?.name ?? `#${id}`);
    const linhas = (combos?.linhas ?? [])
      .filter((l) => fits(l) && ids.some((id) => cardsOfLine(l).includes(id)))
      .sort((x, y) => y.pontos - x.pontos)
      .slice(0, 8)
      .map((l) => t("Calculado pelo App (deck {0}). Mão: {1}{2}.\n{3}\nCampo final: {4}", [combos!.decks[l.deck].nome, l.mao.map(nome).join(" + "), l.qualquer ? t(" + 1 carta qualquer") : "", l.passos.map((p, i) => `${i + 1}. ${passoEmTexto(p, nome)}`).join("\n"), [...l.campo.monstros, ...l.campo.magias.map(([c]) => c)].map(nome).join(", ")]));
    const daBase = base.combos
      .filter((c) => ids.some((id) => c.iniciais.includes(id) || c.finais.includes(id)))
      .slice(0, 6)
      .map((c) => t("{0}: {1}. Mão: {2}.\n{3}", [ORIGEM_LABEL[c.origem], c.titulo, c.iniciais.map(nome).join(" + "), c.dados.passos.map((p, i) => `${i + 1}. ${passoEmTexto(p, nome)}`).join("\n")]));
    return [...linhas, ...daBase].join("\n\n");
  };

  const buscarComIA = async () => {
    if (!consulta) return;
    const cfg = getConfigIA();
    setIa({ status: "buscando", progresso: t("Consultando a IA…"), combos: [] });
    try {
      const { sugestoes, resposta } = await buscarCombosComIA(cfg, {
        ...consulta,
        formato: format,
        acharCarta,
        combosDoApp,
        onProgresso: (progresso) => setIa((s) => ({ ...s, progresso })),
      });
      // grava a busca e os combos sugeridos na base logo em seguida (precisa de conta)
      let gravados: ComboBase[] = [];
      let aviso: string | undefined;
      if (supabaseReady() && conta) {
        try {
          gravados = await gravarBuscaIA(
            { iniciais: consulta.iniciais.map((c) => c.id), finais: consulta.finais.map((c) => c.id), formato: format, modelo: `${provedor(cfg.provedor).nome} · ${cfg.modelo}`.slice(0, 60) },
            sugestoes,
            (ids) => ids.map((id) => byId.get(id)).filter((c): c is Card => !!c),
          );
        } catch (e) {
          aviso = t("Os combos não foram gravados na base: {0}", [e instanceof Error ? e.message : String(e)]);
        }
      } else {
        aviso = t("Entre na sua conta para gravar esta busca na base de combos e publicar como Combo da Comunidade.");
      }
      // sem gravação, mostra as sugestões do mesmo jeito (sem id na base)
      const mostrar = gravados.length ? gravados : sugestoes.map((s, i) => paraComboBase(s, i));
      setIa({ status: "pronto", combos: mostrar, resposta, aviso });
    } catch (e) {
      setIa({ status: "erro", combos: [], erro: e instanceof Error ? e.message : String(e) });
    }
  };

  const destaque = new Set(consulta?.finais.map((c) => c.id) ?? []);
  const cfgIA = getConfigIA();
  const temChave = iaConfigurada(cfgIA);
  const podeBuscar = iniciais.length + finais.length > 0;

  return (
    <div className="combos combo-search">
      <section className="combos-setup">
        {tabs}
        <CardPicker
          label={t("Cartas iniciais (starters)")}
          className="cs-iniciais"
          cards={iniciais}
          onChange={setIniciais}
          all={all}
          format={format}
          placeholder={t("Opcional (ex.: Ice Ryzeal)")}
          placeholderMore={t("Acrescentar outra inicial…")}
        />
        <CardPicker
          label={t("Cartas finais")}
          className="cs-finais"
          cards={finais}
          onChange={setFinais}
          all={all}
          format={format}
          placeholder={t("Onde o combo deve chegar")}
          placeholderMore={t("Acrescentar outra final…")}
        />
        <button className="ghost-btn cs-buscar" disabled={!podeBuscar} onClick={buscar}>
          {t("Buscar")}</button>
        <p className="tags-note">{t("Declare 0 ou mais cartas iniciais e/ou 1 ou mais cartas finais.")}</p>
        {extra}
      </section>

      <section className="combos-result">
        {!consulta ? (
          <div className="combos-empty">
            <p>{t("Combo Search")}</p>
            <small>
              {t("Escolha as cartas iniciais e/ou as finais e clique em Buscar. O App procura nas linhas que ele calculou, na base de combos (comunidade e buscas anteriores) e, com a sua chave de IA, pesquisa novos combos na web.")}</small>
          </div>
        ) : (
          <>
            <VerifiedCombos
              title={t("Calculados pelo App")}
              lines={linhasApp}
              highlight={consulta.finais.map((c) => c.id)}
              combos={combos!}
              byId={byId}
              known={known}
              onHover={onHover}
              respostas={respostas}
              legal={legal}
            />

            {supabaseReady() && (
              <section className="known-combos" aria-label={t("Na base de combos")}>
                <h4>{t("Na base de combos ({0})", [base.carregando ? "…" : base.combos.length])}</h4>
                {base.erro && <p className="db-warning">{base.erro}</p>}
                {base.combos.map((c) => (
                  <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={destaque} format={format} />
                ))}
              </section>
            )}

            <section className="known-combos ia-section" aria-label={t("Busca com IA")}>
              <h4>{t("Busca com IA")}</h4>
              {ia.status === "parado" &&
                (temChave ? (
                  <button className="ghost-btn cs-ia" onClick={() => void buscarComIA()}>
                    {t("Buscar com {0}: {1}", [provedor(cfgIA.provedor).nome, [...consulta.iniciais, ...consulta.finais].map((c) => displayName(c)).join(", ")])}
                  </button>
                ) : (
                  <p className="tags-note">
                    {t("Para pesquisar combos novos com IA (Claude, ChatGPT, Gemini e outras), configure em")}{" "}
                    <button className="link-btn" onClick={() => openConta()}>
                      {t("Minha conta → Integração com IA")}</button>
                    .
                  </p>
                ))}
              {ia.status === "buscando" && (
                <p className="ia-progresso">
                  <span className="spinner" /> {ia.progresso}
                </p>
              )}
              {ia.status === "erro" && <p className="db-warning">{ia.erro}</p>}
              {ia.status === "pronto" && (
                <>
                  {ia.aviso && <p className="tags-note">{ia.aviso}</p>}
                  {ia.combos.length === 0 && <p className="tags-note">{ia.resposta || t("A IA não encontrou combos confiáveis para estas cartas.")}</p>}
                  {ia.combos.map((c) => (
                    <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={destaque} format={format} />
                  ))}
                </>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}

/** Sugestão ainda não gravada na base, no formato de exibição */
export function paraComboBase(s: SugestaoIA, i: number): ComboBase {
  return {
    id: `local-${i}`,
    origem: "ia",
    autor_id: null,
    autor_nome: null,
    titulo: s.titulo,
    arquetipos: [],
    iniciais: s.iniciais,
    finais: s.finais,
    dados: { passos: s.passos, campo: s.campo, observacoes: s.observacoes, fontes: s.fontes },
    conferido_em: null,
    criado_em: new Date().toISOString(),
    publico: false,
  };
}
