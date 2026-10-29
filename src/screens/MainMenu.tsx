import { useEffect, useRef, type ReactNode } from "react";
import { CollectionIcon, ComboIcon, DeckIcon, ExitIcon, SearchIcon } from "../icons";
import { isDesktop } from "../platform";
import { BUILD_LABEL, VERSION_LABEL } from "../version";
import { useConta } from "../db/conta";
import { isContaOpen } from "../components/Conta";
import { isFontesOpen } from "../components/Fontes";
import { isRespostasOpen } from "../components/RespostasDialog";

type Props = {
  /** false enquanto um diálogo está aberto por cima do menu */
  active: boolean;
  onSearch: () => void;
  onCombos: () => void;
  onDeck: () => void;
  /** Teste de Jogo (Solo Mode) com o deck padrão */
  onTeste: () => void;
  /** Minha Coleção: as cartas que o usuário possui */
  onColecao: () => void;
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

export default function MainMenu({ active, onSearch, onCombos, onDeck, onTeste, onColecao, onExit, onConta }: Props) {
  const conta = useConta();
  const items: Item[] = [
    { label: "Buscar Carta", hint: "Encontre qualquer carta", icon: <SearchIcon />, accent: "cyan", action: onSearch },
    { label: "Combos", hint: "Mão inicial e Combo Search", icon: <ComboIcon />, accent: "cyan", action: onCombos },
    { label: "Editor de Deck", hint: "Monte e ajuste seus decks", icon: <DeckIcon />, accent: "magenta", action: onDeck },
    { label: "Teste de Jogo", hint: "Teste de mão e jogadas com o seu deck", icon: <DeckIcon />, accent: "magenta", action: onTeste },
    { label: "Minha Coleção", hint: "Cartas que você possui, raridades e valor", icon: <CollectionIcon />, accent: "magenta", action: onColecao },
    { label: "Sair", hint: isDesktop ? "Fechar o aplicativo" : "Encerrar a sessão", icon: <ExitIcon />, accent: "red", action: onExit },
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
    <button className="ghost-btn menu-conta" onClick={onConta} title={conta ? "Minha conta" : "Entrar ou criar conta"}>
      {conta ? `@${conta.usuario}` : "Entrar"}
    </button>
    <section className="menu">
      <header className="menu-header">
        <h1 className="logo">
          Jam Cards - YGO!
        </h1>
        <p className="subtitle">Busca · Decks</p>
      </header>

      <nav className="menu-list" aria-label="Menu principal">
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
        <span>↑ ↓ navegar</span>
        <span>Enter selecionar</span>
        <span title={BUILD_LABEL}>v{VERSION_LABEL} · {isDesktop ? "Desktop" : "Web"} · {BUILD_LABEL}</span>
      </footer>
    </section>
    </>
  );
}
