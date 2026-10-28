import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ExternalLink from "./ExternalLink";
import politica from "../../docs/politica-de-privacidade.md?raw";
import termos from "../../docs/termos-de-uso.md?raw";
import {
  cadastrar,
  contaAtual,
  entrar,
  lerConfigIANaConta,
  listarRecalculos,
  pedirRecalculo,
  recuperarSenha,
  removerConfigIADaConta,
  sair,
  salvarConfigIANaConta,
  situacao,
  useConta,
  type Recalculo,
  type TipoRecalculo,
} from "../db/conta";
import { getConfigIA, iaConfigurada, MODELOS, PROVEDORES, provedor, setConfigIA, type ConfigIA, type ProvedorId } from "../db/ia";
import { supabaseReady } from "../db/supabase";

// Tela "Minha conta": entrar, criar conta, recuperar senha, integração com IA e documentos.
// Abre de qualquer lugar (menu principal, Combo Search) e o Esc fecha só ela.

type Aba = "entrar" | "criar" | "senha" | "politica" | "termos";

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

function IntegracaoIA() {
  const conta = useConta();
  const [cfg, setCfg] = useState(getConfigIA);
  const [chave, setChave] = useState("");
  // configuração também guardada na conta (opcional), para usar em outros computadores
  const [naConta, setNaConta] = useState(false);
  const [erroConta, setErroConta] = useState("");
  const p = provedor(cfg.provedor);
  useEffect(() => {
    if (conta) void lerConfigIANaConta().then((c) => setNaConta(!!c));
  }, [conta]);
  const salvar = (novo: ConfigIA) => {
    setConfigIA(novo);
    setCfg(getConfigIA());
    if (naConta) void salvarConfigIANaConta(getConfigIA()).catch((e) => setErroConta(String(e.message ?? e)));
  };
  const alternarConta = async (guardar: boolean) => {
    setErroConta("");
    try {
      if (guardar) await salvarConfigIANaConta(getConfigIA());
      else await removerConfigIADaConta();
      setNaConta(guardar);
    } catch (e) {
      setErroConta(e instanceof Error ? e.message : String(e));
    }
  };
  const trocarProvedor = (id: ProvedorId) => {
    const novo = provedor(id);
    // ao trocar de provedor, a chave e o modelo do anterior não servem
    salvar({ provedor: id, chave: "", modelo: id === "anthropic" ? MODELOS[0].id : "", url: novo.url });
    setChave("");
  };
  return (
    <section className="conta-ia">
      <h3>Integração com IA</h3>
      <p className="tags-note">
        O Combo Search usa a IA que você escolher, com a <strong>sua</strong> chave de API: os custos são cobrados na sua conta
        do provedor. A chave fica neste dispositivo (e, se você marcar a opção abaixo, também na sua conta) e é usada só para chamar o provedor.
      </p>
      <label className="field">
        <span className="field-label">Provedor</span>
        <select value={cfg.provedor} onChange={(e) => trocarProvedor(e.target.value as ProvedorId)} aria-label="Provedor de IA">
          {PROVEDORES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </label>
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
        Pesquisa na web: <strong>{p.web}</strong>.{p.web === "não" && " A IA usa os dados do app (texto das cartas e combos registrados) e o próprio conhecimento."}
        {p.local && " Rode o programa no computador antes de buscar."}
      </p>
      {cfg.chave ? (
        <div className="conta-row">
          <span>Chave cadastrada (…{cfg.chave.slice(-4)})</span>
          <button className="link-btn" onClick={() => salvar({ ...cfg, chave: "" })}>
            Remover chave
          </button>
        </div>
      ) : (
        <>
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
          {p.chaves && (
            <p className="tags-note">
              Crie uma chave em <ExternalLink href={p.chaves}>{new URL(p.chaves).host}</ExternalLink>.
            </p>
          )}
        </>
      )}
      {conta && (
        <label className="conta-aceite">
          <input type="checkbox" checked={naConta} onChange={(e) => void alternarConta(e.target.checked)} /> Guardar esta configuração (com a
          chave) na minha conta, para usar em outros computadores
        </label>
      )}
      {erroConta && <p className="db-warning">{erroConta}</p>}
      <p className={iaConfigurada(cfg) ? "conta-ok" : "tags-note"}>
        {iaConfigurada(cfg) ? "Pronta para o Combo Search." : "Falta configurar: " + [!cfg.modelo && "modelo", p.id !== "anthropic" && !cfg.url && "endereço", !cfg.chave && !p.local && "chave"].filter(Boolean).join(", ") + "."}
      </p>
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
            </span>
            <button className="ghost-btn" onClick={() => void sair()}>
              Sair
            </button>
          </div>
        </section>
        <IntegracaoIA />
        {conta.admin && <Administracao />}
        {docs}
      </>
    );
  }

  const abas = (
    <div className="left-tabs conta-tabs" role="tablist">
      {(["entrar", "criar", "senha"] as const).map((a) => (
        <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "active" : ""} onClick={() => openConta(a)}>
          {a === "entrar" ? "Entrar" : a === "criar" ? "Criar conta" : "Esqueci a senha"}
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
                if (aba === "criar") {
                  if (!aceite) throw new Error("Para criar a conta, aceite a Política de Privacidade e os Termos de Uso.");
                  const r = await cadastrar(email, usuario, senha);
                  return r === "confirmar" ? "Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre." : undefined;
                }
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
            {aba === "criar" && (
              <label className="field">
                <span className="field-label">Usuário (público)</span>
                <input autoComplete="username" required pattern="[a-z0-9_]{3,20}" title="3 a 20 letras minúsculas, números ou _" value={usuario} onChange={(e) => setUsuario(e.target.value.toLowerCase())} />
              </label>
            )}
            {aba !== "senha" && (
              <label className="field">
                <span className="field-label">Senha</span>
                <input type="password" autoComplete={aba === "criar" ? "new-password" : "current-password"} required minLength={aba === "criar" ? 8 : undefined} value={senha} onChange={(e) => setSenha(e.target.value)} />
              </label>
            )}
            {aba === "criar" && (
              <label className="conta-aceite">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} /> Li e aceito a Política de Privacidade
                e os Termos de Uso.
              </label>
            )}
            {msg && <p className={msg.tipo === "erro" ? "db-warning" : "conta-ok"}>{msg.texto}</p>}
            <button className="ghost-btn conta-enviar" type="submit" disabled={enviando}>
              {enviando ? "Aguarde…" : aba === "criar" ? "Criar conta" : aba === "senha" ? "Enviar link" : "Entrar"}
            </button>
          </form>
        </>
      )}
      <IntegracaoIA />
      {docs}
    </>
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
  const titulo = aba === "politica" ? "Política de Privacidade" : aba === "termos" ? "Termos de Uso" : conta ? "Minha conta" : "Conta";

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
