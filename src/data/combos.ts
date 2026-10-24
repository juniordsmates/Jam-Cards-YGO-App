// Combos conhecidos (linhas reais da comunidade), passo a passo, com ramificações e fonte.
// Cartas pelo nome em inglês (o app mostra o nome em português). Para acrescentar um arquétipo,
// siga o formato abaixo e cite de onde veio cada linha.

export interface ComboStep {
  /** carta que age no passo (nome em inglês); vazio para passos de fase ("End Phase") */
  card?: string;
  /** o que acontece, em pt-BR */
  acao: string;
  /** cartas que entram em jogo / na mão por causa do passo */
  resultado?: string[];
}

export interface ComboBranch {
  titulo: string;
  /** em que passo da linha principal a ramificação começa (1, 2…) */
  aPartirDoPasso: number;
  passos: ComboStep[];
}

export interface KnownCombo {
  id: string;
  arquetipo: string;
  titulo: string;
  /** cartas que precisam estar na mão inicial */
  mao: string[];
  /** exigência extra da mão (ex.: "+1 carta qualquer para descartar") */
  maoExtra?: string;
  passos: ComboStep[];
  campoFinal: string[];
  turnoOponente?: ComboStep[];
  ramificacoes?: ComboBranch[];
  fontes: { nome: string; url: string }[];
}

const YGOPRODECK_CENTURION = { nome: "YGOPRODeck: Centur-Ion (linha do deck)", url: "https://ygoprodeck.com/deck/centur-ion-613893" };
const MDM_CENTURION = { nome: "Master Duel Meta: guia Centur-Ion", url: "https://masterduelmeta.com/articles/guides/centur-ion-xtrager" };

/** Turno do oponente comum às linhas que terminam com Auxila + Primera e Gargoyle II prontas */
const CENTURION_OPP_TURN: ComboStep[] = [
  { card: "Centur-Ion Primera", acao: "Na Fase Principal do oponente, se Invoca da Zona de Magia/Armadilha." },
  { card: "Centur-Ion Gargoyle II", acao: "Se Invoca (da Zona de Magia/Armadilha ou da mão)." },
  {
    card: "Stand Up Centur-Ion!",
    acao: "Com a Invocação-Especial, Invocação-Sincro imediata: Crimson Dragon (Primera Nv4 Regulador + Gargoyle II Nv8).",
    resultado: ["Crimson Dragon"],
  },
  {
    card: "Crimson Dragon",
    acao: "Efeito Rápido mirando a Auxila (Nv12): volta para o Deck Adicional e Invoca um Dragão Sincro de Nível 12.",
    resultado: ["Cosmic Blazar Dragon", "Red Supernova Dragon"],
  },
];

export const KNOWN_COMBOS: KnownCombo[] = [
  {
    id: "centurion-primera-stand-up",
    arquetipo: "Centur-Ion",
    titulo: "Primera → Stand Up → Trudea → Gargoyle II → Auxila",
    mao: ["Centur-Ion Primera"],
    maoExtra: "+1 carta qualquer para descartar na Stand Up",
    passos: [
      { card: "Centur-Ion Primera", acao: "Invocação-Normal. Ao ser Invocada: busca a Magia de Campo.", resultado: ["Stand Up Centur-Ion!"] },
      {
        card: "Stand Up Centur-Ion!",
        acao: "Ativa; descarta 1 carta da mão e coloca a Trudea do Deck como Armadilha Contínua.",
        resultado: ["Centur-Ion Trudea"],
      },
      { card: "Centur-Ion Trudea", acao: "Na Fase Principal, se Invoca da Zona de Magia/Armadilha." },
      {
        card: "Centur-Ion Trudea",
        acao: "Coloca a si mesma e a Gargoyle II (do Deck) como Armadilhas Contínuas.",
        resultado: ["Centur-Ion Gargoyle II"],
      },
      {
        card: "Centur-Ion Gargoyle II",
        acao: "Se Invoca da Zona de Magia/Armadilha; a Stand Up permite uma Invocação-Sincro imediata.",
      },
      {
        acao: "Invocação-Sincro: Auxila (Primera Nv4 Regulador + Gargoyle II Nv8).",
        resultado: ["Centur-Ion Auxila"],
      },
      {
        card: "Centur-Ion Auxila",
        acao: "Ao ser Invocada: busca a Armadilha de Resposta do arquétipo.",
        resultado: ["Centur-Ion True Awakening"],
      },
      { card: "Centur-Ion Gargoyle II", acao: "Enviada ao Cemitério como material Sincro: volta para a mão." },
      {
        acao: "End Phase: a Auxila coloca a Primera (do Cemitério) como Armadilha Contínua.",
        resultado: ["Centur-Ion Primera"],
      },
    ],
    campoFinal: [
      "Centur-Ion Auxila",
      "Centur-Ion Trudea",
      "Centur-Ion Primera",
      "Stand Up Centur-Ion!",
      "Centur-Ion True Awakening",
      "Centur-Ion Gargoyle II",
    ],
    turnoOponente: CENTURION_OPP_TURN,
    ramificacoes: [
      {
        titulo: "Trudea sobe para Nível 8: Sincro sem a Gargoyle II",
        aPartirDoPasso: 3,
        passos: [
          {
            card: "Centur-Ion Trudea",
            acao: "Ao se Invocar da Zona de Magia/Armadilha, aumenta o Nível em 4 (Nv8); a Stand Up permite Sincro imediata.",
          },
          {
            acao: "Invocação-Sincro: Auxila ou Legatia (Primera Nv4 Regulador + Trudea Nv8).",
            resultado: ["Centur-Ion Auxila", "Centur-Ion Legatia"],
          },
        ],
      },
      {
        titulo: "Buscar Bonds em vez da Armadilha de Resposta",
        aPartirDoPasso: 7,
        passos: [
          { card: "Centur-Ion Auxila", acao: "Ao ser Invocada: busca a Bonds.", resultado: ["Centur-Ion Bonds"] },
          {
            card: "Centur-Ion Bonds",
            acao: "Coloca a Gargoyle II (que voltou para a mão) como Armadilha Contínua: mais um corpo para o turno do oponente.",
          },
        ],
      },
      {
        titulo: "Legatia em vez de Auxila (com Bonds já na mão)",
        aPartirDoPasso: 6,
        passos: [
          {
            acao: "Invocação-Sincro: Legatia (Primera + Gargoyle II). Ao ser Invocada: compra 1 e pode destruir o monstro de maior ATK do oponente.",
            resultado: ["Centur-Ion Legatia"],
          },
          { card: "Centur-Ion Bonds", acao: "Coloca um Centur-Ion da mão ou do Cemitério como Armadilha Contínua." },
          { acao: "End Phase: a Legatia coloca um Centur-Ion não-Sincro da mão ou do Cemitério como Armadilha Contínua." },
        ],
      },
    ],
    fontes: [{ nome: "Linha enviada pelo dono do projeto", url: "" }, YGOPRODECK_CENTURION],
  },
  {
    id: "centurion-trudea",
    arquetipo: "Centur-Ion",
    titulo: "Trudea sozinha: coloca a Primera e segue a linha principal",
    mao: ["Centur-Ion Trudea"],
    passos: [
      { card: "Centur-Ion Trudea", acao: "Invocação-Normal." },
      {
        card: "Centur-Ion Trudea",
        acao: "Coloca a si mesma e a Primera (do Deck) como Armadilhas Contínuas.",
        resultado: ["Centur-Ion Primera"],
      },
      {
        card: "Centur-Ion Primera",
        acao: "Na Fase Principal, se Invoca da Zona de Magia/Armadilha. Ao ser Invocada: busca a Stand Up.",
        resultado: ["Stand Up Centur-Ion!"],
      },
      { card: "Centur-Ion Trudea", acao: "Se Invoca da Zona de Magia/Armadilha e aumenta o Nível em 4 (Nv8)." },
      {
        acao: "Invocação-Sincro: Auxila (Primera Nv4 Regulador + Trudea Nv8); a partir daqui, como na linha principal.",
        resultado: ["Centur-Ion Auxila"],
      },
    ],
    campoFinal: ["Centur-Ion Auxila", "Stand Up Centur-Ion!"],
    fontes: [YGOPRODECK_CENTURION, MDM_CENTURION],
  },
  {
    id: "centurion-primera-with-stand-up",
    arquetipo: "Centur-Ion",
    titulo: "Primera + Stand Up na mão: busca a Gargoyle II",
    mao: ["Centur-Ion Primera", "Stand Up Centur-Ion!"],
    passos: [
      { card: "Centur-Ion Primera", acao: "Invocação-Normal. Ao ser Invocada: busca a Gargoyle II.", resultado: ["Centur-Ion Gargoyle II"] },
      {
        card: "Stand Up Centur-Ion!",
        acao: "Ativa; descarta 1 carta e coloca a Trudea do Deck como Armadilha Contínua.",
        resultado: ["Centur-Ion Trudea"],
      },
      {
        card: "Centur-Ion Gargoyle II",
        acao: "Se Invoca da mão enviando a Trudea (face para cima) ao Cemitério; a Stand Up permite Sincro imediata.",
      },
      {
        acao: "Invocação-Sincro: Auxila (Primera Nv4 Regulador + Gargoyle II Nv8). Ao ser Invocada: busca um card Centur-Ion.",
        resultado: ["Centur-Ion Auxila"],
      },
      { acao: "End Phase: a Auxila coloca a Primera ou a Trudea (do Cemitério) como Armadilha Contínua." },
    ],
    campoFinal: ["Centur-Ion Auxila", "Stand Up Centur-Ion!", "Centur-Ion Gargoyle II"],
    turnoOponente: CENTURION_OPP_TURN,
    fontes: [YGOPRODECK_CENTURION],
  },
];

/** Combos conhecidos que a mão inicial permite (todas as cartas exigidas estão na mão) */
export function combosForHand(handNames: string[]): KnownCombo[] {
  const hand = new Set(handNames);
  return KNOWN_COMBOS.filter((c) => c.mao.every((n) => hand.has(n)));
}
