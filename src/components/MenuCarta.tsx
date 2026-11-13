import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useCardDb } from "../db/cardStore";
import { categoriasManuais, definirCategorias, MAX_CATEGORIAS } from "../db/categoriasManuais";
import { PAPEIS, papeisAutomaticos } from "../db/classificacao";
import { cardImage } from "../db/images";
import { displayName, type Card } from "../db/types";
import { t } from "../i18n";

// Menu do botão direito sobre uma carta, em qualquer tela (menos no Simulador e nos Testes de Jogo,
// que têm os menus de jogo): "Categorizar" abre a janela para escolher até 3 categorias (os papéis:
// Hand trap, Starter, Extender, Board breaker, Floodgate, Staple, Combo Garnets). Telas que já usam o botão direito
// (Editor de Deck) abrem este menu com as ações delas antes (abrirMenuCarta).

/** áreas de jogo, onde o botão direito é dos menus do duelo/teste */
const FORA = ".teste-jogo, .sim-config, .sim-janela-mao, .guia-janela";
/** id da imagem pela URL (site e app de computador; pequena, cheia ou recortada) */
const ID_DA_IMAGEM = /\/cards(?:_small|_cropped)?\/(\d+)\.jpg(?:$|\?)/;

export interface AcaoMenu {
  label: string;
  fazer: () => void;
}

type Menu = { x: number; y: number; id: number; extras: AcaoMenu[] } | null;

let menu: Menu = null;
const ouvintes = new Set<() => void>();
const mudar = (m: Menu) => {
  menu = m;
  ouvintes.forEach((f) => f());
};

/** Abre o menu da carta (id da carta ou de uma das artes dela) na posição do clique, com ações próprias da tela antes */
export function abrirMenuCarta(x: number, y: number, id: number, extras: AcaoMenu[] = []) {
  mudar({ x, y, id, extras });
}

export default function MenuCarta() {
  const atual = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => menu,
    () => null,
  );
  const db = useCardDb();
  // carta pela id dela ou de qualquer arte
  const porImagem = useMemo(() => {
    const m = new Map<number, Card>();
    for (const c of db.cards) {
      m.set(c.id, c);
      for (const i of c.images ?? []) if (!m.has(i)) m.set(i, c);
    }
    return m;
  }, [db.cards]);
  const [categorizando, setCategorizando] = useState<Card | null>(null);
  const caixa = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const aoMenu = (e: MouseEvent) => {
      // a tela já tratou o botão direito (ex.: menus de jogo)
      if (e.defaultPrevented) return;
      const alvo = e.target instanceof Element ? e.target : null;
      if (!alvo || alvo.closest(FORA)) return;
      const comId = alvo.closest<HTMLElement>("[data-card-id]");
      let id = comId ? Number(comId.dataset.cardId) : NaN;
      if (!Number.isFinite(id) && alvo instanceof HTMLImageElement) id = Number(ID_DA_IMAGEM.exec(alvo.currentSrc || alvo.src)?.[1]);
      if (!Number.isFinite(id) || !id) return;
      e.preventDefault();
      abrirMenuCarta(e.clientX, e.clientY, id);
    };
    document.addEventListener("contextmenu", aoMenu);
    return () => document.removeEventListener("contextmenu", aoMenu);
  }, []);

  // fecha o menu ao clicar fora, rolar ou apertar Esc
  useEffect(() => {
    if (!atual) return;
    const fechar = (e: Event) => {
      if (e instanceof MouseEvent && caixa.current?.contains(e.target as Node)) return;
      mudar(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      mudar(null);
    };
    window.addEventListener("mousedown", fechar, true);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("keydown", tecla, true);
    return () => {
      window.removeEventListener("mousedown", fechar, true);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [atual]);

  const carta = atual ? porImagem.get(atual.id) : undefined;
  return (
    <>
      {atual && carta && (
        <ul
          ref={caixa}
          className="menu-carta"
          role="menu"
          aria-label={displayName(carta)}
          // dentro da tela, mesmo perto da borda
          style={{ left: Math.min(atual.x, window.innerWidth - 200), top: Math.min(atual.y, window.innerHeight - 40 * (atual.extras.length + 1) - 8) }}
        >
          {atual.extras.map((a) => (
            <li key={a.label}>
              <button
                role="menuitem"
                onClick={() => {
                  mudar(null);
                  a.fazer();
                }}
              >
                {a.label}
              </button>
            </li>
          ))}
          <li>
            <button
              role="menuitem"
              autoFocus
              onClick={() => {
                mudar(null);
                setCategorizando(carta);
              }}
            >
              {t("Categorizar")}
            </button>
          </li>
        </ul>
      )}
      {categorizando && <Categorizar card={categorizando} onFechar={() => setCategorizando(null)} />}
    </>
  );
}

/** Janela "Categorizar": até 3 categorias para a carta (vazio volta à classificação automática) */
function Categorizar({ card, onFechar }: { card: Card; onFechar: () => void }) {
  const automaticas = papeisAutomaticos(card).map((p) => p.id);
  const manuais = categoriasManuais(card.id);
  const [marcadas, setMarcadas] = useState<string[]>(manuais ?? automaticas);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onFechar();
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [onFechar]);

  const alternar = (id: string) => setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : m.length < MAX_CATEGORIAS ? [...m, id] : m));
  const rotulos = (ids: string[]) => PAPEIS.filter((p) => ids.includes(p.id)).map((p) => p.label).join(", ") || t("nenhuma");

  return (
    <div className="categorizar-fundo" onMouseDown={onFechar}>
      <div className="categorizar" role="dialog" aria-modal="true" aria-label={t("Categorizar {0}", [displayName(card)])} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <img src={cardImage(card.id, "small")} alt="" />
          <div>
            <h3>{t("Categorizar")}</h3>
            <strong>{displayName(card)}</strong>
            <small className="tags-note">
              {t("Automática: {0}", [rotulos(automaticas)])}
              {manuais ? ` · ${t("hoje: escolhida por você")}` : ""}
            </small>
          </div>
        </header>
        <p className="tags-note">{t("Escolha até {0} categorias. Elas trocam a classificação automática desta carta em todas as telas (só neste aparelho).", [MAX_CATEGORIAS])}</p>
        <div className="categorizar-opcoes" role="group" aria-label={t("Categorias")}>
          {PAPEIS.map((p) => {
            const on = marcadas.includes(p.id);
            return (
              <label key={p.id} className={`categorizar-opcao ${on ? "ativa" : ""}`} style={{ "--cor": p.cor } as CSSProperties}>
                <input type="checkbox" checked={on} disabled={!on && marcadas.length >= MAX_CATEGORIAS} onChange={() => alternar(p.id)} />
                <span className="selo-papel" style={{ background: p.cor }}>
                  {p.sigla}
                </span>
                {p.label}
              </label>
            );
          })}
        </div>
        <small className="tags-note">{t("{0} de {1} escolhidas", [marcadas.length, MAX_CATEGORIAS])}</small>
        <div className="categorizar-botoes">
          <button
            className="ghost-btn categorizar-salvar"
            onClick={() => {
              definirCategorias(card.id, marcadas);
              onFechar();
            }}
          >
            {t("Salvar")}
          </button>
          {manuais && (
            <button
              className="ghost-btn"
              onClick={() => {
                definirCategorias(card.id, null);
                onFechar();
              }}
            >
              {t("Voltar à automática")}
            </button>
          )}
          <button className="ghost-btn" onClick={onFechar}>
            {t("Cancelar")}
          </button>
        </div>
      </div>
    </div>
  );
}
