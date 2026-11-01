import { idbGet, idbSetMany } from "./idb";
import { isDesktop } from "../platform";
import type { Card } from "./types";
import { t, LOCALE } from "../i18n";

// Preços: YGOPRODeck (Cardmarket em euro, TCGplayer em dólar) e TCG API (tcgapi.dev, TCGplayer
// por impressão, em dólar). Nenhuma fonte traz reais hoje: quando o valor vier em BRL ele é usado
// direto; senão, é convertido pela cotação do dia.

export type Currency = "BRL" | "USD" | "EUR";

export interface ExchangeRates {
  /** reais por 1 dólar / 1 euro */
  USD: number;
  EUR: number;
  /** data e hora da cotação (fonte) */
  quotedAt: string;
}

const RATES_KEY = "cambio-v1";
const RATES_TTL = 12 * 60 * 60 * 1000;

/** Cotação do dia (AwesomeAPI), guardada por 12 horas; sem rede, usa a última que houver */
export async function getExchangeRates(): Promise<ExchangeRates | undefined> {
  const cached = await idbGet<ExchangeRates & { fetchedAt: number }>(RATES_KEY).catch(() => undefined);
  if (cached && Date.now() - cached.fetchedAt < RATES_TTL) return cached;
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL");
    if (!res.ok) throw new Error(t("câmbio: HTTP {0}", [res.status]));
    const data = (await res.json()) as Record<string, { bid: string; create_date: string }>;
    const rates = {
      USD: Number(data.USDBRL.bid),
      EUR: Number(data.EURBRL.bid),
      quotedAt: data.USDBRL.create_date,
      fetchedAt: Date.now(),
    };
    await idbSetMany({ [RATES_KEY]: rates });
    return rates;
  } catch {
    return cached; // offline: a última cotação conhecida (ou nenhuma)
  }
}

/** Valor em reais: direto se já for BRL, convertido pela cotação se for dólar/euro */
export function toBRL(value: number, currency: Currency, rates?: ExchangeRates): number | undefined {
  if (currency === "BRL") return value;
  return rates ? value * rates[currency] : undefined;
}

export const formatMoney = (value: number, currency: Currency) =>
  value.toLocaleString(LOCALE, { style: "currency", currency });

// ---------- TCG API (tcgapi.dev) ----------

const KEY_STORAGE = "tcgapi-chave";
const CACHE_TTL = 24 * 60 * 60 * 1000;

export const getTcgApiKey = () => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
};

export const setTcgApiKey = (key: string) => {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // armazenamento indisponível: a chave vale só nesta sessão
  }
};

/** Preço de uma impressão da carta (coleção + raridade + versão) */
export interface PrintingPrice {
  set: string;
  rarity?: string;
  printing?: string;
  market?: number;
  low?: number;
  /** preço médio (mediana dos anúncios) */
  median?: number;
  currency: Currency;
  asOf?: string;
}

export interface TcgApiResult {
  prices: PrintingPrice[];
  fetchedAt: number;
  /** consultas restantes hoje no plano do usuário */
  remaining?: number;
}

interface TcgApiItem {
  name?: string;
  set_name?: string;
  rarity?: string;
  printing?: string;
  product_type?: string;
  market_price?: number | string | null;
  low_price?: number | string | null;
  median_price?: number | string | null;
  market_price_as_of?: string;
  currency?: string;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v));

/** Só as impressões da própria carta (a busca é por texto e traz cartas de nome parecido) */
export function parseTcgApi(body: string, card: Card): PrintingPrice[] {
  const data = JSON.parse(body) as { data?: TcgApiItem[]; results?: TcgApiItem[] };
  const items = data.data ?? data.results ?? [];
  const name = card.name.toLowerCase();
  return items
    .filter((i) => i.name?.toLowerCase() === name && (!i.product_type || /card|single/i.test(i.product_type)))
    .map((i) => ({
      set: i.set_name ?? "—",
      rarity: i.rarity,
      printing: i.printing,
      market: num(i.market_price),
      low: num(i.low_price),
      median: num(i.median_price),
      currency: (["BRL", "USD", "EUR"].includes(i.currency ?? "") ? i.currency : "USD") as Currency,
      asOf: i.market_price_as_of,
    }))
    .sort((a, b) => (a.market ?? Infinity) - (b.market ?? Infinity));
}

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * A impressão da TCG API que corresponde a uma coleção da carta: mesma coleção e mesma raridade.
 * Só quando a TCG API não informa a raridade vale a coleção sozinha (se tiver uma impressão só);
 * raridades diferentes são versões diferentes, com preços diferentes.
 */
export function matchPrinting(prices: PrintingPrice[], setName: string, rarity: string): PrintingPrice | undefined {
  const sameSet = prices.filter((p) => norm(p.set) === norm(setName));
  const exact = sameSet.find((p) => norm(p.rarity) === norm(rarity));
  if (exact) return exact;
  const noRarity = sameSet.filter((p) => !p.rarity);
  return sameSet.length === 1 && noRarity.length === 1 ? noRarity[0] : undefined;
}

/** Resultado guardado da última consulta (vale por 24 horas) */
export async function cachedTcgApi(card: Card): Promise<TcgApiResult | undefined> {
  const cached = await idbGet<TcgApiResult>(`tcgapi-${card.id}`).catch(() => undefined);
  return cached && Date.now() - cached.fetchedAt < CACHE_TTL ? cached : undefined;
}

/**
 * Consulta a TCG API. Só no app desktop: a API só aceita chamadas do próprio site (CORS),
 * então a requisição sai pelo Rust. Cada consulta gasta 1 das consultas diárias do plano.
 */
export async function fetchTcgApi(card: Card, apiKey: string): Promise<TcgApiResult> {
  if (!isDesktop) throw new Error(t("A consulta à TCG API só funciona no app desktop."));
  const { invoke } = await import("@tauri-apps/api/core");
  const res = await invoke<{ status: number; body: string; remaining?: string }>("tcgapi_search", {
    apiKey,
    query: card.name,
  });
  if (res.status === 401 || res.status === 403) throw new Error(t("Chave da TCG API recusada. Confira a chave."));
  if (res.status === 429) throw new Error(t("Limite diário de consultas da TCG API atingido. Tente amanhã."));
  if (res.status >= 400) throw new Error(t("TCG API respondeu {0}.", [res.status]));
  const remainingInBody = (() => {
    try {
      return (JSON.parse(res.body) as { rate_limit?: { daily_remaining?: number } }).rate_limit?.daily_remaining;
    } catch {
      return undefined;
    }
  })();
  const result: TcgApiResult = {
    prices: parseTcgApi(res.body, card),
    fetchedAt: Date.now(),
    remaining: num(res.remaining) ?? remainingInBody,
  };
  await idbSetMany({ [`tcgapi-${card.id}`]: result });
  return result;
}
