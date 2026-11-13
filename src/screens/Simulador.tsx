import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { OcgLocation as L, OcgMessageType as T, OcgPhase, OcgResponseType as R, type OcgResponse, type SelectFieldPlace } from "ocgcore-wasm";
import ScreenShell from "./ScreenShell";
import Lateral from "../components/Lateral";
import EscolherMao from "../components/EscolherMao";
import TreinoCombos, { type SugestaoTreino } from "../components/TreinoCombos";
import { EscolherCombo, PainelGuia } from "../components/GuiaCombo";
import { avaliarGuia, combosDoDeck, passosDaLinha, type EstadoGuia } from "../db/guiaCombo";
import { usoEmTorneio } from "../db/respostas";
import { legalIn } from "../db/legality";
import InteracoesCarta from "../components/InteracoesCarta";
import { ChatAssistente, ChatOponente, type MensagemOponente } from "../components/ChatDuelo";
import { useCardDb } from "../db/cardStore";
import { useDecks } from "../db/decks";
import { cardImage } from "../db/images";
import { kindLabel } from "../db/labels";
import { displayName, type Card } from "../db/types";
import { aleatorio } from "../db/testeJogo";
import { useConta } from "../db/conta";
import { openConta } from "../components/Conta";
import { assinarDuelo, enviarChat, meusDuelos, codigoDaSala, obterDueloPorCodigo, partidasAtivas, criarDuelo, definirMao, encerrarDuelo, entrarDuelo, enviarResposta, faltaMao, idDaSala, meuJogador, minhaMao, partidaDoDuelo, nomesDeUsuarios, obterDuelo, respostasDoDuelo, type Duelo } from "../db/duelos";
import { abandonarMatch, assinarMatch, criarMatch, obterMatch, papelNaMatch, prepararJogo, type DeckMatch, type Match } from "../db/duelos";
import SideDeck from "../components/SideDeck";
import { placar, quemEscolhe, sideValido, vencedorDaMatch, type Lado, type ResultadoJogo } from "../sim/match";
import { copiarLink, linkPara, type Rota } from "../rotas";
import { APP_VERSION } from "../version";
import { LOCALE, t } from "../i18n";
import { ClienteSim, obterPacote } from "../sim/cliente";
import { zonasLivres } from "../sim/opcoes";
import type { DecisaoIA, LinhaIA, NivelIA } from "../sim/ia";
import type { Aprendizado, CartaSim, ConfigSessao, EventoSim, Momento, PedidoSim, Quadro } from "../sim/sessao";
import { apagarReplay, compartilharReplay, obterReplay } from "../db/replays";
import { aprenderValores, exportarReplay, guardarAprendizado, guardarReplay, importarReplay, lerValoresAprendidos, listarAprendizado, marcarCompartilhado, REPLAYS_GRATIS, REPLAYS_PREMIUM, type DueloGuardado, type RotulosReplay } from "../sim/aprendizado";
import type { AnaliseDuelo, FatoDuelo } from "../sim/analise";
import { temPremium } from "../db/conta";
import { isDesktop } from "../platform";
import { explicarPorque, type Explicacao } from "../sim/porque";
import type { DeckSim, Jogada, Partida } from "../sim/regras";
import { maoDoRoteiro } from "../sim/roteiro";
import type { DeckTemporario } from "../db/decks";
import type { ComboTeste } from "./TesteJogo";
import type { QuemTemOCombo } from "../components/TestarDialog";
import "./teste-jogo.css";
import "./simulador.css";

// Simulador: duelo com as regras do jogo (motor do EDOPro, Project Ignis) contra a IA, com o seu
// deck e um deck seu ou do meta. O motor e a IA rodam num Worker (src/sim/); esta tela mostra o
// campo e pergunta ao jogador cada decisão que o motor pede.

const NIVEIS: { id: NivelIA; label: string; hint: string }[] = [
  { id: "passiva", label: t("Passiva"), hint: t("Só passa a vez: para treinar os seus combos") },
  { id: "facil", label: t("Fácil"), hint: t("Joga sem planejar e quase não responde") },
  { id: "normal", label: t("Normal"), hint: t("Planeja o turno e responde às vezes") },
  { id: "dificil", label: t("Difícil"), hint: t("Planeja mais e responde sempre que pode") },
];

const FASES: [number, string][] = [
  [OcgPhase.DRAW, "DP"],
  [OcgPhase.STANDBY, "SP"],
  [OcgPhase.MAIN1, "M1"],
  [OcgPhase.BATTLE_START, "BP"],
  [OcgPhase.MAIN2, "M2"],
  [OcgPhase.END, "EP"],
];
/** Fases da barra do topo: sigla, nome e o valor do motor (Battle Phase reúne as etapas da batalha) */
const BARRA_FASES: { id: string; nome: string; fase: number }[] = [
  { id: "DP", nome: t("Draw Phase"), fase: OcgPhase.DRAW },
  { id: "SP", nome: t("Standby Phase"), fase: OcgPhase.STANDBY },
  { id: "M1", nome: t("Main Phase 1"), fase: OcgPhase.MAIN1 },
  { id: "BP", nome: t("Battle Phase"), fase: OcgPhase.BATTLE_START },
  { id: "M2", nome: t("Main Phase 2"), fase: OcgPhase.MAIN2 },
  { id: "EP", nome: t("End Phase"), fase: OcgPhase.END },
];
const siglaFase = (f: number) => (f & (OcgPhase.BATTLE_START | OcgPhase.BATTLE_STEP | OcgPhase.DAMAGE | OcgPhase.DAMAGE_CAL | OcgPhase.BATTLE) ? "BP" : FASES.find(([v]) => v === f)?.[1] ?? "");

// títulos das escolhas, pela dica do motor (HINTMSG_* do constant.lua do Project Ignis)
const DICAS: Record<string, string> = {
  RELEASE: t("Escolha o que oferecer como Tributo"),
  TRIBUTE: t("Escolha o que oferecer como Tributo"),
  DISCARD: t("Escolha a carta para descartar"),
  DESTROY: t("Escolha a carta para destruir"),
  REMOVE: t("Escolha a carta para banir"),
  TOGRAVE: t("Escolha a carta para enviar ao Cemitério"),
  RTOGRAVE: t("Escolha a carta para enviar ao Cemitério"),
  RTOHAND: t("Escolha a carta para devolver à mão"),
  ATOHAND: t("Escolha a carta para adicionar à mão"),
  TODECK: t("Escolha a carta para devolver ao Deck"),
  SUMMON: t("Escolha o monstro para Invocar por Invocação-Normal"),
  SPSUMMON: t("Escolha o monstro para Invocar por Invocação-Especial"),
  SET: t("Escolha a carta para baixar"),
  FMATERIAL: t("Escolha as matérias de Fusão"),
  SMATERIAL: t("Escolha as matérias de Sincro"),
  XMATERIAL: t("Escolha as matérias Xyz"),
  LMATERIAL: t("Escolha as matérias de Link"),
  FACEUP: t("Escolha uma carta com a face para cima"),
  FACEDOWN: t("Escolha uma carta com a face para baixo"),
  ATTACK: t("Escolha um monstro em Posição de Ataque"),
  DEFENSE: t("Escolha um monstro em Posição de Defesa"),
  EQUIP: t("Escolha a carta para equipar"),
  REMOVEXYZ: t("Escolha a matéria Xyz para desassociar"),
  DEATTACHFROM: t("Escolha de qual monstro desassociar a matéria"),
  ATTACH: t("Escolha a carta para anexar como matéria"),
  CONTROL: t("Escolha o monstro para controlar"),
  DESREPLACE: t("Escolha a carta para substituir a destruição"),
  CONFIRM: t("Escolha a carta para revelar"),
  TOFIELD: t("Escolha a carta para colocar no campo"),
  POSCHANGE: t("Escolha o monstro para mudar de posição"),
  SELF: t("Escolha uma das suas cartas"),
  OPPO: t("Escolha uma carta do oponente"),
  ATTACKTARGET: t("Escolha o alvo do ataque"),
  EFFECT: t("Escolha a carta do efeito"),
  TARGET: t("Escolha o alvo"),
  NEGATE: t("Escolha a carta para negar"),
  APPLYTO: t("Escolha a carta que recebe o efeito"),
  ATKDEF: t("Escolha o monstro"),
  RESOLVECARD: t("Escolha a carta a resolver"),
  RESOLVEEFFECT: t("Escolha o efeito a resolver"),
  OPTION: t("Escolha uma opção"),
  POSITION: t("Escolha a posição"),
  ZONE: t("Escolha a zona"),
  TOZONE: t("Escolha a zona de destino"),
  DISABLEZONE: t("Escolha a zona a desativar"),
  COUNTER: t("Escolha os marcadores"),
};

const ATRIBUTOS: [number, string][] = [
  [0x1, t("TERRA")],
  [0x2, t("ÁGUA")],
  [0x4, t("FOGO")],
  [0x8, t("VENTO")],
  [0x10, t("LUZ")],
  [0x20, t("TREVAS")],
  [0x40, t("DIVINO")],
];
const TIPOS_MONSTRO = [
  t("Guerreiro"), t("Mago"), t("Fada"), t("Demônio"), t("Zumbi"), t("Máquina"), t("Aqua"), t("Piro"), t("Rocha"), t("Besta Alada"), t("Planta"), t("Inseto"), t("Trovão"),
  t("Dragão"), t("Besta"), t("Besta-Guerreira"), t("Dinossauro"), t("Peixe"), t("Serpente Marinha"), t("Réptil"), t("Psíquico"), t("Besta Divina"), t("Deus Criador"), t("Wyrm"), t("Ciberso"), t("Ilusão"),
];

const QUEM_COMECA: { id: Config["primeiro"]; label: string }[] = [
  { id: "eu", label: t("Eu") },
  { id: "ia", label: t("IA") },
  { id: "sorteio", label: t("Sorteio") },
];

/** Artes das Fichas criadas pelo jogador: um dos 4 Sheep Token de Scapegoat */
const OVELHAS = [73915052, 73915053, 73915054, 73915055];
const nomeAtributo = (bits: number) => ATRIBUTOS.find(([b]) => b === bits)?.[1] ?? "";
const nomeTipo = (bits: number) => TIPOS_MONSTRO[Math.round(Math.log2(bits || 1))] ?? "";

const POSICOES: [number, string][] = [
  [1, t("Ataque")],
  [4, t("Defesa")],
  [8, t("Defesa, virada para baixo")],
  [2, t("Ataque, virada para baixo")],
];

interface Acao {
  rotulo: string;
  resp: OcgResponse;
}

/** Chave de uma carta no motor: dono, local e posição na zona */
const chave = (controller: number, location: number, sequence: number) => `${controller}:${location}:${sequence}`;
/** Chave da carta de uma escolha no tabuleiro: a matéria Xyz acende o monstro que a tem */
const chaveRef = (c: { controller: number; location: number; sequence: number }) => (c.location & L.OVERLAY ? chave(c.controller, L.MZONE, c.sequence) : chave(c.controller, c.location, c.sequence));
const virada = (pos: number) => (pos & 0xa) !== 0;

const CONFIG = "simulador-config";
interface Config {
  meu: string;
  ia: string;
  nivel: NivelIA;
  primeiro: "eu" | "ia" | "sorteio";
  /** pausar em todas as janelas de resposta (senão, só depois de uma jogada da IA) */
  todasJanelas?: boolean;
  /** contra a IA ou contra outra pessoa (partida 1x1) */
  modo?: "ia" | "amigo";
  /** "Escolher Cartas na Mão" antes do duelo (Premium) */
  escolherMao?: boolean;
  /** duelo único (1) ou match, melhor de 3 (3) */
  melhorDe?: 1 | 3;
}
function lerConfig(): Partial<Config> {
  try {
    return JSON.parse(localStorage.getItem(CONFIG) ?? "{}") as Partial<Config>;
  } catch {
    return {};
  }
}
function gravarConfig(c: Config) {
  try {
    localStorage.setItem(CONFIG, JSON.stringify(c));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

interface DeckOpcao {
  valor: string;
  nome: string;
  deck: DeckSim;
  /** Side Deck (só os decks do Editor de Deck têm): usado na troca entre os jogos de uma match */
  side: number[];
  linhas: LinhaIA[];
}

/** "Testar" de um combo contra a IA: quem começa com a mão do combo e o deck temporário dele */
export interface TesteCombo {
  deck: DeckTemporario;
  combo: ComboTeste;
  quem: QuemTemOCombo;
}

const ROTULO_TESTE: Record<QuemTemOCombo, string> = {
  eu: t("Teste Contra a IA (Eu Tenho o Combo)"),
  ia: t("Teste Contra a IA (A IA Tem o Combo)"),
  ambos: t("Teste Contra a IA (Ambos Temos o Combo)"),
};

/** Mão inicial do teste: as cartas que os passos pedem da mão (no máximo 5); o resto da mão sai do Deck ao acaso */
function maoDoTeste(combo: ComboTeste): number[] {
  const necessarias = maoDoRoteiro(combo.passos, combo.campo ?? { mao: [] });
  return (necessarias.length ? necessarias : combo.mao).slice(0, 5);
}

/** Cartas da mão que faltam no Deck principal (contando cópias) */
function faltando(main: number[], mao: number[]): number[] {
  const resto = [...main];
  return mao.filter((c) => {
    const i = resto.indexOf(c);
    if (i < 0) return true;
    resto.splice(i, 1);
    return false;
  });
}

export default function Simulador({
  onBack,
  duelo: dueloDaRota,
  replay: replayDaRota,
  onRota,
  testeCombo,
  treino = false,
}: {
  onBack: () => void;
  duelo?: string;
  /** código de um replay compartilhado (#/replay/<código>) */
  replay?: string;
  onRota?: (r: Rota) => void;
  testeCombo?: TesteCombo;
  /** Modo de Treino: só contra a IA, com combos possíveis e interações da carta na tela */
  treino?: boolean;
}) {
  const tituloTela = treino ? t("Modo de Treino") : t("Simulador");
  const conta = useConta();
  const db = useCardDb();
  const { decks } = useDecks();
  const byId = useMemo(() => {
    const m = new Map<number, Card>();
    for (const c of db.cards) for (const id of [c.id, ...c.images]) if (!m.has(id)) m.set(id, c);
    return m;
  }, [db.cards]);

  // decks: os seus (Editor de Deck) e os de torneio que o motor já jogou (camada: combos calculados)
  const opcoes = useMemo<DeckOpcao[]>(() => {
    const combos = db.extras?.combos;
    const linhas = combos?.linhas ?? [];
    const meus = decks
      .filter((d) => !d.temporario && d.main.length)
      .map((d) => {
        const ids = new Set(d.main);
        return { valor: `meu:${d.id}`, nome: d.nome, deck: { main: d.main, extra: d.extra }, side: d.side, linhas: linhas.filter((l) => l.mao.every((c) => ids.has(c))) };
      });
    const meta = (combos?.decks ?? []).flatMap((d, i) => {
      const lista = d.listas?.find((l) => l.formatos.includes("TCG")) ?? d.listas?.[0];
      if (!lista) return [];
      return [{ valor: `meta:${i}`, nome: `${d.nome}${d.evento ? ` · ${d.evento}` : ""}`, deck: { main: lista.main, extra: lista.extra }, side: [], linhas: linhas.filter((l) => l.deck === i) }];
    });
    // teste de combo: o deck temporário do combo, com as cópias que a mão do teste pede
    const doCombo = testeCombo
      ? [{ valor: "combo", nome: testeCombo.deck.nome, deck: { main: [...testeCombo.deck.main, ...faltando(testeCombo.deck.main, maoDoTeste(testeCombo.combo))], extra: testeCombo.deck.extra }, side: [], linhas: [] }]
      : [];
    return [...doCombo, ...meus, ...meta];
  }, [decks, db.extras?.combos, testeCombo]);

  // teste de combo: mão do combo e o deck sugerido para quem a tem (o que tem a mão toda e mais cartas do combo)
  const maoCombo = useMemo(() => (testeCombo ? maoDoTeste(testeCombo.combo) : []), [testeCombo]);
  const comboEu = !!testeCombo && testeCombo.quem !== "ia";
  const comboIA = !!testeCombo && testeCombo.quem !== "eu";
  const sugerido = useMemo(() => {
    if (!testeCombo) return undefined;
    const doCombo = new Set(testeCombo.combo.passos.flatMap((p) => (p.t === "compra" || p.t === "texto" ? p.c : [p.c])));
    const comMao = opcoes.filter((o) => o.valor !== "combo" && !faltando(o.deck.main, maoCombo).length);
    const nota = (o: DeckOpcao) => new Set([...o.deck.main, ...o.deck.extra].filter((c) => doCombo.has(c))).size;
    return comMao.sort((a, b) => nota(b) - nota(a))[0] ?? opcoes[0];
  }, [opcoes, testeCombo, maoCombo]);

  const salvo = useMemo(lerConfig, []);
  const [cfg, setCfg] = useState<Config>(() => ({
    meu: comboEu ? "" : (salvo.meu ?? ""),
    ia: comboIA ? "" : (salvo.ia ?? ""),
    nivel: salvo.nivel ?? "normal",
    primeiro: salvo.primeiro ?? "sorteio",
    todasJanelas: salvo.todasJanelas,
    escolherMao: salvo.escolherMao,
    modo: salvo.modo ?? "ia",
    melhorDe: salvo.melhorDe ?? 1,
  }));
  // match (melhor de 3): fora do teste de combo e do Modo de Treino
  const melhorDe3 = cfg.melhorDe === 3 && !testeCombo && !treino;
  const meu = opcoes.find((o) => o.valor === cfg.meu) ?? (comboEu ? sugerido : undefined) ?? opcoes.find((o) => o.valor !== "combo") ?? opcoes[0];
  const doIA = opcoes.find((o) => o.valor === cfg.ia) ?? (comboIA ? sugerido : undefined) ?? opcoes.find((o) => o.valor.startsWith("meta:")) ?? opcoes[0];

  const [etapa, setEtapaEstado] = useState<"config" | "carregando" | "sala" | "mao" | "duelo" | "side">("config");
  const etapaRef = useRef(etapa);
  const setEtapa = (e: typeof etapa) => {
    etapaRef.current = e;
    setEtapaEstado(e);
  };
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [pensando, setPensando] = useState(false);
  const [registro, setRegistro] = useState<EventoSim[]>([]);
  const [eu, setEuEstado] = useState<0 | 1>(0);
  const euRef = useRef<0 | 1>(0);
  const setEu = (v: 0 | 1) => {
    euRef.current = v;
    setEuEstado(v);
  };
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<number | null>(null);
  // menu de ações ancorado na carta clicada (esquerda, topo e base dela na tela)
  const [menu, setMenu] = useState<{ x: number; topo: number; base: number; acoes: Acao[] } | null>(null);
  const [lista, setLista] = useState<{ titulo: string; cartas: { c: CartaSim; k: string; oculta: boolean }[] } | null>(null);
  const [sair, setSair] = useState(false);
  // cartas marcadas na escolha em aberto (índices da mensagem) e carta em foco (opção sob o mouse)
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [foco, setFoco] = useState<string | null>(null);
  // Deck embaralhado agora há pouco (por jogador), para o aviso na pilha
  const [embaralhando, setEmbaralhando] = useState<[boolean, boolean]>([false, false]);
  const timerEmbaralho = useRef<number[]>([]);
  // ativações: a cadeia atual (ou a última, já resolvida), para mostrar abaixo dos PV
  // (com os alvos e o nome declarado de cada elo)
  const [ativacoes, setAtivacoes] = useState<{ itens: (Extract<EventoSim, { t: "ativa" }> & { resolvida?: boolean; alvos?: Extract<EventoSim, { t: "alvo" }>["cartas"]; declarado?: number })[]; aberta: boolean }>({ itens: [], aberta: false });
  // tela dos replays (aberta pelo botão "Replays" no topo da configuração)
  const [replaysAberto, setReplaysAberto] = useState(false);
  // chat abaixo do Registro (assistente contra a IA; oponente na partida 1x1)
  const [chatAberto, setChatAberto] = useState(false);
  const [chatOponente, setChatOponente] = useState<MensagemOponente[]>([]);
  // Modo de Treino: jogada sugerida pela IA (pedida pelo jogador)
  const [sugestao, setSugestao] = useState<SugestaoTreino | null>(null);
  // Modo de Treino: guia de combo (botão "Combos"), como no Teste de Jogo
  const [guia, setGuia] = useState<EstadoGuia | null>(null);
  const [escolhendoCombo, setEscolhendoCombo] = useState(false);
  const combosDeck = useMemo(
    () => (treino ? combosDoDeck(db.extras?.combos, (meu?.deck.main ?? []).map((id) => byId.get(id)?.id ?? id)) : []),
    [treino, db.extras?.combos, meu?.deck.main, byId],
  );
  // cartas mostradas ao jogador (ex.: a mão do oponente)
  const [revelacao, setRevelacao] = useState<{ code: number; controller: number; location: number }[] | null>(null);
  const cliente = useRef<ClienteSim | null>(null);
  const versaoMotor = useRef<string>("");
  // partida 1x1: a sala, o nome do oponente, a sala de outra pessoa para entrar e o fim fora do motor
  const [sala, setSalaEstado] = useState<Duelo | null>(null);
  const salaRef = useRef<Duelo | null>(null);
  const setSala = (d: Duelo | null) => {
    salaRef.current = d;
    setSalaEstado(d);
  };
  const [nomeOp, setNomeOp] = useState<string | null>(null);
  const [convite, setConvite] = useState<{ duelo: Duelo; criador: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  // o servidor tem as partidas 1x1? (null = conferindo)
  const [servidorPvp, setServidorPvp] = useState<boolean | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [desistencia, setDesistencia] = useState<{ vencedor: number | null; quem: "eu" | "oponente" } | null>(null);
  const [confirmarDesistir, setConfirmarDesistir] = useState(false);
  // match contra a IA: o deck original (com o Side), o deck do jogo atual, os jogos já encerrados e
  // quem começou o jogo 1 (escolhe de novo se ele empatar)
  const [matchIA, setMatchIA] = useState<{ original: DeckMatch; atual: DeckMatch; resultados: ResultadoJogo[]; inicial: Lado; abandonada?: boolean } | null>(null);
  // match na partida 1x1: a linha do banco (placar, quem escolhe, sala do jogo atual)
  const [matchPvp, setMatchPvpEstado] = useState<Match | null>(null);
  const matchPvpRef = useRef<Match | null>(null);
  const setMatchPvp = (m: Match | null) => {
    matchPvpRef.current = m;
    setMatchPvpEstado(m);
  };
  const pararMatch = useRef<(() => void) | null>(null);
  // troca de side entre os jogos: o deck sendo montado, quem começa (se for a sua escolha) e se já foi enviado
  const [side, setSide] = useState<{ deck: DeckMatch; primeiro: Lado | null; enviado?: boolean } | null>(null);
  const [confirmarAbandono, setConfirmarAbandono] = useState(false);
  // o que o duelo ensinou (fica só neste aparelho nesta etapa)
  const [aprendido, setAprendido] = useState<Aprendizado | null>(null);
  // "Análise da IA" de um duelo (chave: "fim" ou a data do replay)
  const [analise, setAnalise] = useState<{ chave: string; status: "analisando" | "ok" | "erro"; dados?: AnaliseDuelo; erro?: string } | null>(null);
  // partida em andamento (decks e semente), para o "?" listar as cartas de cada um
  const partidaRef = useRef<ConfigSessao["partida"] | null>(null);
  // nomes e decks da partida em andamento, para a lista de replays
  const rotulosRef = useRef<RotulosReplay | undefined>(undefined);
  const premium = temPremium(conta);
  // "Escolher Cartas na Mão" (Premium): contra a IA, as duas mãos (null = Aleatório); no 1x1, a sua
  const escolherMao = premium && !!cfg.escolherMao && !testeCombo && !melhorDe3;
  const [maos, setMaos] = useState<{ eu: number[] | null; ia: number[] | null }>({ eu: null, ia: null });
  // janela "Escolher Cartas na Mão" (contra a IA) aberta
  const [janelaMao, setJanelaMao] = useState(false);
  const [maoPvp, setMaoPvp] = useState<number[] | null>([]);
  const limiteReplays = premium ? REPLAYS_PREMIUM : REPLAYS_GRATIS;
  const [avisoReplay, setAvisoReplay] = useState<string | null>(null);
  // revisão: a partida refeita, os momentos (um por resposta) e o momento mostrado
  const [revisao, setRevisao] = useState<{
    cfg: ConfigSessao;
    momentos: Momento[];
    k: number;
    oponente: string;
    /** replay recebido por link: o duelo (para guardar), quem compartilhou e o aviso de versão das regras */
    recebido?: { d: DueloGuardado; jogador: string; aviso?: string; salvo?: boolean };
    /** decisões da IA com o motivo de cada uma (apresentação IA x IA e replays contra a IA) */
    decisoes?: DecisaoIA[];
    /** nome do lado de baixo, quando não é "Você" (IA x IA) */
    jogador?: string;
  } | null>(null);
  // revisão: reprodução automática (decisão a decisão) e a lista com todas as decisões, não só as jogadas
  const [reproduzindo, setReproduzindo] = useState(false);
  const [todasDecisoes, setTodasDecisoes] = useState(false);
  useEffect(() => {
    const r = revisao;
    if (!reproduzindo || !r) return;
    // vai até logo depois da próxima jogada da IA (o motivo dela aparece no painel)
    const prox = r.decisoes?.find((x) => x.relevante && x.n + 1 > r.k);
    const alvo = prox ? prox.n + 1 : r.k + 1;
    if (alvo > r.momentos.length - 1) {
      setReproduzindo(false);
      return;
    }
    const id = window.setTimeout(() => void irPara(alvo), 1400);
    return () => window.clearTimeout(id);
  }, [reproduzindo, revisao?.k]); // eslint-disable-line react-hooks/exhaustive-deps
  const revisaoRef = useRef(revisao);
  revisaoRef.current = revisao;
  // "?": pergunta aberta (de quem é a carta, qual carta) e a resposta
  const [pergunta, setPergunta] = useState<{ jogador: number; code: number | null; resposta: Explicacao | null; carregando: boolean } | null>(null);
  // "Criar Token": painel aberto e os dados da Ficha
  const [ficha, setFicha] = useState<{ nivel: number; atributo: number; raca: number; atk: number; def: number; posicao: 1 | 4; sequencia: number } | null>(null);
  // cartas mudando de lugar (0,3 s): de onde para onde na tela
  const [voos, setVoos] = useState<{ id: number; code: number; oculta: boolean; de: { x: number; y: number }; para: { x: number; y: number } }[]>([]);
  const idVoo = useRef(0);
  // compra animada: quantas cartas cada jogador acabou de comprar (as últimas da mão)
  const [comprando, setComprando] = useState<[number, number]>([0, 0]);
  const timerCompra = useRef<number[]>([]);
  // dado: valor mostrado (rolando por 2 s antes do resultado)
  const [dado, setDado] = useState<{ valor: number; rolando: boolean } | null>(null);
  // partidas para revisar: guardadas neste aparelho e 1x1 do servidor
  const [recentes, setRecentes] = useState<{ locais: DueloGuardado[]; servidor: Duelo[] }>({ locais: [], servidor: [] });
  const pararSala = useRef<(() => void) | null>(null);
  // maior posição do histórico já vista no banco (para buscar só as jogadas novas)
  const ultimaN = useRef(-1);
  // jogadas do oponente que chegam antes de o duelo começar neste aparelho
  const remotasAntes = useRef<{ n: number; resp: Jogada }[] | null>(null);
  // envio das jogadas em ordem (o banco só aceita a próxima posição)
  const filaEnvio = useRef<Promise<void>>(Promise.resolve());
  const fimEnviado = useRef(false);
  const desistenciaRef = useRef(desistencia);
  desistenciaRef.current = desistencia;
  const quadroRef = useRef<Quadro | null>(null);

  useEffect(
    () => () => {
      cliente.current?.encerrar();
      pararSala.current?.();
      pararMatch.current?.();
      // sala aberta e ninguém entrou: sair cancela
      const d = salaRef.current;
      if (d?.estado === "aguardando") void encerrarDuelo(d.id, null).catch(() => {});
    },
    [],
  );

  const nomeDe = (code: number) => {
    const c = byId.get(code);
    return c ? displayName(c) : nomes[code] ?? `#${code}`;
  };

  /** Baixa (se preciso) e abre o motor num Worker novo; devolve o cliente pronto */
  async function prepararMotor(deck?: DeckSim): Promise<ClienteSim> {
    const dados = await obterPacote(setProgresso);
    cliente.current?.encerrar();
    const c = new ClienteSim(receber, (msg) => setErro(msg));
    cliente.current = c;
    setProgresso(t("Abrindo o motor de regras…"));
    const { nomes: n, versao } = await c.carregar(dados);
    versaoMotor.current = versao;
    setNomes(n);
    // cartas que o motor não tem ficam de fora do duelo
    const fora = deck ? [...deck.main, ...deck.extra].filter((id) => !(id in n)) : [];
    setAviso(fora.length ? t("{0} carta(s) do seu deck ainda não existem no motor e ficaram de fora: {1}.", [fora.length, [...new Set(fora)].map(nomeDe).join(", ")]) : null);
    return c;
  }

  /** Zera o que é de um duelo (registro, cadeia, revelações, fim) antes de começar outro */
  function limparDuelo() {
    setRegistro([]);
    setAtivacoes({ itens: [], aberta: false });
    setRevelacao(null);
    setQuadro(null);
    setDesistencia(null);
    setAprendido(null);
    setGuia(null);
    setSugestao(null);
    setChatOponente([]);
    fimEnviado.current = false;
  }

  /** Modo de Treino: a IA joga pelo jogador a partir de agora até o fim do turno e mostra os passos */
  function pedirJogada() {
    const c = cliente.current;
    if (!c) return;
    setSugestao({ estado: "pensando" });
    c.sugerir(meu?.linhas ?? [])
      .then((passos) => setSugestao({ estado: "pronta", passos }))
      .catch((e) => setSugestao({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }));
  }

  const falhou = (e: unknown) => {
    setErro(e instanceof Error ? e.message : String(e));
    setEtapa("config");
  };

  /**
   * Começa o duelo contra a IA. Sem `jogo`, é um duelo novo (o jogo 1, na match); com ele, o próximo
   * jogo da match: o deck com o side trocado e quem começa, escolhido pelo perdedor do anterior.
   */
  async function iniciar(jogo?: { deck: DeckSim; humano: 0 | 1 }) {
    if (!meu || !doIA) return;
    gravarConfig({ ...cfg, meu: meu.valor, ia: doIA.valor });
    setEtapa("carregando");
    setErro(null);
    pararSala.current?.();
    setSala(null);
    const meuDeck = jogo?.deck ?? meu.deck;
    try {
      // teste de combo: o deck de quem tem o combo precisa ter as cartas da mão dele
      const nome = (id: number) => (byId.get(id) ? displayName(byId.get(id)!) : `#${id}`);
      for (const [tem, o] of [[comboEu, meu], [comboIA, doIA]] as const) {
        const falta = tem ? faltando(o.deck.main, maoCombo) : [];
        if (falta.length) throw new Error(t("O deck {0} não tem estas cartas da mão do combo: {1}", [o.nome, falta.map(nome).join(", ")]));
      }
      const c = await prepararMotor(meuDeck);
      // no teste de combo, quem tem o combo começa (com os dois, a IA)
      const humano = jogo ? jogo.humano : testeCombo ? (testeCombo.quem === "eu" ? 0 : 1) : cfg.primeiro === "eu" ? 0 : cfg.primeiro === "ia" ? 1 : (aleatorio(2) as 0 | 1);
      // match nova: guarda o deck original (com o Side) para as trocas entre os jogos
      if (!jogo) {
        const completo: DeckMatch = { main: [...meu.deck.main], extra: [...meu.deck.extra], side: [...meu.side] };
        setMatchIA(melhorDe3 ? { original: completo, atual: completo, resultados: [], inicial: humano === 0 ? "eu" : "op" } : null);
      }
      // o motor sempre dá o primeiro turno ao jogador 0
      const par: [DeckSim, DeckSim] = humano === 0 ? [meuDeck, doIA.deck] : [doIA.deck, meuDeck];
      const semente = Array.from(crypto.getRandomValues(new Uint32Array(4)), String) as [string, string, string, string];
      // mãos fixas: a do combo (teste de combo) ou as escolhidas (Aleatório = sem mão fixa)
      const mao = { eu: comboEu ? maoCombo : escolherMao ? (maos.eu ?? []) : [], ia: comboIA ? maoCombo : escolherMao ? (maos.ia ?? []) : [] };
      const fixas = mao.eu.length > 0 || mao.ia.length > 0;
      const partida: Partida = { decks: par, semente, ...(fixas ? { maos: (humano === 0 ? [mao.eu, mao.ia] : [mao.ia, mao.eu]) as [number[], number[]] } : {}) };
      setEu(humano);
      limparDuelo();
      setPensando(true);
      setEtapa("duelo");
      partidaRef.current = partida;
      rotulosRef.current = { eu: conta?.usuario || t("Você"), oponente: t("IA"), meuDeck: meu.nome, deckOponente: doIA.nome };
      // o que as análises dos duelos anteriores ensinaram sobre o valor das cartas
      const aprendidos = await lerValoresAprendidos().catch(() => ({}));
      c.iniciar({ partida, humano, nivel: cfg.nivel, linhas: doIA.linhas, aprendidos, roteiro: comboIA ? testeCombo!.combo.passos : undefined, janelas: cfg.todasJanelas ? "todas" : "acao" });
    } catch (e) {
      falhou(e);
    }
  }

  // ---------- partida 1x1 ----------

  /** Mudança na sala (pelo tempo real ou pela conferência periódica) */
  function aoMudarSala(d: Duelo, novo: Duelo) {
    setSala({ ...(salaRef.current ?? d), ...novo });
    if (novo.estado === "em-andamento" && etapaRef.current === "sala") void comecarPvp(novo);
    // escolha das mãos: o duelo começa quando os dois deram "Pronto"
    if (etapaRef.current === "mao" && !faltaMao(novo)) void comecarPvp(novo);
    // o oponente desistiu ou saiu: o duelo acaba aqui também
    if (novo.estado === "encerrado" && etapaRef.current === "duelo" && !quadroRef.current?.fim && !desistenciaRef.current) setDesistencia({ vencedor: novo.vencedor, quem: "oponente" });
  }

  /** Jogada gravada no banco (as deste aparelho e as repetidas não mudam nada) */
  function aoReceberJogada(n: number, jogador: 0 | 1, resp: Jogada) {
    ultimaN.current = Math.max(ultimaN.current, n);
    if (jogador === euRef.current) return;
    if (remotasAntes.current) remotasAntes.current.push({ n, resp });
    else cliente.current?.remota(n, resp);
  }

  /**
   * Acompanha a sala: entrada do oponente, fim ou desistência, e as jogadas dele. Pelo tempo real
   * do Supabase e, se ele falhar ou atrasar, conferindo o banco a cada 2 segundos.
   */
  function acompanhar(d: Duelo) {
    pararSala.current?.();
    const pararTempoReal = assinarDuelo(d.id, {
      duelo: (novo) => aoMudarSala(d, novo),
      resposta: aoReceberJogada,
      chat: (jogador, texto) => jogador !== euRef.current && setChatOponente((m) => [...m, { minha: false, texto }].slice(-100)),
    });
    let conferindo = false;
    const conferir = async () => {
      if (conferindo || salaRef.current?.id !== d.id) return;
      conferindo = true;
      try {
        const novo = await obterDuelo(d.id);
        if (novo && (novo.estado !== salaRef.current?.estado || etapaRef.current === "sala" || etapaRef.current === "mao")) aoMudarSala(d, novo);
        // jogadas novas do oponente (só quando o duelo espera por ele)
        if (etapaRef.current === "duelo" && !remotasAntes.current && quadroRef.current?.aguardando)
          for (const r of await respostasDoDuelo(d.id, ultimaN.current)) aoReceberJogada(r.n, r.jogador, r.resp);
      } catch {
        // sem rede agora: tenta de novo na próxima
      } finally {
        conferindo = false;
      }
    };
    const timer = window.setInterval(() => void conferir(), 2000);
    pararSala.current = () => {
      pararTempoReal();
      window.clearInterval(timer);
    };
  }

  /** Começa (ou retoma, depois de cair) o duelo 1x1 com a sala já com os dois jogadores */
  async function comecarPvp(d: Duelo) {
    if (!conta) return;
    // jogo de uma match: acompanha o placar e o preparo do próximo jogo
    if (d.match) {
      if (matchPvpRef.current?.id !== d.match || !pararMatch.current)
        void obterMatch(d.match)
          .then((m) => m && acompanharMatch(m))
          .catch(() => {});
    } else if (matchPvpRef.current) {
      pararMatch.current?.();
      pararMatch.current = null;
      setMatchPvp(null);
    }
    setSide(null);
    // "Escolher Cartas na Mão": antes do duelo, cada um escolhe a própria mão e dá "Pronto"
    if (faltaMao(d)) {
      setSala(d);
      setConvite(null);
      setErro(null);
      acompanhar(d);
      setMaoPvp([]);
      setEtapa("mao");
      return;
    }
    setEtapa("carregando");
    setErro(null);
    try {
      remotasAntes.current = [];
      acompanhar(d);
      const c = cliente.current && versaoMotor.current ? cliente.current : await prepararMotor();
      if (versaoMotor.current !== d.versao_motor) throw new Error(t("O motor de regras deste aparelho é diferente do da sala. Abram o Simulador de novo para os dois baixarem o mais recente."));
      if (APP_VERSION !== d.versao_app) throw new Error(t("Versões diferentes do app (sala: {0}, sua: {1}). Atualizem para a mesma versão.", [d.versao_app, APP_VERSION]));
      const historico = await respostasDoDuelo(d.id);
      ultimaN.current = historico.length ? historico[historico.length - 1].n : -1;
      const humano = meuJogador(d, conta.id);
      const outro = d.criador === conta.id ? d.convidado : d.criador;
      if (outro) void nomesDeUsuarios([outro]).then((n) => setNomeOp(n[outro] ?? null));
      setEu(humano);
      setSala(d);
      setConvite(null);
      limparDuelo();
      setPensando(true);
      setEtapa("duelo");
      partidaRef.current = partidaDoDuelo(d);
      rotulosRef.current = { eu: conta.usuario || t("Você"), oponente: t("Oponente"), meuDeck: meu?.nome ?? t("seu deck"), deckOponente: t("deck do oponente") };
      if (outro) void nomesDeUsuarios([outro]).then((n) => rotulosRef.current && n[outro] && (rotulosRef.current = { ...rotulosRef.current, oponente: n[outro], deckOponente: t("deck de {0}", [n[outro]]) }));
      c.iniciar({ partida: partidaDoDuelo(d), humano, nivel: "normal", remoto: true, historico: historico.map((h) => h.resp), janelas: cfg.todasJanelas ? "todas" : "acao" });
      // jogadas que chegaram enquanto o duelo era montado (as repetidas o motor ignora)
      for (const r of remotasAntes.current ?? []) c.remota(r.n, r.resp);
      remotasAntes.current = null;
    } catch (e) {
      remotasAntes.current = null;
      falhou(e);
    }
  }

  /** Cria a sala com o seu deck e espera o oponente entrar pelo link */
  async function criarSala() {
    if (!meu || !conta) return;
    gravarConfig({ ...cfg, meu: meu.valor, ia: doIA?.valor ?? cfg.ia });
    setEtapa("carregando");
    setErro(null);
    try {
      await prepararMotor(meu.deck);
      let d: Duelo;
      if (melhorDe3) {
        // match: o deck vai com o Side, para as trocas entre os jogos
        const r = await criarMatch({ ...meu.deck, side: meu.side }, versaoMotor.current, APP_VERSION);
        acompanharMatch(r.match);
        d = r.duelo;
      } else {
        pararMatch.current?.();
        pararMatch.current = null;
        setMatchPvp(null);
        d = await criarDuelo(meu.deck, versaoMotor.current, APP_VERSION, escolherMao);
      }
      setSala(d);
      acompanhar(d);
      setCopiado(false);
      setEtapa("sala");
      onRota?.({ tela: "simulador", duelo: d.id });
    } catch (e) {
      falhou(e);
    }
  }

  /** "Pronto" da escolha das mãos (sala 1x1): grava a mão; com as duas, o duelo começa */
  async function prontoPvp() {
    const d = salaRef.current;
    if (!d) return;
    setErro(null);
    try {
      aoMudarSala(d, await definirMao(d.id, maoPvp ?? []));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  /** Entra na sala de outra pessoa com o seu deck */
  async function entrarSala(d: Duelo) {
    if (!meu || !conta) return;
    gravarConfig({ ...cfg, meu: meu.valor, ia: doIA?.valor ?? cfg.ia });
    setEtapa("carregando");
    setErro(null);
    try {
      await prepararMotor(meu.deck);
      // sala de uma match: o deck vai com o Side, para as trocas entre os jogos
      const novo = await entrarDuelo(d.id, d.match ? { ...meu.deck, side: meu.side } : meu.deck, versaoMotor.current, APP_VERSION);
      await comecarPvp(novo);
    } catch (e) {
      falhou(e);
    }
  }

  /** Abre a sala do link: entrar, esperar o oponente (sua sala) ou voltar a um duelo em andamento */
  async function abrirSala(id: string) {
    setCfg((c) => ({ ...c, modo: "amigo" }));
    if (!conta) return setErro(t("Entre na sua conta para duelar com um amigo."));
    setErro(null);
    try {
      const d = await obterDuelo(id);
      if (!d) throw new Error(t("Sala não encontrada (ou você não participa dela)."));
      const participo = conta.id === d.criador || conta.id === d.convidado;
      if (d.estado === "encerrado") {
        // jogo encerrado de uma match em andamento: vai ao jogo atual ou volta à troca de side
        const m = d.match && participo ? await obterMatch(d.match) : null;
        if (!m || m.estado === "encerrado") throw new Error(t("Esta partida já terminou."));
        if (m.duelo_atual && m.duelo_atual !== d.id) return void (await abrirSala(m.duelo_atual));
        const outro = d.criador === conta.id ? d.convidado : d.criador;
        if (outro) void nomesDeUsuarios([outro]).then((n) => setNomeOp(n[outro] ?? null));
        setEu(meuJogador(d, conta.id));
        setSala(d);
        acompanharMatch(m);
        setSide({ deck: comSide(d.criador === conta.id ? d.deck_criador : d.deck_convidado), primeiro: null, enviado: (papelNaMatch(m, conta.id) === "criador" ? m.prox_deck_criador : m.prox_deck_convidado) !== null });
        setEtapa("side");
        return;
      }
      if (d.estado === "em-andamento") {
        if (!participo) throw new Error(t("Esta partida já começou com outros jogadores."));
        return void comecarPvp(d);
      }
      if (d.criador === conta.id) {
        setSala(d);
        acompanhar(d);
        if (d.match)
          void obterMatch(d.match)
            .then((m) => m && acompanharMatch(m))
            .catch(() => {});
        setEtapa("sala");
        return;
      }
      const n = await nomesDeUsuarios([d.criador]);
      setConvite({ duelo: d, criador: n[d.criador] ?? t("um jogador") });
    } catch (e) {
      falhou(e);
    }
  }

  // modo amigo com a conta aberta: confere uma vez se o servidor já tem as partidas
  useEffect(() => {
    if ((cfg.modo === "amigo" || dueloDaRota) && conta && servidorPvp === null)
      void partidasAtivas()
        .then(setServidorPvp)
        .catch(() => setServidorPvp(true));
  }, [cfg.modo, dueloDaRota, conta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Abre a sala digitada: código de 6 dígitos (busca a sala aguardando) ou link */
  async function abrirPorCodigo() {
    setErro(null);
    try {
      let id = idDaSala(codigo);
      const numero = codigoDaSala(codigo);
      if (!id && numero) {
        const d = await obterDueloPorCodigo(numero);
        if (!d) throw new Error(t("Nenhuma sala aguardando oponente com esse código (as salas valem por 4 horas)."));
        id = d.id;
      }
      if (!id) return;
      onRota?.({ tela: "simulador", duelo: id });
      await abrirSala(id);
    } catch (e) {
      falhou(e);
    }
  }

  // link de sala aberto (#/duelo/<id>): espera a conta carregar
  useEffect(() => {
    if (dueloDaRota && etapaRef.current !== "duelo" && salaRef.current?.id !== dueloDaRota) void abrirSala(dueloDaRota);
  }, [dueloDaRota, conta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // link de replay compartilhado (#/replay/<código>): abre na revisão, sem precisar de conta
  const replayAberto = useRef<string | null>(null);
  useEffect(() => {
    if (!replayDaRota || replayAberto.current === replayDaRota || etapaRef.current === "duelo") return;
    replayAberto.current = replayDaRota;
    void (async () => {
      setErro(null);
      setEtapa("carregando");
      try {
        const d = await obterReplay(replayDaRota);
        if (!d) throw new Error(t("Este link de replay não existe ou já venceu (os links valem por 10 dias)."));
        await abrirRevisao({ partida: d.partida, humano: d.humano, nivel: "normal", historico: d.historico }, d.rotulos?.oponente ?? (d.remoto ? t("Oponente") : t("IA")), d);
      } catch (e) {
        falhou(e);
      }
    })();
  }, [replayDaRota]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Guarda neste aparelho o que o duelo ensinou e mostra no fim */
  function registrarAprendizado(a: Aprendizado) {
    setAprendido(a);
    void guardarAprendizado(a, versaoMotor.current, APP_VERSION, limiteReplays, rotulosRef.current).catch(() => {});
  }

  // ---------- revisão e "?" ----------

  /** Abre a revisão de uma partida (refeita no motor a partir das respostas) */
  /**
   * "Análise da IA" (fim do duelo ou replay contra a IA): ela refaz a partida, aponta o que decidiu o
   * duelo e testa as escolhas melhores; os ganhos viram valor aprendido para os próximos duelos
   */
  async function analisar(d: Pick<ConfigSessao, "partida" | "humano"> & { historico: Jogada[] }, chave: string) {
    setAnalise({ chave, status: "analisando" });
    try {
      const c = cliente.current && versaoMotor.current ? cliente.current : await prepararMotor();
      const ids = new Set(d.partida.decks[1 - d.humano].main);
      const linhas = (db.extras?.combos?.linhas ?? []).filter((l) => l.mao.every((x) => ids.has(x)));
      const dados = await c.analisar({ partida: d.partida, humano: d.humano, historico: d.historico, linhas, aprendidos: await lerValoresAprendidos().catch(() => ({})) });
      await aprenderValores(dados.aprender).catch(() => {});
      setAnalise({ chave, status: "ok", dados });
    } catch (e) {
      setAnalise({ chave, status: "erro", erro: e instanceof Error ? e.message : String(e) });
    }
  }

  async function abrirRevisao(cfg: ConfigSessao, oponente: string, recebido?: DueloGuardado, extra: { decisoes?: DecisaoIA[]; jogador?: string } = {}) {
    setReproduzindo(false);
    setReplaysAberto(false);
    setErro(null);
    setEtapa("carregando");
    try {
      const c = cliente.current && versaoMotor.current ? cliente.current : await prepararMotor();
      const momentos = await c.linhaDoTempo(cfg);
      setEu(cfg.humano);
      partidaRef.current = cfg.partida;
      setPergunta(null);
      const deLink = recebido && {
        d: recebido,
        jogador: recebido.rotulos?.eu || t("Jogador"),
        // as regras mudaram desde o duelo: o replay pode seguir outro caminho
        aviso: recebido.versaoMotor !== versaoMotor.current ? t("Este replay foi gravado com outra versão das regras do motor: a partir de algum lance, ele pode não repetir o duelo original.") : undefined,
      };
      const decisoes = extra.decisoes ?? recebido?.decisoes;
      // IA x IA: começa do início, para a apresentação
      const k = extra.jogador ? 0 : momentos.length - 1;
      setRevisao({ cfg, momentos, k, oponente, ...(deLink ? { recebido: deLink } : {}), ...(decisoes?.length ? { decisoes } : {}), ...(extra.jogador ? { jogador: extra.jogador } : {}) });
      await irPara(k, cfg);
      setEtapa("duelo");
    } catch (e) {
      falhou(e);
    }
  }

  /** Mostra o momento k da revisão */
  async function irPara(k: number, cfg = revisaoRef.current?.cfg) {
    if (!cfg || !cliente.current) return;
    const { quadro: q } = await cliente.current.momento(cfg, k);
    setRevisao((r) => (r ? { ...r, k } : r));
    setQuadro(q);
    quadroRef.current = q;
    setRegistro(q.eventos.slice(-400));
    setAtivacoes({ itens: [], aberta: false });
    setPensando(false);
  }

  /** Apresentação IA x IA (administrador): as duas IAs jogam o duelo inteiro; o resultado abre na revisão */
  async function iniciarIaXIa() {
    if (!meu || !doIA) return;
    gravarConfig({ ...cfg, meu: meu.valor, ia: doIA.valor });
    setEtapa("carregando");
    setErro(null);
    try {
      const c = await prepararMotor(meu.deck);
      const humano = cfg.primeiro === "eu" ? 0 : cfg.primeiro === "ia" ? 1 : (aleatorio(2) as 0 | 1);
      const par: [DeckSim, DeckSim] = humano === 0 ? [meu.deck, doIA.deck] : [doIA.deck, meu.deck];
      const semente = Array.from(crypto.getRandomValues(new Uint32Array(4)), String) as [string, string, string, string];
      const partida: Partida = { decks: par, semente };
      const nivel: NivelIA = cfg.nivel === "passiva" ? "normal" : cfg.nivel;
      const aprendidos = await lerValoresAprendidos().catch(() => ({}));
      setProgresso(t("As duas IAs estão duelando (pode levar alguns minutos)…"));
      const { aprendizado } = await c.iaxia({ partida, humano, nivel, linhas: doIA.linhas, aprendidos, iaNoHumano: { nivel, linhas: meu.linhas, aprendidos }, ateTurno: 20, janelas: "todas" });
      const rotulos = { eu: t("IA ({0})", [meu.nome]), oponente: t("IA ({0})", [doIA.nome]), meuDeck: meu.nome, deckOponente: doIA.nome };
      // fica nos replays, com o motivo de cada decisão (o Exportar leva tudo)
      await guardarAprendizado(aprendizado, versaoMotor.current, APP_VERSION, limiteReplays, rotulos).catch(() => {});
      await abrirRevisao({ partida, humano, nivel, historico: aprendizado.historico }, rotulos.oponente, undefined, { decisoes: aprendizado.decisoes, jogador: rotulos.eu });
    } catch (e) {
      falhou(e);
    }
  }

  function sairRevisao() {
    setReproduzindo(false);
    if (revisaoRef.current?.recebido && replayDaRota) onRota?.({ tela: "simulador" });
    setRevisao(null);
    setPergunta(null);
    setQuadro(null);
    setEtapa("config");
  }

  /** "?": pergunta ao motor por que o jogador não pôde usar a carta (no duelo ou no momento da revisão) */
  async function perguntar(jogador: number, code: number) {
    const c = cliente.current;
    if (!c) return;
    setPergunta({ jogador, code, resposta: null, carregando: true });
    try {
      const r = revisaoRef.current;
      let k = r?.k;
      if (r) {
        // a Main Phase do jogador no mesmo turno (antes do momento, ou logo depois) é quando ele poderia agir
        const turno = r.momentos[r.k]?.turno;
        const main = (m: Momento) => m.turno === turno && m.decisao?.jogador === jogador && m.decisao.tipo === T.SELECT_IDLECMD;
        // primeiro a próxima Main Phase dele (o campo como você está vendo, depois do que estiver resolvendo); sem ela, a anterior
        let j = r.k;
        while (j < r.momentos.length && !main(r.momentos[j])) j++;
        if (j >= r.momentos.length) {
          j = r.k;
          while (j >= 0 && !main(r.momentos[j])) j--;
        }
        if (j >= 0 && j < r.momentos.length) k = j;
      }
      const fatos = await c.fatos(code, jogador, r?.cfg, k);
      const nomeJ = jogador === euRef.current ? t("Você") : (r ? r.oponente : salaRef.current ? (nomeOp ?? t("Oponente")) : t("IA"));
      const nomeO = jogador === euRef.current ? (r ? r.oponente : salaRef.current ? (nomeOp ?? t("Oponente")) : t("IA")) : t("você");
      const resposta = explicarPorque(fatos, { carta: byId.get(code), code, nomeDe, cartaDe: (x) => byId.get(x), jogador: nomeJ, outro: nomeO, numeroJogador: jogador });
      if (r && k !== r.k) resposta.itens.unshift(t("Analisado no momento em que {0} tinha a ação neste turno (Main Phase).", [nomeJ]));
      setPergunta({ jogador, code, resposta, carregando: false });
    } catch (e) {
      setPergunta({ jogador, code, resposta: { conclusao: e instanceof Error ? e.message : String(e), itens: [] }, carregando: false });
    }
  }

  /** Joga um dado: 0,5 s de animação e o resultado vai para o registro */
  function jogarDado() {
    if (dado?.rolando) return;
    const sorteio = () => 1 + aleatorio(6);
    setDado({ valor: sorteio(), rolando: true });
    const giro = window.setInterval(() => setDado((d) => (d?.rolando ? { ...d, valor: sorteio() } : d)), 60);
    window.setTimeout(() => {
      window.clearInterval(giro);
      const valor = sorteio();
      setDado({ valor, rolando: false });
      setRegistro((r) => [...r, { t: "dado", p: euRef.current, v: valor } as EventoSim].slice(-400));
      window.setTimeout(() => setDado((d) => (d && !d.rolando ? null : d)), 1500);
    }, 500);
  }

  /** "Criar Token": Ficha com os dados escolhidos na primeira Zona de Monstros livre */
  function criarFicha() {
    if (!ficha) return;
    setFicha(null);
    setPensando(true);
    setQuadro((q) => (q ? { ...q, pedido: null } : q));
    cliente.current?.criarFicha({ nome: "Token", ...ficha });

  }

  // partidas para revisar (na tela de configuração)
  useEffect(() => {
    if (etapa !== "config") return;
    void listarAprendizado().then((locais) => setRecentes((r) => ({ ...r, locais: locais.slice(-limiteReplays).reverse() })));
    if (conta) void meusDuelos(conta.id).then((servidor) => setRecentes((r) => ({ ...r, servidor }))).catch(() => {});
  }, [etapa, conta?.id, limiteReplays]);

  /** Exporta o replay (Premium): arquivo .json no site; no app de computador, copia o texto */
  async function exportar(d: DueloGuardado) {
    const texto = exportarReplay(d);
    const nome = `jam-cards-replay-${d.quando.slice(0, 16).replace(/[-:T]/g, "")}.json`;
    try {
      if (isDesktop) {
        await navigator.clipboard.writeText(texto);
        setAvisoReplay(t("Replay copiado. Cole num arquivo .json para guardar ou enviar."));
        return;
      }
      const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAvisoReplay(t("Replay exportado: {0}", [nome]));
    } catch (e) {
      setAvisoReplay(e instanceof Error ? e.message : String(e));
    }
  }

  async function recarregarReplays() {
    const locais = await listarAprendizado();
    setRecentes((r) => ({ ...r, locais: locais.slice(-limiteReplays).reverse() }));
  }

  /** Link compartilhado ainda válido de um replay guardado */
  const linkValido = (d: DueloGuardado) => (d.compartilhado && new Date(d.compartilhado.expira).getTime() > Date.now() ? d.compartilhado : null);

  /** Copia o link do replay e avisa até quando ele vale */
  async function copiarLinkReplay(c: NonNullable<DueloGuardado["compartilhado"]>) {
    const rota: Rota = { tela: "simulador", replay: c.codigo };
    const ok = await copiarLink(rota);
    const ate = new Date(c.expira).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" });
    setAvisoReplay(ok ? t("Link copiado (vale até {0}): {1}", [ate, linkPara(rota)]) : t("Link do replay (vale até {0}): {1}", [ate, linkPara(rota)]));
  }

  /** Compartilha o replay por link (precisa de conta; quem recebe vê sem conta) */
  async function compartilhar(d: DueloGuardado) {
    if (!conta) return openConta();
    const ja = linkValido(d);
    if (ja) return copiarLinkReplay(ja);
    try {
      const c = await compartilharReplay(d);
      await marcarCompartilhado(d.quando, c);
      await recarregarReplays();
      await copiarLinkReplay(c);
    } catch (e) {
      setAvisoReplay(e instanceof Error ? e.message : String(e));
    }
  }

  /** Apaga o link do replay (libera a vaga no limite de links ativos) */
  async function apagarLink(d: DueloGuardado) {
    if (!d.compartilhado) return;
    try {
      await apagarReplay(d.compartilhado.codigo);
      await marcarCompartilhado(d.quando, null);
      await recarregarReplays();
      setAvisoReplay(t("Link apagado."));
    } catch (e) {
      setAvisoReplay(e instanceof Error ? e.message : String(e));
    }
  }

  /** Guarda nos meus replays o replay recebido por link */
  async function salvarRecebido() {
    const r = revisaoRef.current?.recebido;
    if (!r) return;
    try {
      await guardarReplay(r.d, limiteReplays);
      setRevisao((v) => (v?.recebido ? { ...v, recebido: { ...v.recebido, salvo: true } } : v));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  /** Importa um replay de arquivo .json (Premium) */
  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      await importarReplay(await arquivo.text(), limiteReplays);
      await recarregarReplays();
      setAvisoReplay(t("Replay importado."));
    } catch (e) {
      setAvisoReplay(e instanceof Error ? t(e.message) : String(e));
    }
  }

  /** Revisa uma partida 1x1 do servidor */
  async function revisarDoServidor(d: Duelo) {
    if (!conta) return;
    try {
      const historico = (await respostasDoDuelo(d.id)).map((r) => r.resp);
      const outro = d.criador === conta.id ? d.convidado : d.criador;
      const nomes = outro ? await nomesDeUsuarios([outro]) : {};
      await abrirRevisao({ partida: partidaDoDuelo(d), humano: meuJogador(d, conta.id), nivel: "normal", historico }, (outro && nomes[outro]) || t("Oponente"));
    } catch (e) {
      falhou(e);
    }
  }

  /** Desiste: na partida 1x1, o oponente vence; contra a IA, o duelo só termina (na match, conta como derrota no jogo) */
  function desistir() {
    void cliente.current?.aprendizado().then((a) => a && registrarAprendizado(a));
    setConfirmarDesistir(false);
    const vencedor = 1 - euRef.current;
    setDesistencia({ vencedor, quem: "eu" });
    const d = salaRef.current;
    if (d) void encerrarDuelo(d.id, vencedor as 0 | 1).catch(() => {});
  }

  /** Volta à configuração para outra partida (fecha a sala e a match acompanhadas) */
  function novaPartida() {
    pararSala.current?.();
    pararSala.current = null;
    pararMatch.current?.();
    pararMatch.current = null;
    setMatchPvp(null);
    setMatchIA(null);
    setSide(null);
    setConfirmarAbandono(false);
    setSala(null);
    setNomeOp(null);
    setConvite(null);
    setEtapa("config");
    if (dueloDaRota) onRota?.({ tela: "simulador" });
  }

  // ---------- match (melhor de 3) ----------

  /** Vencedor do jogo que acabou de terminar, do ponto de vista deste aparelho (null: empate) */
  function resultadoDoJogo(): ResultadoJogo {
    const v = quadroRef.current?.fim?.vencedor ?? desistenciaRef.current?.vencedor;
    return v === euRef.current ? "eu" : v === 1 - euRef.current ? "op" : null;
  }

  /** O seu deck da match (original ou do jogo atual), com o Side */
  const comSide = (d: DeckSim | null | undefined): DeckMatch => ({ main: [...(d?.main ?? [])], extra: [...(d?.extra ?? [])], side: [...((d as DeckMatch | null | undefined)?.side ?? [])] });

  /** Mudança na match 1x1: placar, fim da match ou a sala do próximo jogo, que o banco acabou de criar */
  function aoMudarMatch(m: Match) {
    setMatchPvp(m);
    if (etapaRef.current === "side" && m.estado === "em-andamento" && m.duelo_atual && m.duelo_atual !== salaRef.current?.id && abrindoJogo.current !== m.duelo_atual) {
      abrindoJogo.current = m.duelo_atual;
      void obterDuelo(m.duelo_atual)
        .then((d) => d && comecarPvp(d))
        .catch(falhou);
    }
  }
  const abrindoJogo = useRef<string | null>(null);

  /** Acompanha a match 1x1 pelo tempo real e, entre os jogos, conferindo o banco a cada 2 segundos */
  function acompanharMatch(m: Match) {
    const jaAcompanha = !!pararMatch.current && matchPvpRef.current?.id === m.id;
    setMatchPvp(m);
    if (jaAcompanha) return;
    pararMatch.current?.();
    const pararTempoReal = assinarMatch(m.id, aoMudarMatch);
    const timer = window.setInterval(() => {
      // durante o jogo nada muda na match: só confere entre os jogos
      if (etapaRef.current !== "side" && !quadroRef.current?.fim && !desistenciaRef.current) return;
      void obterMatch(m.id)
        .then((novo) => novo && aoMudarMatch(novo))
        .catch(() => {});
    }, 2000);
    pararMatch.current = () => {
      pararTempoReal();
      window.clearInterval(timer);
    };
  }

  /** "Próximo jogo": guarda o resultado (contra a IA) e abre a troca de side */
  function proximoJogo() {
    setErro(null);
    setConfirmarAbandono(false);
    if (matchIA) {
      const m = { ...matchIA, resultados: [...matchIA.resultados, resultadoDoJogo()] };
      setMatchIA(m);
      setSide({ deck: comSide(m.atual), primeiro: null });
    } else if (matchPvp && conta && sala) {
      setSide({ deck: comSide(sala.criador === conta.id ? sala.deck_criador : sala.deck_convidado), primeiro: null });
    } else return;
    setEtapa("side");
  }

  /** "Pronto" da troca de side: contra a IA começa o próximo jogo; no 1x1 manda o deck e a escolha ao banco */
  async function prontoSide() {
    if (!side) return;
    if (matchIA) {
      // a IA, quando escolhe, escolhe começar
      const comeca: Lado = quemEscolhe(matchIA.resultados, matchIA.inicial) === "eu" ? (side.primeiro ?? "eu") : "op";
      setMatchIA({ ...matchIA, atual: side.deck });
      return void iniciar({ deck: { main: side.deck.main, extra: side.deck.extra }, humano: comeca === "eu" ? 0 : 1 });
    }
    const m = matchPvpRef.current;
    if (!m || !conta) return;
    const papel = papelNaMatch(m, conta.id);
    const outro = papel === "criador" ? "convidado" : "criador";
    const primeiro = m.escolhe === papel && side.primeiro ? (side.primeiro === "eu" ? papel : outro) : null;
    setErro(null);
    try {
      const novo = await prepararJogo(m.id, side.deck, primeiro);
      setSide({ ...side, enviado: true });
      aoMudarMatch(novo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  /** Abandona a match: o oponente vence (e o jogo em andamento termina como desistência) */
  function abandonar() {
    setConfirmarAbandono(false);
    setConfirmarDesistir(false);
    if (matchIA) setMatchIA({ ...matchIA, abandonada: true });
    const m = matchPvpRef.current;
    if (m) void abandonarMatch(m.id).catch(() => {});
    if (etapaRef.current === "duelo" && !quadroRef.current?.fim && !desistenciaRef.current) desistir();
  }

  /** Retângulo na tela do lugar de uma carta (mão, pilha ou zona do campo) */
  function lugarNaTela(p: number, local: number, seq: number): DOMRect | null {
    let el: Element | null | undefined = null;
    if (local === L.HAND) {
      const mao = document.querySelector(`[data-mao="${p}"]`);
      el = mao?.children[seq] ?? mao;
    } else if (local & (L.DECK | L.EXTRA | L.GRAVE | L.REMOVED)) el = document.querySelector(`[data-pilha="${p}:${local & (L.DECK | L.EXTRA | L.GRAVE | L.REMOVED)}"]`);
    else if (local === L.FZONE) el = document.querySelector(`[data-zona="${chave(p, L.SZONE, 5)}"]`);
    else if (local & L.OVERLAY) el = document.querySelector(`[data-zona="${chave(p, L.MZONE, seq)}"]`);
    else if (local & (L.MZONE | L.SZONE)) el = document.querySelector(`[data-zona="${chave(p, local & (L.MZONE | L.SZONE), seq)}"]`);
    return el?.getBoundingClientRect() ?? null;
  }

  /** Animação de 0,3 s das cartas que mudaram de lugar (revela a do oponente que sai da mão, salvo se vai baixada) */
  function animarVoos(q: Quadro) {
    if (revisaoRef.current) return;
    const novos: typeof voos = [];
    for (const e of q.eventos) {
      if (e.t !== "voo" || novos.length >= 6) continue;
      const a = lugarNaTela(e.de.p, e.de.local, e.de.seq);
      const b = lugarNaTela(e.para.p, e.para.local, e.para.seq);
      if (!a || !b) continue;
      const oculta = e.para.baixada && e.para.p !== euRef.current;
      const centro = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      novos.push({ id: ++idVoo.current, code: e.code, oculta, de: centro(a), para: centro(b) });
    }
    if (!novos.length) return;
    setVoos((v) => [...v, ...novos]);
    const ids = new Set(novos.map((v) => v.id));
    window.setTimeout(() => setVoos((v) => v.filter((x) => !ids.has(x.id))), 360);
  }

  function receber(q: Quadro) {
    animarVoos(q);
    setPensando(!!q.pensando);
    setQuadro(q);
    quadroRef.current = q;
    const d = salaRef.current;
    if (d && q.publicar)
      for (const p of q.publicar)
        filaEnvio.current = filaEnvio.current
          .then(() => enviarResposta(d.id, p.n, euRef.current, p.resp))
          .then(() => void (ultimaN.current = Math.max(ultimaN.current, p.n)))
          .catch((e) => setErro(t("Falha ao enviar a jogada: {0}", [e instanceof Error ? e.message : String(e)])));
    if (q.aprendizado) registrarAprendizado(q.aprendizado);
    if (d && q.fim && !fimEnviado.current) {
      fimEnviado.current = true;
      const v = q.fim.vencedor;
      void encerrarDuelo(d.id, v === 0 || v === 1 ? v : null).catch(() => {});
    }
    if (q.eventos.length) setRegistro((r) => [...r, ...q.eventos].slice(-400));
    for (const e of q.eventos) {
      if (e.t === "ativa") setAtivacoes((a) => ({ itens: e.elo === 1 || !a.aberta ? [e] : [...a.itens, e], aberta: true }));
      // guia de combo: a IA ativou algo no seu turno, uma resposta ao combo que resolveu
      if (e.t === "ativa" && e.p !== euRef.current && q.estado.vez === euRef.current)
        setGuia((g) => (g ? { ...g, interrupcoes: [...g.interrupcoes, { passo: g.passo, carta: byId.get(e.code)?.id ?? e.code }] } : g));
      // a jogada sugerida vale só para o turno em que foi pedida
      if (e.t === "turno") setSugestao(null);
      if (e.t === "alvo") setAtivacoes((a) => ({ ...a, itens: a.itens.map((x) => (x.elo === e.elo ? { ...x, alvos: [...(x.alvos ?? []), ...e.cartas] } : x)) }));
      if (e.t === "declara" && e.elo) setAtivacoes((a) => ({ ...a, itens: a.itens.map((x) => (x.elo === e.elo ? { ...x, declarado: e.code } : x)) }));
      if (e.t === "resolve") setAtivacoes((a) => ({ ...a, itens: a.itens.map((x) => (x.elo === e.elo ? { ...x, resolvida: true } : x)) }));
      if (e.t === "cadeia-fim") setAtivacoes((a) => ({ itens: a.itens.map((x) => ({ ...x, resolvida: true })), aberta: false }));
      if (e.t === "revela" && e.p === euRef.current) setRevelacao(e.cartas);
      if (e.t === "compra" && !revisaoRef.current) {
        const p = e.p as 0 | 1;
        const n = e.codes.length;
        setComprando((v) => (p === 0 ? [n, v[1]] : [v[0], n]));
        window.clearTimeout(timerCompra.current[p]);
        timerCompra.current[p] = window.setTimeout(() => setComprando((v) => (p === 0 ? [0, v[1]] : [v[0], 0])), 600 + n * 150);
      }
      if (e.t !== "embaralha") continue;
      const p = e.p as 0 | 1;
      setEmbaralhando((v) => (p === 0 ? [true, v[1]] : [v[0], true]));
      window.clearTimeout(timerEmbaralho.current[p]);
      timerEmbaralho.current[p] = window.setTimeout(() => setEmbaralhando((v) => (p === 0 ? [false, v[1]] : [v[0], false])), 900);
    }
  }

  function responder(resp: OcgResponse) {
    setMenu(null);
    setLista(null);
    setQuadro((q) => (q ? { ...q, pedido: null } : q));
    setPensando(true);
    cliente.current?.responder(resp);
  }

  // Esc: fecha menu e listas; no duelo, pede confirmação antes de voltar ao menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menu || lista || pergunta) {
        e.preventDefault();
        setMenu(null);
        setLista(null);
        setPergunta(null);
      } else if (revisaoRef.current) {
        e.preventDefault();
        sairRevisao();
      } else if (etapa === "duelo" && !quadro?.fim && !sair) {
        e.preventDefault();
        setSair(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [menu, lista, pergunta, etapa, quadro?.fim, sair]); // eslint-disable-line react-hooks/exhaustive-deps

  const pedido = quadro?.pedido ?? null;
  const d = pedido?.msg;
  const texto = (desc: bigint | number) => pedido?.textos[String(desc)];

  // ações sobre as cartas (Main Phase e Battle Phase): chave da carta → ações
  const acoes = useMemo(() => {
    const m = new Map<string, Acao[]>();
    if (!d) return m;
    const add = (c: { controller: number; location: number; sequence: number }, a: Acao) => {
      const k = chave(c.controller, c.location, c.sequence);
      m.set(k, [...(m.get(k) ?? []), a]);
    };
    const efeito = (desc: bigint) => {
      const s = texto(desc);
      return s ? `${t("Ativar")}: ${s}` : t("Ativar");
    };
    if (d.type === T.SELECT_IDLECMD) {
      d.activates.forEach((c, i) => add(c, { rotulo: efeito(c.description), resp: { type: R.SELECT_IDLECMD, action: 5, index: i } }));
      d.summons.forEach((c, i) => add(c, { rotulo: t("Invocar por Invocação-Normal"), resp: { type: R.SELECT_IDLECMD, action: 0, index: i } }));
      d.special_summons.forEach((c, i) => add(c, { rotulo: t("Invocar por Invocação-Especial"), resp: { type: R.SELECT_IDLECMD, action: 1, index: i } }));
      d.monster_sets.forEach((c, i) => add(c, { rotulo: t("Baixar"), resp: { type: R.SELECT_IDLECMD, action: 3, index: i } }));
      d.spell_sets.forEach((c, i) => add(c, { rotulo: t("Baixar"), resp: { type: R.SELECT_IDLECMD, action: 4, index: i } }));
      d.pos_changes.forEach((c, i) => add(c, { rotulo: t("Mudar a posição de batalha"), resp: { type: R.SELECT_IDLECMD, action: 2, index: i } }));
    } else if (d.type === T.SELECT_BATTLECMD) {
      d.attacks.forEach((c, i) => add(c, { rotulo: c.can_direct ? t("Atacar (direto, se não houver alvo)") : t("Atacar"), resp: { type: R.SELECT_BATTLECMD, action: 1, index: i } }));
      d.chains.forEach((c, i) => add(c, { rotulo: efeito(c.description), resp: { type: R.SELECT_BATTLECMD, action: 0, index: i } }));
    }
    return m;
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  // cartas da escolha em aberto (alvos, cadeia, matérias…): chave no tabuleiro → índices na mensagem
  useEffect(() => {
    setMarcadas([]);
    setFoco(null);
    if (pedido?.carta) setPreview(pedido.carta);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const escolhiveis = useMemo(() => {
    const m = new Map<string, number[]>();
    if (!d) return m;
    const add = (c: { controller: number; location: number; sequence: number }, i: number) => {
      const k = chaveRef(c);
      m.set(k, [...(m.get(k) ?? []), i]);
    };
    if (d.type === T.SELECT_CHAIN || d.type === T.SELECT_CARD || d.type === T.SELECT_TRIBUTE || d.type === T.SELECT_SUM) d.selects.forEach(add);
    if (d.type === T.SELECT_UNSELECT_CARD) {
      d.select_cards.forEach(add);
      d.unselect_cards.forEach((c, i) => add(c, d.select_cards.length + i));
    }
    if (d.type === T.SELECT_EFFECTYN) add(d, 0);
    return m;
  }, [d]);
  const obrigatorias = useMemo(() => new Set(d?.type === T.SELECT_SUM ? d.selects_must.map(chaveRef) : []), [d]);

  /** Escolhe (ou desmarca) a carta de índice i da escolha em aberto: pelo painel ou pelo tabuleiro */
  function tocar(i: number) {
    if (!d) return;
    switch (d.type) {
      case T.SELECT_CHAIN:
        return responder({ type: R.SELECT_CHAIN, index: i });
      case T.SELECT_UNSELECT_CARD:
        return responder({ type: R.SELECT_UNSELECT_CARD, index: i });
      case T.SELECT_CARD:
      case T.SELECT_TRIBUTE:
        // uma carta só: responde no clique
        if (d.max === 1 && d.min === 1) return responder(d.type === T.SELECT_CARD ? { type: R.SELECT_CARD, indicies: [i] } : { type: R.SELECT_TRIBUTE, indicies: [i] });
        return setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : m.length < d.max ? [...m, i] : m));
      case T.SELECT_SUM:
        return setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
    }
  }
  /** Clique numa carta escolhível do tabuleiro: a primeira opção dela ainda não marcada (ou desmarca) */
  // cartas da cadeia em aberto no tabuleiro: chave → elo
  const elos = useMemo(() => {
    const m = new Map<string, number>();
    quadro?.estado.cadeia.forEach((c, i) => m.set(chave(c.controller, c.location, c.sequence), i + 1));
    return m;
  }, [quadro?.estado.cadeia]);
  const tocarChave = (k: string) => {
    const idx = escolhiveis.get(k);
    if (!idx || !d || d.type === T.SELECT_EFFECTYN) return;
    tocar(idx.find((i) => !marcadas.includes(i)) ?? idx[0]);
  };

  // SELECT_PLACE: zonas livres e as já marcadas
  const [zonas, setZonas] = useState<SelectFieldPlace[]>([]);
  useEffect(() => setZonas([]), [d]);
  const livres = useMemo(() => (d && (d.type === T.SELECT_PLACE || d.type === T.SELECT_DISFIELD) ? zonasLivres(d) : []), [d]);
  const escolherZona = (z: SelectFieldPlace) => {
    if (!d || (d.type !== T.SELECT_PLACE && d.type !== T.SELECT_DISFIELD)) return;
    const novas = [...zonas, z];
    if (novas.length >= Math.max(1, d.count)) responder(d.type === T.SELECT_PLACE ? { type: R.SELECT_PLACE, places: novas } : { type: R.SELECT_DISFIELD, places: novas });
    else setZonas(novas);
  };

  // o teste de combo e o Modo de Treino são sempre contra a IA
  const amigo = !testeCombo && !treino && (cfg.modo === "amigo" || !!convite);
  const trocarModo = (modo: Config["modo"]) => {
    const novo = { ...cfg, modo };
    setCfg(novo);
    gravarConfig({ ...novo, meu: meu?.valor ?? novo.meu, ia: doIA?.valor ?? novo.ia });
  };
  const carregando = etapa === "carregando";

  /** Opção "Escolher Cartas na Mão" (só Premium liga) */
  const opcaoEscolherMao = (dica: string) => (
    <label className="sim-campo sim-opcao-premium">
      <span>
        <input type="checkbox" checked={escolherMao} disabled={!premium} onChange={(e) => setCfg({ ...cfg, escolherMao: e.target.checked })} /> {t("Escolher Cartas na Mão")}
      </span>
      <small className="tags-note">{premium ? dica : t("Recurso Premium.")}</small>
    </label>
  );

  /**
   * Situação da match (null: duelo único): placar, jogos encerrados, vencedor e quem escolhe quem
   * começa o próximo jogo. `fimDoJogo`: resultado do jogo que acabou de terminar e ainda não foi guardado
   * (contra a IA); no 1x1 o placar vem do banco e fica "atualizando" até ele contar o jogo.
   */
  const situacaoMatch = (fimDoJogo?: ResultadoJogo) => {
    if (matchIA) {
      const r = fimDoJogo !== undefined ? [...matchIA.resultados, fimDoJogo] : matchIA.resultados;
      const vencedor: Lado | null = matchIA.abandonada ? "op" : vencedorDaMatch(r);
      return { encerrados: r.length, placar: placar(r), vencedor, encerrada: !!vencedor, atualizando: false, escolhe: quemEscolhe(r, matchIA.inicial) };
    }
    if (matchPvp && conta) {
      const papel = papelNaMatch(matchPvp, conta.id);
      const p = papel === "criador" ? { eu: matchPvp.vitorias_criador, op: matchPvp.vitorias_convidado } : { eu: matchPvp.vitorias_convidado, op: matchPvp.vitorias_criador };
      const encerrada = matchPvp.estado === "encerrado";
      const vencedor: Lado | null = !encerrada || !matchPvp.vencedor ? null : matchPvp.vencedor === conta.id ? "eu" : "op";
      const jogo = sala?.match === matchPvp.id ? (sala.jogo ?? 1) : 1;
      const escolhe: Lado = matchPvp.escolhe === papel ? "eu" : "op";
      return { encerrados: matchPvp.jogos, placar: p, vencedor, encerrada, atualizando: fimDoJogo !== undefined && !encerrada && matchPvp.jogos < jogo, escolhe };
    }
    return null;
  };

  if (etapa === "side" && side) {
    const s = situacaoMatch();
    const rotulo = matchIA ? t("IA") : (nomeOp ?? t("Oponente"));
    const original = comSide(matchIA ? matchIA.original : matchPvp && conta ? (papelNaMatch(matchPvp, conta.id) === "criador" ? matchPvp.deck_criador : matchPvp.deck_convidado) : null);
    const escolheEu = s?.escolhe === "eu";
    return (
      <ScreenShell title={tituloTela} accent="magenta" onBack={() => setConfirmarAbandono(true)}>
        <div className="sim-config">
          <h3>{t("Match · jogo {0}", [(s?.encerrados ?? 0) + 1])}</h3>
          {s && <p className="sim-placar">{t("Placar: você {0} x {1} {2}", [s.placar.eu, s.placar.op, rotulo])}</p>}
          {s?.encerrada ? (
            <>
              <p>{s.vencedor === "eu" ? t("{0} abandonou a match. Você venceu!", [rotulo]) : t("A match terminou.")}</p>
              <button className="ghost-btn sim-duelar" onClick={novaPartida}>
                {t("Nova partida")}
              </button>
            </>
          ) : side.enviado ? (
            <p className="sim-pensando" role="status">
              {t("Aguardando o oponente terminar o side…")}
            </p>
          ) : (
            <>
              {original.side.length > 0 ? (
                <SideDeck original={original} deck={side.deck} byId={byId} onChange={(deck) => setSide({ ...side, deck })} />
              ) : (
                <p className="tags-note">{t("O seu deck não tem Side Deck: ele segue igual no próximo jogo.")}</p>
              )}
              {escolheEu ? (
                <fieldset className="sim-campo">
                  <legend className="field-label">{t("Quem começa este jogo (você escolhe)")}</legend>
                  <div className="sim-niveis">
                    <button className={`ghost-btn ${side.primeiro === "eu" ? "sim-ativo" : ""}`} onClick={() => setSide({ ...side, primeiro: "eu" })} aria-pressed={side.primeiro === "eu"}>
                      {t("Eu começo")}
                    </button>
                    <button className={`ghost-btn ${side.primeiro === "op" ? "sim-ativo" : ""}`} onClick={() => setSide({ ...side, primeiro: "op" })} aria-pressed={side.primeiro === "op"}>
                      {t("{0} começa", [rotulo])}
                    </button>
                  </div>
                </fieldset>
              ) : (
                <small className="tags-note">{matchIA ? t("A IA escolhe quem começa este jogo: ela começa.") : t("{0} escolhe quem começa este jogo.", [rotulo])}</small>
              )}
              <button className="ghost-btn sim-duelar" disabled={!sideValido(original, side.deck) || (escolheEu && !side.primeiro)} onClick={() => void prontoSide()}>
                {t("Pronto")}
              </button>
            </>
          )}
          {!s?.encerrada &&
            (confirmarAbandono ? (
              <div className="sim-campo" role="alertdialog" aria-label={t("Abandonar match")}>
                <p>{t("Abandonar a match? {0} vence.", [rotulo])}</p>
                <div className="sim-niveis">
                  <button
                    className="danger-btn"
                    onClick={() => {
                      abandonar();
                      novaPartida();
                    }}
                    autoFocus
                  >
                    {t("Abandonar match")}
                  </button>
                  <button className="ghost-btn" onClick={() => setConfirmarAbandono(false)}>
                    {t("Continuar na match")}
                  </button>
                </div>
              </div>
            ) : (
              <button className="ghost-btn" onClick={() => setConfirmarAbandono(true)}>
                {t("Abandonar match")}
              </button>
            ))}
          {erro && (
            <p className="conta-erro" role="alert">
              {erro}
            </p>
          )}
        </div>
      </ScreenShell>
    );
  }

  if (etapa === "mao" && sala && conta) {
    const jaDei = minhaMao(sala, conta.id) !== null;
    const meuDeck = sala.criador === conta.id ? sala.deck_criador : sala.deck_convidado;
    return (
      <ScreenShell title={tituloTela} accent="magenta" onBack={onBack}>
        <div className="sim-config">
          <h3>{t("Escolher Cartas na Mão")}</h3>
          {!jaDei ? (
            <>
              <p>{t("Escolha as cartas da sua mão inicial (ou Aleatório) e clique em Pronto. O duelo começa quando os dois derem Pronto.")}</p>
              <EscolherMao titulo={conta.usuario || t("Você")} main={meuDeck?.main ?? []} byId={byId} mao={maoPvp} onChange={setMaoPvp} />
              <button className="ghost-btn sim-duelar" onClick={() => void prontoPvp()}>
                {t("Pronto")}
              </button>
            </>
          ) : (
            <p className="sim-pensando" role="status">
              {t("Aguardando o oponente dar Pronto…")}
            </p>
          )}
          {erro && (
            <p className="conta-erro" role="alert">
              {erro}
            </p>
          )}
        </div>
      </ScreenShell>
    );
  }

  if (etapa === "sala" && sala) {
    const link = linkPara({ tela: "simulador", duelo: sala.id });
    return (
      <ScreenShell title={tituloTela} accent="magenta" onBack={onBack}>
        <div className="sim-config">
          <h3>{t("Sala criada")}</h3>
          {sala.match && <p className="tags-note">{t("Match (melhor de 3): vence quem ganhar 2 jogos.")}</p>}
          <p>{t("Mande o link ou o código para o seu oponente. O duelo começa assim que ele entrar com o deck dele.")}</p>
          <label className="sim-campo">
            <span className="field-label">{t("Link da sala")}</span>
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
          {sala.codigo && (
            <p className="sim-codigo-sala">
              {t("Código da sala")}: <strong>{`${sala.codigo.slice(0, 3)} ${sala.codigo.slice(3)}`}</strong>
            </p>
          )}
          <small className="tags-note">{t("O oponente entra pelo link ou digitando o código em “Entrar numa sala”. A sala vale por 4 horas.")}</small>
          <div className="sim-niveis">
            <button className="ghost-btn" onClick={() => void copiarLink({ tela: "simulador", duelo: sala.id }).then(setCopiado)}>
              {copiado ? t("Link copiado") : t("Copiar link")}
            </button>
            <button
              className="ghost-btn"
              onClick={() => {
                void encerrarDuelo(sala.id, null).catch(() => {});
                novaPartida();
              }}
            >
              {t("Cancelar sala")}
            </button>
          </div>
          <p className="sim-pensando" role="status">
            {t("Aguardando o oponente entrar…")}
          </p>
          <small className="tags-note">{t("Os dois precisam estar com a mesma versão do app.")}</small>
          {erro && (
            <p className="conta-erro" role="alert">
              {erro}
            </p>
          )}
        </div>
      </ScreenShell>
    );
  }

  if (etapa !== "duelo" || !quadro) {
    return (
      <ScreenShell
        title={tituloTela}
        accent="magenta"
        onBack={onBack}
        actions={
          !convite && (
            <button className="ghost-btn sim-replays-btn" onClick={() => setReplaysAberto(true)}>
              {t("Replays")}
            </button>
          )
        }
      >
        <div className="sim-config sim-config-grade">
          <aside className="sim-config-esq">
            {!convite && !testeCombo && !treino && (
              <section className="sim-duelar-contra" role="group" aria-label={t("Duelar contra")}>
                <h3>{t("Duelar contra")}</h3>
                <div className="sim-niveis">
                  <button className={`ghost-btn ${!amigo ? "sim-ativo" : ""}`} onClick={() => trocarModo("ia")} aria-pressed={!amigo}>
                    {t("IA")}
                  </button>
                  <button className={`ghost-btn ${amigo ? "sim-ativo" : ""}`} onClick={() => trocarModo("amigo")} aria-pressed={amigo}>
                    {t("Jogador")}
                  </button>
                </div>
              </section>
            )}
            {!convite && !testeCombo && !treino && (
              <fieldset className="sim-campo">
                <legend className="field-label">{t("Formato")}</legend>
                <div className="sim-niveis">
                  <button className={`ghost-btn ${!melhorDe3 ? "sim-ativo" : ""}`} onClick={() => setCfg({ ...cfg, melhorDe: 1 })} aria-pressed={!melhorDe3}>
                    {t("Duelo único")}
                  </button>
                  <button className={`ghost-btn ${melhorDe3 ? "sim-ativo" : ""}`} onClick={() => setCfg({ ...cfg, melhorDe: 3 })} aria-pressed={melhorDe3}>
                    {t("Match (melhor de 3)")}
                  </button>
                </div>
                <small className="tags-note">
                  {melhorDe3
                    ? t("Vence quem ganhar 2 jogos. Antes do jogo 2 e do jogo 3 você pode trocar cartas com o Side Deck, e quem perdeu o jogo anterior escolhe quem começa.")
                    : t("Um duelo só.")}
                </small>
              </fieldset>
            )}
            {!amigo && opcoes.length > 0 && (
              <>
                <fieldset className="sim-campo">
                  <legend className="field-label">{t("Nível da IA")}</legend>
                  <div className="sim-niveis">
                    {NIVEIS.map((n) => (
                      <button key={n.id} className={`ghost-btn ${cfg.nivel === n.id ? "sim-ativo" : ""}`} onClick={() => setCfg({ ...cfg, nivel: n.id })} title={n.hint} aria-pressed={cfg.nivel === n.id}>
                        {n.label}
                      </button>
                    ))}
                  </div>
                  <small className="tags-note">{NIVEIS.find((n) => n.id === cfg.nivel)?.hint}</small>
                </fieldset>
                {!testeCombo && (
                  <fieldset className="sim-campo">
                    <legend className="field-label">{t("Quem começa")}</legend>
                    <div className="sim-niveis">
                      {QUEM_COMECA.map(({ id, label }) => (
                        <button key={id} className={`ghost-btn ${cfg.primeiro === id ? "sim-ativo" : ""}`} onClick={() => setCfg({ ...cfg, primeiro: id })} aria-pressed={cfg.primeiro === id}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <button className="sim-duelar-grande" onClick={() => void iniciar()} disabled={etapa === "carregando"}>
                  {etapa === "carregando" ? progresso || t("Preparando…") : t("Duelar")}
                </button>
                {conta?.admin && !testeCombo && !treino && (
                  <div className="sim-campo">
                    <button className="ghost-btn sim-iaxia" onClick={() => void iniciarIaXIa()} disabled={etapa === "carregando"}>
                      {t("IA x IA (apresentação)")}
                    </button>
                    <small className="tags-note">{t("Só administradores. A IA joga com os dois decks acima, cada lado só com o que um jogador veria; depois a revisão mostra cada decisão e o motivo dela.")}</small>
                  </div>
                )}
              </>
            )}
          </aside>
          <div className="sim-config-dir">
          {testeCombo && (
            <div className="sim-teste-combo" role="note">
              <strong>{ROTULO_TESTE[testeCombo.quem]}</strong>
              <span>
                {t("Mão do combo:")} {maoCombo.map((id) => (byId.get(id) ? displayName(byId.get(id)!) : `#${id}`)).join(", ")}
                {maoCombo.length < 5 ? ` ${t("+ {0} carta(s) do Deck ao acaso", [5 - maoCombo.length])}` : ""}
              </span>
              <small className="tags-note">
                {testeCombo.quem === "eu" ? t("Você começa o duelo.") : t("A IA começa o duelo e tenta repetir os passos do combo.")}</small>
            </div>
          )}
          {treino && <p className="tags-note">{t("Modo de Treino: abaixo da mão do oponente aparecem os combos possíveis da carta em foco (e a IA sugere a jogada quando você pedir); abaixo da carta, as interações com ela.")}</p>}
          {!opcoes.length ? (
            <p>{t("Monte um deck no Editor de Deck para duelar.")}</p>
          ) : amigo && !conta ? (
            <div className="sim-campo">
              <p>{t("Para duelar com um amigo, entre na sua conta: a sala e as jogadas passam pelo servidor do app.")}</p>
              <button className="ghost-btn" onClick={() => openConta()}>
                {t("Entrar na conta")}
              </button>
            </div>
          ) : convite ? (
            <>
              <p>
                <strong>{t("Convite de {0}", [convite.criador])}</strong> — {t("escolha o seu deck e entre no duelo.")}
              </p>
              {convite.duelo.match && <p className="tags-note">{t("É uma match (melhor de 3): o Side Deck do seu deck vale para as trocas entre os jogos.")}</p>}
              <label className="sim-campo">
                <span className="field-label">{t("Seu deck")}</span>
                <select value={meu?.valor} onChange={(e) => setCfg({ ...cfg, meu: e.target.value })}>
                  {opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.valor.startsWith("meta:") ? `${t("Torneio")}: ${o.nome}` : o.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sim-niveis">
                <button className="ghost-btn sim-duelar" onClick={() => void entrarSala(convite.duelo)} disabled={carregando}>
                  {carregando ? progresso || t("Preparando…") : t("Entrar no duelo")}
                </button>
                <button className="ghost-btn" onClick={novaPartida} disabled={carregando}>
                  {t("Recusar")}
                </button>
              </div>
            </>
          ) : amigo ? (
            <>
              {servidorPvp === false && (
                <p className="conta-erro" role="alert">
                  {t("As partidas com amigos ainda não foram ativadas no servidor do app.")} {conta?.admin ? t("Falta aplicar a migração das salas (supabase/migrations/20261110000000_duelos.sql) no SQL Editor do Supabase.") : ""}
                </p>
              )}
              <label className="sim-campo">
                <span className="field-label">{t("Seu deck")}</span>
                <select value={meu?.valor} onChange={(e) => setCfg({ ...cfg, meu: e.target.value })}>
                  {opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.valor.startsWith("meta:") ? `${t("Torneio")}: ${o.nome}` : o.nome}
                    </option>
                  ))}
                </select>
              </label>
              {!melhorDe3 && opcaoEscolherMao(t("Antes do duelo, cada um escolhe as cartas da própria mão e clica em Pronto."))}
              <button className="ghost-btn sim-duelar" onClick={() => void criarSala()} disabled={carregando || servidorPvp === false}>
                {carregando ? progresso || t("Preparando…") : t("Criar sala")}
              </button>
              {erro && (
                <p className="conta-erro" role="alert">
                  {erro}
                </p>
              )}
              <small className="tags-note">{t("Você recebe um link para mandar ao seu oponente. Quem começa é sorteado.")}</small>
              <label className="sim-campo">
                <span className="field-label">{t("Entrar numa sala (código de 6 dígitos ou link)")}</span>
                <div className="sim-niveis">
                  <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={t("Ex.: 123 456, ou cole o link")} inputMode="text" />
                  <button
                    className="ghost-btn"
                    disabled={(!idDaSala(codigo) && !codigoDaSala(codigo)) || carregando}
                    onClick={() => void abrirPorCodigo()}
                  >
                    {t("Abrir")}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <>
              <div className="sim-campo">
                <span className="field-label">{t("Seu deck")}</span>
                <div className="sim-deck-linha">
                  <select
                    className="sim-select-deck"
                    aria-label={t("Seu deck")}
                    value={meu?.valor}
                    onChange={(e) => {
                      setCfg({ ...cfg, meu: e.target.value });
                      // a mão escolhida era do outro deck
                      setMaos((m) => ({ ...m, eu: m.eu && [] }));
                    }}
                  >
                    {opcoes.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.valor.startsWith("meta:") ? `${t("Torneio")}: ${o.nome}` : o.nome}
                      </option>
                    ))}
                  </select>
                  {!testeCombo && !melhorDe3 && (
                    <button className="ghost-btn sim-btn-mao" disabled={!premium} onClick={() => setJanelaMao(true)} title={premium ? t("Escolha a sua mão inicial e a da IA") : t("Recurso Premium.")}>
                      {t("Escolher Cartas na Mão")}
                    </button>
                  )}
                </div>
                {!testeCombo && !melhorDe3 && (
                  <small className="tags-note">
                    {!premium
                      ? t("Escolher Cartas na Mão: recurso Premium.")
                      : escolherMao
                        ? t("Mãos: você {0} · IA {1}", [maos.eu === null ? t("aleatória") : t("{0} carta(s) escolhida(s)", [maos.eu.length]), maos.ia === null ? t("aleatória") : t("{0} carta(s) escolhida(s)", [maos.ia.length])])
                        : t("Mãos aleatórias.")}
                  </small>
                )}
              </div>
              <label className="sim-campo">
                <span className="field-label">{t("Deck da IA")}</span>
                <select
                  className="sim-select-deck"
                  value={doIA?.valor}
                  onChange={(e) => {
                    setCfg({ ...cfg, ia: e.target.value });
                    setMaos((m) => ({ ...m, ia: m.ia && [] }));
                  }}
                >
                  {opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.valor.startsWith("meta:") ? `${t("Torneio")}: ${o.nome}` : o.nome}
                    </option>
                  ))}
                </select>
                {doIA && <small className="tags-note">{doIA.linhas.length ? t("A IA conhece {0} linha(s) de combo deste deck.", [doIA.linhas.length]) : t("Sem linhas de combo conhecidas: a IA monta as jogadas sozinha.")}</small>}
              </label>
              {janelaMao && meu && doIA && (
                <div className="sim-janela-fundo" onClick={() => setJanelaMao(false)}>
                  <div className="sim-janela-mao" role="dialog" aria-label={t("Escolher Cartas na Mão")} onClick={(e) => e.stopPropagation()}>
                    <h4>{t("Escolher Cartas na Mão")}</h4>
                    <small className="tags-note">{t("Escolha a sua mão e a da IA, ou deixe uma delas em Aleatório.")}</small>
                    <EscolherMao titulo={conta?.usuario || t("Você")} main={meu.deck.main} byId={byId} mao={maos.eu} onChange={(eu) => setMaos((m) => ({ ...m, eu }))} />
                    <EscolherMao titulo={t("IA")} main={doIA.deck.main} byId={byId} mao={maos.ia} onChange={(ia) => setMaos((m) => ({ ...m, ia }))} />
                    <div className="sim-niveis">
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          setCfg({ ...cfg, escolherMao: maos.eu !== null || maos.ia !== null });
                          setJanelaMao(false);
                        }}
                        autoFocus
                      >
                        {t("Confirmar")}
                      </button>
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          setMaos({ eu: null, ia: null });
                          setCfg({ ...cfg, escolherMao: false });
                          setJanelaMao(false);
                        }}
                      >
                        {t("Usar mãos aleatórias")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {erro && !(amigo && conta && !convite) && (
            <p className="conta-erro" role="alert">
              {erro}
            </p>
          )}
          <p className="tags-note">
            {t("Duelo com as regras do jogo contra a IA. O motor é o do EDOPro (Project Ignis): custos, condições, cadeias e “uma vez por turno” valem como no jogo.")}
          </p>
          <p className="tags-note sim-licenca">
            {t("Motor de regras: ocgcore e scripts das cartas do Project Ignis (EDOPro), licença AGPL-3.0. Os textos dos efeitos nas escolhas vêm em inglês, como nos scripts.")}
          </p>
          </div>
        </div>
          {!convite && replaysAberto && (
            <div className="sim-replays-tela" role="dialog" aria-label={t("Replays")}>
            <section className="sim-recentes">
              <div className="sim-replays-topo">
                <h3>{t("Replays (últimos {0})", [limiteReplays])}</h3>
                <button className="ghost-btn" onClick={() => setReplaysAberto(false)} autoFocus>
                  {t("Fechar")}
                </button>
              </div>
              <small className="tags-note">
                {premium ? t("Premium: até 10 replays, com exportar e importar.") : t("Grátis: os últimos 5 replays ficam salvos neste aparelho. Premium: até 10, com exportar e importar.")}
              </small>
              {premium && (
                <label className="ghost-btn sim-importar">
                  {t("Importar replay (.json)")}
                  <input type="file" accept=".json,application/json" onChange={(e) => void importar(e.target.files?.[0]).finally(() => (e.target.value = ""))} hidden />
                </label>
              )}
              {avisoReplay && <small className="tags-note">{avisoReplay}</small>}
              {!recentes.locais.length && !recentes.servidor.length && <small className="tags-note">{t("Nenhum replay ainda: termine (ou desista de) um duelo.")}</small>}
              <ul>
                {recentes.servidor.map((d) => (
                  <li key={d.id}>
                    <span>{t("Partida 1x1 · sala {0}", [d.codigo ?? d.id.slice(0, 8)])}</span>
                    <button className="ghost-btn" disabled={carregando} onClick={() => void revisarDoServidor(d)}>
                      {t("Revisar")}
                    </button>
                  </li>
                ))}
                {recentes.locais.map((d) => (
                  <li key={d.quando}>
                    <span>
                      <strong>{new Date(d.quando).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" })}</strong> · {d.remoto ? t("1x1") : t("contra a IA")}
                      <small>
                        {d.rotulos
                          ? t("{0} ({1}) x {2} ({3})", [d.rotulos.eu, d.rotulos.meuDeck, d.rotulos.oponente, d.rotulos.deckOponente])
                          : t("Decks não registrados (replay antigo)")}
                      </small>
                    </span>
                    <span className="sim-niveis">
                      <button className="ghost-btn" disabled={carregando} onClick={() => void abrirRevisao({ partida: d.partida, humano: d.humano, nivel: "normal", historico: d.historico }, d.rotulos?.oponente ?? (d.remoto ? t("Oponente") : t("IA")), undefined, { decisoes: d.decisoes, jogador: d.decisoes?.some((x) => x.jogador === d.humano) ? d.rotulos?.eu : undefined })}>
                        {t("Revisar")}
                      </button>
                      {!d.remoto && (
                        <button className="ghost-btn" disabled={analise?.status === "analisando"} onClick={() => void analisar(d, d.quando)}>
                          {t("Análise da IA")}
                        </button>
                      )}
                      {premium && (
                        <button className="ghost-btn" onClick={() => void exportar(d)}>
                          {t("Exportar")}
                        </button>
                      )}
                      <button className="ghost-btn" onClick={() => void compartilhar(d)} title={conta ? t("Cria um link do replay (vale por 10 dias); quem recebe vê sem precisar de conta") : t("Entre na sua conta para compartilhar")}>
                        {linkValido(d) ? t("Copiar link") : t("Compartilhar")}
                      </button>
                      {linkValido(d) && (
                        <button className="ghost-btn" onClick={() => void apagarLink(d)}>
                          {t("Apagar link")}
                        </button>
                      )}
                    </span>
                    {analise?.chave === d.quando && <AnaliseIA analise={analise} nomeDe={nomeDe} quem={(j) => (j === d.humano ? d.rotulos?.eu ?? t("Você") : t("IA"))} />}
                  </li>
                ))}
              </ul>
            </section>
            </div>
          )}
      </ScreenShell>
    );
  }

  const op = (1 - eu) as 0 | 1;
  const rotuloOp = sala ? (nomeOp ?? t("Oponente")) : t("IA");
  const nomeOponente = revisao ? revisao.oponente : rotuloOp;
  const meuNome = revisao?.recebido?.jogador ?? revisao?.jogador ?? (conta?.usuario || t("Você"));
  const est = quadro.estado;
  const meuLado = est.lados[eu];
  const lado2 = est.lados[op];
  const minhaVez = est.vez === eu;

  const abrirMenu = (e: MouseEvent, lista: Acao[]) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: r.left, topo: r.top, base: r.bottom, acoes: lista });
  };

  // carta desenhada (não componente, para o React não recriar o elemento a cada quadro)
  const carta = (c: CartaSim, k: string, oculta: boolean, monstro = false) => {
    const ac = acoes.get(k);
    const idx = escolhiveis.get(k);
    const jaEscolhida = (i: number) => marcadas.includes(i) || (d?.type === T.SELECT_UNSELECT_CARD && i >= d.select_cards.length);
    const marcada = obrigatorias.has(k) || !!idx?.some(jaEscolhida);
    const elo = elos.get(k);
    const verso = oculta;
    return (
      <div
        key={k}
        className={`tj-carta ${monstro && c.pos & 0xc ? "tj-defesa" : ""} ${ac && !idx ? "sim-acao" : ""} ${idx ? (k.startsWith(`${eu}:`) ? "sim-escolhivel" : "sim-escolhivel sim-escolhivel-op") : ""} ${marcada ? "sim-marcada" : ""} ${foco === k ? "sim-foco" : ""} ${elo ? "sim-ativando" : ""} ${!oculta && virada(c.pos) ? "sim-baixada" : ""}`}
        onMouseEnter={() => !verso && setPreview(c.code)}
        onClick={(e) => {
          if (idx) {
            e.stopPropagation();
            tocarChave(k);
          } else if (ac) abrirMenu(e, ac);
          else if (!verso) setPreview(c.code);
        }}
        title={verso ? t("Carta virada para baixo") : nomeDe(c.code)}
        data-card-id={verso ? undefined : c.code}
      >
        {verso ? (
          <div className="tj-verso" />
        ) : c.ficha ? (
          <div className="sim-ficha-carta" title={`${c.ficha.nome} · ${t("Nível {0}", [c.ficha.nivel])} · ${nomeAtributo(c.ficha.atributo)} · ${nomeTipo(c.ficha.raca)}${c.atk !== undefined ? ` · ${c.atk}/${c.def}` : ""}`}>
            <span className="sim-ficha-nome">{c.ficha.nome}</span>
            <span className="sim-ficha-estrelas">{"★".repeat(Math.min(12, Math.max(0, c.ficha.nivel)))}</span>
            <img
              className="sim-ficha-arte"
              src={cardImage(c.code >= 990000000 ? OVELHAS[c.code % OVELHAS.length] : c.code, "cropped")}
              alt=""
              draggable={false}
              onError={(e) => ((e.target as HTMLImageElement).src = cardImage(OVELHAS[c.code % OVELHAS.length], "cropped"))}
            />
            <span className="sim-ficha-tipo">
              {nomeAtributo(c.ficha.atributo)} · {nomeTipo(c.ficha.raca)}
            </span>
            {c.atk !== undefined && (
              <span className="sim-ficha-atk">
                ATK {c.atk} / DEF {c.def}
              </span>
            )}
          </div>
        ) : (
          <img src={cardImage(c.code, "small")} alt={nomeDe(c.code)} draggable={false} onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
        )}
        {c.mat && c.mat.length > 0 && (
          <span className="tj-materiais" title={t("Matérias Xyz")}>
            {c.mat.length}
          </span>
        )}
        {c.pub && !verso && (virada(c.pos) || k.split(":")[1] === String(L.HAND)) && (
          <span className="sim-pub" title={k.startsWith(`${eu}:`) ? t("Revelada: o oponente vê esta carta") : t("Revelada por um efeito: você vê esta carta")}>
            👁
          </span>
        )}
        {elo && (
          <span className="sim-elo" title={t("Elo {0} da cadeia", [elo])}>
            {elo}
          </span>
        )}
        {monstro && !verso && !c.ficha && c.atk !== undefined && c.pos & 5 ? (
          <span className="sim-atk">
            {c.atk}/{c.def}
          </span>
        ) : null}
      </div>
    );
  };

  // zona do campo: p = dono, location/sequence do motor
  const zonaCampo = (p: number, location: number, sequence: number, classe: string, c: CartaSim | null) => {
    const livre = livres.find((z) => z.player === p && z.location === location && z.sequence === sequence);
    const marcada = zonas.some((z) => z.player === p && z.location === location && z.sequence === sequence);
    const k = chave(p, location, sequence);
    return (
      <div
        key={`z-${k}`}
        className={`tj-zona ${classe} ${p === op ? "tj-zona-op" : ""} ${livre ? "sim-zona-livre" : ""} ${marcada ? "sim-zona-marcada" : ""}`}
        onClick={() => livre && !marcada && escolherZona(livre)}
        data-zona={k}
      >
        {c && carta(c, k, !revisao && p === op && virada(c.pos) && !c.pub, location === L.MZONE)}
      </div>
    );
  };

  // pilhas: Deck, Extra Deck, Cemitério, banidas (clique abre a lista)
  const pilha = (p: number, tipo: "deck" | "extra" | "cemiterio" | "banido") => {
    const l = est.lados[p];
    const location = tipo === "deck" ? L.DECK : tipo === "extra" ? L.EXTRA : tipo === "cemiterio" ? L.GRAVE : L.REMOVED;
    const cartas = tipo === "deck" ? [] : tipo === "extra" ? l.extra : tipo === "cemiterio" ? l.cemiterio : l.banidas;
    const n = tipo === "deck" ? l.deck : cartas.length;
    const temAcao = cartas.some((_, i) => acoes.has(chave(p, location, i)));
    const temEscolha = cartas.some((_, i) => escolhiveis.has(chave(p, location, i)));
    const titulo = `${p === op ? t("Oponente — ") : ""}${tipo === "deck" ? t("Deck") : tipo === "extra" ? t("Extra Deck") : tipo === "cemiterio" ? t("Cemitério") : t("Banidas")}`;
    // Extra Deck do oponente: só as cartas com a face para cima (Pêndulos) ficam visíveis
    const oculta = (c: CartaSim) => !revisao && p === op && !c.pub && ((tipo === "extra" && !(c.pos & 1)) || (tipo === "banido" && virada(c.pos)));
    const topo = tipo === "extra" ? null : cartas[cartas.length - 1];
    return (
      <div
        key={`p-${p}-${tipo}`}
        data-pilha={`${p}:${location}`}
        className={`tj-zona tj-${tipo} ${p === op ? "tj-zona-op" : ""} ${temAcao && !temEscolha ? "sim-acao" : ""} ${temEscolha ? "sim-escolhivel" : ""}`}
        onClick={() => cartas.length && setLista({ titulo, cartas: cartas.map((c, i) => ({ c, k: chave(p, location, i), oculta: oculta(c) })) })}
        title={titulo}
      >
        {tipo === "deck" || tipo === "extra" ? n > 0 && <div className="tj-verso" /> : topo && carta(topo, chave(p, location, cartas.length - 1), oculta(topo))}
        {tipo === "deck" && embaralhando[p] && (
          <span className="tj-embaralhando" aria-label={t("Embaralhando")}>
            ⟳
          </span>
        )}
        <span className="tj-contagem">{n}</span>
        {!n && <span className="tj-rotulo">{tipo === "cemiterio" ? t("Cemitério") : tipo === "banido" ? t("Banidas") : tipo === "extra" ? t("Extra") : t("Deck")}</span>}
      </div>
    );
  };

  // Zonas de Monstros Extra são compartilhadas: a esquerda de um jogador é a direita do outro
  const emz = (lado: 0 | 1) => {
    const minha = meuLado.monstros[5 + lado];
    const dele = lado2.monstros[6 - lado];
    if (dele) return zonaCampo(op, L.MZONE, 6 - lado, "tj-em", dele);
    return zonaCampo(eu, L.MZONE, 5 + lado, "tj-em", minha);
  };

  /** Abre "Criar Token" com a primeira Zona de Monstros livre e Posição de Ataque */
  const abrirFicha = () => {
    const livre = [0, 1, 2, 3, 4].find((i) => !meuLado.monstros[i]) ?? 0;
    setPergunta(null);
    setFicha({ nivel: 1, atributo: 0x20, raca: 0x4000, atk: 0, def: 0, posicao: 1, sequencia: livre });
  };

  /** Resposta que leva à fase `id` agora (null: não dá para ir para ela neste momento) */
  const passarPara = (id: string): OcgResponse | null => {
    const d = pedido?.msg;
    if (!d || !minhaVez || pensando) return null;
    const agora = siglaFase(est.fase);
    const cadeiaVazia = !est.cadeia.length;
    if (d.type === T.SELECT_CHAIN && !d.forced && cadeiaVazia) {
      // Draw → Standby → Main Phase 1: passar a janela da fase atual
      if ((agora === "DP" && id === "SP") || (agora === "SP" && id === "M1")) return { type: R.SELECT_CHAIN, index: null };
    }
    if (d.type === T.SELECT_IDLECMD) {
      if (agora === "M1" && id === "BP" && d.to_bp) return { type: R.SELECT_IDLECMD, action: 6, index: null };
      if (id === "EP" && d.to_ep) return { type: R.SELECT_IDLECMD, action: 7, index: null };
    }
    if (d.type === T.SELECT_BATTLECMD) {
      if (id === "M2" && d.to_m2) return { type: R.SELECT_BATTLECMD, action: 2, index: null };
      if (id === "EP" && d.to_ep) return { type: R.SELECT_BATTLECMD, action: 3, index: null };
    }
    return null;
  };

  // painel da revisão: momento, navegação lance a lance e por turno, "?" e saída
  const painelRevisao = (r: NonNullable<typeof revisao>) => {
    const ultimo = r.momentos.length - 1;
    const m = r.momentos[r.k];
    const turnoDe = (turno: number) => r.momentos.findIndex((x) => x.turno === turno);
    const quem = (j: number) => (j === eu ? (r.recebido?.jogador ?? r.jogador ?? t("Você")) : r.oponente);
    // decisões da IA: a última antes do momento mostrado e a lista (só as jogadas, ou todas)
    const ultimaDecisao = r.decisoes ? [...r.decisoes].reverse().find((x) => x.n < r.k) : undefined;
    const listaDecisoes = (r.decisoes ?? []).filter((x) => todasDecisoes || x.relevante);
    const ir = (k: number) => void irPara(Math.max(0, Math.min(ultimo, k)));
    return (
      <div className="sim-revisao">
        <p>
          <strong>{t("Momento {0} de {1}", [r.k, ultimo])}</strong>
          <br />
          <small>
            {t("Turno {0}", [m?.turno ?? 0])} · {siglaFase(m?.fase ?? 0)} · {m?.decisao ? t("decisão de {0}", [quem(m.decisao.jogador)]) : t("fim do duelo")}
          </small>
        </p>
        <input type="range" min={0} max={ultimo} value={r.k} onChange={(e) => ir(Number(e.target.value))} aria-label={t("Momento da partida")} />
        <div className="sim-niveis">
          <button className="ghost-btn" onClick={() => ir(0)} title={t("Início")}>⏮</button>
          <button className="ghost-btn" onClick={() => ir(turnoDe((m?.turno ?? 1) - 1))} title={t("Turno anterior")}>⏪</button>
          <button className="ghost-btn" onClick={() => ir(r.k - 1)} title={t("Lance anterior")}>◀</button>
          <button className="ghost-btn" onClick={() => ir(r.k + 1)} title={t("Próximo lance")}>▶</button>
          <button className="ghost-btn" onClick={() => { const i = turnoDe((m?.turno ?? 0) + 1); ir(i < 0 ? ultimo : i); }} title={t("Próximo turno")}>⏩</button>
          <button className="ghost-btn" onClick={() => ir(ultimo)} title={t("Fim")}>⏭</button>
        </div>
        <small className="tags-note">{t("Na revisão, as cartas escondidas dos dois lados ficam visíveis.")}</small>
        {r.decisoes && (
          <div className="sim-decisoes">
            <div className="sim-niveis">
              <button className="ghost-btn" onClick={() => setReproduzindo(!reproduzindo)} aria-pressed={reproduzindo}>
                {reproduzindo ? t("⏸ Pausar") : t("▶ Reproduzir")}
              </button>
            </div>
            {ultimaDecisao && (
              <p className="sim-decisao-atual">
                <strong>
                  {t("Turno {0} · {1}", [ultimaDecisao.turno, quem(ultimaDecisao.jogador)])}: {ultimaDecisao.acao}
                </strong>
                <br />
                <small>{ultimaDecisao.motivo}</small>
              </p>
            )}
            <details>
              <summary>{t("Decisões da IA ({0})", [listaDecisoes.length])}</summary>
              <label className="sim-janelas">
                <input type="checkbox" checked={todasDecisoes} onChange={(e) => setTodasDecisoes(e.target.checked)} /> {t("Mostrar também as passagens sem nada a ativar")}
              </label>
              <ol>
                {listaDecisoes.map((x) => (
                  <li key={x.n} className={ultimaDecisao?.n === x.n ? "sim-decisao-marcada" : ""}>
                    <button className="link-btn" onClick={() => ir(x.n + 1)}>
                      {t("T{0} · {1}: {2}", [x.turno, quem(x.jogador), x.acao])}
                    </button>
                    <small>{x.motivo}</small>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        )}
        {r.recebido && (
          <small className="tags-note">
            {t("Replay compartilhado: {0} x {1}.", [r.recebido.jogador, r.oponente])}
            {r.recebido.aviso && (
              <>
                <br />
                {r.recebido.aviso}
              </>
            )}
          </small>
        )}
        <div className="sim-niveis">
          {r.recebido && (
            <button className="ghost-btn" disabled={r.recebido.salvo} onClick={() => void salvarRecebido()}>
              {r.recebido.salvo ? t("Salvo nos seus replays") : t("Salvar nos meus replays")}
            </button>
          )}
          <button className="ghost-btn" onClick={sairRevisao}>
            {t("Sair da revisão")}
          </button>
        </div>
      </div>
    );
  };

  // painel de perguntas: no alto da coluna da direita (nunca sobre o campo)
  const painelPergunta = pergunta && (
            <div className="sim-pergunta-painel" role="dialog" aria-label={t("Perguntas / Dúvidas sobre o duelo")}>
              <h4>{t("Perguntas / Dúvidas sobre o duelo")}</h4>
              <p className="tags-note">{t("Por que uma carta não pôde ser usada? Escolha de quem é a carta e qual carta.")}</p>
              <p className="tags-note">{revisao ? t("Pergunta sobre o momento mostrado na revisão.") : t("Pergunta sobre este momento do duelo.")}</p>
              <label className="sim-campo">
                <span className="field-label">{t("De quem")}</span>
                <select value={pergunta.jogador} onChange={(e) => setPergunta({ jogador: Number(e.target.value), code: null, resposta: null, carregando: false })}>
                  <option value={op}>{revisao ? revisao.oponente : rotuloOp}</option>
                  <option value={eu}>{t("Você")}</option>
                </select>
              </label>
              <label className="sim-campo">
                <span className="field-label">{t("Carta")}</span>
                <select value={pergunta.code ?? ""} onChange={(e) => setPergunta({ ...pergunta, code: Number(e.target.value) || null, resposta: null })}>
                  <option value="">{t("Escolha a carta")}</option>
                  {(["extra", "main"] as const).map((parte) => {
                    const ids = [...new Set(partidaRef.current?.decks[pergunta.jogador]?.[parte] ?? [])].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b)));
                    return ids.length ? (
                      <optgroup key={parte} label={parte === "extra" ? t("Extra Deck") : t("Deck")}>
                        {ids.map((id) => (
                          <option key={id} value={id}>
                            {nomeDe(id)}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </label>
              <button className="ghost-btn" disabled={!pergunta.code || pergunta.carregando} onClick={() => pergunta.code && void perguntar(pergunta.jogador, pergunta.code)}>
                {pergunta.carregando ? t("Consultando o motor…") : t("Perguntar")}
              </button>
              {pergunta.resposta && (
                <div className="sim-resposta" role="status">
                  <p>
                    <strong>{pergunta.resposta.conclusao}</strong>
                  </p>
                  <ul>
                    {pergunta.resposta.itens.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button className="ghost-btn" onClick={() => setPergunta(null)}>
                {t("Fechar")}
              </button>
            </div>
  );

  // "Criar Token": dados da Ficha (padrão: Token, Nível 1, TREVAS, Besta, 0/0)
  const painelFicha = ficha && (
    <div className="sim-pergunta-painel" role="dialog" aria-label={t("Criar Token")}>
      <h4>{t("Criar Token")}</h4>
      <p className="tags-note">{t("Escolha a posição, a zona e os dados da Ficha. Fichas criadas por efeitos de cartas (como Nibiru) já vêm com os dados certos.")}</p>
      <label className="sim-campo">
        <span className="field-label">{t("Tipo")}</span>
        <select value={ficha.raca} onChange={(e) => setFicha({ ...ficha, raca: Number(e.target.value) })}>
          {TIPOS_MONSTRO.map((n, i) => (
            <option key={i} value={1 << i}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="sim-campo">
        <span className="field-label">{t("Atributo")}</span>
        <select value={ficha.atributo} onChange={(e) => setFicha({ ...ficha, atributo: Number(e.target.value) })}>
          {ATRIBUTOS.map(([b, n]) => (
            <option key={b} value={b}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="sim-campo">
        <span className="field-label">{t("Posição de batalha")}</span>
        <select value={ficha.posicao} onChange={(e) => setFicha({ ...ficha, posicao: Number(e.target.value) as 1 | 4 })}>
          <option value={1}>{t("Ataque")}</option>
          <option value={4}>{t("Defesa")}</option>
        </select>
      </label>
      <label className="sim-campo">
        <span className="field-label">{t("Zona no campo")}</span>
        <select value={ficha.sequencia} onChange={(e) => setFicha({ ...ficha, sequencia: Number(e.target.value) })}>
          {[0, 1, 2, 3, 4]
            .filter((i) => !meuLado.monstros[i])
            .map((i) => (
              <option key={i} value={i}>
                {t("Zona de Monstros {0}", [i + 1])}
              </option>
            ))}
        </select>
      </label>
      <div className="sim-ficha-numeros">
        <label className="sim-campo">
          <span className="field-label">{t("Nível")}</span>
          <input type="number" min={1} max={12} value={ficha.nivel} onChange={(e) => setFicha({ ...ficha, nivel: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} />
        </label>
        <label className="sim-campo">
          <span className="field-label">ATK</span>
          <input type="number" min={0} max={9999} step={100} value={ficha.atk} onChange={(e) => setFicha({ ...ficha, atk: Math.max(0, Math.min(9999, Number(e.target.value) || 0)) })} />
        </label>
        <label className="sim-campo">
          <span className="field-label">DEF</span>
          <input type="number" min={0} max={9999} step={100} value={ficha.def} onChange={(e) => setFicha({ ...ficha, def: Math.max(0, Math.min(9999, Number(e.target.value) || 0)) })} />
        </label>
      </div>
      <div className="sim-niveis">
        <button className="ghost-btn" onClick={criarFicha}>
          {t("Criar")}
        </button>
        <button className="ghost-btn" onClick={() => setFicha(null)}>
          {t("Cancelar")}
        </button>
      </div>
    </div>
  );

  const preCard = preview !== null ? byId.get(preview) : undefined;
  // Modo de Treino: carta em foco (a do mouse ou a última que o jogador ativou) e as cartas que ele tem
  const canon = (c: number) => byId.get(c)?.id ?? c;
  const ultimaMinha = [...ativacoes.itens].reverse().find((a) => a.p === eu)?.code;
  const focoTreino = preview !== null ? canon(preview) : ultimaMinha ? canon(ultimaMinha) : null;
  const disponiveis = [...meuLado.mao, ...meuLado.monstros, ...meuLado.magias].flatMap((c) => (c ? [canon(c.code)] : []));
  // guia de combo: a mão do oponente fica escondida (estimativa pelo uso das respostas em torneios)
  const avaliacaoGuia = guia
    ? avaliarGuia({
        estado: guia,
        linhasDoDeck: combosDeck.flatMap((g) => g.linhas),
        mao: meuLado.mao.flatMap((c) => (c ? [canon(c.code)] : [])),
        campo: [...meuLado.monstros, ...meuLado.magias].flatMap((c) => (c ? [canon(c.code)] : [])),
        maoOponente: null,
        uso: (id) => usoEmTorneio(db.extras?.uso, id),
        legal: (id) => {
          const c = byId.get(id);
          return !c || legalIn(c, "TCG") || legalIn(c, "OCG");
        },
      })
    : null;
  /** Estado do duelo em texto para o assistente do chat (as cartas viradas do oponente ficam ocultas) */
  const contextoDuelo = () => {
    const nomes = (cs: (CartaSim | null)[], oculta: (c: CartaSim) => boolean, campo = true) =>
      cs.flatMap((c) => (!c ? [] : [oculta(c) ? "carta virada para baixo" : !campo ? nomeDe(c.code) : `${nomeDe(c.code)}${c.atk !== undefined && !virada(c.pos) ? ` (${c.atk}/${c.def}${c.pos & 0xc ? ", defesa" : ""})` : virada(c.pos) ? " (baixada)" : ""}`])).join("; ") || "nenhuma";
    const lado = (l: typeof meuLado, meu: boolean) =>
      [
        `PV: ${l.lp}`,
        meu ? `Mão: ${nomes(l.mao, () => false, false)}` : `Mão: ${l.mao.length} carta(s)${l.mao.some((c) => c.pub) ? ` (reveladas: ${nomes(l.mao.filter((c) => c.pub), () => false, false)})` : ""}`,
        `Monstros: ${nomes(l.monstros, (c) => !meu && virada(c.pos))}`,
        `Magias/Armadilhas: ${nomes(l.magias, (c) => !meu && virada(c.pos))}`,
        `Cemitério: ${nomes(l.cemiterio, () => false, false)}`,
        `Banidas: ${nomes(l.banidas, (c) => !meu && virada(c.pos))}`,
        `Deck: ${l.deck} carta(s)`,
      ].join("\n");
    const log = registro
      .filter((e) => e.t !== "resolve" && e.t !== "cadeia-fim" && e.t !== "voo" && e.t !== "alvo")
      .slice(-15)
      .map((e) => `- ${textoEvento(e, eu, nomeDe, rotuloOp)}`)
      .join("\n");
    return [
      `Turno ${est.turno}, de ${minhaVez ? "jogador" : "oponente"}; fase ${siglaFase(est.fase)}.`,
      `JOGADOR:\n${lado(meuLado, true)}`,
      `OPONENTE (${rotuloOp}):\n${lado(lado2, false)}`,
      est.cadeia.length ? `Corrente em aberto: ${est.cadeia.map((c, i) => `${i + 1}. ${nomeDe(c.code)}`).join(", ")}` : "",
      `Últimos acontecimentos:\n${log || "nenhum"}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  };
  const vencedorFim = quadro.fim?.vencedor ?? desistencia?.vencedor;
  const fimTexto =
    quadro.fim || desistencia
      ? (desistencia && !quadro.fim ? (desistencia.quem === "eu" ? t("Você desistiu.") + " " : t("{0} desistiu ou saiu.", [rotuloOp]) + " ") : "") +
        (vencedorFim === eu ? t("Você venceu!") : vencedorFim === op ? t("{0} venceu.", [rotuloOp]) : t("Fim do duelo."))
      : null;
  // match: o placar com o jogo que acabou de terminar
  const fimMatch = situacaoMatch(fimTexto ? (vencedorFim === eu ? "eu" : vencedorFim === op ? "op" : null) : undefined);

  return (
    <ScreenShell
      title={revisao ? t("Revisão da partida") : tituloTela}
      accent="magenta"
      onBack={() => (revisao ? sairRevisao() : fimTexto && !(fimMatch && !fimMatch.encerrada) ? onBack() : setSair(true))}
      plain
      actions={
        <div className="sim-topo">
          <div className="sim-fases-bloco">
          {!revisao && !fimTexto && (
            <span className={`sim-de-quem ${minhaVez ? "sim-de-quem-meu" : "sim-de-quem-op"}`} role="status">
              {minhaVez ? t("Seu Turno") : t("Turno do Oponente")}
            </span>
          )}
          <nav className="sim-fases" aria-label={t("Fases do turno")}>
            {BARRA_FASES.map((f) => {
              const atual = siglaFase(est.fase) === f.id;
              const ir = revisao ? null : passarPara(f.id);
              return (
                <button
                  key={f.id}
                  className={`sim-fase ${atual ? "sim-fase-atual" : ""} ${ir ? "sim-fase-pode" : ""}`}
                  disabled={!ir}
                  onClick={() => ir && responder(ir)}
                  title={atual ? t("{0} (fase atual)", [f.nome]) : ir ? t("Ir para a {0}", [f.nome]) : f.nome}
                  aria-current={atual ? "step" : undefined}
                >
                  {f.id}
                </button>
              );
            })}
          </nav>
          </div>
          <div className="sim-topo-botoes">
          <button className="ghost-btn sim-pergunta-btn" onClick={() => { setFicha(null); setPergunta({ jogador: op, code: null, resposta: null, carregando: false }); }} title={t("Por que uma carta não pôde ser usada?")}>
            {t("Perguntas / Dúvidas sobre o duelo")}
          </button>
          {!revisao && !fimTexto && (
            <button className="danger-btn" onClick={() => setConfirmarDesistir(true)}>
              {t("Desistir")}
            </button>
          )}
          </div>
        </div>
      }
    >
      <div className="teste-jogo sim">
        <Lateral className={`tj-esq ${guia && avaliacaoGuia ? "tj-esq-guia" : ""}`} titulo={t("Carta")}>
          <div className="tj-esq-carta">
          {preview !== null ? (
            <>
              <img src={cardImage(preview, "full")} alt={nomeDe(preview)} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              <strong>{nomeDe(preview)}</strong>
              {preCard && <small>{kindLabel(preCard)}</small>}
              {preCard && <p>{preCard.descPt ?? preCard.desc}</p>}
              {treino && preCard && <InteracoesCarta key={preCard.id} card={preCard} byId={byId} />}
            </>
          ) : (
            <p className="tags-note">{t("Passe o mouse sobre uma carta para ver os detalhes. Cartas com contorno brilhante têm ações: clique nelas.")}</p>
          )}
          </div>
          {guia && avaliacaoGuia && (
            <PainelGuia
              estado={guia}
              avaliacao={avaliacaoGuia}
              nomeDe={nomeDe}
              byId={byId}
              onHover={(c) => c && setPreview(c.id)}
              onPasso={(k) => setGuia((g) => (g ? { ...g, passo: Math.max(0, Math.min(passosDaLinha(g.linha).length - 1, k)) } : g))}
              onDesfazer={(i) => setGuia((g) => (g ? { ...g, interrupcoes: g.interrupcoes.filter((_, n) => n !== i) } : g))}
              onFechar={() => setGuia(null)}
            />
          )}
        </Lateral>
        {escolhendoCombo && (
          <EscolherCombo
            grupos={combosDeck}
            nomeDe={nomeDe}
            descricao={t("Combos dos arquétipos do seu deck (calculados com as regras das cartas). Escolha um: o painel abaixo da carta acompanha os passos a partir de agora; a mão do duelo não muda.")}
            onEscolher={(l) => {
              setGuia({ linha: l, passo: 0, interrupcoes: [] });
              setEscolhendoCombo(false);
            }}
            onFechar={() => setEscolhendoCombo(false)}
          />
        )}

        <section className="tj-mesa tj-mesa-avancada" onClick={() => setMenu(null)}>
          <div className="sim-mao-linha">
            <span className="sim-nome" title={nomeOponente}>
              {nomeOponente.slice(0, 15)}
            </span>
            <div className="tj-mao tj-mao-op" aria-label={t("Mão do oponente")} data-mao={op}>
              {lado2.mao.map((c, i) => (
                <div key={i} className={`tj-mao-carta ${i >= lado2.mao.length - comprando[op] ? "sim-comprada sim-comprada-op" : ""}`} style={{ animationDelay: `${Math.max(0, i - (lado2.mao.length - comprando[op])) * 150}ms` }}>
                  {carta(c, chave(op, L.HAND, i), !revisao && !c.pub)}
                </div>
              ))}
            </div>
          </div>
          {treino && !revisao && (
            <TreinoCombos
              carta={focoTreino}
              linhas={db.extras?.combos?.linhas ?? []}
              deck={(meu?.deck.main ?? []).map(canon)}
              disponiveis={disponiveis}
              nomeDe={nomeDe}
              onPedir={minhaVez && pedido && !pensando && !fimTexto ? pedirJogada : undefined}
              sugestao={sugestao}
              onCombos={() => setEscolhendoCombo(true)}
            />
          )}
          <div className="tj-campo">
            <div className="tj-l3 tj-linha-op">
              {pilha(op, "deck")}
              {[4, 3, 2, 1, 0].map((i) => zonaCampo(op, L.SZONE, i, "tj-st", lado2.magias[i]))}
              {pilha(op, "extra")}
            </div>
            <div className="tj-l2 tj-linha-op">
              {pilha(op, "cemiterio")}
              {[4, 3, 2, 1, 0].map((i) => zonaCampo(op, L.MZONE, i, "tj-m", lado2.monstros[i]))}
              {zonaCampo(op, L.SZONE, 5, "tj-campo-magia", lado2.magias[5])}
            </div>
            <div className="tj-l1">
              {pilha(op, "banido")}
              <div className="sim-acoes-campo">
                {!revisao && !fimTexto && pedido?.msg.type === T.SELECT_IDLECMD && (
                  <button className="ghost-btn" onClick={abrirFicha} title={t("Cria uma Ficha numa Zona de Monstros livre")}>
                    {t("Criar Token")}
                  </button>
                )}
                {!revisao && !fimTexto && (
                  <button className="ghost-btn" onClick={jogarDado} disabled={!!dado?.rolando}>
                    {t("Jogar dado")}
                  </button>
                )}
              </div>
              {emz(0)}
              <span className="sim-centro">
                <b className={`sim-lp ${!minhaVez ? "sim-lp-vez" : ""}`} title={t("Pontos de Vida de {0}", [nomeOponente])}>
                  {lado2.lp}
                </b>
                <strong>{siglaFase(est.fase)}</strong>
                <small>{t("Turno {0}", [est.turno])}</small>
                <b className={`sim-lp ${minhaVez ? "sim-lp-vez" : ""}`} title={t("Seus Pontos de Vida")}>
                  {meuLado.lp}
                </b>
              </span>
              {emz(1)}
              <span />
              {pilha(eu, "banido")}
            </div>
            <div className="tj-l2">
              {zonaCampo(eu, L.SZONE, 5, "tj-campo-magia", meuLado.magias[5])}
              {[0, 1, 2, 3, 4].map((i) => zonaCampo(eu, L.MZONE, i, "tj-m", meuLado.monstros[i]))}
              {pilha(eu, "cemiterio")}
            </div>
            <div className="tj-l3">
              {pilha(eu, "extra")}
              {[0, 1, 2, 3, 4].map((i) => zonaCampo(eu, L.SZONE, i, "tj-st", meuLado.magias[i]))}
              {pilha(eu, "deck")}
            </div>
          </div>
          <div className="sim-mao-linha">
            <span className="sim-nome" title={meuNome}>
              {meuNome.slice(0, 15)}
            </span>
            <div className="tj-mao" aria-label={t("Sua mão")} data-mao={eu}>
              {meuLado.mao.map((c, i) => (
                <div key={i} className={`tj-mao-carta ${i >= meuLado.mao.length - comprando[eu] ? "sim-comprada" : ""}`} style={{ animationDelay: `${Math.max(0, i - (meuLado.mao.length - comprando[eu])) * 150}ms` }}>
                  {carta(c, chave(eu, L.HAND, i), false)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <Lateral lado="dir" className="tj-dir sim-dir" titulo={t("Duelo")} abrirCom={pedido && pedido.msg.type !== T.SELECT_IDLECMD && pedido.msg.type !== T.SELECT_BATTLECMD ? pedido : undefined}>
          {pergunta && painelPergunta}
          {ficha && painelFicha}
          {ativacoes.itens.length > 0 && (
            <div className={`sim-cadeia ${ativacoes.aberta ? "sim-cadeia-aberta" : ""}`} aria-live="polite">
              <h4>{ativacoes.aberta ? t("Em ativação") : t("Última ativação")}</h4>
              <ol>
                {[...ativacoes.itens].reverse().map((a) => (
                  <li
                    key={a.elo}
                    className={a.resolvida ? "sim-resolvida" : ""}
                    onMouseEnter={() => {
                      setPreview(a.code);
                      setFoco(chave(a.p, a.location, a.sequence));
                    }}
                    onMouseLeave={() => setFoco(null)}
                  >
                    <span className="sim-elo-num">{a.elo}</span>
                    <span>
                      <strong>
                        {a.p === eu ? t("Você") : rotuloOp}: {nomeDe(a.code)}
                      </strong>
                      <small>{lugarDe(a.location, a.p === eu)}</small>
                      {a.texto && <em>{a.texto}</em>}
                      {!!a.alvos?.length && <small className="sim-alvos">{t("Alvo: {0}", [a.alvos.map((c) => (c.code ? nomeDe(c.code) : t("carta baixada"))).join(", ")])}</small>}
                      {!!a.declarado && <small className="sim-alvos">{t("Nome declarado: {0}", [nomeDe(a.declarado)])}</small>}
                    </span>
                    {a.resolvida && <span aria-label={t("resolvida")}>✓</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {revisao ? (
            painelRevisao(revisao)
          ) : fimTexto ? (
            <div className="sim-fim" role="status">
              <strong>{fimTexto}</strong>
              {fimMatch && (
                <p className="sim-placar">
                  {fimMatch.atualizando
                    ? t("Atualizando o placar da match…")
                    : t("Match: você {0} x {1} {2}", [fimMatch.placar.eu, fimMatch.placar.op, rotuloOp])}
                  {fimMatch.vencedor === "eu" && <strong> · {t("Você venceu a match!")}</strong>}
                  {fimMatch.vencedor === "op" && <strong> · {t("{0} venceu a match.", [rotuloOp])}</strong>}
                  {fimMatch.encerrada && !fimMatch.vencedor && <strong> · {t("A match terminou.")}</strong>}
                </p>
              )}
              <div className="sim-niveis">
                {fimMatch && !fimMatch.encerrada ? (
                  <>
                    <button className="ghost-btn" onClick={proximoJogo} disabled={fimMatch.atualizando} autoFocus>
                      {t("Próximo jogo")}
                    </button>
                    <button className="ghost-btn" onClick={() => setConfirmarDesistir(true)}>
                      {t("Abandonar match")}
                    </button>
                  </>
                ) : (
                  <button className="ghost-btn" onClick={novaPartida}>
                    {t("Nova partida")}
                  </button>
                )}
                {aprendido && (
                  <button className="ghost-btn" onClick={() => void abrirRevisao({ partida: aprendido.partida, humano: aprendido.humano, nivel: "normal", historico: aprendido.historico }, rotuloOp)}>
                    {t("Revisar a partida")}
                  </button>
                )}
                {aprendido && !sala && (
                  <button className="ghost-btn" disabled={analise?.status === "analisando"} onClick={() => void analisar(aprendido, "fim")}>
                    {t("Análise da IA")}
                  </button>
                )}
              </div>
              {analise?.chave === "fim" && <AnaliseIA analise={analise} nomeDe={nomeDe} quem={(j) => (j === eu ? conta?.usuario || t("Você") : rotuloOp)} />}
              {aprendido && <Aprendido a={aprendido} nomeDe={nomeDe} oponente={rotuloOp} />}
            </div>
          ) : pensando || !pedido ? (
            <p className="sim-pensando" role="status">
              {sala ? t("Vez de {0}…", [rotuloOp]) : t("A IA está pensando…")}
            </p>
          ) : (
            <Escolha pedido={pedido} nomeDe={nomeDe} responder={responder} eu={eu} setPreview={setPreview} marcadas={marcadas} setMarcadas={setMarcadas} tocar={tocar} setFoco={setFoco} fase={minhaVez && !est.cadeia.length ? siglaFase(est.fase) : ""} />
          )}
          {!revisao && (
          <label className="sim-janelas" title={t("Desligado: o simulador pergunta se você quer encadear quando há uma corrente aberta (de qualquer jogador) ou logo depois de uma jogada do oponente, e pula as janelas vazias, como as das mudanças de fase.")}>
            <input
              type="checkbox"
              checked={!!cfg.todasJanelas}
              onChange={(e) => {
                const novo = { ...cfg, todasJanelas: e.target.checked };
                setCfg(novo);
                gravarConfig({ ...novo, meu: meu?.valor ?? novo.meu, ia: doIA?.valor ?? novo.ia });
                cliente.current?.janelas(e.target.checked ? "todas" : "acao");
              }}
            />
            {t("Pausar em todas as janelas de resposta")}
          </label>
          )}

          {aviso && <p className="tags-note">{aviso}</p>}
          {erro && (
            <p className="conta-erro" role="alert">
              {erro}
            </p>
          )}
          <h3>{t("Registro")}</h3>
          <ol className="tj-log sim-log" aria-label={t("Registro do duelo")}>
            {[...registro]
              .reverse()
              .map((e, i) => [e, registro.length - i] as const)
              .filter(([e]) => e.t !== "resolve" && e.t !== "cadeia-fim" && e.t !== "voo" && e.t !== "alvo")
              .map(([e, k]) => (
                <li key={k}>{textoEvento(e, eu, nomeDe, rotuloOp)}</li>
              ))}
          </ol>
          {!revisao && (
            <>
              <button className={`ghost-btn sim-chat-btn ${chatAberto ? "sim-ativo" : ""}`} onClick={() => setChatAberto(!chatAberto)} aria-expanded={chatAberto}>
                {sala ? t("Chat com {0}", [rotuloOp]) : t("Chat com o assistente")}
                {sala && !chatAberto && chatOponente[chatOponente.length - 1]?.minha === false && <span className="sim-chat-novo" aria-label={t("mensagens novas")} />}
              </button>
              {chatAberto &&
                (sala ? (
                  <ChatOponente
                    mensagens={chatOponente}
                    nome={rotuloOp}
                    enviar={(texto) => {
                      setChatOponente((m) => [...m, { minha: true, texto }].slice(-100));
                      void enviarChat(sala.id, eu as 0 | 1, texto).then((ok) => !ok && setErro(t("O chat não conectou. Tente de novo em instantes.")));
                    }}
                  />
                ) : (
                  <ChatAssistente contexto={contextoDuelo} />
                ))}
            </>
          )}
        </Lateral>

        {lista && (
          <div className="tj-menu-fundo" onClick={() => setLista(null)}>
            <div className="tj-lista" role="dialog" aria-label={lista.titulo} onClick={(e) => e.stopPropagation()}>
              <h4>{lista.titulo}</h4>
              <div className="tj-lista-cartas">{lista.cartas.map(({ c, k, oculta }) => carta(c, k, oculta))}</div>
              <button className="ghost-btn" onClick={() => setLista(null)}>
                {t("Fechar")}
              </button>
            </div>
          </div>
        )}

        {menu && (
          <div className="tj-menu-fundo sim-menu-fundo" onClick={() => setMenu(null)}>
            {/* logo acima da carta clicada, sem cobrir ela nem as vizinhas da lista; sem espaço em cima, logo abaixo */}
            <ul
              className="tj-menu"
              style={{
                left: Math.max(8, Math.min(menu.x, window.innerWidth - 300)),
                top: menu.topo - 44 * menu.acoes.length - 22 >= 8 ? menu.topo - 44 * menu.acoes.length - 22 : Math.min(menu.base + 6, window.innerHeight - 44 * menu.acoes.length - 22),
              }}
              role="menu"
            >
              {menu.acoes.map((a, i) => (
                <li key={i}>
                  <button role="menuitem" onClick={() => responder(a.resp)}>
                    {a.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {revelacao && (
          <div className="tj-menu-fundo" onClick={() => setRevelacao(null)}>
            <div className="tj-lista" role="dialog" aria-label={t("Cartas reveladas")} onClick={(e) => e.stopPropagation()}>
              <h4>{t("Cartas reveladas")}</h4>
              <div className="tj-lista-cartas">
                {revelacao.map((c, i) => (
                  <div key={i} className="tj-carta" onMouseEnter={() => setPreview(c.code)} title={nomeDe(c.code)}>
                    <img src={cardImage(c.code, "small")} alt={nomeDe(c.code)} onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
                  </div>
                ))}
              </div>
              <small className="tags-note">{revelacao.every((c) => c.controller === op) ? t("Cartas do oponente") : t("Cartas mostradas")}</small>
              <button className="ghost-btn" onClick={() => setRevelacao(null)} autoFocus>
                {t("Fechar")}
              </button>
            </div>
          </div>
        )}

        {voos.map((v) => (
          <div key={v.id} className="sim-voo" style={{ left: v.de.x, top: v.de.y, ["--dx" as string]: `${v.para.x - v.de.x}px`, ["--dy" as string]: `${v.para.y - v.de.y}px` }} aria-hidden>
            {v.oculta || !v.code ? <div className="tj-verso" /> : <img src={cardImage(v.code, "small")} alt="" />}
          </div>
        ))}

        {dado && (
          <div className={`sim-dado ${dado.rolando ? "sim-dado-rolando" : ""}`} role="status" aria-live="polite" aria-label={dado.rolando ? t("Jogando o dado…") : t("Dado: {0}", [dado.valor])}>
            <span>{dado.valor}</span>
          </div>
        )}

        {confirmarDesistir && (
          <div className="tj-menu-fundo" onClick={() => setConfirmarDesistir(false)}>
            <div className="tj-lista sim-sair" role="dialog" aria-label={t("Desistir")} onClick={(e) => e.stopPropagation()}>
              <h4>{fimTexto ? t("Abandonar a match?") : fimMatch ? t("Desistir do jogo?") : t("Desistir do duelo?")}</h4>
              <p>
                {fimTexto
                  ? t("{0} vence a match.", [rotuloOp])
                  : fimMatch
                    ? t("Desistir: {0} vence este jogo e a match continua. Abandonar: {0} vence a match.", [rotuloOp])
                    : t("{0} vence o duelo.", [rotuloOp])}
              </p>
              <div className="sim-niveis">
                {!fimTexto && (
                  <button className="danger-btn" onClick={desistir} autoFocus>
                    {fimMatch ? t("Desistir do jogo") : t("Desistir")}
                  </button>
                )}
                {fimMatch && !fimMatch.encerrada && (
                  <button className="danger-btn" onClick={abandonar}>
                    {t("Abandonar match")}
                  </button>
                )}
                <button className="ghost-btn" onClick={() => setConfirmarDesistir(false)}>
                  {fimTexto ? t("Continuar na match") : t("Continuar duelando")}
                </button>
              </div>
            </div>
          </div>
        )}

        {sair && (
          <div className="tj-menu-fundo" onClick={() => setSair(false)}>
            <div className="tj-lista sim-sair" role="dialog" aria-label={t("Sair do duelo")} onClick={(e) => e.stopPropagation()}>
              <h4>{t("Sair do duelo?")}</h4>
              <p>{fimMatch && !fimMatch.encerrada ? t("Sair abandona a match: {0} vence.", [rotuloOp]) : sala ? t("Sair conta como desistência: {0} vence.", [rotuloOp]) : t("O duelo em andamento será perdido.")}</p>
              <div className="sim-niveis">
                <button
                  className="danger-btn"
                  onClick={() => {
                    if (fimMatch && !fimMatch.encerrada) abandonar();
                    else if (!fimTexto) desistir();
                    onBack();
                  }}
                  autoFocus
                >
                  {t("Sair")}
                </button>
                <button className="ghost-btn" onClick={() => setSair(false)}>
                  {t("Continuar duelando")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

/** O que o duelo ensinou: turnos de combo e respostas do jogador (fica só neste aparelho) */
/** Relatório da "Análise da IA": o que decidiu o duelo e as escolhas melhores que ela encontrou */
function AnaliseIA({ analise, nomeDe, quem }: { analise: { status: "analisando" | "ok" | "erro"; dados?: AnaliseDuelo; erro?: string }; nomeDe: (c: number) => string; quem: (jogador: number) => string }) {
  if (analise.status === "analisando")
    return (
      <p className="tags-note sim-analise" role="status">
        {t("A IA está refazendo a partida e testando outras escolhas (leva de 2 a 3 minutos)…")}
      </p>
    );
  if (analise.status === "erro" || !analise.dados) return <p className="conta-erro sim-analise">{t("Não foi possível analisar: {0}", [analise.erro ?? ""])}</p>;
  const { fatos, achados } = analise.dados;
  const fato = (f: FatoDuelo) =>
    f.t === "negado"
      ? f.por
        ? t("Turno {0}: {1} ({2}) foi negado por {3}", [f.turno, nomeDe(f.carta), quem(f.jogador), nomeDe(f.por)])
        : t("Turno {0}: {1} ({2}) foi negado", [f.turno, nomeDe(f.carta), quem(f.jogador)])
      : f.t === "pv"
        ? t("Turno {0}: {1} perdeu {2} PV", [f.turno, quem(f.jogador), f.perdeu])
        : f.vencedor === null
          ? t("Turno {0}: empate", [f.turno])
          : t("Turno {0}: vitória de {1}", [f.turno, quem(f.vencedor)]);
  return (
    <section className="sim-analise">
      <h4>{t("O que decidiu o duelo")}</h4>
      {fatos.length ? (
        <ul>
          {fatos.map((f, i) => (
            <li key={i}>{fato(f)}</li>
          ))}
        </ul>
      ) : (
        <p className="tags-note">{t("Nenhuma negação nem perda grande de PV.")}</p>
      )}
      <h4>{t("O que a IA poderia ter feito melhor")}</h4>
      {achados.length ? (
        <>
          <ul>
            {achados.map((a, i) => (
              <li key={i}>
                {t("Turno {0}: Invocar {1} {2} em vez de passar a vez (+{3} na avaliação do campo no começo do turno seguinte dela)", [a.turno, nomeDe(a.carta), a.defesa ? t("em Posição de Defesa") : t("em Posição de Ataque"), a.ganho])}
              </li>
            ))}
          </ul>
          <small className="tags-note">
            {t("A IA guardou isso: {0} passam a valer mais quando ela avaliar o campo nos próximos duelos.", [[...new Set(achados.map((a) => nomeDe(a.carta)))].join(", ")])}
          </small>
        </>
      ) : (
        <p className="tags-note">{t("Nos momentos em que a IA passou a vez, as Invocações testadas não deixaram o campo melhor.")}</p>
      )}
      <small className="tags-note">{t("Em cada momento, a IA joga pelos dois lados até o começo do turno seguinte dela, com e sem a escolha, e compara a nota do campo.")}</small>
    </section>
  );
}

function Aprendido({ a, nomeDe, oponente }: { a: Aprendizado; nomeDe: (c: number) => string; oponente: string }) {
  const nomes = (ids: number[]) => ids.map((c) => (c ? nomeDe(c) : t("Ficha"))).join(", ") || "—";
  const evento = (r: Aprendizado["respostas"][number]) => {
    const e = r.evento;
    if (!e) return t("sem jogada antes");
    const quem = e.doOponente ? oponente : t("você");
    const carta = e.code ? nomeDe(e.code) : "";
    switch (e.tipo) {
      case "busca":
        return t("depois de {0} buscar {1}", [quem, carta]);
      case "invocacao":
        return t("depois de {0} invocar {1}", [quem, carta]);
      case "ativacao":
        return t("depois de {0} ativar {1}", [quem, carta]);
      case "ataque":
        return t("no ataque de {0}", [carta]);
      case "compra":
        return t("depois da compra de {0}", [quem]);
      case "fase":
        return t("na mudança de fase");
    }
  };
  return (
    <details className="sim-aprendido" open>
      <summary>{t("O que este duelo ensinou")}</summary>
      {a.linhas.length > 0 && (
        <>
          <h5>{t("Seus turnos de combo")}</h5>
          <ul>
            {a.linhas.map((l) => (
              <li key={l.n}>
                {t("Turno {0}: mão {1} → campo {2}", [l.turno, nomes(l.mao), nomes([...l.campo.monstros, ...l.campo.magias.map(([c]) => c)])])}
                <small> ({t("{0} passos", [l.passos.length])})</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {a.respostas.length > 0 && (
        <>
          <h5>{t("Suas respostas")}</h5>
          <ul>
            {a.respostas.map((r) => (
              <li key={r.n}>
                {r.escolha ? t("Ativou {0}", [nomeDe(r.escolha)]) : t("Deixou passar ({0})", [nomes(r.opcoes)])} — {evento(r)}
              </li>
            ))}
          </ul>
        </>
      )}
      {!a.linhas.length && !a.respostas.length && <p className="tags-note">{t("Nenhum turno de combo nem resposta sua neste duelo.")}</p>}
      <small className="tags-note">{t("Fica só neste aparelho. Enviar para a IA aprender virá numa próxima etapa, só com a sua autorização.")}</small>
    </details>
  );
}

/** Painel da decisão em aberto (tudo menos as ações de Main/Battle Phase, que ficam nas cartas) */
interface PropsEscolha {
  pedido: PedidoSim;
  nomeDe: (c: number) => string;
  responder: (r: OcgResponse) => void;
  eu: number;
  setPreview: (c: number) => void;
  /** seleção compartilhada com o tabuleiro (índices da mensagem) */
  marcadas: number[];
  setMarcadas: (f: (m: number[]) => number[]) => void;
  /** escolhe a carta de índice i (o mesmo que clicar nela no tabuleiro) */
  tocar: (i: number) => void;
  /** acende no tabuleiro a carta da opção sob o mouse */
  setFoco: (k: string | null) => void;
  /** fase do turno do jogador sem corrente aberta ("DP", "SP"…); vazio fora disso */
  fase: string;
}

function Escolha({ pedido, nomeDe, responder, eu, setPreview, marcadas, setMarcadas, tocar, setFoco, fase }: PropsEscolha) {
  const d = pedido.msg;
  const [busca, setBusca] = useState("");
  const [contadores, setContadores] = useState<number[]>([]);
  useEffect(() => {
    setBusca("");
    setContadores(d.type === T.SELECT_COUNTER ? d.cards.map(() => 0) : []);
  }, [d]);

  const dica = pedido.dica?.replace(/^HINTMSG_/, "");
  const titulo = pedido.dicaTexto ?? (dica && DICAS[dica]) ?? t("Escolha");
  const texto = (desc: bigint | number) => pedido.textos[String(desc)];
  const aviso = pedido.repetir ? <p className="conta-erro">{t("Essa escolha não vale aqui. Escolha de novo.")}</p> : null;
  const lugar = (c: { controller: number; location: number }) =>
    `${c.location & L.HAND ? t("mão") : c.location & L.DECK ? t("Deck") : c.location & L.GRAVE ? t("Cemitério") : c.location & L.REMOVED ? t("banida") : c.location & L.EXTRA ? t("Extra Deck") : c.location & L.OVERLAY ? t("matéria") : t("campo")}`;
  const cartaBotao = (c: { code: number; controller: number; location: number; sequence?: number }, i: number, ativo: boolean, onClick: () => void, sufixo?: ReactNode) => (
    <button
      key={i}
      className={`sim-opcao-carta ${c.controller === eu ? "sim-opcao-minha" : "sim-opcao-op"} ${ativo ? "sim-ativo" : ""}`}
      onClick={onClick}
      onMouseEnter={() => {
        if (c.code) setPreview(c.code);
        if (c.sequence !== undefined) setFoco(chaveRef({ ...c, sequence: c.sequence }));
      }}
      onMouseLeave={() => setFoco(null)}
      aria-pressed={ativo}
    >
      {c.code ? <img src={cardImage(c.code, "small")} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} /> : <div className="tj-verso" />}
      <span>
        <strong>{c.code ? nomeDe(c.code) : t("Carta virada para baixo")}</strong>
        <small>
          <b className={`sim-dono ${c.controller === eu ? "sim-dono-meu" : "sim-dono-op"}`}>{c.controller === eu ? t("Sua") : t("Oponente")}</b> {lugar(c)}
        </small>
        {sufixo}
      </span>
    </button>
  );

  /** Opções de cartas separadas por dono (com título só quando a escolha mistura os dois lados) */
  const porDono = <C extends { controller: number }>(cartas: C[], desenhar: (c: C, i: number) => ReactNode, inicio = 0) => {
    const minhas = cartas.map((c, i) => [c, i + inicio] as const).filter(([c]) => c.controller === eu);
    const dele = cartas.map((c, i) => [c, i + inicio] as const).filter(([c]) => c.controller !== eu);
    if (!minhas.length || !dele.length) return cartas.map((c, i) => desenhar(c, i + inicio));
    return (
      <>
        <h5 className="sim-grupo sim-dono-meu">{t("Suas cartas")}</h5>
        {minhas.map(([c, i]) => desenhar(c, i))}
        <h5 className="sim-grupo sim-dono-op">{t("Cartas do oponente")}</h5>
        {dele.map(([c, i]) => desenhar(c, i))}
      </>
    );
  };

  // Main Phase / Battle Phase: as ações ficam nas cartas; aqui, as fases
  if (d.type === T.SELECT_IDLECMD || d.type === T.SELECT_BATTLECMD) {
    return (
      <div className="sim-escolha">
        {aviso}
        <p className="tags-note">{t("Sua vez: clique numa carta com contorno para agir. Para mudar de fase, use a barra de fases no topo.")}</p>
      </div>
    );
  }

  const corpo = (): ReactNode => {
    switch (d.type) {
      case T.SELECT_CHAIN:
        if (!d.forced && (fase === "DP" || fase === "SP"))
          return (
            <>
              <h4>{fase === "DP" ? t("Draw Phase") : t("Standby Phase")}</h4>
              <small className="tags-note">
                {d.selects.length ? t("Cartas que você pode ativar nesta fase:") : t("Nenhuma carta sua pode ser ativada nesta fase.")}
              </small>
              {d.selects.map((c, i) => cartaBotao(c, i, false, () => tocar(i), texto(c.description) && <em>{texto(c.description)}</em>))}
              <button className="ghost-btn" onClick={() => responder({ type: R.SELECT_CHAIN, index: null })} autoFocus>
                {fase === "DP" ? t("Ir para a Standby Phase") : t("Ir para a Main Phase 1")}
              </button>
              {fase === "DP" && <small className="tags-note">{t("Na Standby Phase o motor só para se houver carta que possa ser ativada; sem nenhuma, segue para a Main Phase 1.")}</small>}
            </>
          );
        return (
          <>
            <h4>{d.forced ? t("Ative um efeito obrigatório") : t("Encadear um efeito?")}</h4>
            {d.forced && d.selects.length > 1 && (
              <small className="tags-note">{t("Efeitos que acontecem ao mesmo tempo: pela regra, você escolhe a ordem. O que você escolher agora entra como o próximo elo da corrente (e resolve depois dos que vierem em cima dele).")}</small>
            )}
            {d.selects.map((c, i) => cartaBotao(c, i, false, () => tocar(i), texto(c.description) && <em>{texto(c.description)}</em>))}
            {!d.forced && (
              <button className="sim-resolver" onClick={() => responder({ type: R.SELECT_CHAIN, index: null })} autoFocus>
                <strong>{t("Resolver")} ▸</strong>
                <small>{t("Não encadear nada e seguir o duelo")}</small>
              </button>
            )}
          </>
        );
      case T.SELECT_EFFECTYN:
      case T.SELECT_YESNO:
        return (
          <>
            <h4>{d.type === T.SELECT_EFFECTYN ? t("Ativar o efeito de {0}?", [nomeDe(d.code)]) : t("Confirmar?")}</h4>
            {texto(d.description) && <p>{texto(d.description)}</p>}
            <div className="sim-niveis">
              <button className="ghost-btn" onClick={() => responder(d.type === T.SELECT_EFFECTYN ? { type: R.SELECT_EFFECTYN, yes: true } : { type: R.SELECT_YESNO, yes: true })} autoFocus>
                {t("Sim")}
              </button>
              <button className="ghost-btn" onClick={() => responder(d.type === T.SELECT_EFFECTYN ? { type: R.SELECT_EFFECTYN, yes: false } : { type: R.SELECT_YESNO, yes: false })}>
                {t("Não")}
              </button>
            </div>
          </>
        );
      case T.SELECT_OPTION:
        return (
          <>
            <h4>{titulo}</h4>
            {d.options.map((o, i) => (
              <button key={i} className="ghost-btn sim-opcao" onClick={() => responder({ type: R.SELECT_OPTION, index: i })}>
                {texto(o) ?? (pedido.carta ? t("Opção {0} do efeito de {1} (veja o texto da carta à esquerda)", [i + 1, nomeDe(pedido.carta)]) : t("Opção {0}", [i + 1]))}
              </button>
            ))}
          </>
        );
      case T.SELECT_CARD:
      case T.SELECT_TRIBUTE: {
        const ok = marcadas.length >= d.min && marcadas.length <= d.max;
        return (
          <>
            <h4>{titulo}</h4>
            <small className="tags-note">{d.min === d.max ? t("Escolha {0}.", [d.min]) : t("Escolha de {0} a {1}.", [d.min, d.max])}</small>
            {porDono(d.selects as { code: number; controller: number; location: number; sequence: number }[], (c, i) => cartaBotao(c, i, marcadas.includes(i), () => tocar(i)))}
            <div className="sim-niveis">
              {!(d.max === 1 && d.min === 1) && (
                <button className="ghost-btn" disabled={!ok} onClick={() => responder(d.type === T.SELECT_CARD ? { type: R.SELECT_CARD, indicies: marcadas } : { type: R.SELECT_TRIBUTE, indicies: marcadas })}>
                  {t("Confirmar")}
                </button>
              )}
              {d.can_cancel && (
                <button className="ghost-btn" onClick={() => responder(d.type === T.SELECT_CARD ? { type: R.SELECT_CARD, indicies: null } : { type: R.SELECT_TRIBUTE, indicies: null })}>
                  {t("Cancelar")}
                </button>
              )}
            </div>
          </>
        );
      }
      case T.SELECT_UNSELECT_CARD:
        return (
          <>
            <h4>{titulo}</h4>
            {/* as já escolhidas vêm depois das disponíveis na resposta */}
            {porDono(d.select_cards, (c, i) => cartaBotao(c, i, false, () => tocar(i)))}
            {porDono(d.unselect_cards, (c, i) => cartaBotao(c, i, true, () => tocar(i)), d.select_cards.length)}
            {(d.can_finish || d.can_cancel) && (
              <button className="ghost-btn" onClick={() => responder({ type: R.SELECT_UNSELECT_CARD, index: null })}>
                {d.can_finish ? t("Concluir") : t("Cancelar")}
              </button>
            )}
          </>
        );
      case T.SELECT_SUM: {
        const valor = (a: number) => a & 0xffff;
        const soma = [...d.selects_must.map((c) => valor(c.amount)), ...marcadas.map((i) => valor(d.selects[i].amount))].reduce((a, b) => a + b, 0);
        return (
          <>
            <h4>{titulo}</h4>
            <small className="tags-note">{t("Some {0} (agora: {1}).", [d.amount, soma])}</small>
            {d.selects_must.map((c, i) => cartaBotao(c, 1000 + i, true, () => {}, <small>{t("obrigatória")}</small>))}
            {porDono(d.selects, (c, i) => cartaBotao(c, i, marcadas.includes(i), () => tocar(i), <small>{valor(c.amount)}</small>))}
            <button className="ghost-btn" disabled={!marcadas.length && !d.selects_must.length} onClick={() => responder({ type: R.SELECT_SUM, indicies: marcadas })}>
              {t("Confirmar")}
            </button>
          </>
        );
      }
      case T.SELECT_PLACE:
      case T.SELECT_DISFIELD:
        return (
          <>
            <h4>{titulo === t("Escolha") ? t("Escolha a zona no campo") : titulo}</h4>
            <p className="tags-note">{t("Clique numa zona destacada no campo.")}</p>
            <button
              className="ghost-btn"
              onClick={() => {
                const z = zonasLivres(d);
                const places = [...z.filter((x) => x.player === d.player), ...z.filter((x) => x.player !== d.player)].slice(0, Math.max(1, d.count));
                responder(d.type === T.SELECT_PLACE ? { type: R.SELECT_PLACE, places } : { type: R.SELECT_DISFIELD, places });
              }}
            >
              {t("Escolher automaticamente")}
            </button>
          </>
        );
      case T.SELECT_POSITION:
        return (
          <>
            <h4>{t("Posição de {0}", [nomeDe(d.code)])}</h4>
            {POSICOES.filter(([p]) => d.positions & p).map(([p, label]) => (
              <button key={p} className="ghost-btn sim-opcao" onClick={() => responder({ type: R.SELECT_POSITION, position: p as 1 })}>
                {label}
              </button>
            ))}
          </>
        );
      case T.SORT_CARD:
      case T.SORT_CHAIN: {
        // marcadas = índices das cartas na ordem em que foram clicadas; a resposta diz a posição de cada carta
        const completa = marcadas.length === d.cards.length;
        return (
          <>
            <h4>{d.type === T.SORT_CHAIN ? t("Ordem dos seus efeitos na corrente") : t("Ordem das cartas")}</h4>
            <small className="tags-note">
              {d.type === T.SORT_CHAIN
                ? t("Pela regra, quem ativa efeitos ao mesmo tempo escolhe a ordem deles. Clique na ordem dos elos: o 1º entra primeiro na corrente (e resolve por último).")
                : t("Clique as cartas na ordem desejada: a 1ª clicada fica em primeiro.")}
            </small>
            {d.cards.map((c, i) =>
              cartaBotao(
                c,
                i,
                marcadas.includes(i),
                () => setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i])),
                marcadas.includes(i) ? <small className="sim-ordem">{t("{0}º", [marcadas.indexOf(i) + 1])}</small> : undefined,
              ),
            )}
            <div className="sim-niveis">
              <button className="ghost-btn" disabled={!completa} onClick={() => responder({ type: R.SORT_CARD, order: d.cards.map((_, i) => marcadas.indexOf(i)) })}>
                {t("Confirmar ordem")}
              </button>
              <button className="ghost-btn" onClick={() => responder({ type: R.SORT_CARD, order: null })}>
                {t("Usar a ordem proposta")}
              </button>
            </div>
          </>
        );
      }
      case T.ANNOUNCE_NUMBER:
        return (
          <>
            <h4>{titulo}</h4>
            <div className="sim-niveis">
              {d.options.map((n, i) => (
                <button key={i} className="ghost-btn" onClick={() => responder({ type: R.ANNOUNCE_NUMBER, value: i })}>
                  {String(n)}
                </button>
              ))}
            </div>
          </>
        );
      case T.ANNOUNCE_ATTRIB:
      case T.ANNOUNCE_RACE: {
        const disp = Number(d.available);
        const itens = d.type === T.ANNOUNCE_ATTRIB ? ATRIBUTOS.filter(([b]) => disp & b) : TIPOS_MONSTRO.map((n, i) => [1 << i, n] as [number, string]).filter(([b]) => disp & b);
        return (
          <>
            <h4>{d.type === T.ANNOUNCE_ATTRIB ? t("Declare {0} Atributo(s)", [d.count]) : t("Declare {0} Tipo(s)", [d.count])}</h4>
            <div className="sim-niveis">
              {itens.map(([b, label]) => (
                <button key={b} className={`ghost-btn ${marcadas.includes(b) ? "sim-ativo" : ""}`} onClick={() => setMarcadas((m) => (m.includes(b) ? m.filter((x) => x !== b) : m.length < d.count ? [...m, b] : m))}>
                  {label}
                </button>
              ))}
            </div>
            <button
              className="ghost-btn"
              disabled={marcadas.length !== d.count}
              onClick={() => responder(d.type === T.ANNOUNCE_ATTRIB ? { type: R.ANNOUNCE_ATTRIB, attributes: marcadas as never } : { type: R.ANNOUNCE_RACE, races: marcadas.map((b) => BigInt(b)) as never })}
            >
              {t("Confirmar")}
            </button>
          </>
        );
      }
      case T.ANNOUNCE_CARD: {
        const termo = busca.trim().toLowerCase();
        const achadas = termo.length < 2 ? [] : (pedido.candidatos ?? []).filter(([code, nome]) => nome.toLowerCase().includes(termo) || nomeDe(code).toLowerCase().includes(termo)).slice(0, 30);
        return (
          <>
            <h4>{t("Declare o nome de uma carta")}</h4>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("Digite o nome (português ou inglês)")} autoFocus />
            {achadas.map(([code], i) => cartaBotao({ code, controller: eu, location: L.DECK }, i, false, () => responder({ type: R.ANNOUNCE_CARD, card: code })))}
          </>
        );
      }
      case T.SELECT_COUNTER: {
        const total = contadores.reduce((a, b) => a + b, 0);
        return (
          <>
            <h4>{t("Remova {0} marcador(es)", [d.count])}</h4>
            {d.cards.map((c, i) => (
              <label key={i} className="sim-contador">
                {nomeDe(c.code)} ({c.count})
                <input type="number" min={0} max={c.count} value={contadores[i] ?? 0} onChange={(e) => setContadores((v) => v.map((x, j) => (j === i ? Math.max(0, Math.min(c.count, Number(e.target.value) || 0)) : x)))} />
              </label>
            ))}
            <button className="ghost-btn" disabled={total !== d.count} onClick={() => responder({ type: R.SELECT_COUNTER, counters: contadores })}>
              {t("Confirmar")}
            </button>
          </>
        );
      }
      case T.ROCK_PAPER_SCISSORS:
        return (
          <>
            <h4>{t("Pedra, papel ou tesoura?")}</h4>
            <div className="sim-niveis">
              {(
                [
                  [2, t("Pedra")],
                  [3, t("Papel")],
                  [1, t("Tesoura")],
                ] as const
              ).map(([v, label]) => (
                <button key={v} className="ghost-btn" onClick={() => responder({ type: R.ROCK_PAPER_SCISSORS, value: v })}>
                  {label}
                </button>
              ))}
            </div>
          </>
        );
      default:
        return <p className="tags-note">{t("Escolha não suportada ({0}).", [d.type])}</p>;
    }
  };

  return (
    <div className="sim-escolha" role="group" aria-label={titulo}>
      {aviso}
      {pedido.carta && d.type !== T.SELECT_EFFECTYN && (
        <small className="sim-de-carta" onMouseEnter={() => setPreview(pedido.carta!)}>
          {t("Efeito de {0}", [nomeDe(pedido.carta)])}
        </small>
      )}
      {corpo()}
    </div>
  );
}

/** Onde a carta foi ativada */
function lugarDe(location: number, minha: boolean): string {
  const onde = location & L.HAND ? t("da mão") : location & L.GRAVE ? t("do Cemitério") : location & L.REMOVED ? t("das banidas") : location & L.DECK ? t("do Deck") : location & L.EXTRA ? t("do Extra Deck") : location & L.MZONE ? t("na Zona de Monstros") : location & (L.SZONE | L.FZONE) ? t("na Zona de Magias e Armadilhas") : "";
  return minha ? onde : onde && t("{0} (oponente)", [onde]);
}

/** Linha do registro do duelo */
function textoEvento(e: EventoSim, eu: number, nomeDe: (c: number) => string, oponente: string): string {
  const quem = (p: number) => (p === eu ? t("Você") : oponente);
  switch (e.t) {
    case "turno":
      return t("— Turno {0}: {1} —", [e.n, quem(e.p)]);
    case "fase":
      return t("Fase: {0}", [siglaFase(e.fase)]);
    case "compra":
      return e.p === eu ? t("Você comprou {0}", [e.codes.map(nomeDe).join(", ")]) : t("{0} comprou {1} carta(s)", [oponente, e.codes.length]);
    case "invoca":
      return e.como === "normal"
        ? t("{0} Invocou por Invocação-Normal {1}", [quem(e.p), nomeDe(e.code)])
        : e.como === "virar"
          ? t("{0} Invocou por Invocação-Virar {1}", [quem(e.p), nomeDe(e.code)])
          : t("{0} Invocou por Invocação-Especial {1}", [quem(e.p), nomeDe(e.code)]);
    case "baixa":
      return t("{0} baixou uma carta", [quem(e.p)]);
    case "ativa":
      return t("{0} ativou {1} {2}", [quem(e.p), nomeDe(e.code), lugarDe(e.location, e.p === eu)]).trim() + (e.texto ? ` — ${e.texto}` : "");
    case "declara":
      return t("{0} declarou o nome {1}", [quem(e.p), nomeDe(e.code)]);
    case "alvo":
      return "";
    case "nega":
      return t("Ativação ou efeito negado");
    case "revela":
      return e.p === eu ? t("Cartas mostradas a você: {0}", [e.cartas.map((c) => nomeDe(c.code)).join(", ")]) : t("{0} viu {1} carta(s)", [oponente, e.cartas.length]);
    case "resolve":
    case "cadeia-fim":
      return "";
    case "voo":
      return "";
    case "dado":
      return t("{0} jogou um dado: {1}", [quem(e.p), e.v]);
    case "embaralha":
      return e.p === eu ? t("Seu Deck foi embaralhado") : t("O Deck de {0} foi embaralhado", [oponente]);
    case "move": {
      if (e.para & L.OVERLAY) return t("{0} virou matéria Xyz", [nomeDe(e.code)]);
      const para = e.para & L.GRAVE ? t("Cemitério") : e.para & L.REMOVED ? t("banidas") : e.para & L.HAND ? t("mão") : e.para & L.EXTRA ? t("Extra Deck") : e.para & L.DECK ? t("Deck") : t("campo");
      return t("{0} foi para: {1}", [nomeDe(e.code), para]);
    }
    case "ataque":
      return e.alvo ? t("{0} atacou {1}", [nomeDe(e.code), nomeDe(e.alvo)]) : t("{0} atacou diretamente", [nomeDe(e.code)]);
    case "dano":
      return t("{0} sofreu {1} de dano", [quem(e.p), e.v]);
    case "cura":
      return t("{0} ganhou {1} PV", [quem(e.p), e.v]);
    case "custo":
      return t("{0} pagou {1} PV", [quem(e.p), e.v]);
    case "fim":
      return e.vencedor === eu ? t("Você venceu o duelo") : t("{0} venceu o duelo", [oponente]);
  }
}
