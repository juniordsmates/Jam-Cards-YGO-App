import { isDesktop } from "./platform";

// Links próprios: cada tela (e o que está aberto nela) fica no endereço, depois do "#", para
// compartilhar e para o voltar do navegador funcionar. Ex.:
//   #/carta/14558127                      painel da Ash Blossom na busca
//   #/combo/<id>                          um Combo da Comunidade
//   #/combos/mao/42493140,15005145        Combos com essa mão inicial
//   #/guia/Kewl%20Tune/combos             Guia de Deck do Kewl Tune, aba Combos
//   #/meta-call/TCG/Kewl%20Tune:17,Elfnote:12
//   #/comunidade/Kewl%20Tune                aba Comunidade do arquétipo
//   #/rank                                  Rank dos duelistas
//   #/conquistas                            Conquistas
//   #/eventos  #/eventos/compartilhar      Eventos (resultados de torneio) e o envio
//   #/evento/<id>                           um resultado de evento
//   #/desejos                               Lista de Desejos
//   #/simulador                             Simulador (duelo contra a IA)
// O "#" funciona no GitHub Pages sem configurar o servidor. No app de computador, o link copiado é
// o do site (abre em qualquer navegador).

export const SITE = "https://juniordsmates.github.io/Jam-Cards-YGO/";

export type Rota =
  | { tela: "menu" }
  | { tela: "search"; carta?: number }
  | { tela: "combos"; combo?: string; mao?: number[] }
  | { tela: "guia"; arquetipo?: string; aba?: string }
  | { tela: "metacall"; formato?: "TCG" | "OCG"; decks?: Record<string, number> }
  | { tela: "deck" }
  | { tela: "teste" }
  | { tela: "colecao" }
  | { tela: "manual" }
  | { tela: "rank" }
  | { tela: "conquistas" }
  | { tela: "eventos"; resultado?: string; aba?: "compartilhar" | "analise" }
  | { tela: "desejos" }
  | { tela: "meuscombos" }
  | { tela: "simulador" }
  | { tela: "comunidade"; arquetipo?: string };

const NOMES: Record<string, Rota["tela"]> = {
  busca: "search",
  carta: "search",
  combos: "combos",
  combo: "combos",
  guia: "guia",
  "meta-call": "metacall",
  editor: "deck",
  teste: "teste",
  colecao: "colecao",
  manual: "manual",
  rank: "rank",
  conquistas: "conquistas",
  eventos: "eventos",
  evento: "eventos",
  desejos: "desejos",
  "meus-combos": "meuscombos",
  simulador: "simulador",
  comunidade: "comunidade",
};

const dec = (s: string | undefined) => {
  if (!s) return undefined;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const ids = (s: string | undefined) => (s ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);

/** Rota do endereço atual (ou de um hash) */
export function lerRota(hash = window.location.hash): Rota {
  const partes = hash.replace(/^#\/?/, "").split("/");
  const [nome, a, b] = partes;
  const tela = NOMES[nome ?? ""];
  switch (tela) {
    case "search": {
      const carta = nome === "carta" ? Number(a) : NaN;
      return Number.isInteger(carta) && carta > 0 ? { tela, carta } : { tela };
    }
    case "combos":
      if (nome === "combo" && a && /^[0-9a-f-]{36}$/i.test(a)) return { tela, combo: a };
      return a === "mao" && ids(b).length ? { tela, mao: ids(b).slice(0, 10) } : { tela };
    case "guia":
      return { tela, arquetipo: dec(a), aba: dec(b) };
    case "comunidade":
      return { tela, arquetipo: dec(a) };
    case "eventos":
      if (nome === "evento" && a && /^[0-9a-f-]{36}$/i.test(a)) return { tela, resultado: a };
      return a === "compartilhar" || a === "analise" ? { tela, aba: a } : { tela };
    case "metacall": {
      const formato = a === "OCG" ? "OCG" : a === "TCG" ? "TCG" : undefined;
      const decks: Record<string, number> = {};
      for (const par of (dec(b) ?? "").split(",")) {
        const i = par.lastIndexOf(":");
        if (i <= 0) continue;
        const peso = Math.round(Number(par.slice(i + 1)));
        if (peso > 0 && peso <= 100) decks[par.slice(0, i)] = peso;
      }
      return { tela, formato, decks: Object.keys(decks).length ? decks : undefined };
    }
    case undefined:
      return { tela: "menu" };
    default:
      return { tela } as Rota;
  }
}

/** Hash de uma rota */
export function hashDa(r: Rota): string {
  const enc = encodeURIComponent;
  switch (r.tela) {
    case "menu":
      return "#/";
    case "search":
      return r.carta ? `#/carta/${r.carta}` : "#/busca";
    case "combos":
      return r.combo ? `#/combo/${r.combo}` : r.mao?.length ? `#/combos/mao/${r.mao.join(",")}` : "#/combos";
    case "guia":
      return r.arquetipo ? `#/guia/${enc(r.arquetipo)}${r.aba ? `/${enc(r.aba)}` : ""}` : "#/guia";
    case "metacall": {
      const decks = Object.entries(r.decks ?? {}).filter(([, p]) => p > 0);
      return decks.length || r.formato
        ? `#/meta-call/${r.formato ?? "TCG"}${decks.length ? `/${enc(decks.map(([a, p]) => `${a}:${p}`).join(","))}` : ""}`
        : "#/meta-call";
    }
    case "comunidade":
      return r.arquetipo ? `#/comunidade/${enc(r.arquetipo)}` : "#/comunidade";
    case "eventos":
      return r.resultado ? `#/evento/${r.resultado}` : r.aba ? `#/eventos/${r.aba}` : "#/eventos";
    case "deck":
      return "#/editor";
    case "meuscombos":
      return "#/meus-combos";
    default:
      return `#/${r.tela}`;
  }
}

/**
 * Atualiza o endereço sem recarregar. `substituir`: troca a entrada atual do histórico (detalhes
 * dentro da tela, como a carta aberta), em vez de criar uma nova (troca de tela).
 */
export function escreverRota(r: Rota, substituir = false) {
  const hash = hashDa(r);
  if (window.location.hash === hash || (hash === "#/" && !window.location.hash)) return;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (substituir) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

/** Link completo para compartilhar (no app de computador, o do site) */
export function linkPara(r: Rota): string {
  const base = isDesktop || window.location.protocol === "tauri:" ? SITE : `${window.location.origin}${window.location.pathname}`;
  return `${base}${hashDa(r)}`;
}

/** Copia o link da rota; devolve se deu certo */
export async function copiarLink(r: Rota): Promise<boolean> {
  const link = linkPara(r);
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    // sem a API de área de transferência (alguns webviews): cópia pelo campo de texto
    const campo = document.createElement("textarea");
    campo.value = link;
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    campo.remove();
    return ok;
  }
}
