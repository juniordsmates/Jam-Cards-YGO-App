import { useEffect, useRef, type ReactNode } from "react";
import { BookIcon, CollectionIcon, ComboIcon, DeckIcon, DuelIcon, EventIcon, ExitIcon, HeartIcon, HelpIcon, PeopleIcon, SearchIcon, TargetIcon, TrophyIcon } from "../icons";
import { isDesktop } from "../platform";
import { BUILD_LABEL, VERSION_LABEL } from "../version";
import { useConta } from "../db/conta";
import { isContaOpen } from "../components/Conta";
import { isFontesOpen } from "../components/Fontes";
import { isRespostasOpen } from "../components/RespostasDialog";
import { definirIdioma, IDIOMA, IDIOMAS_APP, t } from "../i18n";
import { definirTema, useTema } from "../tema";

type Props = {
  /** false enquanto um diálogo está aberto por cima do menu */
  active: boolean;
  onSearch: () => void;
  onCombos: () => void;
  /** Guia de Deck: os decks do meta, com ideias, combos e interações */
  onGuia: () => void;
  /** Meta Call: decks esperados no torneio → cartas boas contra eles */
  onMetaCall: () => void;
  onDeck: () => void;
  /** Teste de Jogo (Solo Mode) com o deck padrão */
  onTeste: () => void;
  /** Simulador: duelo com regras contra a IA */
  onSimulador: () => void;
  /** Minha Coleção: as cartas que o usuário possui */
  onColecao: () => void;
  /** Lista de Desejos: cartas que o jogador quer conseguir */
  onDesejos: () => void;
  /** Meus Combos: combos salvos pelo jogador */
  onMeusCombos: () => void;
  /** Comunidade: por arquétipo, quem mais compartilha, combos e guia */
  onComunidade: () => void;
  /** Rank: duelistas com mais pontos */
  onRank: () => void;
  /** Eventos: resultados de torneio compartilhados, com a decklist */
  onEventos: () => void;
  /** Como Utilizar: manual das telas */
  onManual: () => void;
  onExit: () => void;
  /** abre a tela de conta (entrar, criar conta, integração com IA) */
  onConta: () => void;
};

type Item = {
  label: string;
  hint: string;
  icon: ReactNode;
  accent: "cyan" | "magenta" | "red";
  action: () => void;
};

export default function MainMenu({ active, onSearch, onCombos, onGuia, onMetaCall, onDeck, onTeste, onSimulador, onColecao, onDesejos, onMeusCombos, onComunidade, onRank, onEventos, onManual, onExit, onConta }: Props) {
  const conta = useConta();
  const tema = useTema();
  const B = (label: string, hint: string, icon: Item["icon"], accent: Item["accent"], action: () => void): Item => ({ label, hint, icon, accent, action });
  // três colunas; a ordem dentro de cada uma é a dos botões
  const colunas: { titulo: string; itens: Item[] }[] = [
    {
      titulo: t("Explorar"),
      itens: [
        B(t("Buscar Carta"), t("Encontre qualquer carta"), <SearchIcon />, "cyan", onSearch),
        B(t("Combos"), t("Mão inicial e Combo Search"), <ComboIcon />, "cyan", onCombos),
        B(t("Guia de Deck"), t("Decks do meta: ideias, combos e interações"), <BookIcon />, "cyan", onGuia),
        B(t("Meta Call"), t("Decks esperados no torneio → cartas contra eles"), <TargetIcon />, "cyan", onMetaCall),
      ],
    },
    {
      titulo: t("Seus decks e cartas"),
      itens: [
        B(t("Editor de Deck"), t("Monte e ajuste seus decks"), <DeckIcon />, "magenta", onDeck),
        B(t("Teste de Jogo"), t("Teste de mão e jogadas com o seu deck"), <DeckIcon />, "magenta", onTeste),
        B(t("Simulador"), t("Duelo com as regras do jogo contra a IA"), <DuelIcon />, "magenta", onSimulador),
        B(t("Minha Coleção"), t("Cartas que você possui, raridades e valor"), <CollectionIcon />, "magenta", onColecao),
        B(t("Meus Combos"), t("Combos que você salvou, para abrir rápido"), <ComboIcon />, "magenta", onMeusCombos),
      ],
    },
    {
      titulo: t("Comunidade e app"),
      itens: [
        B(t("Lista de Desejos"), t("Cartas que você quer conseguir"), <HeartIcon />, "magenta", onDesejos),
        B(t("Comunidade"), t("Por arquétipo: quem mais compartilha, combos e guia"), <PeopleIcon />, "magenta", onComunidade),
        B(t("Eventos"), t("Resultados de torneio com a decklist"), <EventIcon />, "magenta", onEventos),
        B(t("Rank e Conquistas"), t("Duelistas com mais pontos e suas conquistas"), <TrophyIcon />, "magenta", onRank),
        B(t("Como Utilizar"), t("Manual de cada tela, com exemplos"), <HelpIcon />, "cyan", onManual),
      ],
    },
  ];

  // botões por coluna (refs.current[coluna][linha])
  const refs = useRef<(HTMLButtonElement | null)[][]>([]);
  const tamanhos = colunas.map((c) => c.itens.length);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Setas navegam entre os botões (Enter aciona). Sem atalhos de letras ou números: digitar numa
  // janela aberta por cima do menu (ex.: senha na tela de conta) não pode acionar o menu.
  useEffect(() => {
    refs.current[0]?.[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!activeRef.current || isFontesOpen() || isContaOpen() || isRespostasOpen()) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable]")) return;
      // posição do botão em foco (coluna, linha); sem foco num botão, o primeiro
      let [c, j] = [0, 0];
      refs.current.forEach((col, ci) => col.forEach((el, ji) => el === document.activeElement && ([c, j] = [ci, ji])));
      // ↑ ↓ dentro da coluna (e passam para a próxima no fim); ← → para a coluna ao lado, na mesma linha
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const ordem = tamanhos.flatMap((n, ci) => Array.from({ length: n }, (_, ji) => [ci, ji]));
        const atual = ordem.findIndex(([ci, ji]) => ci === c && ji === j);
        const [nc, nj] = ordem[(atual + (e.key === "ArrowDown" ? 1 : -1) + ordem.length) % ordem.length];
        refs.current[nc]?.[nj]?.focus();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const nc = (c + (e.key === "ArrowRight" ? 1 : -1) + tamanhos.length) % tamanhos.length;
        refs.current[nc]?.[Math.min(j, tamanhos[nc] - 1)]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
    {/* fora do bloco animado do menu: canto superior direito da tela */}
    {/* tema (claro/escuro) e idioma do app (recarrega ao trocar), ao lado da conta */}
    <div className="menu-topo">
    <div className="menu-idioma menu-tema" role="radiogroup" aria-label={t("Tema")}>
      <button role="radio" aria-checked={tema === "claro"} className={tema === "claro" ? "active" : ""} onClick={() => definirTema("claro")} title={t("Modo claro")}>
        {t("☀ Claro")}
      </button>
      <button role="radio" aria-checked={tema === "escuro"} className={tema === "escuro" ? "active" : ""} onClick={() => definirTema("escuro")} title={t("Modo escuro")}>
        {t("☾ Escuro")}
      </button>
    </div>
    <div className="menu-idioma" role="radiogroup" aria-label={t("Idioma / Language / Idioma")}>
      {IDIOMAS_APP.map((i) => (
        <button key={i.id} role="radio" aria-checked={IDIOMA === i.id} className={IDIOMA === i.id ? "active" : ""} onClick={() => definirIdioma(i.id)} title={i.label}>
          {i.label}
        </button>
      ))}
    </div>
    <button className="ghost-btn menu-conta" onClick={onConta} title={conta ? t("Minha conta") : t("Entrar ou criar conta")}>
      {conta ? `@${conta.usuario}` : t("Entrar")}
    </button>
    {/* Sair fica no topo, fora das colunas do menu */}
    <button className="ghost-btn menu-sair" onClick={onExit} title={isDesktop ? t("Fechar o aplicativo") : t("Encerrar a sessão")}>
      <ExitIcon /> {t("Sair")}
    </button>
    </div>
    <section className="menu">
      <header className="menu-header">
        <h1 className="logo">
          {t("Jam Cards - YGO!")}</h1>
        <p className="subtitle">{t("Busca · Decks")}</p>
      </header>

      <nav className="menu-list" aria-label={t("Menu principal")}>
        {colunas.map((col, c) => (
          <div key={col.titulo} className="menu-coluna" role="group" aria-label={col.titulo}>
            <h2 className="menu-coluna-titulo">{col.titulo}</h2>
            {col.itens.map((item, j) => (
              <button
                key={item.label}
                ref={(el) => {
                  (refs.current[c] ??= [])[j] = el;
                }}
                className={`menu-btn accent-${item.accent}`}
                onClick={item.action}
              >
                <span className="menu-btn-icon">{item.icon}</span>
                <span className="menu-btn-text">
                  <span className="menu-btn-label">{item.label}</span>
                  <span className="menu-btn-hint">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <footer className="menu-footer">
        <span>{t("↑ ↓ ← → navegar")}</span>
        <span>{t("Enter selecionar")}</span>
        <span title={BUILD_LABEL}>{t("v{0} · {1} · {2}", [VERSION_LABEL, isDesktop ? t("Desktop") : t("Web"), BUILD_LABEL])}</span>
      </footer>
    </section>
    </>
  );
}
