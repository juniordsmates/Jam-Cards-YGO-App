import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ExternalLink from "./ExternalLink";
import politica from "../../docs/politica-de-privacidade.md?raw";
import termos from "../../docs/termos-de-uso.md?raw";
import { cadastrar, contaAtual, entrar, recuperarSenha, sair, useConta } from "../db/conta";
import { getConfigIA, MODELOS, setConfigIA } from "../db/ia";
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
  const [cfg, setCfg] = useState(getConfigIA);
  const [rascunho, setRascunho] = useState("");
  const salvar = (novo: typeof cfg) => {
    setConfigIA(novo);
    setCfg(getConfigIA());
  };
  return (
    <section className="conta-ia">
      <h3>Integração com IA</h3>
      <p className="tags-note">
        O Combo Search usa o Claude (Anthropic) com a <strong>sua</strong> chave de API: os custos são cobrados na sua conta
        Anthropic. A chave fica guardada só neste dispositivo e é enviada apenas à Anthropic, nunca aos servidores do app. Crie
        uma em <ExternalLink href="https://console.anthropic.com/settings/keys">console.anthropic.com</ExternalLink>.
      </p>
      <label className="field">
        <span className="field-label">Modelo</span>
        <select value={cfg.modelo} onChange={(e) => salvar({ ...cfg, modelo: e.target.value })} disabled={!cfg.chave}>
          {MODELOS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>
      {cfg.chave ? (
        <div className="conta-row">
          <span>Chave cadastrada (…{cfg.chave.slice(-4)})</span>
          <button className="link-btn" onClick={() => salvar({ ...cfg, chave: "" })}>
            Remover chave
          </button>
        </div>
      ) : (
        <div className="tcgapi-key-row">
          <input type="password" placeholder="Chave da API da Anthropic (sk-ant-…)" value={rascunho} onChange={(e) => setRascunho(e.target.value)} aria-label="Chave da API da Anthropic" />
          <button
            className="ghost-btn"
            disabled={!rascunho.trim()}
            onClick={() => {
              salvar({ ...cfg, chave: rascunho });
              setRascunho("");
            }}
          >
            Salvar
          </button>
        </div>
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
