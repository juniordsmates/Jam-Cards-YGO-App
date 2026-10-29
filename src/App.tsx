import { useEffect, useState } from "react";
import MainMenu from "./screens/MainMenu";
import CardSearch from "./screens/CardSearch";
import Combos from "./screens/Combos";
import Colecao from "./screens/Colecao";
import Manual from "./screens/Manual";
import DeckEditor, { type EditorInicial } from "./screens/DeckEditor";
import ExitDialog from "./components/ExitDialog";
import { FontesDialog, isFontesOpen } from "./components/Fontes";
import { ContaDialog, isContaOpen, openConta } from "./components/Conta";
import { isRespostasOpen, RespostasDialog } from "./components/RespostasDialog";
import { iniciarConta } from "./db/conta";
import { exitApp } from "./platform";
import { initCardDb } from "./db/cardStore";
import type { Card } from "./db/types";

export type Screen = "menu" | "search" | "combos" | "deck" | "colecao" | "manual";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  // Combos aberta pela busca: volta para a busca e já abre com a carta na mão
  const [combosFrom, setCombosFrom] = useState<{ screen: Screen; hand: Card[] }>({ screen: "menu", hand: [] });
  // Editor de Deck aberto direto no Teste de Jogo (menu principal ou atalho de um combo)
  const [deckInicial, setDeckInicial] = useState<EditorInicial>({});
  const [deckFrom, setDeckFrom] = useState<Screen>("menu");
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [exited, setExited] = useState(false);

  // Carrega a base de cartas já na abertura, para a busca abrir pronta
  useEffect(() => void initCardDb(), []);
  // sem o menu nativo do navegador interno ("Reload", "Inspect Element") no botão direito;
  // os campos de texto continuam com o menu de copiar e colar
  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo?.closest("input, textarea, [contenteditable]")) e.preventDefault();
    };
    document.addEventListener("contextmenu", onMenu);
    return () => document.removeEventListener("contextmenu", onMenu);
  }, []);
  // restaura a sessão da conta (se as contas estiverem ativas)
  useEffect(() => iniciarConta(), []);

  // Esc volta ao menu a partir de qualquer tela (painéis abertos tratam antes)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || confirmingExit || e.defaultPrevented || isFontesOpen() || isContaOpen() || isRespostasOpen()) return;
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
          onCombos={() => {
            setCombosFrom({ screen: "menu", hand: [] });
            setScreen("combos");
          }}
          onDeck={() => {
            setDeckInicial({});
            setDeckFrom("menu");
            setScreen("deck");
          }}
          onTeste={() => {
            setDeckInicial({ testar: true });
            setDeckFrom("menu");
            setScreen("deck");
          }}
          onColecao={() => setScreen("colecao")}
          onManual={() => setScreen("manual")}
          onExit={() => setConfirmingExit(true)}
          onConta={() => openConta()}
        />
      )}

      {screen === "search" && (
        <CardSearch
          onBack={() => setScreen("menu")}
          onCombos={(card) => {
            setCombosFrom({ screen: "search", hand: card ? [card] : [] });
            setScreen("combos");
          }}
        />
      )}
      {screen === "combos" && (
        <Combos
          onBack={() => setScreen(combosFrom.screen)}
          initialHand={combosFrom.hand}
          onTestar={(deckId, combo) => {
            setDeckInicial({ deckId, testar: true, combo });
            setDeckFrom("combos");
            setScreen("deck");
          }}
        />
      )}

      {screen === "colecao" && <Colecao onBack={() => setScreen("menu")} />}
      {screen === "manual" && <Manual onBack={() => setScreen("menu")} />}
      {screen === "deck" && <DeckEditor key={JSON.stringify(deckInicial)} inicial={deckInicial} onBack={() => setScreen(deckFrom)} />}

      <FontesDialog />
      <ContaDialog />
      <RespostasDialog />

      {confirmingExit && (
        <ExitDialog
          onConfirm={handleExit}
          onCancel={() => setConfirmingExit(false)}
        />
      )}
    </main>
  );
}
