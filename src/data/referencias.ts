// Sites / Referências: todos os sites de onde vêm os dados do app e das pesquisas.
// O app mostra só um botão "Fontes" em cada lugar; a lista completa abre numa tela própria
// (src/components/Fontes.tsx). Para incluir um site, acrescente aqui com o grupo e o uso.

export type SiteId =
  | "ygoprodeck"
  | "yugioh-wiki"
  | "yugipedia"
  | "road-of-the-king"
  | "master-duel-meta"
  | "ygo-combo-builder"
  | "ygocounter"
  | "cardcluster"
  | "project-ignis"
  | "tcgapi"
  | "awesomeapi"
  | "otterlord"
  | "deck-probability"
  | "deckcal";

export interface Site {
  id: SiteId;
  nome: string;
  url: string;
  grupo: "Cartas" | "Combos" | "Metagame" | "Probabilidade" | "Preços";
  /** o que o app usa do site */
  uso: string;
}

export const SITES: Site[] = [
  {
    id: "ygoprodeck",
    nome: "YGOPRODeck",
    url: "https://ygoprodeck.com",
    grupo: "Cartas",
    uso: "Base de cartas (inglês e português), imagens, staples, decklists de torneio e preços mínimos.",
  },
  {
    id: "yugioh-wiki",
    nome: "Yu-Gi-Oh! Wiki",
    url: "https://yugioh.fandom.com/wiki/",
    grupo: "Cartas",
    uso: "Nomes oficiais das cartas em português.",
  },
  {
    id: "yugipedia",
    nome: "Yugipedia",
    url: "https://yugipedia.com/wiki/List_of_unofficial_terms",
    grupo: "Cartas",
    uso: "Termos da comunidade usados nas tags (starter, extender, hand trap, floodgate…).",
  },
  {
    id: "project-ignis",
    nome: "Project Ignis (EDOPro)",
    url: "https://github.com/ProjectIgnis",
    grupo: "Combos",
    uso: "Regras e scripts oficiais das cartas usados para calcular os combos.",
  },
  {
    id: "master-duel-meta",
    nome: "Master Duel Meta",
    url: "https://www.masterduelmeta.com/combos-and-counters",
    grupo: "Combos",
    uso: "Combos e counters por deck, e guias usados nas linhas da comunidade.",
  },
  {
    id: "ygo-combo-builder",
    nome: "YGO Combo Builder",
    url: "https://ygocombobuilder.netlify.app",
    grupo: "Combos",
    uso: "Linhas de combo montadas pela comunidade, para pesquisa e conferência.",
  },
  {
    id: "ygocounter",
    nome: "YGOCounter",
    url: "https://ygocounter.com/wiki/AllDeck",
    grupo: "Combos",
    uso: "Wiki de decks e combos, para pesquisa.",
  },
  {
    id: "cardcluster",
    nome: "CardCluster",
    url: "https://cardcluster.com/decks/combo-guide",
    grupo: "Combos",
    uso: "Guias de combo por deck, para pesquisa e conferência.",
  },
  {
    id: "road-of-the-king",
    nome: "Road of the King",
    url: "https://roadoftheking.com/tag/ocg-metagame-quarterly/",
    grupo: "Metagame",
    uso: "Participação de cada arquétipo nos torneios do OCG, por trimestre.",
  },
  {
    id: "otterlord",
    nome: "Yu-Gi-Oh! Probability Calculator (otterlord)",
    url: "https://yugioh.otterlord.dev/",
    grupo: "Probabilidade",
    uso: "Referência da conta de chance de abrir cartas (hipergeométrica) usada no Teste de Mão.",
  },
  {
    id: "deck-probability",
    nome: "Deck Probability",
    url: "https://www.deck-probability.com/",
    grupo: "Probabilidade",
    uso: "Referência da conta de chance de abrir cartas usada no Teste de Mão.",
  },
  {
    id: "deckcal",
    nome: "DeckCal",
    url: "https://www.deckcal.cc",
    grupo: "Probabilidade",
    uso: "Referência da conta de chance de abrir cartas usada no Teste de Mão.",
  },
  {
    id: "tcgapi",
    nome: "TCG API",
    url: "https://tcgapi.dev/games/yugioh/",
    grupo: "Preços",
    uso: "Preço por impressão (coleção, raridade e versão), no app desktop.",
  },
  {
    id: "awesomeapi",
    nome: "AwesomeAPI",
    url: "https://docs.awesomeapi.com.br/api-de-moedas",
    grupo: "Preços",
    uso: "Cotação do dólar e do euro para os preços em reais.",
  },
];

export const GRUPOS: Site["grupo"][] = ["Cartas", "Combos", "Metagame", "Probabilidade", "Preços"];
