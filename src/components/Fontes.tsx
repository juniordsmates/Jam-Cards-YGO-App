import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import ExternalLink from "./ExternalLink";
import { GRUPOS, SITES, type SiteId } from "../data/referencias";
import { t } from "../i18n";

/** Link específico do lugar de onde a tela foi aberta (ex.: o deck usado numa linha) */
export interface FonteLink {
  nome: string;
  url: string;
}

interface Contexto {
  sites: SiteId[];
  links: FonteLink[];
}

// Estado global da tela de Fontes: um botão em qualquer lugar abre a mesma tela
let current: Contexto | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openFontes(sites: SiteId[] = [], links: FonteLink[] = []) {
  current = { sites, links };
  emit();
}

export function closeFontes() {
  current = null;
  emit();
}

/** A tela está aberta? (o Esc dos painéis e do menu espera ela fechar primeiro) */
export const isFontesOpen = () => current !== null;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Botão "Fontes": abre a tela com todos os sites, com os usados aqui em destaque */
export function FontesButton({ sites = [], links = [], className = "" }: { sites?: SiteId[]; links?: FonteLink[]; className?: string }) {
  return (
    <button type="button" className={`link-btn fontes-btn ${className}`} onClick={() => openFontes(sites, links)}>
      {t("Fontes")}</button>
  );
}

/** Tela de Fontes (montada uma vez no App) */
export function FontesDialog() {
  const ctx = useSyncExternalStore(subscribe, () => current);

  useEffect(() => {
    if (!ctx) return;
    // captura + preventDefault: o Esc fecha só esta tela, não o painel nem a tela atual
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeFontes();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [ctx]);

  if (!ctx) return null;
  const here = SITES.filter((s) => ctx.sites.includes(s.id));

  return createPortal(
    <div className="overlay fontes-overlay" onClick={closeFontes}>
      <div className="dialog fontes-dialog" role="dialog" aria-modal="true" aria-labelledby="fontes-title" onClick={(e) => e.stopPropagation()}>
        <div className="fontes-head">
          <h2 id="fontes-title">{t("Fontes")}</h2>
          <button className="ghost-btn" onClick={closeFontes} aria-label={t("Fechar")} autoFocus>
            ✕
          </button>
        </div>

        {(ctx.links.length > 0 || here.length > 0) && (
          <section className="fontes-group fontes-here">
            <h3>{t("Usadas aqui")}</h3>
            <ul>
              {ctx.links.map((l) => (
                <li key={l.url}>
                  <ExternalLink href={l.url}>{l.nome} ↗</ExternalLink>
                </li>
              ))}
              {here.map((s) => (
                <li key={s.id}>
                  <ExternalLink href={s.url}>{s.nome} ↗</ExternalLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {GRUPOS.map((g) => (
          <section key={g} className="fontes-group">
            <h3>{g}</h3>
            <ul>
              {SITES.filter((s) => s.grupo === g).map((s) => (
                <li key={s.id}>
                  <ExternalLink href={s.url}>{s.nome} ↗</ExternalLink>
                  <small>{s.uso}</small>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
