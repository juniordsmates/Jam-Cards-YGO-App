import { useMemo, useState, type ReactNode } from "react";
import CardPicker from "./CardPicker";
import { openConta } from "./Conta";
import { FontesButton } from "./Fontes";
import VerifiedCombos, { groupSteps, join, Name, StepText } from "./VerifiedCombos";
import type { KnownCombo } from "../data/combos";
import { buscarNaBase, gravarBuscaIA, salvarComoComunidade, type ComboBase } from "../db/baseCombos";
import { useConta } from "../db/conta";
import { buscarCombosComIA, getConfigIA, iaConfigurada, provedor, type SugestaoIA } from "../db/ia";
import type { GameFormat } from "../db/legality";
import { cardsOfLine, passoEmTexto, uniqueLines, type CombosCalculados, type LinhaCombo } from "../db/motor";
import { normalize } from "../db/search";
import { supabaseReady } from "../db/supabase";
import { displayName, type Card } from "../db/types";

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
  app: "Calculado com o App",
  comunidade: "Combo da Comunidade",
  ia: "Sugestão de IA · não conferida",
};

/** Um combo da base (comunidade ou IA), com a opção de publicar como Combo da Comunidade */
function ComboCard({ combo, byId, onHover, highlight }: { combo: ComboBase; byId: Map<number, Card>; onHover: Hover; highlight: Set<number> }) {
  const conta = useConta();
  const [form, setForm] = useState<{ autor: string; titulo: string; obs: string } | null>(null);
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const d = combo.dados;
  const groups = groupSteps(d.passos);

  const salvar = async () => {
    if (!form) return;
    try {
      await salvarComoComunidade(combo, { autorNome: form.autor, titulo: form.titulo, observacoes: form.obs });
      setEstado({ tipo: "ok", texto: "Salvo como Combo da Comunidade." });
      setForm(null);
    } catch (e) {
      setEstado({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <details className={`kc vc base-combo origem-${combo.origem}`} open>
      <summary>
        <span className="kc-title">{combo.titulo}</span>
        <span className="kc-hand">
          Mão: {combo.iniciais.length ? join(combo.iniciais.map((id) => <Name key={id} id={id} byId={byId} onHover={onHover} />), " + ") : "—"}
          {combo.arquetipos.length > 0 && ` · ${combo.arquetipos.join(", ")}`}
        </span>
        <span className={`vc-badge badge-${combo.origem}`}>
          {ORIGEM_LABEL[combo.origem]}
          {combo.origem === "comunidade" && combo.autor_nome && ` · ${combo.autor_nome}`}
          {combo.conferido_em && " · conferido com o App"}
        </span>
      </summary>
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
          <span className="field-label">Campo final</span>
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
        {combo.origem === "ia" && `Sugerido por IA${combo.dados.modelo ? ` (${combo.dados.modelo})` : ""}: confira antes de usar. `}
        <FontesButton links={(d.fontes ?? []).map((f) => ({ nome: f.nome, url: f.url }))} />
        {combo.origem !== "comunidade" && supabaseReady() && !form && estado?.tipo !== "ok" && (
          <>
            {" · "}
            <button
              className="link-btn salvar-comunidade"
              onClick={() => (conta ? setForm({ autor: conta.usuario, titulo: combo.titulo, obs: d.observacoes ?? "" }) : openConta())}
            >
              Salvar como Combo da Comunidade
            </button>
          </>
        )}
      </p>
      {form && (
        <div className="comunidade-form">
          <label className="field">
            <span className="field-label">Nome do autor</span>
            <input value={form.autor} maxLength={60} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Título</span>
            <input value={form.titulo} maxLength={120} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Observações</span>
            <textarea rows={3} maxLength={2000} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
          </label>
          <div className="dialog-actions">
            <button className="ghost-btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="ghost-btn" disabled={!form.autor.trim() || !form.titulo.trim()} onClick={() => void salvar()}>
              Publicar
            </button>
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
      .map((l) => `Calculado pelo App (deck ${combos!.decks[l.deck].nome}). Mão: ${l.mao.map(nome).join(" + ")}${l.qualquer ? " + 1 carta qualquer" : ""}.\n${l.passos.map((p, i) => `${i + 1}. ${passoEmTexto(p, nome)}`).join("\n")}\nCampo final: ${[...l.campo.monstros, ...l.campo.magias.map(([c]) => c)].map(nome).join(", ")}`);
    const daBase = base.combos
      .filter((c) => ids.some((id) => c.iniciais.includes(id) || c.finais.includes(id)))
      .slice(0, 6)
      .map((c) => `${ORIGEM_LABEL[c.origem]}: ${c.titulo}. Mão: ${c.iniciais.map(nome).join(" + ")}.\n${c.dados.passos.map((p, i) => `${i + 1}. ${passoEmTexto(p, nome)}`).join("\n")}`);
    return [...linhas, ...daBase].join("\n\n");
  };

  const buscarComIA = async () => {
    if (!consulta) return;
    const cfg = getConfigIA();
    setIa({ status: "buscando", progresso: "Consultando a IA…", combos: [] });
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
          aviso = `Os combos não foram gravados na base: ${e instanceof Error ? e.message : String(e)}`;
        }
      } else {
        aviso = "Entre na sua conta para gravar esta busca na base de combos e publicar como Combo da Comunidade.";
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
          label="Cartas iniciais (starters)"
          className="cs-iniciais"
          cards={iniciais}
          onChange={setIniciais}
          all={all}
          format={format}
          placeholder="Opcional (ex.: Ice Ryzeal)"
          placeholderMore="Acrescentar outra inicial…"
        />
        <CardPicker
          label="Cartas finais"
          className="cs-finais"
          cards={finais}
          onChange={setFinais}
          all={all}
          format={format}
          placeholder="Onde o combo deve chegar"
          placeholderMore="Acrescentar outra final…"
        />
        <button className="ghost-btn cs-buscar" disabled={!podeBuscar} onClick={buscar}>
          Buscar
        </button>
        <p className="tags-note">Declare 0 ou mais cartas iniciais e/ou 1 ou mais cartas finais.</p>
        {extra}
      </section>

      <section className="combos-result">
        {!consulta ? (
          <div className="combos-empty">
            <p>Combo Search</p>
            <small>
              Escolha as cartas iniciais e/ou as finais e clique em Buscar. O App procura nas linhas que ele calculou, na base de
              combos (comunidade e buscas anteriores) e, com a sua chave de IA, pesquisa novos combos na web.
            </small>
          </div>
        ) : (
          <>
            <VerifiedCombos
              title="Calculados pelo App"
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
              <section className="known-combos" aria-label="Na base de combos">
                <h4>Na base de combos ({base.carregando ? "…" : base.combos.length})</h4>
                {base.erro && <p className="db-warning">{base.erro}</p>}
                {base.combos.map((c) => (
                  <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={destaque} />
                ))}
              </section>
            )}

            <section className="known-combos ia-section" aria-label="Busca com IA">
              <h4>Busca com IA</h4>
              {ia.status === "parado" &&
                (temChave ? (
                  <button className="ghost-btn cs-ia" onClick={() => void buscarComIA()}>
                    Buscar com {provedor(cfgIA.provedor).nome}: {[...consulta.iniciais, ...consulta.finais].map((c) => displayName(c)).join(", ")}
                  </button>
                ) : (
                  <p className="tags-note">
                    Para pesquisar combos novos com IA (Claude, ChatGPT, Gemini e outras), configure em{" "}
                    <button className="link-btn" onClick={() => openConta()}>
                      Minha conta → Integração com IA
                    </button>
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
                  {ia.combos.length === 0 && <p className="tags-note">{ia.resposta || "A IA não encontrou combos confiáveis para estas cartas."}</p>}
                  {ia.combos.map((c) => (
                    <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={destaque} />
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
function paraComboBase(s: SugestaoIA, i: number): ComboBase {
  return {
    id: `local-${i}`,
    origem: "ia",
    autor_nome: null,
    titulo: s.titulo,
    arquetipos: [],
    iniciais: s.iniciais,
    finais: s.finais,
    dados: { passos: s.passos, campo: s.campo, observacoes: s.observacoes, fontes: s.fontes },
    conferido_em: null,
    criado_em: new Date().toISOString(),
  };
}
