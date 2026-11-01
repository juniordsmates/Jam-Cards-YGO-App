import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CLASSES, ordenarRespostas, TIPOS, useContextoRespostas, type Classe, type Resposta } from "../db/respostas";
import { displayName, type Card } from "../db/types";
import { t, LOCALE } from "../i18n";

// Janela com todas as respostas possíveis de um passo ou de uma carta (o "+" das listas).
// Ordem padrão: mais usadas em torneios > hand trap e staple > hand trap > staple > outras.

interface Pedido {
  titulo: string;
  ids: number[];
  byId: Map<number, Card>;
}

let atual: Pedido | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function openRespostas(pedido: Pedido) {
  atual = pedido;
  emit();
}
export function closeRespostas() {
  atual = null;
  emit();
}
export const isRespostasOpen = () => atual !== null;

type Ordem = "prioridade" | "nome" | "tipo";

function Lista({ pedido }: { pedido: Pedido }) {
  const ctx = useContextoRespostas(pedido.byId);
  const [classe, setClasse] = useState<Classe | "todas">("todas");
  const [tipo, setTipo] = useState("todos");
  const [ordem, setOrdem] = useState<Ordem>("prioridade");

  const todas = useMemo(() => ordenarRespostas(pedido.ids, ctx), [pedido, ctx.uso, ctx.respondedores]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiposPresentes = useMemo(() => [...new Set(todas.flatMap((r) => r.tipos))].sort((a, b) => (TIPOS[a] ?? a).localeCompare(TIPOS[b] ?? b)), [todas]);
  const nome = (r: Resposta) => (r.card ? displayName(r.card) : `#${r.id}`);

  const lista = useMemo(() => {
    const filtrada = todas.filter((r) => (classe === "todas" || r.classe === classe) && (tipo === "todos" || r.tipos.includes(tipo)));
    if (ordem === "nome") return [...filtrada].sort((a, b) => nome(a).localeCompare(nome(b), LOCALE));
    if (ordem === "tipo") return [...filtrada].sort((a, b) => (TIPOS[a.tipos[0]] ?? "").localeCompare(TIPOS[b.tipos[0]] ?? "", LOCALE) || nome(a).localeCompare(nome(b), LOCALE));
    return filtrada;
  }, [todas, classe, tipo, ordem]);

  return (
    <>
      <div className="respostas-filtros">
        <label className="field">
          <span className="field-label">{t("Classificação")}</span>
          <select value={classe} onChange={(e) => setClasse(e.target.value as Classe | "todas")} aria-label={t("Classificação")}>
            <option value="todas">{t("Todas")}</option>
            {CLASSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t("Tipo de Resposta")}</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label={t("Tipo de Resposta")}>
            <option value="todos">{t("Todos")}</option>
            {tiposPresentes.map((t) => (
              <option key={t} value={t}>
                {TIPOS[t] ?? t}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t("Ordenar por")}</span>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label={t("Ordenar por")}>
            <option value="prioridade">{t("Prioridade (padrão)")}</option>
            <option value="nome">{t("Nome")}</option>
            <option value="tipo">{t("Tipo de resposta")}</option>
          </select>
        </label>
      </div>
      <p className="tags-note">
        {t("{0} de {1} cartas", [lista.length, todas.length])}{ctx.uso && t(" · uso em {0} decklists de torneio recentes", [ctx.uso.decks.toLocaleString(LOCALE)])}
      </p>
      <ul className="respostas-todas">
        {lista.map((r) => (
          <li key={r.id}>
            <span className="rt-nome">
              <strong>{nome(r)}</strong>
              {r.card?.namePt && <small> {r.card.name}</small>}
            </span>
            <span className="rt-info">
              <span className={`rt-classe rt-${r.classe}`}>{CLASSES.find((c) => c.id === r.classe)?.label}</span>
              {r.uso > 0 && <span className="rt-uso">{t("em {0}% dos decks", [(r.uso * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })])}</span>}
              {r.tipos.map((t) => (
                <span key={t} className="rt-tipo">
                  {TIPOS[t] ?? t}
                </span>
              ))}
            </span>
            {r.descricao && <small className="rt-desc">{r.descricao}</small>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Janela de respostas (montada uma vez no App) */
export function RespostasDialog() {
  const pedido = useSyncExternalStore(subscribe, () => atual);

  useEffect(() => {
    if (!pedido) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeRespostas();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [pedido]);

  if (!pedido) return null;
  return createPortal(
    <div className="overlay fontes-overlay" onClick={closeRespostas}>
      <div className="dialog fontes-dialog respostas-dialog" role="dialog" aria-modal="true" aria-labelledby="respostas-title" onClick={(e) => e.stopPropagation()}>
        <div className="fontes-head">
          <h2 id="respostas-title">{pedido.titulo}</h2>
          <button className="ghost-btn" onClick={closeRespostas} aria-label={t("Fechar")}>
            ✕
          </button>
        </div>
        <Lista key={pedido.titulo + pedido.ids.join()} pedido={pedido} />
      </div>
    </div>,
    document.body,
  );
}
