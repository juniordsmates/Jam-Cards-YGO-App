export type BanStatus = "Forbidden" | "Limited" | "Semi-Limited";

/** Carta como vem de cardinfo.php (apenas os campos usados) */
export interface ApiCard {
  id: number;
  name: string;
  type: string;
  humanReadableCardType: string;
  frameType: string;
  typeline?: string[];
  desc: string;
  race: string;
  atk?: number | null;
  def?: number | null;
  level?: number | null;
  scale?: number | null;
  linkval?: number | null;
  linkmarkers?: string[];
  attribute?: string | null;
  archetype?: string;
  ygoprodeck_url: string;
  banlist_info?: { ban_tcg?: BanStatus; ban_ocg?: BanStatus; ban_goat?: BanStatus };
  card_sets?: { set_name: string; set_code: string; set_rarity: string; set_price: string }[];
  card_images: { id: number }[];
  card_prices?: { cardmarket_price?: string; tcgplayer_price?: string }[];
  /** só com misc=yes */
  misc_info?: {
    formats?: string[];
    tcg_date?: string;
    ocg_date?: string;
    treated_as?: string;
    md_rarity?: string;
    views?: number;
    genesys_points?: number;
  }[];
}

export interface CardSet {
  name: string;
  code: string;
  rarity: string;
  price: string;
}

/** Carta já normalizada e mesclada com a tradução em português */
export interface Card {
  id: number;
  name: string;
  namePt?: string;
  desc: string;
  descPt?: string;
  type: string;
  frame: string;
  typeline?: string[];
  race: string;
  attribute?: string;
  atk?: number;
  def?: number;
  level?: number;
  scale?: number;
  linkval?: number;
  linkmarkers?: string[];
  archetype?: string;
  ban?: { tcg?: BanStatus; ocg?: BanStatus; goat?: BanStatus };
  /** ids das artes (a primeira é a principal) */
  images: number[];
  sets: CardSet[];
  prices?: { cardmarket?: string; tcgplayer?: string };
  url: string;
  /** nomes em pt + en normalizados, usados na busca */
  key: string;
  /** formatos em que a carta existe (TCG, OCG, Master Duel, Duel Links, GOAT…) */
  formats?: string[];
  /** lançamento original (AAAA-MM-DD) */
  tcgDate?: string;
  ocgDate?: string;
  /** nome da carta com que esta é tratada (ex.: Harpie Lady 1 → Harpie Lady), quando diferente */
  treatedAs?: string;
  /** raridade no Master Duel */
  mdRarity?: string;
  /** visualizações na YGOPRODeck (popularidade) */
  views?: number;
  /** está na lista de staples da comunidade (cardinfo.php?staple=yes) */
  staple?: boolean;
  /** nome do arquétipo em português (deduzido no app pelo pareamento das aspas) */
  archetypePt?: string;
  /** ids de tags (ver tags.ts), já com as correções manuais aplicadas */
  tags?: string[];
  /** ajustes manuais da leitura dos efeitos (chave = número do efeito, a partir de 1) */
  effectOverrides?: Record<string, { tipo?: string; local?: string; opcional?: boolean; limite?: "soft" | "hard" | null }>;
}

export type Category = "monster" | "spell" | "trap" | "other";

export const categoryOf = (card: Card): Category =>
  card.frame === "spell"
    ? "spell"
    : card.frame === "trap"
      ? "trap"
      : card.frame === "skill" || card.frame === "token"
        ? "other"
        : "monster";

export const displayName = (card: Card) => card.namePt ?? card.name;
