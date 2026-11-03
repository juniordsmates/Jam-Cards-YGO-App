import { useEffect, useRef, type ReactNode } from "react";
import { BookIcon, CollectionIcon, ComboIcon, DeckIcon, ExitIcon, HelpIcon, PeopleIcon, SearchIcon, TargetIcon, TrophyIcon } from "../icons";
import { isDesktop } from "../platform";
import { BUILD_LABEL, VERSION_LABEL } from "../version";
import { useConta } from "../db/conta";
import { isContaOpen } from "../components/Conta";
import { isFontesOpen } from "../components/Fontes";
import { isRespostasOpen } from "../components/RespostasDialog";
import { definirIdioma, IDIOMA, IDIOMAS_APP, t } from "../i18n";

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
  /** Minha Coleção: as cartas que o usuário possui */
  onColecao: () => void;
  /** Comunidade: por arquétipo, quem mais compartilha, combos e guia */
  onComunidade: () => void;
  /** Rank: duelistas com mais pontos */
  onRank: () => void;
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

export default function MainMenu({ active, onSearch, onCombos, onGuia, onMetaCall, onDeck, onTeste, onColecao, onComunidade, onRank, onManual, onExit, onConta }: Props) {
  const conta = useConta();
  const items: Item[] = [
    { label: t("Buscar Carta"), hint: t("Encontre qualquer carta"), icon: <SearchIcon />, accent: "cyan", action: onSearch },
    { label: t("Combos"), hint: t("Mão inicial e Combo Search"), icon: <ComboIcon />, accent: "cyan", action: onCombos },
    { label: t("Guia de Deck"), hint: t("Decks do meta: ideias, combos e interações"), icon: <BookIcon />, accent: "cyan", action: onGuia },
    { label: t("Meta Call"), hint: t("Decks esperados no torneio → cartas contra eles"), icon: <TargetIcon />, accent: "cyan", action: onMetaCall },
    { label: t("Editor de Deck"), hint: t("Monte e ajuste seus decks"), icon: <DeckIcon />, accent: "magenta", action: onDeck },
    { label: t("Teste de Jogo"), hint: t("Teste de mão e jogadas com o seu deck"), icon: <DeckIcon />, accent: "magenta", action: onTeste },
    { label: t("Minha Coleção"), hint: t("Cartas que você possui, raridades e valor"), icon: <CollectionIcon />, accent: "magenta", action: onColecao },
    { label: t("Comunidade"), hint: t("Por arquétipo: quem mais compartilha, combos e guia"), icon: <PeopleIcon />, accent: "magenta", action: onComunidade },
    { label: t("Rank"), hint: t("Duelistas com mais pontos"), icon: <TrophyIcon />, accent: "magenta", action: onRank },
    { label: t("Como Utilizar"), hint: t("Manual de cada tela, com exemplos"), icon: <HelpIcon />, accent: "cyan", action: onManual },
    { label: t("Sair"), hint: isDesktop ? t("Fechar o aplicativo") : t("Encerrar a sessão"), icon: <ExitIcon />, accent: "red", action: onExit },
  ];

  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Setas navegam entre os botões (Enter aciona). Sem atalhos de letras ou números: digitar numa
  // janela aberta por cima do menu (ex.: senha na tela de conta) não pode acionar o menu.
  useEffect(() => {
    refs.current[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!activeRef.current || isFontesOpen() || isContaOpen() || isRespostasOpen()) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable]")) return;
      const current = refs.current.findIndex((el) => el === document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = (Math.max(current, 0) + step + items.length) % items.length;
        refs.current[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
    {/* fora do bloco animado do menu: canto superior direito da tela */}
    {/* idioma do app (recarrega ao trocar), ao lado da conta */}
    <div className="menu-topo">
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
    </div>
    <section className="menu">
      <header className="menu-header">
        <h1 className="logo">
          {t("Jam Cards - YGO!")}</h1>
        <p className="subtitle">{t("Busca · Decks")}</p>
      </header>

      <nav className="menu-list" aria-label={t("Menu principal")}>
        {items.map((item, i) => (
          <button
            key={item.label}
            ref={(el) => {
              refs.current[i] = el;
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
      </nav>

      <footer className="menu-footer">
        <span>{t("↑ ↓ navegar")}</span>
        <span>{t("Enter selecionar")}</span>
        <span title={BUILD_LABEL}>{t("v{0} · {1} · {2}", [VERSION_LABEL, isDesktop ? t("Desktop") : t("Web"), BUILD_LABEL])}</span>
      </footer>
    </section>
    </>
  );
}
