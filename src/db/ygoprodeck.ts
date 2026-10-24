import type { ApiCard, Card } from "./types";
import { normalize } from "./search";

// Guia: https://ygoprodeck.com/api-guide/ — limite de 20 req/s (bloqueio de 1h se exceder).
// Por isso a base inteira é baixada de uma vez e guardada localmente.
const API = "https://db.ygoprodeck.com/api/v7";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // corpo não é JSON; mantém o status
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export interface DbVersion {
  version: string;
  lastUpdate: string;
}

export async function fetchDbVersion(): Promise<DbVersion> {
  const [v] = await getJson<{ database_version: string; last_update: string }[]>("checkDBVer.php");
  return { version: v.database_version, lastUpdate: v.last_update };
}

/** Base completa; o inglês vem com misc=yes (formatos, datas, raridade no Master Duel…) */
export async function fetchAllCards(language?: "pt"): Promise<ApiCard[]> {
  const query = language ? `?language=${language}` : "?misc=yes";
  return (await getJson<{ data: ApiCard[] }>(`cardinfo.php${query}`)).data;
}

/** Nomes oficiais de todos os arquétipos */
export async function fetchArchetypes(): Promise<string[]> {
  return (await getJson<{ archetype_name: string }[]>("archetypes.php")).map((a) => a.archetype_name);
}

/** Pontos do formato Genesys (só cartas com pontos > 0) */
export async function fetchGenesysPoints(): Promise<Record<number, number>> {
  const data = (await getJson<{ data: ApiCard[] }>("cardinfo.php?format=genesys&misc=yes")).data;
  const points: Record<number, number> = {};
  for (const c of data) {
    const p = c.misc_info?.[0]?.genesys_points;
    if (p) points[c.id] = p;
  }
  return points;
}

/** Ids das cartas marcadas como "staple" pela comunidade da YGOPRODeck */
export async function fetchStapleIds(): Promise<number[]> {
  return (await getJson<{ data: { id: number }[] }>("cardinfo.php?staple=yes")).data.map((c) => c.id);
}

const orUndef =<T>(v: T | null | undefined) => (v == null ? undefined : v);

/** Converte a resposta em inglês e mescla nome/texto da versão em português */
export function buildCards(en: ApiCard[], pt: ApiCard[]): Card[] {
  const ptById = new Map(pt.map((c) => [c.id, c]));
  const ptByName = new Map(pt.map((c) => [(c as ApiCard & { name_en?: string }).name_en ?? c.name, c]));

  return en.map((c) => {
    // Com misc=yes, a API às vezes usa o id de uma arte alternativa como id principal
    // (ex.: Aleister 86120752 em vez de 86120751). A base em português usa o id canônico.
    const imageIds = c.card_images.map((i) => i.id);
    const byName = ptByName.get(c.name);
    const canonical = !ptById.has(c.id) && byName && imageIds.includes(byName.id) ? byName.id : c.id;
    const t = ptById.get(canonical);
    const namePt = t && t.name !== c.name ? t.name : undefined;
    const descPt = t && t.desc !== c.desc ? t.desc : undefined;
    const price = c.card_prices?.[0];
    const misc = c.misc_info?.[0];

    return {
      id: canonical,
      name: c.name,
      namePt,
      desc: c.desc,
      descPt,
      type: c.type,
      frame: c.frameType,
      typeline: c.typeline,
      race: c.race,
      attribute: orUndef(c.attribute),
      atk: orUndef(c.atk),
      def: orUndef(c.def),
      level: orUndef(c.level),
      scale: orUndef(c.scale),
      linkval: orUndef(c.linkval),
      linkmarkers: c.linkmarkers,
      archetype: c.archetype,
      ban: c.banlist_info && {
        tcg: c.banlist_info.ban_tcg,
        ocg: c.banlist_info.ban_ocg,
        goat: c.banlist_info.ban_goat,
      },
      // arte principal primeiro
      images: [canonical, ...imageIds.filter((i) => i !== canonical)],
      sets: (c.card_sets ?? []).map((s) => ({
        name: s.set_name,
        code: s.set_code,
        rarity: s.set_rarity,
        price: s.set_price,
      })),
      prices: price && { cardmarket: price.cardmarket_price, tcgplayer: price.tcgplayer_price },
      url: c.ygoprodeck_url,
      formats: misc?.formats,
      tcgDate: misc?.tcg_date,
      ocgDate: misc?.ocg_date,
      treatedAs: misc?.treated_as && misc.treated_as !== c.name ? misc.treated_as : undefined,
      mdRarity: misc?.md_rarity,
      views: misc?.views,
      key: normalize(namePt ? `${namePt} ${c.name}` : c.name),
    };
  });
}
