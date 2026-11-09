import { useEffect, useState } from "react";
import MainMenu from "./screens/MainMenu";
import CardSearch from "./screens/CardSearch";
import Combos from "./screens/Combos";
import Colecao from "./screens/Colecao";
import Manual from "./screens/Manual";
import GuiaDeck from "./screens/GuiaDeck";
import MetaCall from "./screens/MetaCall";
import Rank from "./screens/Rank";
import Conquistas from "./screens/Conquistas";
import Eventos from "./screens/Eventos";
import ListaDesejos from "./screens/ListaDesejos";
import Comunidade from "./screens/Comunidade";
import DeckEditor, { type EditorInicial } from "./screens/DeckEditor";
import ExitDialog from "./components/ExitDialog";
import AvisoConquista from "./components/AvisoConquista";
import { FontesDialog, isFontesOpen } from "./components/Fontes";
import { ContaDialog, isContaOpen, openConta } from "./components/Conta";
import { isRespostasOpen, RespostasDialog } from "./components/RespostasDialog";
import { iniciarConta } from "./db/conta";
import { exitApp } from "./platform";
import { initCardDb } from "./db/cardStore";
import type { Card } from "./db/types";
import { escreverRota, lerRota, type Rota } from "./rotas";
import { t } from "./i18n";

export type Screen = "menu" | "search" | "combos" | "deck" | "colecao" | "manual" | "guia" | "metacall" | "rank" | "conquistas" | "eventos" | "comunidade" | "desejos";

/** Tela do app para uma rota do endereço (o Teste de Jogo abre o Editor de Deck já testando) */
const telaDa = (r: Rota): Screen => (r.tela === "teste" ? "deck" : r.tela);

export default function App() {
  // rota do endereço: tela e o que abrir nela (carta, combo, deck do guia, seleção do Meta Call)
  const [rota, setRota] = useState<Rota>(lerRota);
  const [screen, setScreen] = useState<Screen>(() => telaDa(rota));
  // Combos aberta pela busca: volta para a busca e já abre com a carta na mão
  const [combosFrom, setCombosFrom] = useState<{ screen: Screen; hand: Card[] }>({ screen: "menu", hand: [] });
  // Editor de Deck aberto direto no Teste de Jogo (menu principal ou atalho de um combo)
  const [deckInicial, setDeckInicial] = useState<EditorInicial>(() => (rota.tela === "teste" ? { testar: true } : {}));
  const [deckFrom, setDeckFrom] = useState<Screen>("menu");
  // Guia de Deck aberto pela Comunidade: o voltar retorna para ela
  const [guiaFrom, setGuiaFrom] = useState<Screen>("menu");
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [exited, setExited] = useState(false);

  // o endereço acompanha a tela; ao trocar de tela, o que estava aberto na anterior não vale mais
  useEffect(() => {
    const atual: Rota["tela"] = screen === "deck" && deckInicial.testar ? "teste" : screen;
    if (lerRota().tela === atual) return;
    const nova = { tela: atual } as Rota;
    setRota(nova);
    escreverRota(nova);
  }, [screen, deckInicial.testar]);
  // voltar/avançar do navegador e link aberto com o app já aberto
  useEffect(() => {
    const aoMudar = () => {
      const r = lerRota();
      setRota(r);
      if (r.tela === "teste") setDeckInicial({ testar: true });
      if (r.tela === "combos") setCombosFrom({ screen: "menu", hand: [] });
      setScreen(telaDa(r));
    };
    window.addEventListener("popstate", aoMudar);
    window.addEventListener("hashchange", aoMudar);
    return () => {
      window.removeEventListener("popstate", aoMudar);
      window.removeEventListener("hashchange", aoMudar);
    };
  }, []);
  /**
   * detalhe aberto dentro da tela (carta, combo, aba…): troca o endereço sem criar histórico; se a
   * tela é outra (a tela nova avisa antes do App), entra como nova entrada, para o voltar funcionar
   */
  const aoRota = (r: Rota) => escreverRota(r, lerRota().tela === r.tela);

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
          <h1 className="logo">{t("Até logo!")}</h1>
          <p>{t("Você já pode fechar esta aba.")}</p>
          <button className="ghost-btn" onClick={() => setExited(false)}>
            {t("Voltar ao menu")}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="stage">
      <div className="backdrop" aria-hidden />
      {/* aviso de conquista desbloqueada, por cima de qualquer tela */}
      <AvisoConquista />

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
          onDesejos={() => setScreen("desejos")}
          onComunidade={() => setScreen("comunidade")}
          onRank={() => setScreen("rank")}
          onEventos={() => setScreen("eventos")}
          onManual={() => setScreen("manual")}
          onGuia={() => setScreen("guia")}
          onMetaCall={() => setScreen("metacall")}
          onExit={() => setConfirmingExit(true)}
          onConta={() => openConta()}
        />
      )}

      {screen === "search" && (
        <CardSearch
          cartaInicial={rota.tela === "search" ? rota.carta : undefined}
          onRota={aoRota}
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
          comboId={rota.tela === "combos" ? rota.combo : undefined}
          maoIds={rota.tela === "combos" ? rota.mao : undefined}
          onRota={aoRota}
          onTestar={(deck, combo) => {
            setDeckInicial({ temporario: deck, testar: true, combo });
            setDeckFrom("combos");
            setScreen("deck");
          }}
        />
      )}

      {screen === "colecao" && <Colecao onBack={() => setScreen("menu")} />}
      {screen === "manual" && <Manual onBack={() => setScreen("menu")} />}
      {screen === "metacall" && <MetaCall onBack={() => setScreen("menu")} inicial={rota.tela === "metacall" ? rota : undefined} onRota={aoRota} />}
      {screen === "desejos" && <ListaDesejos onBack={() => setScreen("menu")} />}
      {screen === "rank" && <Rank onBack={() => setScreen("menu")} onComunidade={() => setScreen("comunidade")} onConquistas={() => setScreen("conquistas")} />}
      {screen === "conquistas" && <Conquistas onBack={() => setScreen("menu")} onRank={() => setScreen("rank")} />}
      {screen === "eventos" && <Eventos inicial={rota.tela === "eventos" ? rota : undefined} onRota={aoRota} onBack={() => setScreen("menu")} />}
      {screen === "comunidade" && (
        <Comunidade
          inicial={rota.tela === "comunidade" ? rota : undefined}
          onRota={aoRota}
          onBack={() => setScreen("menu")}
          onGuia={(arquetipo, aba) => {
            // abre o Guia já no deck e na aba; o voltar do Guia retorna para a Comunidade
            const r: Rota = { tela: "guia", arquetipo, aba };
            setRota(r);
            escreverRota(r);
            setGuiaFrom("comunidade");
            setScreen("guia");
          }}
        />
      )}
      {screen === "guia" && (
        <GuiaDeck
          inicial={rota.tela === "guia" ? rota : undefined}
          onRota={aoRota}
          onBack={() => {
            setScreen(guiaFrom);
            setGuiaFrom("menu");
          }}
          onTestar={(deck, combo) => {
            setDeckInicial({ temporario: deck, testar: true, combo });
            setDeckFrom("guia");
            setScreen("deck");
          }}
        />
      )}
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
