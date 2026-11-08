import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ExternalLink from "./ExternalLink";
import politicaPt from "../../docs/politica-de-privacidade.md?raw";
import politicaEn from "../../docs/politica-de-privacidade.en.md?raw";
import politicaEs from "../../docs/politica-de-privacidade.es.md?raw";
import termosPt from "../../docs/termos-de-uso.md?raw";
import termosEn from "../../docs/termos-de-uso.en.md?raw";
import termosEs from "../../docs/termos-de-uso.es.md?raw";
import {
  aoRecuperarSenha,
  cadastrar,
  contaAtual,
  criarUsuarioComoAdmin,
  definirNivel,
  definirNovaSenha,
  emRecuperacao,
  entrar,
  lerConfigsIANaConta,
  listarRecalculos,
  listarUsuarios,
  NIVEIS,
  pedirRecalculo,
  recuperarSenha,
  removerConfigIADaConta,
  sair,
  salvarConfigIANaConta,
  situacao,
  useConta,
  type Nivel,
  type Recalculo,
  type TipoRecalculo,
  type UsuarioCadastrado,
} from "../db/conta";
import { GUIAS } from "../data/ias";
import {
  getConfigDe,
  getIaAtiva,
  iaConfigurada,
  MODELOS,
  PROVEDORES,
  provedor,
  removerConfigIA,
  setConfigIA,
  setIaAtiva,
  type ConfigIA,
  type ProvedorId,
} from "../db/ia";
import { supabaseReady } from "../db/supabase";
import { publicarCamada } from "../db/overlay";
import { meusPontos, minhasContribuicoes, PONTOS_POR_COMBO, rankingDuelistas, type Contribuicoes, type Duelista, type Leitura } from "../db/conquistas";
import { useCombosLocais } from "../db/combosLocais";
import { useListaDesejos } from "../db/listaDesejos";
import { useColecao } from "../db/colecao";
import { useMinhasConquistas } from "../db/minhasConquistas";
import { cardImage } from "../db/images";
import { CONQUISTAS } from "../data/conquistas";
import "../screens/comunidade.css";

// documentos no idioma do app (as traduções avisam que vale a versão em português)
const politica = IDIOMA === "en" ? politicaEn : IDIOMA === "es" ? politicaEs : politicaPt;
const termos = IDIOMA === "en" ? termosEn : IDIOMA === "es" ? termosEs : termosPt;
import { IDIOMA, t, LOCALE } from "../i18n";

// Tela "Minha conta": entrar, criar conta, recuperar senha e documentos. Logado, abre maior, com
// Visão Geral (dados, pontos, ranking e contribuições) e Opções (IAs e, para o administrador,
// usuários, recálculos e camada). Abre de qualquer lugar e o Esc fecha só ela.

type Aba = "entrar" | "criar" | "senha" | "novaSenha" | "politica" | "termos";

let aberta: Aba | "conta" | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Abre a tela; sem aba, mostra a conta (logado) ou o formulário de entrar */
export function openConta(aba?: Aba | "conta") {
  aberta = aba ?? (contaAtual() || !supabaseReady() ? "conta" : "entrar");
  emit();
}
export function closeConta() {
  aberta = null;
  emit();
}
export const isContaOpen = () => aberta !== null;

// link de "Esqueci a senha" (e-mail): a tela abre direto em "Nova senha"
aoRecuperarSenha(() => openConta("novaSenha"));

/** IA aberta direto no detalhe ao abrir a tela (ex.: "Cadastrar o Gemini", na aba Vídeo de Combos) */
let iaInicial: ProvedorId | null = null;
export function openContaIA(id: ProvedorId) {
  iaInicial = id;
  aberta = "conta";
  emit();
}

/** Markdown simples dos documentos legais (títulos, listas, tabelas, negrito e links) */
function Documento({ texto }: { texto: string }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
      if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) return /^https?:/.test(link[2]) ? <ExternalLink key={i} href={link[2]}>{link[1]}</ExternalLink> : <span key={i}>{link[1]}</span>;
      return part;
    });
  const blocos: ReactNode[] = [];
  let lista: ReactNode[] = [];
  const fecharLista = () => {
    if (lista.length) blocos.push(<ul key={`l${blocos.length}`}>{lista}</ul>);
    lista = [];
  };
  texto.split("\n").forEach((linha, i) => {
    const t = linha.trim();
    if (/^[-\d]+[.)]? /.test(t) && (t.startsWith("- ") || /^\d+\. /.test(t))) {
      lista.push(<li key={i}>{inline(t.replace(/^(- |\d+\. )/, ""))}</li>);
      return;
    }
    fecharLista();
    if (!t || /^\|[\s-|]+\|$/.test(t)) return;
    if (t.startsWith("# ")) blocos.push(<h3 key={i}>{t.slice(2)}</h3>);
    else if (t.startsWith("## ")) blocos.push(<h4 key={i}>{t.slice(3)}</h4>);
    else if (t.startsWith("|")) blocos.push(<p key={i} className="doc-row">{inline(t.split("|").filter(Boolean).map((c) => c.trim()).join(" · "))}</p>);
    else blocos.push(<p key={i}>{inline(t)}</p>);
  });
  fecharLista();
  return <div className="doc">{blocos}</div>;
}

/** Uma IA: para que serve no app, tutorial do cadastro e os campos (modelo, endereço, chave) */
function DetalheIA({ id, onVoltar }: { id: ProvedorId; onVoltar: () => void }) {
  const conta = useConta();
  const p = provedor(id);
  const guia = GUIAS[id];
  const [cfg, setCfg] = useState(() => getConfigDe(id));
  const [chave, setChave] = useState("");
  const [ativa, setAtiva] = useState(() => getIaAtiva() === id);
  // configuração também guardada na conta (opcional), para usar em outros computadores
  const [naConta, setNaConta] = useState(false);
  const [erroConta, setErroConta] = useState("");
  useEffect(() => {
    if (conta) void lerConfigsIANaConta().then((l) => setNaConta(l.some((c) => c.provedor === id)));
  }, [conta, id]);
  const salvar = (novo: ConfigIA) => {
    setConfigIA(novo);
    setCfg(getConfigDe(id));
    if (naConta) void salvarConfigIANaConta(getConfigDe(id)).catch((e) => setErroConta(String(e.message ?? e)));
  };
  const alternarConta = async (guardar: boolean) => {
    setErroConta("");
    // chave digitada e ainda não salva: salva antes de guardar na conta
    if (guardar && chave.trim()) {
      setConfigIA({ ...getConfigDe(id), chave });
      setCfg(getConfigDe(id));
      setChave("");
    }
    try {
      if (guardar) await salvarConfigIANaConta(getConfigDe(id));
      else await removerConfigIADaConta(id);
      setNaConta(guardar);
    } catch (e) {
      setErroConta(e instanceof Error ? e.message : String(e));
    }
  };
  const remover = () => {
    removerConfigIA(id);
    setCfg(getConfigDe(id));
    if (naConta) void removerConfigIADaConta(id).then(() => setNaConta(false));
  };
  const pronta = iaConfigurada(cfg);
  return (
    <section className="conta-ia ia-detalhe">
      <div className="conta-row">
        <h3>{p.nome}</h3>
        <button className="link-btn" onClick={onVoltar}>
          {t("← Todas as IAs")}</button>
      </div>
      <p className="ia-intuito">
        <strong>{t("Para que serve no app:")}</strong> {guia.intuito}
      </p>
      <details className="ia-tutorial" open={!pronta}>
        <summary>{t("Tutorial: como cadastrar")}</summary>
        <ol>
          {guia.tutorial.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
        {p.chaves && (
          <p className="tags-note">
            {t("Página das chaves:")}{" "}<ExternalLink href={p.chaves}>{new URL(p.chaves).host}</ExternalLink>
          </p>
        )}
        <p className="tags-note">{t("Custo: {0}. A chave é sua: os custos são cobrados na sua conta do provedor.", [guia.custo])}</p>
      </details>
      {p.id === "anthropic" ? (
        <label className="field">
          <span className="field-label">{t("Modelo")}</span>
          <select value={cfg.modelo} onChange={(e) => salvar({ ...cfg, modelo: e.target.value })}>
            {MODELOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{t("Endereço da API (formato OpenAI)")}</span>
            <input value={cfg.url} placeholder={t("https://…/v1")} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} onBlur={() => salvar(cfg)} aria-label={t("Endereço da API")} />
          </label>
          <label className="field">
            <span className="field-label">{t("Modelo")}</span>
            <input value={cfg.modelo} placeholder={p.exemplo} onChange={(e) => setCfg({ ...cfg, modelo: e.target.value })} onBlur={() => salvar(cfg)} aria-label={t("Modelo")} />
          </label>
        </>
      )}
      <p className="tags-note">
        {t("Pesquisa na web no Combo Search:")}{" "}<strong>{p.web}</strong>.{p.local && t(" Rode o programa no computador antes de usar.")}
      </p>
      {cfg.chave ? (
        <div className="conta-row">
          <span>{t("Chave cadastrada (…{0})", [cfg.chave.slice(-4)])}</span>
          <button className="link-btn" onClick={() => salvar({ ...cfg, chave: "" })}>
            {t("Remover chave")}</button>
        </div>
      ) : (
        <div className="tcgapi-key-row">
          <input
            type="password"
            placeholder={p.local ? t("Chave (opcional)") : t("Chave da API · {0}", [p.nome])}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            aria-label={t("Chave da API de IA")}
          />
          <button
            className="ghost-btn"
            disabled={!chave.trim()}
            onClick={() => {
              salvar({ ...cfg, chave });
              setChave("");
            }}
          >
            {t("Salvar")}</button>
        </div>
      )}
      {conta && (
        <label className="conta-aceite">
          <input type="checkbox" checked={naConta} onChange={(e) => void alternarConta(e.target.checked)} /> {" "}{t("Guardar esta IA (com a chave) na minha conta, para usar em outros computadores")}</label>
      )}
      {erroConta && <p className="db-warning">{erroConta}</p>}
      <p className={pronta ? "conta-ok" : "tags-note"}>
        {pronta
          ? ativa
            ? t("Pronta e em uso no Combo Search.")
            : t("Pronta.")
          : t("Falta configurar: ") + [!cfg.modelo && t("modelo"), p.id !== "anthropic" && !cfg.url && t("endereço"), !cfg.chave && !p.local && t("chave")].filter(Boolean).join(", ") + "."}
      </p>
      <div className="ia-acoes">
        {pronta && !ativa && (
          <button
            className="ghost-btn"
            onClick={() => {
              setIaAtiva(id);
              setAtiva(true);
            }}
          >
            {t("Usar no Combo Search")}</button>
        )}
        {(cfg.chave || naConta) && (
          <button className="link-btn" onClick={remover}>
            {t("Remover esta IA")}</button>
        )}
      </div>
    </section>
  );
}

/** As IAs que o usuário pode cadastrar: um botão para cada uma */
function IntegracaoIA() {
  const [aberta, setAberta] = useState<ProvedorId | null>(() => {
    const x = iaInicial;
    iaInicial = null;
    return x;
  });
  if (aberta) return <DetalheIA id={aberta} onVoltar={() => setAberta(null)} />;
  const ativa = getIaAtiva();
  return (
    <section className="conta-ia">
      <h3>{t("IAs")}</h3>
      <p className="tags-note">
        {t("Cada IA usa a")}{" "}<strong>{t("sua")}</strong> {" "}{t("chave de API (os custos ficam na sua conta do provedor). A chave fica neste dispositivo e, se você quiser, também na sua conta. Clique numa IA para cadastrar, ver o tutorial e para que ela serve no app.")}</p>
      <div className="ia-grade">
        {PROVEDORES.map((x) => {
          const pronta = iaConfigurada(getConfigDe(x.id));
          return (
            <button key={x.id} className={`ia-botao ${pronta ? "ia-pronta" : ""}`} onClick={() => setAberta(x.id)}>
              <strong>{x.nome}</strong>
              <small>
                {pronta ? (ativa === x.id ? t("Configurada · Combo Search") : t("Configurada")) : t("Não configurada")}
                {x.id === "gemini" && t(" · vídeo do YouTube")}
              </small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Só o administrador: cadastra um usuário (nome de usuário, e-mail e senha), já confirmado */
function CadastroUsuarios() {
  const [form, setForm] = useState({ usuario: "", email: "", senha: "" });
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cadastrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
      await criarUsuarioComoAdmin(form.usuario, form.email, form.senha);
      setMsg({ tipo: "ok", texto: t("Usuário @{0} cadastrado. Ele já pode entrar com o e-mail e a senha.", [form.usuario.trim().toLowerCase()]) });
      setForm({ usuario: "", email: "", senha: "" });
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <section className="conta-ia conta-admin">
      <h3>{t("Cadastrar usuário")}</h3>
      <p className="tags-note">{t("Só o administrador cria contas. A conta já nasce confirmada; passe o e-mail e a senha para a pessoa.")}</p>
      <form className="conta-form" onSubmit={(e) => void cadastrar(e)}>
        <label className="field">
          <span className="field-label">{t("Usuário (público)")}</span>
          <input
            required
            pattern="[a-z0-9_]{3,20}"
            title={t("3 a 20 letras minúsculas, números ou _")}
            value={form.usuario}
            onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase() })}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span className="field-label">{t("E-mail")}</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label">{t("Senha (mínimo 8 caracteres)")}</span>
          <input type="password" required minLength={8} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} autoComplete="new-password" />
        </label>
        {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
        <button className="ghost-btn conta-enviar" type="submit" disabled={enviando}>
          {enviando ? t("Cadastrando…") : t("Cadastrar usuário")}
        </button>
      </form>
    </section>
  );
}

/** Só o administrador: todas as contas, com o nível de cada uma (Padrão, Avançado ou Mentor) */
function UsuariosCadastrados() {
  const [lista, setLista] = useState<UsuarioCadastrado[] | null>(null);
  const [filtro, setFiltro] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const atualizar = () =>
    void listarUsuarios()
      .then(setLista)
      .catch((e) => setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) }));
  useEffect(atualizar, []);

  const mudar = async (u: UsuarioCadastrado, nivel: Nivel) => {
    setSalvando(u.id);
    setMsg(null);
    try {
      await definirNivel(u.id, nivel);
      setLista((l) => l?.map((x) => (x.id === u.id ? { ...x, nivel } : x)) ?? l);
      setMsg({ tipo: "ok", texto: t("@{0} agora é {1}.", [u.usuario, NIVEIS.find((n) => n.id === nivel)!.label]) });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setSalvando(null);
    }
  };

  const f = filtro.trim().toLowerCase();
  const visiveis = (lista ?? []).filter((u) => !f || u.usuario.includes(f) || u.email.toLowerCase().includes(f));
  const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(LOCALE) : "nunca");
  return (
    <section className="conta-ia conta-admin conta-usuarios">
      <h3>{t("Usuários cadastrados{0}", [lista ? ` (${lista.length})` : ""])}</h3>
      <p className="tags-note">
        {NIVEIS.map((n) => (
          <span key={n.id} className="conta-nivel-dica">
            <strong>{n.label}:</strong> {n.hint}.{" "}
          </span>
        ))}
      </p>
      <label className="field">
        <span className="field-label">{t("Procurar (usuário ou e-mail)")}</span>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} autoComplete="off" />
      </label>
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
      {!lista && !msg && <p className="tags-note">{t("Carregando…")}</p>}
      {visiveis.length > 0 && (
        <ul className="conta-usuarios-lista">
          {visiveis.map((u) => (
            <li key={u.id}>
              <span>
                <strong>@{u.usuario}</strong>
                {u.admin && <span className="vc-badge"> {" "}{t("administrador")}</span>}
                <small>
                  {t("{0} · desde {1} · último acesso {2}", [u.email, data(u.criado_em), data(u.ultimo_acesso)])}
                </small>
              </span>
              <select
                value={u.nivel}
                disabled={salvando === u.id}
                onChange={(e) => void mudar(u, e.target.value as Nivel)}
                aria-label={t("Nível de @{0}", [u.usuario])}
              >
                {NIVEIS.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Só o administrador: publica a camada de dados no bucket privado do Supabase (o app lê de lá) */
function PublicarCamada() {
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviando(true);
    setMsg(null);
    try {
      const o = await publicarCamada(arquivo);
      setMsg({ tipo: "ok", texto: t("Camada publicada (gerada em {0}). O app baixa a nova na próxima abertura.", [new Date(o.geradoEm).toLocaleString(LOCALE)]) });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <section className="conta-ia conta-admin">
      <h3>{t("Publicar camada de dados")}</h3>
      <p className="tags-note">
        {t("Envia a camada (camada.json, gerada pelo pipeline da base) para o bucket privado do Supabase: só o app consegue ler, sem link aberto para robôs.")}
      </p>
      <label className="ghost-btn conta-enviar">
        {enviando ? t("Enviando…") : t("Escolher camada.json e publicar")}
        <input type="file" accept="application/json,.json" hidden disabled={enviando} onChange={(e) => void enviar(e.target.files?.[0])} />
      </label>
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
    </section>
  );
}

/** Só administradores: pede o recálculo das ações (combos e respostas) no pipeline da base */
function Administracao() {
  const [tipo, setTipo] = useState<TipoRecalculo>("tudo");
  const [forcar, setForcar] = useState(false);
  const [lista, setLista] = useState<Recalculo[]>([]);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const atualizar = () => void listarRecalculos().then(setLista);
  useEffect(atualizar, []);

  const pedir = async () => {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await pedirRecalculo(tipo, forcar);
      setMsg({ tipo: r.status.startsWith("sem token") ? "erro" : "ok", texto: t("Pedido registrado: {0}. Conferindo a resposta do GitHub…", [r.status]) });
      // a chamada ao GitHub sai do banco em segundo plano: a resposta chega em alguns segundos
      setTimeout(() => void listarRecalculos().then((l) => {
        setLista(l);
        const s = l[0] && situacao(l[0]);
        if (s) setMsg({ tipo: s.ok ? "ok" : "erro", texto: s.ok ? t("{0}. O resultado aparece no app quando o cálculo terminar.", [s.texto]) : t("Falhou: {0}.", [s.texto]) });
      }), 6000);
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="conta-ia conta-admin">
      <h3>{t("Administração")}</h3>
      <p className="tags-note">
        {t("Recalcula no pipeline da base (GitHub Actions) as linhas de combo e as respostas, e publica a camada nova. Leva de alguns minutos a algumas horas; o app baixa o resultado ao abrir.")}</p>
      <label className="field">
        <span className="field-label">{t("O que recalcular")}</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRecalculo)}>
          <option value="tudo">{t("Tudo (combos e respostas)")}</option>
          <option value="combos">{t("Combos")}</option>
          <option value="respostas">{t("Respostas")}</option>
        </select>
      </label>
      <label className="conta-aceite">
        <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} /> {" "}{t("Ignorar o cache e recalcular todos os decks")}</label>
      <button className="ghost-btn conta-enviar recalcular" disabled={enviando} onClick={() => void pedir()}>
        {enviando ? t("Enviando…") : t("Recalcular Ações")}
      </button>
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
      {lista.length > 0 && (
        <ul className="respostas-lista">
          {lista.map((r) => (
            <li key={r.id}>
              {new Date(r.criado_em).toLocaleString(LOCALE)} · {r.tipo}
              {r.forcar ? t(" (sem cache)") : ""} · <small>{situacao(r).texto}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Formulario() {
  const conta = useConta();
  const aba = useSyncExternalStore(subscribe, () => aberta);
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [aceite, setAceite] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setMsg(null), [aba]);

  const enviar = async (e: FormEvent, acao: () => Promise<string | void>) => {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
      const ok = await acao();
      if (ok) setMsg({ tipo: "ok", texto: ok });
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setEnviando(false);
    }
  };

  if (aba === "novaSenha" || (aba && emRecuperacao())) return <NovaSenha />;
  if (aba === "politica") return <Documento texto={politica} />;
  if (aba === "termos") return <Documento texto={termos} />;

  const docs = (
    <p className="tags-note conta-docs">
      <button className="link-btn" onClick={() => openConta("politica")}>{t("Política de Privacidade")}</button> ·{" "}
      <button className="link-btn" onClick={() => openConta("termos")}>{t("Termos de Uso")}</button>
    </p>
  );

  if (conta) return <MinhaConta docs={docs} />;

  const abas = (
    <div className="left-tabs conta-tabs" role="tablist">
      {(["entrar", "criar", "senha"] as const).map((a) => (
        <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "active" : ""} onClick={() => openConta(a)}>
          {a === "entrar" ? t("Entrar") : a === "criar" ? t("Criar conta") : t("Esqueci a senha")}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {!supabaseReady() ? (
        <p className="db-warning">{t("As contas ainda não foram ativadas nesta versão do app.")}</p>
      ) : (
        <>
          {abas}
          <form
            className="conta-form"
            onSubmit={(e) =>
              void enviar(e, async () => {
                if (aba === "senha") {
                  await recuperarSenha(email);
                  return t("Se o e-mail tiver conta, você vai receber um link para criar uma nova senha.");
                }
                if (aba === "criar") {
                  if (!aceite) throw new Error(t("Para criar a conta, aceite a Política de Privacidade e os Termos de Uso."));
                  const r = await cadastrar(email, usuario, senha);
                  if (r === "confirmar") return t("Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.");
                  return;
                }
                await entrar(email, senha);
              })
            }
          >
            {aba === "criar" && (
              <label className="field">
                <span className="field-label">{t("Nome de usuário (aparece como autor e no Rank)")}</span>
                <input
                  autoComplete="username"
                  required
                  pattern="[a-z0-9_]{3,20}"
                  title={t("3 a 20 letras minúsculas, números ou _")}
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value.toLowerCase())}
                />
              </label>
            )}
            <label className="field">
              <span className="field-label">{t("E-mail")}</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {aba !== "senha" && (
              <label className="field">
                <span className="field-label">{aba === "criar" ? t("Senha (mínimo 8 caracteres)") : t("Senha")}</span>
                <input
                  type="password"
                  autoComplete={aba === "criar" ? "new-password" : "current-password"}
                  required
                  minLength={aba === "criar" ? 8 : undefined}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </label>
            )}
            {aba === "criar" && (
              <label className="conta-aceite">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} /> {t("Li e aceito a Política de Privacidade e os Termos de Uso.")}
              </label>
            )}
            {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
            <button className="ghost-btn conta-enviar" type="submit" disabled={enviando}>
              {enviando ? t("Aguarde…") : aba === "senha" ? t("Enviar link") : aba === "criar" ? t("Criar conta") : t("Entrar")}
            </button>
          </form>
          {aba !== "criar" && <p className="tags-note">{t("Ao entrar, você aceita a Política de Privacidade e os Termos de Uso.")}</p>}
        </>
      )}
      <IntegracaoIA />
      {docs}
    </>
  );
}

/** Vai para uma tela do app pelo endereço (o App acompanha o #) e fecha a conta */
const irPara = (hash: string) => {
  closeConta();
  window.location.hash = hash;
};

/** Conta logada: Visão Geral (dados, pontos, ranking, contribuições) e Opções (IAs, administração) */
function MinhaConta({ docs }: { docs: ReactNode }) {
  const conta = useConta()!;
  // "Cadastrar o Gemini" (aba Vídeo de Combos) abre direto nas Opções
  const [aba, setAba] = useState<"visao" | "opcoes">(() => (iaInicial ? "opcoes" : "visao"));
  const nivel = NIVEIS.find((n) => n.id === (conta.admin ? "mentor" : conta.nivel))!;
  return (
    <>
      <div className="conta-topo">
        <div className="left-tabs conta-tabs conta-abas" role="tablist">
          {(["visao", "opcoes"] as const).map((a) => (
            <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "active" : ""} onClick={() => setAba(a)}>
              {a === "visao" ? t("Visão Geral") : t("Opções")}
            </button>
          ))}
        </div>
        <span className="conta-quem">
          <strong>@{conta.usuario}</strong> <small className="conta-nivel">{nivel.label}</small>
        </span>
        <button className="ghost-btn" onClick={() => void sair()}>
          {t("Sair")}
        </button>
      </div>
      {aba === "visao" ? (
        <VisaoGeral />
      ) : (
        <div className="conta-opcoes">
          <IntegracaoIA />
          {conta.admin && <UsuariosCadastrados />}
          {conta.admin && <CadastroUsuarios />}
          {conta.admin && <Administracao />}
          {conta.admin && <PublicarCamada />}
        </div>
      )}
      {docs}
    </>
  );
}

/** Visão Geral: dados básicos, pontos e posição, ranking geral e contribuições */
function VisaoGeral() {
  const conta = useConta()!;
  const nivel = NIVEIS.find((n) => n.id === (conta.admin ? "mentor" : conta.nivel))!;
  const [contrib, setContrib] = useState<Contribuicoes | null>(null);
  const [pontos, setPontos] = useState<Awaited<ReturnType<typeof meusPontos>> | null>(null);
  const [rank, setRank] = useState<Leitura<Duelista[]> | null>(null);
  const locais = useCombosLocais();
  const desejos = useListaDesejos();
  const colecao = useColecao();
  const { obtidas } = useMinhasConquistas();
  useEffect(() => {
    let vivo = true;
    void minhasContribuicoes(conta.id).then((c) => vivo && setContrib(c));
    void meusPontos(conta.id).then((p) => vivo && setPontos(p));
    void rankingDuelistas(5).then((r) => vivo && setRank(r));
    return () => void (vivo = false);
  }, [conta.id]);
  const fmt = (n: number) => n.toLocaleString(LOCALE);
  const rankAtivo = pontos ? pontos.ok || !pontos.indisponivel : true;

  return (
    <div className="conta-visao">
      <section className="conta-cartao conta-dados">
        <h3>{t("Dados da conta")}</h3>
        <dl>
          <dt>{t("Usuário")}</dt>
          <dd>@{conta.usuario}</dd>
          <dt>{t("E-mail")}</dt>
          <dd>{conta.email}</dd>
          <dt>{t("Nível")}</dt>
          <dd>
            {nivel.label}
            {conta.admin ? t(" · administrador") : ""} <small className="tags-note">({nivel.hint})</small>
          </dd>
          <dt>{t("Membro desde")}</dt>
          <dd>{contrib?.membroDesde ? new Date(contrib.membroDesde).toLocaleDateString(LOCALE) : "—"}</dd>
          <dt>{t("Minha Coleção")}</dt>
          <dd>{t("{0} carta(s) diferente(s)", [fmt(new Set(colecao.itens.map((i) => i.cartaId)).size)])}</dd>
          <dt>{t("Lista de Desejos")}</dt>
          <dd>
            <button className="link-btn" onClick={() => irPara("#/desejos")}>
              {t("{0} carta(s)", [fmt(desejos.itens.length)])}
            </button>
          </dd>
        </dl>
      </section>

      <section className="conta-cartao conta-pontos">
        <h3>{t("Pontos")}</h3>
        {!rankAtivo ? (
          <p className="tags-note">{t("O Rank ainda não está ativo neste servidor (falta aplicar a atualização do banco das conquistas).")}</p>
        ) : (
          <>
            <span className="rank-meus-pts">{pontos?.ok ? fmt(pontos.dados.pontos) : "…"}</span>
            <span className="tags-note">
              {pontos?.ok && pontos.dados.posicao ? t("{0}º lugar no ranking geral", [pontos.dados.posicao]) : t("Compartilhe um combo para entrar no Rank.")}
            </span>
            <small className="tags-note">{t("Compartilhar um combo: {0} pts", [PONTOS_POR_COMBO])}</small>
          </>
        )}
      </section>

      <section className="conta-cartao conta-ranking">
        <h3>{t("Ranking geral")}</h3>
        {!rank ? (
          <p className="tags-note">{t("Carregando…")}</p>
        ) : !rank.ok ? (
          <p className="tags-note">{rank.indisponivel ? t("O Rank ainda não está ativo neste servidor (falta aplicar a atualização do banco das conquistas).") : rank.erro}</p>
        ) : !rank.dados.length ? (
          <p className="tags-note">{t("Ninguém pontuou ainda. Compartilhe o primeiro combo!")}</p>
        ) : (
          <ol className="rank-tabela rank-tabela-curta">
            {rank.dados.map((d, i) => (
              <li key={d.usuario_id} className={d.usuario_id === conta.id ? "rank-eu" : ""}>
                <span className="rank-pos">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`}</span>
                <span className="rank-nome">@{d.usuario}</span>
                <span className="rank-pts">{t("{0} pts", [fmt(d.pontos)])}</span>
              </li>
            ))}
            {pontos?.ok && pontos.dados.posicao && pontos.dados.posicao > rank.dados.length && (
              <li className="rank-eu">
                <span className="rank-pos">{pontos.dados.posicao}º</span>
                <span className="rank-nome">@{conta.usuario}</span>
                <span className="rank-pts">{t("{0} pts", [fmt(pontos.dados.pontos)])}</span>
              </li>
            )}
          </ol>
        )}
        <button className="ghost-btn" onClick={() => irPara("#/rank")}>
          {t("Ver o Rank completo")} →
        </button>
      </section>

      <section className="conta-cartao conta-contrib">
        <h3>{t("Contribuições")}</h3>
        {!contrib ? (
          <p className="tags-note">{t("Carregando…")}</p>
        ) : (
          <ul>
            <li>
              <strong>{fmt(contrib.combosCompartilhados)}</strong> {t("combo(s) compartilhado(s) com todos")}
            </li>
            <li>
              <strong>{fmt(contrib.combosSoMeus)}</strong> {t("combo(s) só seus (compartilhe para pontuar)")}
            </li>
            {locais.length > 0 && (
              <li>
                <strong>{fmt(locais.length)}</strong> {t("combo(s) neste aparelho (exportar: Usuário Avançado ou Mentor)")}
              </li>
            )}
            <li>
              <strong>{fmt(contrib.artigosAprovados)}</strong> {t("artigo(s) publicado(s) no Guia de Deck")}
              {contrib.artigosPendentes > 0 && <small className="tags-note"> {t("· {0} aguardando aprovação", [contrib.artigosPendentes])}</small>}
            </li>
          </ul>
        )}
        <div className="conta-atalhos">
          <button className="ghost-btn" onClick={() => irPara("#/combos")}>
            {t("Combos")}
          </button>
          <button className="ghost-btn" onClick={() => irPara("#/comunidade")}>
            {t("Comunidade")}
          </button>
        </div>
      </section>

      <section className="conta-cartao conta-conquistas">
        <h3>{t("Conquistas")}</h3>
        <span className="tags-note">{t("{0} de {1} conquistas", [CONQUISTAS.filter((c) => obtidas[c.id]).length, CONQUISTAS.length])}</span>
        <ul className="conta-conquistas-icones">
          {CONQUISTAS.map((c) => (
            <li key={c.id} className={obtidas[c.id] ? "cq-obtida" : "cq-bloqueada"} title={obtidas[c.id] || !c.secreta ? `${c.nome}: ${c.descricao}` : t("Conquista secreta")}>
              <img src={cardImage(c.cartaId, "cropped")} alt={c.nome} loading="lazy" />
            </li>
          ))}
        </ul>
        <button className="ghost-btn" onClick={() => irPara("#/conquistas")}>
          {t("Ver conquistas")} →
        </button>
      </section>
    </div>
  );
}

/** Chegou pelo link de recuperação: define a senha nova (a sessão já está aberta pelo link) */
function NovaSenha() {
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (senha !== repetir) return setMsg({ tipo: "erro", texto: t("As duas senhas são diferentes.") });
    try {
      await definirNovaSenha(senha);
      setMsg({ tipo: "ok", texto: t("Senha alterada. Você já está conectado.") });
      setSenha("");
      setRepetir("");
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    }
  };
  return (
    <form className="conta-form" onSubmit={(e) => void enviar(e)}>
      <label className="field">
        <span className="field-label">{t("Nova senha (mínimo 8 caracteres)")}</span>
        <input type="password" autoComplete="new-password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">{t("Repita a nova senha")}</span>
        <input type="password" autoComplete="new-password" required minLength={8} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </label>
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
      <button className="ghost-btn conta-enviar" type="submit">
        {t("Salvar a nova senha")}</button>
    </form>
  );
}

/** Tela de conta (montada uma vez no App) */
export function ContaDialog() {
  const aba = useSyncExternalStore(subscribe, () => aberta);
  const conta = useConta();

  useEffect(() => {
    if (!aba) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      // nos documentos, o Esc volta para a conta
      if (aba === "politica" || aba === "termos") openConta();
      else closeConta();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [aba]);

  if (!aba) return null;
  const titulo =
    aba === "novaSenha" ? t("Nova senha") : aba === "politica" ? t("Política de Privacidade") : aba === "termos" ? t("Termos de Uso") : conta ? t("Minha conta") : "Conta";

  return createPortal(
    <div className="overlay fontes-overlay" onClick={closeConta}>
      <div className={`dialog fontes-dialog conta-dialog ${conta && aba === "conta" ? "conta-grande" : ""}`} role="dialog" aria-modal="true" aria-labelledby="conta-title" onClick={(e) => e.stopPropagation()}>
        <div className="fontes-head">
          <h2 id="conta-title">{titulo}</h2>
          <span>
            {(aba === "politica" || aba === "termos") && (
              <button className="link-btn" onClick={() => openConta()}>
                {t("← Voltar")}</button>
            )}{" "}
            <button className="ghost-btn" onClick={closeConta} aria-label={t("Fechar")}>
              ✕
            </button>
          </span>
        </div>
        <Formulario />
      </div>
    </div>,
    document.body,
  );
}
