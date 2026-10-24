import { useEffect, useState } from "react";
import MainMenu from "./screens/MainMenu";
import ScreenShell from "./screens/ScreenShell";
import CardSearch from "./screens/CardSearch";
import Combos from "./screens/Combos";
import ExitDialog from "./components/ExitDialog";
import { exitApp } from "./platform";
import { initCardDb } from "./db/cardStore";

export type Screen = "menu" | "search" | "combos" | "deck";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [exited, setExited] = useState(false);

  // Carrega a base de cartas já na abertura, para a busca abrir pronta
  useEffect(() => void initCardDb(), []);

  // Esc volta ao menu a partir de qualquer tela (painéis abertos tratam antes)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || confirmingExit || e.defaultPrevented) return;
      if (screen !== "menu") setScreen("menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, confirmingExit]);

  const handleExit = async () => {
    setConfirmingExit(false);
    if (!(await exitApp())) setExited(true);
  };

  if (exited) {
    return (
      <main className="stage">
        <div className="goodbye">
          <h1 className="logo">Até logo!</h1>
          <p>Você já pode fechar esta aba.</p>
          <button className="ghost-btn" onClick={() => setExited(false)}>
            Voltar ao menu
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="stage">
      <div className="backdrop" aria-hidden />

      {screen === "menu" && (
        <MainMenu
          active={!confirmingExit}
          onSearch={() => setScreen("search")}
          onCombos={() => setScreen("combos")}
          onDeck={() => setScreen("deck")}
          onExit={() => setConfirmingExit(true)}
        />
      )}

      {screen === "search" && <CardSearch onBack={() => setScreen("menu")} />}
      {screen === "combos" && <Combos onBack={() => setScreen("menu")} />}

      {screen === "deck" && (
        <ScreenShell
          title="Editor de Deck"
          accent="magenta"
          onBack={() => setScreen("menu")}
        >
          O editor de deck entra aqui.
        </ScreenShell>
      )}

      {confirmingExit && (
        <ExitDialog
          onConfirm={handleExit}
          onCancel={() => setConfirmingExit(false)}
        />
      )}
    </main>
  );
}
