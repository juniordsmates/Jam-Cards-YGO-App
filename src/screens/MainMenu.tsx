import { useEffect, useRef, type ReactNode } from "react";
import { ComboIcon, DeckIcon, ExitIcon, SearchIcon } from "../icons";
import { isDesktop } from "../platform";

type Props = {
  /** false enquanto um diálogo está aberto por cima do menu */
  active: boolean;
  onSearch: () => void;
  onCombos: () => void;
  onDeck: () => void;
  onExit: () => void;
};

type Item = {
  label: string;
  hint: string;
  icon: ReactNode;
  accent: "cyan" | "magenta" | "red";
  action: () => void;
};

export default function MainMenu({ active, onSearch, onCombos, onDeck, onExit }: Props) {
  const items: Item[] = [
    { label: "Buscar Carta", hint: "Encontre qualquer carta", icon: <SearchIcon />, accent: "cyan", action: onSearch },
    { label: "Combos", hint: "O que uma mão inicial alcança", icon: <ComboIcon />, accent: "cyan", action: onCombos },
    { label: "Editor de Deck", hint: "Monte e ajuste seus decks", icon: <DeckIcon />, accent: "magenta", action: onDeck },
    { label: "Sair", hint: isDesktop ? "Fechar o aplicativo" : "Encerrar a sessão", icon: <ExitIcon />, accent: "red", action: onExit },
  ];

  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Setas navegam entre os botões; teclas 1-3 acionam direto
  useEffect(() => {
    refs.current[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      const current = refs.current.findIndex((el) => el === document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = (Math.max(current, 0) + step + items.length) % items.length;
        refs.current[next]?.focus();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= items.length) {
        // impede que o dígito seja digitado no campo que ganha foco na próxima tela
        e.preventDefault();
        items[n - 1].action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="menu">
      <header className="menu-header">
        <h1 className="logo">
          Cartas
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
            <kbd className="menu-btn-key">{i + 1}</kbd>
          </button>
        ))}
      </nav>

      <footer className="menu-footer">
        <span>↑ ↓ navegar</span>
        <span>Enter selecionar</span>
        <span>v0.2.1 · {isDesktop ? "Desktop" : "Web"}</span>
      </footer>
    </section>
  );
}
