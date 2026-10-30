import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ExternalLink from "./ExternalLink";
import politica from "../../docs/politica-de-privacidade.md?raw";
import termos from "../../docs/termos-de-uso.md?raw";
import {
  aoRecuperarSenha,
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

// Tela "Minha conta": entrar, recuperar senha, IAs, documentos e (administrador) recálculos e
// cadastro de usuários. Novas contas só pelo administrador. Abre de qualquer lugar e o Esc fecha só ela.

type Aba = "entrar" | "senha" | "novaSenha" | "politica" | "termos";

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
          ← Todas as IAs
        </button>
      </div>
      <p className="ia-intuito">
        <strong>Para que serve no app:</strong> {guia.intuito}
      </p>
      <details className="ia-tutorial" open={!pronta}>
        <summary>Tutorial: como cadastrar</summary>
        <ol>
          {guia.tutorial.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
        {p.chaves && (
          <p className="tags-note">
            Página das chaves: <ExternalLink href={p.chaves}>{new URL(p.chaves).host}</ExternalLink>
          </p>
        )}
        <p className="tags-note">Custo: {guia.custo}. A chave é sua: os custos são cobrados na sua conta do provedor.</p>
      </details>
      {p.id === "anthropic" ? (
        <label className="field">
          <span className="field-label">Modelo</span>
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
            <span className="field-label">Endereço da API (formato OpenAI)</span>
            <input value={cfg.url} placeholder="https://…/v1" onChange={(e) => setCfg({ ...cfg, url: e.target.value })} onBlur={() => salvar(cfg)} aria-label="Endereço da API" />
          </label>
          <label className="field">
            <span className="field-label">Modelo</span>
            <input value={cfg.modelo} placeholder={p.exemplo} onChange={(e) => setCfg({ ...cfg, modelo: e.target.value })} onBlur={() => salvar(cfg)} aria-label="Modelo" />
          </label>
        </>
      )}
      <p className="tags-note">
        Pesquisa na web no Combo Search: <strong>{p.web}</strong>.{p.local && " Rode o programa no computador antes de usar."}
      </p>
      {cfg.chave ? (
        <div className="conta-row">
          <span>Chave cadastrada (…{cfg.chave.slice(-4)})</span>
          <button className="link-btn" onClick={() => salvar({ ...cfg, chave: "" })}>
            Remover chave
          </button>
        </div>
      ) : (
        <div className="tcgapi-key-row">
          <input
            type="password"
            placeholder={p.local ? "Chave (opcional)" : `Chave da API · ${p.nome}`}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            aria-label="Chave da API de IA"
          />
          <button
            className="ghost-btn"
            disabled={!chave.trim()}
            onClick={() => {
              salvar({ ...cfg, chave });
              setChave("");
            }}
          >
            Salvar
          </button>
        </div>
      )}
      {conta && (
        <label className="conta-aceite">
          <input type="checkbox" checked={naConta} onChange={(e) => void alternarConta(e.target.checked)} /> Guardar esta IA (com a chave) na
          minha conta, para usar em outros computadores
        </label>
      )}
      {erroConta && <p className="db-warning">{erroConta}</p>}
      <p className={pronta ? "conta-ok" : "tags-note"}>
        {pronta
          ? ativa
            ? "Pronta e em uso no Combo Search."
            : "Pronta."
          : "Falta configurar: " + [!cfg.modelo && "modelo", p.id !== "anthropic" && !cfg.url && "endereço", !cfg.chave && !p.local && "chave"].filter(Boolean).join(", ") + "."}
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
            Usar no Combo Search
          </button>
        )}
        {(cfg.chave || naConta) && (
          <button className="link-btn" onClick={remover}>
            Remover esta IA
          </button>
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
      <h3>IAs</h3>
      <p className="tags-note">
        Cada IA usa a <strong>sua</strong> chave de API (os custos ficam na sua conta do provedor). A chave fica neste dispositivo e, se você
        quiser, também na sua conta. Clique numa IA para cadastrar, ver o tutorial e para que ela serve no app.
      </p>
      <div className="ia-grade">
        {PROVEDORES.map((x) => {
          const pronta = iaConfigurada(getConfigDe(x.id));
          return (
            <button key={x.id} className={`ia-botao ${pronta ? "ia-pronta" : ""}`} onClick={() => setAberta(x.id)}>
              <strong>{x.nome}</strong>
              <small>
                {pronta ? (ativa === x.id ? "Configurada · Combo Search" : "Configurada") : "Não configurada"}
                {x.id === "gemini" && " · vídeo do YouTube"}
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
      setMsg({ tipo: "ok", texto: `Usuário @${form.usuario.trim().toLowerCase()} cadastrado. Ele já pode entrar com o e-mail e a senha.` });
      setForm({ usuario: "", email: "", senha: "" });
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <section className="conta-ia conta-admin">
      <h3>Cadastrar usuário</h3>
      <p className="tags-note">Só o administrador cria contas. A conta já nasce confirmada; passe o e-mail e a senha para a pessoa.</p>
      <form className="conta-form" onSubmit={(e) => void cadastrar(e)}>
        <label className="field">
          <span className="field-label">Usuário (público)</span>
          <input
            required
            pattern="[a-z0-9_]{3,20}"
            title="3 a 20 letras minúsculas, números ou _"
            value={form.usuario}
            onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase() })}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span className="field-label">E-mail</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label">Senha (mínimo 8 caracteres)</span>
          <input type="password" required minLength={8} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} autoComplete="new-password" />
        </label>
        {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
        <button className="ghost-btn conta-enviar" type="submit" disabled={enviando}>
          {enviando ? "Cadastrando…" : "Cadastrar usuário"}
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
      setMsg({ tipo: "ok", texto: `@${u.usuario} agora é ${NIVEIS.find((n) => n.id === nivel)!.label}.` });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setSalvando(null);
    }
  };

  const f = filtro.trim().toLowerCase();
  const visiveis = (lista ?? []).filter((u) => !f || u.usuario.includes(f) || u.email.toLowerCase().includes(f));
  const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "nunca");
  return (
    <section className="conta-ia conta-admin conta-usuarios">
      <h3>Usuários cadastrados{lista ? ` (${lista.length})` : ""}</h3>
      <p className="tags-note">
        {NIVEIS.map((n) => (
          <span key={n.id} className="conta-nivel-dica">
            <strong>{n.label}:</strong> {n.hint}.{" "}
          </span>
        ))}
      </p>
      <label className="field">
        <span className="field-label">Procurar (usuário ou e-mail)</span>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} autoComplete="off" />
      </label>
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
      {!lista && !msg && <p className="tags-note">Carregando…</p>}
      {visiveis.length > 0 && (
        <ul className="conta-usuarios-lista">
          {visiveis.map((u) => (
            <li key={u.id}>
              <span>
                <strong>@{u.usuario}</strong>
                {u.admin && <span className="vc-badge"> administrador</span>}
                <small>
                  {u.email} · desde {data(u.criado_em)} · último acesso {data(u.ultimo_acesso)}
                </small>
              </span>
              <select
                value={u.nivel}
                disabled={salvando === u.id}
                onChange={(e) => void mudar(u, e.target.value as Nivel)}
                aria-label={`Nível de @${u.usuario}`}
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
      setMsg({ tipo: r.status.startsWith("sem token") ? "erro" : "ok", texto: `Pedido registrado: ${r.status}. Conferindo a resposta do GitHub…` });
      // a chamada ao GitHub sai do banco em segundo plano: a resposta chega em alguns segundos
      setTimeout(() => void listarRecalculos().then((l) => {
        setLista(l);
        const s = l[0] && situacao(l[0]);
        if (s) setMsg({ tipo: s.ok ? "ok" : "erro", texto: s.ok ? `${s.texto}. O resultado aparece no app quando o cálculo terminar.` : `Falhou: ${s.texto}.` });
      }), 6000);
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="conta-ia conta-admin">
      <h3>Administração</h3>
      <p className="tags-note">
        Recalcula no pipeline da base (GitHub Actions) as linhas de combo e as respostas, e publica a camada nova. Leva de alguns
        minutos a algumas horas; o app baixa o resultado ao abrir.
      </p>
      <label className="field">
        <span className="field-label">O que recalcular</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRecalculo)}>
          <option value="tudo">Tudo (combos e respostas)</option>
          <option value="combos">Combos</option>
          <option value="respostas">Respostas</option>
        </select>
      </label>
      <label className="conta-aceite">
        <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} /> Ignorar o cache e recalcular todos os
        decks
      </label>
      <button className="ghost-btn conta-enviar recalcular" disabled={enviando} onClick={() => void pedir()}>
        {enviando ? "Enviando…" : "Recalcular Ações"}
      </button>
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
      {lista.length > 0 && (
        <ul className="respostas-lista">
          {lista.map((r) => (
            <li key={r.id}>
              {new Date(r.criado_em).toLocaleString("pt-BR")} · {r.tipo}
              {r.forcar ? " (sem cache)" : ""} · <small>{situacao(r).texto}</small>
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
  const [senha, setSenha] = useState("");
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
      <button className="link-btn" onClick={() => openConta("politica")}>Política de Privacidade</button> ·{" "}
      <button className="link-btn" onClick={() => openConta("termos")}>Termos de Uso</button>
    </p>
  );

  if (conta) {
    return (
      <>
        <section>
          <div className="conta-row">
            <span>
              <strong>@{conta.usuario}</strong> · {conta.email}
              <small className="conta-nivel"> · {NIVEIS.find((n) => n.id === (conta.admin ? "mentor" : conta.nivel))!.label}</small>
            </span>
            <button className="ghost-btn" onClick={() => void sair()}>
              Sair
            </button>
          </div>
        </section>
        <IntegracaoIA />
        {conta.admin && <UsuariosCadastrados />}
        {conta.admin && <CadastroUsuarios />}
        {conta.admin && <Administracao />}
        {docs}
      </>
    );
  }

  const abas = (
    <div className="left-tabs conta-tabs" role="tablist">
      {(["entrar", "senha"] as const).map((a) => (
        <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "active" : ""} onClick={() => openConta(a)}>
          {a === "entrar" ? "Entrar" : "Esqueci a senha"}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {!supabaseReady() ? (
        <p className="db-warning">As contas ainda não foram ativadas nesta versão do app.</p>
      ) : (
        <>
          {abas}
          <form
            className="conta-form"
            onSubmit={(e) =>
              void enviar(e, async () => {
                if (aba === "senha") {
                  await recuperarSenha(email);
                  return "Se o e-mail tiver conta, você vai receber um link para criar uma nova senha.";
                }
                await entrar(email, senha);
              })
            }
          >
            <label className="field">
              <span className="field-label">E-mail</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {aba !== "senha" && (
              <label className="field">
                <span className="field-label">Senha</span>
                <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
              </label>
            )}
            {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
            <button className="ghost-btn conta-enviar" type="submit" disabled={enviando}>
              {enviando ? "Aguarde…" : aba === "senha" ? "Enviar link" : "Entrar"}
            </button>
          </form>
          <p className="tags-note">Novas contas são criadas pelo administrador do app. Ao entrar, você aceita a Política de Privacidade e os Termos de Uso.</p>
        </>
      )}
      <IntegracaoIA />
      {docs}
    </>
  );
}

/** Chegou pelo link de recuperação: define a senha nova (a sessão já está aberta pelo link) */
function NovaSenha() {
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (senha !== repetir) return setMsg({ tipo: "erro", texto: "As duas senhas são diferentes." });
    try {
      await definirNovaSenha(senha);
      setMsg({ tipo: "ok", texto: "Senha alterada. Você já está conectado." });
      setSenha("");
      setRepetir("");
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    }
  };
  return (
    <form className="conta-form" onSubmit={(e) => void enviar(e)}>
      <label className="field">
        <span className="field-label">Nova senha (mínimo 8 caracteres)</span>
        <input type="password" autoComplete="new-password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Repita a nova senha</span>
        <input type="password" autoComplete="new-password" required minLength={8} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </label>
      {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
      <button className="ghost-btn conta-enviar" type="submit">
        Salvar a nova senha
      </button>
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
    aba === "novaSenha" ? "Nova senha" : aba === "politica" ? "Política de Privacidade" : aba === "termos" ? "Termos de Uso" : conta ? "Minha conta" : "Conta";

  return createPortal(
    <div className="overlay fontes-overlay" onClick={closeConta}>
      <div className="dialog fontes-dialog conta-dialog" role="dialog" aria-modal="true" aria-labelledby="conta-title" onClick={(e) => e.stopPropagation()}>
        <div className="fontes-head">
          <h2 id="conta-title">{titulo}</h2>
          <span>
            {(aba === "politica" || aba === "termos") && (
              <button className="link-btn" onClick={() => openConta()}>
                ← Voltar
              </button>
            )}{" "}
            <button className="ghost-btn" onClick={closeConta} aria-label="Fechar">
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
