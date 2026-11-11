// Chat do Simulador, abaixo do Registro. Contra a IA (e no Modo de Treino): assistente com a IA que o
// usuário configurou na Conta, que recebe o estado do duelo em texto. Na partida 1x1: mensagens com o
// oponente, de passagem (broadcast do Supabase Realtime, sem gravar: somem ao recarregar).
import { useEffect, useRef, useState } from "react";
import { conversarComIA, getConfigIA, iaConfigurada, provedor, type MensagemChat } from "../db/ia";
import { MAX_CHAT } from "../db/duelos";
import { openConta } from "./Conta";
import { t } from "../i18n";

/** intervalo mínimo entre duas mensagens (anti-spam) */
const INTERVALO = 1000;

export interface MensagemOponente {
  minha: boolean;
  texto: string;
}

function Lista({ itens, quem }: { itens: { minha: boolean; texto: string }[]; quem: string }) {
  const fim = useRef<HTMLLIElement>(null);
  // (chaves: no Chromium novo scrollIntoView devolve uma Promise, e o efeito não pode devolver nada além de função)
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" });
  }, [itens.length]);
  return (
    <ol className="sim-chat-lista" aria-live="polite">
      {itens.map((m, i) => (
        <li key={i} className={m.minha ? "sim-chat-minha" : ""}>
          <strong>{m.minha ? t("Você") : quem}:</strong> {m.texto}
        </li>
      ))}
      <li ref={fim} aria-hidden="true" />
    </ol>
  );
}

function Campo({ enviar, desabilitado, placeholder }: { enviar: (texto: string) => void; desabilitado?: boolean; placeholder: string }) {
  const [texto, setTexto] = useState("");
  const ultimo = useRef(0);
  const mandar = () => {
    const s = texto.trim();
    if (!s || desabilitado || Date.now() - ultimo.current < INTERVALO) return;
    ultimo.current = Date.now();
    setTexto("");
    enviar(s);
  };
  return (
    <form
      className="sim-chat-campo"
      onSubmit={(e) => {
        e.preventDefault();
        mandar();
      }}
    >
      <input value={texto} maxLength={MAX_CHAT} placeholder={placeholder} onChange={(e) => setTexto(e.target.value)} disabled={desabilitado} aria-label={placeholder} />
      <button className="ghost-btn" type="submit" disabled={desabilitado || !texto.trim()}>
        {t("Enviar")}
      </button>
    </form>
  );
}

/** Assistente de IA: pergunta sobre o duelo; `contexto` monta o estado do duelo na hora do envio */
export function ChatAssistente({ contexto }: { contexto: () => string }) {
  const [msgs, setMsgs] = useState<MensagemChat[]>([]);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cfg = getConfigIA();
  if (!iaConfigurada(cfg))
    return (
      <div className="sim-chat">
        <p className="tags-note">{t("Para conversar com o assistente, configure uma IA (Claude, ChatGPT, Gemini…) com a sua chave na Conta.")}</p>
        <button className="ghost-btn" onClick={() => openConta()}>
          {t("Abrir a Conta")}
        </button>
      </div>
    );
  const enviar = (texto: string) => {
    const novas: MensagemChat[] = [...msgs, { role: "user", content: texto }];
    setMsgs(novas);
    setPensando(true);
    setErro(null);
    conversarComIA(cfg, novas.slice(-12), contexto())
      .then((r) => setMsgs((m) => [...m, { role: "assistant", content: r }]))
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => setPensando(false));
  };
  return (
    <div className="sim-chat">
      <small className="tags-note">{t("Assistente: {0}. Cada mensagem usa a sua chave e envia o estado do duelo a esse provedor.", [provedor(cfg.provedor).nome])}</small>
      <Lista itens={msgs.map((m) => ({ minha: m.role === "user", texto: m.content }))} quem={t("Assistente")} />
      {pensando && <small className="tags-note">{t("O assistente está pensando…")}</small>}
      {erro && <small className="conta-erro">{erro}</small>}
      <Campo enviar={enviar} desabilitado={pensando} placeholder={t("Pergunte sobre a jogada…")} />
    </div>
  );
}

/** Partida 1x1: mensagens com o oponente */
export function ChatOponente({ mensagens, enviar, nome }: { mensagens: MensagemOponente[]; enviar: (texto: string) => void; nome: string }) {
  const [silenciado, setSilenciado] = useState(false);
  return (
    <div className="sim-chat">
      <label className="tags-note">
        <input type="checkbox" checked={silenciado} onChange={(e) => setSilenciado(e.target.checked)} /> {t("Silenciar {0}", [nome])}
      </label>
      <Lista itens={silenciado ? mensagens.filter((m) => m.minha) : mensagens} quem={nome} />
      <small className="tags-note">{t("As mensagens não ficam salvas: somem ao recarregar a página.")}</small>
      <Campo enviar={enviar} placeholder={t("Mensagem para {0}", [nome])} />
    </div>
  );
}
