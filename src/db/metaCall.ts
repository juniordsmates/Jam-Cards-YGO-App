import { CATALOGO, type CategoriaMeta, type ItemCatalogo } from "../data/metaCall";
import { copiasPermitidas } from "./decks";
import { calcularInteracoes, linhasDoArquetipo } from "./guiaDeck";
import { acoesDoTexto, type Acao } from "./indicacoes";
import { isActivated, readCard } from "./effects";
import { legalIn, type GameFormat } from "./legality";
import type { CombosCalculados, LinhaCombo, Passo } from "./motor";
import type { CartaNucleo, Overlay } from "./overlay";
import type { ContextoRespostas } from "./respostas";
import { categoryOf, type Card } from "./types";
import { t, LOCALE } from "../i18n";

// Meta Call: o jogador escolhe os decks que espera no torneio (e quanto de cada um) e o app indica as
// cartas boas contra eles. Junta tudo o que o app já sabe:
//   - o núcleo de cada deck nos decklists de torneio (o que o motor do deck faz, lido do texto oficial)
//   - as linhas do motor de regras (Invocações por combo, buscas, uso do Cemitério, campo final)
//   - as interações calculadas (em quantas linhas cada hand trap para o deck, e a partir de que passo)
//   - o que o meta realmente põe no Main e no Side (núcleo), e o uso em torneios
//   - a banlist do formato, o seu deck (cartas que atrapalham você) e a sua coleção

/** Um deck do formato para escolher */
export interface DeckDoMeta {
  arquetipo: string;
  /** % dos decks do meta (0 a 100) */
  pct: number;
  /** % mais recente (últimos 2 meses no TCG; último trimestre no OCG) */
  pctRecente: number;
  nucleo: { main: CartaNucleo[]; extra: CartaNucleo[]; side: CartaNucleo[] };
  /** "torneio": decklists do TCG; "arquetipo": estimado pelas cartas do arquétipo (OCG) */
  fonte: "torneio" | "arquetipo";
}

/** Decks do formato: TCG pelos decklists (6 meses); OCG pelo Road of the King (dois últimos trimestres) */
export function decksDoFormato(overlay: Pick<Overlay, "metaTcg" | "meta"> | undefined, formato: GameFormat, cards: Card[]): DeckDoMeta[] {
  if (!overlay) return [];
  if (formato === "TCG")
    return (overlay.metaTcg?.arquetipos ?? []).map((a) => ({ arquetipo: a.arquetipo, pct: a.pct6m, pctRecente: a.pct2m, nucleo: a.nucleo, fonte: "torneio" }));
  const meta = overlay.meta;
  if (!meta) return [];
  const periodos = [...meta.periodos].sort((a, b) => b.inicio.localeCompare(a.inicio));
  // os períodos com dados de arquétipos (o mais novo pode ser mais recente que a lista de períodos)
  const todos = [...new Set(Object.values(meta.porArquetipo).flatMap((l) => l.map(([p]) => p)))].sort().reverse();
  const ultimos = todos.slice(0, 2);
  const totalDe = (p: string) => periodos.find((x) => x.periodo === p)?.total ?? 0;
  const soma = (l: [string, number][], ps: string[]) => l.filter(([p]) => ps.includes(p)).reduce((s, [, n]) => s + n, 0);
  const total = (ps: string[]) => ps.reduce((s, p) => s + totalDe(p), 0) || Object.values(meta.porArquetipo).reduce((s, l) => s + soma(l, ps), 0);
  const t2 = total(ultimos);
  const t1 = total(ultimos.slice(0, 1));
  const porArq = new Map<string, Card[]>();
  for (const c of cards) if (c.archetype) porArq.set(c.archetype.toLowerCase(), [...(porArq.get(c.archetype.toLowerCase()) ?? []), c]);
  return Object.entries(meta.porArquetipo)
    .map(([arquetipo, l]) => {
      const doArq = (porArq.get(arquetipo.toLowerCase()) ?? []).filter((c) => legalIn(c, "OCG"));
      const ehExtraC = (c: Card) => /^(fusion|synchro|xyz|link)/.test(c.frame);
      const nuc = (cs: Card[]): CartaNucleo[] => cs.map((c) => ({ id: c.id, pct: 1, copias: 1 }));
      return {
        arquetipo,
        pct: t2 ? (soma(l, ultimos) / t2) * 100 : 0,
        pctRecente: t1 ? (soma(l, ultimos.slice(0, 1)) / t1) * 100 : 0,
        nucleo: { main: nuc(doArq.filter((c) => !ehExtraC(c))), extra: nuc(doArq.filter(ehExtraC)), side: [] },
        fonte: "arquetipo" as const,
      };
    })
    .filter((d) => d.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 30);
}

// ---------------------------------------------------------------- perfil do deck

/** Frações (0 a 1) do motor do deck, ponderadas pelas cópias esperadas nas listas */
export interface PerfilDeck {
  arquetipo: string;
  fonte: DeckDoMeta["fonte"];
  /** cartas do motor (sem hand traps e staples) com efeito que… */
  /** busca, Invoca ou envia do Deck, ou compra (o que a Ash nega) */
  ash: number;
  busca: number;
  invocaDeck: number;
  enviaDeck: number;
  compra: number;
  /** tira cartas do Cemitério (adiciona, Invoca ou bane de lá) */
  usaGY: number;
  /** tem efeito ativado no Cemitério */
  efeitoGY: number;
  /** efeito de monstro ativado na mão ou no Cemitério */
  efeitoMaoGY: number;
  /** efeito de monstro ativado no campo */
  efeitoCampo: number;
  /** efeitos (de qualquer carta) que Invocam por Invocação-Especial */
  invocaPorEfeito: number;
  invocaMao: number;
  invocaExtra: number;
  invocaGY: number;
  /** bane (no efeito ou no custo) */
  bane: number;
  /** Magias e Armadilhas do motor */
  magias: number;
  armadilhas: number;
  /** Magias/Armadilhas que ficam no campo (Contínuas, de Campo, de Equipamento) */
  permanentes: number;
  /** Magias que Invocam (Retaliating "C") */
  magiaInvoca: number;
  /** monstros LUZ ou TREVAS do motor que vão ao Cemitério ou têm efeito lá (Bystial) */
  luzTrevasGY: number;
  /** Tipo de monstro mais comum e a fração dele; quantos Tipos e Atributos diferentes */
  tipoPrincipal: { race: string; fracao: number };
  tipos: number;
  atributos: number;
  /** fração dos monstros por Atributo */
  atribFrac: Record<string, number>;
  maquinas: number;
  fadas: number;
  /** tipo do Extra Deck mais usado que o Dimensional Barrier pode declarar (sem Link) e fração */
  extraPrincipal: { tipo: string; fracao: number };
  sincros: number;
  fusoes: number;
  /** médias das linhas do motor de regras (sem linhas: undefined) */
  linhas?: {
    n: number;
    invocacoes: number;
    especiais: number;
    doExtra: number;
    doDeck: number;
    daMao: number;
    doGY: number;
    buscas: number;
    envios: number;
    ativacoesGY: number;
    monstrosFinais: number;
    magiasFinais: number;
    /** passos por linha */
    tamanho: number;
  };
  /**
   * por resposta (linhas do motor): fração das linhas em que ela pode responder, o primeiro passo
   * médio e o "corte": quanto do combo, em média, ainda falta quando ela já pode responder (0 a 1;
   * 0 nas linhas em que ela não responde) — responder cedo corta mais
   */
  interacoes: Map<number, { pct: number; primeiro: number; corte: number }>;
  /** passos do combo que mais respostas param */
  pontos: { passo: Passo; respostas: number; linhas: number }[];
  /** hand traps que o deck joga (Main e Side), com a fração das listas */
  handTraps: { id: number; pct: number; side: boolean }[];
  /** monstros do campo final que negam ou removem (chefes) */
  chefes: { id: number; pct: number }[];
}

const ehGenerica = (c: Card) => !!c.tags?.some((t) => t === "hand-trap" || t === "staple");
const somaDe = (m: { pct: number; copias: number }[]) => m.reduce((s, x) => s + x.pct * x.copias, 0);

/** Ações e zonas de todos os efeitos ativados da carta (texto oficial em inglês) */
function leituraDaCarta(c: Card) {
  const efeitos = readCard(c, false).effects.filter(isActivated);
  const acoes = new Set<Acao>();
  let custoBane = false;
  for (const e of efeitos) {
    for (const a of acoesDoTexto(e.resolution ?? e.text, e.costTarget ?? "")) acoes.add(a);
    if (/banish/i.test(`${e.condition ?? ""} ${e.costTarget ?? ""}`)) custoBane = true;
    if (/special summon this card/i.test(e.resolution ?? "") && e.zone === "Cemitério") acoes.add("invoca-gy");
    if (/special summon this card/i.test(e.resolution ?? "") && e.zone === "Mão") acoes.add("invoca-mao");
  }
  const zonas = new Set(efeitos.map((e) => e.zone));
  return { acoes, custoBane, zonas };
}

const cache = new WeakMap<Card, ReturnType<typeof leituraDaCarta>>();
const leitura = (c: Card) => {
  let l = cache.get(c);
  if (!l) cache.set(c, (l = leituraDaCarta(c)));
  return l;
};

export function perfilDoDeck(
  deck: Pick<DeckDoMeta, "arquetipo" | "nucleo" | "fonte">,
  byId: Map<number, Card>,
  combos: CombosCalculados | undefined,
  ctx: ContextoRespostas,
): PerfilDeck {
  const motor = deck.nucleo.main.filter((x) => {
    const c = byId.get(x.id);
    return c && !ehGenerica(c);
  });
  const total = somaDe(motor) || 1;
  const fracao = (f: (c: Card, l: ReturnType<typeof leituraDaCarta>) => boolean) =>
    somaDe(motor.filter((x) => f(byId.get(x.id)!, leitura(byId.get(x.id)!)))) / total;
  const monstro = (c: Card) => categoryOf(c) === "monster";

  // Tipos e Atributos dos monstros (Main e Extra)
  const monstros = [...motor, ...deck.nucleo.extra].map((x) => ({ x, c: byId.get(x.id) })).filter((m): m is { x: CartaNucleo; c: Card } => !!m.c && monstro(m.c));
  const pesoM = somaDe(monstros.map((m) => m.x)) || 1;
  const contar = (chave: (c: Card) => string | undefined) => {
    const m = new Map<string, number>();
    for (const { x, c } of monstros) {
      const k = chave(c);
      if (k) m.set(k, (m.get(k) ?? 0) + x.pct * x.copias);
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const racas = contar((c) => c.race);
  const atributos = contar((c) => c.attribute);
  const extras = deck.nucleo.extra.map((x) => ({ x, c: byId.get(x.id) })).filter((m) => !!m.c);
  const pesoE = somaDe(extras.map((m) => m.x)) || 1;
  const tiposExtra = new Map<string, number>();
  for (const { x, c } of extras) {
    const t = c!.frame.replace(/_pendulum$/, "");
    tiposExtra.set(t, (tiposExtra.get(t) ?? 0) + x.pct * x.copias);
  }
  // o Dimensional Barrier não declara Link
  const extraPrincipal = [...tiposExtra].filter(([t]) => t !== "link").sort((a, b) => b[1] - a[1])[0];
  const extraNoCampo =
    somaDe(
      deck.nucleo.extra.filter((x) => {
        const c = byId.get(x.id);
        return !!c && (!!c.tags?.includes("quick-effect") || leitura(c).zonas.has("Campo"));
      }),
    ) / pesoE;

  // linhas do motor de regras e interações
  const linhas: LinhaCombo[] = combos ? linhasDoArquetipo(combos, deck.arquetipo) : [];
  const media = (f: (l: LinhaCombo) => number) => linhas.reduce((s, l) => s + f(l), 0) / linhas.length;
  const conta = (l: LinhaCombo, p: (x: Passo) => boolean) => l.passos.filter(p).length;
  const inter = linhas.length ? calcularInteracoes(linhas, ctx) : { respostas: [], pontos: [] };
  // primeiro passo em que cada resposta pode entrar, por linha
  const porResposta = new Map<number, { linhas: number; primeiro: number; corte: number }>();
  for (const l of linhas) {
    const visto = new Set<number>();
    l.passos.forEach((p, j) => {
      for (const r of p.resp ?? []) {
        if (visto.has(r)) continue;
        visto.add(r);
        const x = porResposta.get(r) ?? { linhas: 0, primeiro: 0, corte: 0 };
        x.linhas++;
        x.primeiro += j + 1;
        x.corte += 1 - j / l.passos.length;
        porResposta.set(r, x);
      }
    });
  }

  // hand traps que o próprio deck joga (Main e Side)
  const handTraps = [
    ...deck.nucleo.main.map((x) => ({ ...x, side: false })),
    ...deck.nucleo.side.map((x) => ({ ...x, side: true })),
  ]
    .filter((x) => byId.get(x.id)?.tags?.includes("hand-trap") && x.pct >= 0.2)
    .map(({ id, pct, side }) => ({ id, pct, side }))
    .sort((a, b) => b.pct - a.pct);

  // chefes: monstros do Extra com negação/remoção no núcleo
  const chefes = deck.nucleo.extra
    .filter((x) => x.pct >= 0.35 && byId.get(x.id)?.tags?.some((t) => t === "negacao" || t === "omni-negate" || t === "board-breaker"))
    .map(({ id, pct }) => ({ id, pct }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  return {
    arquetipo: deck.arquetipo,
    fonte: deck.fonte,
    ash: fracao((_c, l) => ["busca", "invoca-deck", "envia-deck", "compra"].some((a) => l.acoes.has(a as Acao))),
    busca: fracao((_c, l) => l.acoes.has("busca")),
    invocaDeck: fracao((_c, l) => l.acoes.has("invoca-deck")),
    enviaDeck: fracao((_c, l) => l.acoes.has("envia-deck")),
    compra: fracao((_c, l) => l.acoes.has("compra")),
    usaGY: fracao((_c, l) => l.acoes.has("gy-mao") || l.acoes.has("invoca-gy") || l.acoes.has("gy-bane")),
    efeitoGY: fracao((_c, l) => l.zonas.has("Cemitério")),
    efeitoMaoGY: fracao((c, l) => monstro(c) && (l.zonas.has("Mão") || l.zonas.has("Cemitério"))),
    // Main (60%) e Extra (40%): monstros com efeito ativado no campo
    efeitoCampo: fracao((c, l) => monstro(c) && l.zonas.has("Campo")) * 0.6 + extraNoCampo * 0.4,
    invocaPorEfeito: fracao((_c, l) => l.acoes.has("invoca")),
    invocaMao: fracao((_c, l) => l.acoes.has("invoca-mao")),
    invocaExtra: fracao((_c, l) => l.acoes.has("invoca-extra")),
    invocaGY: fracao((_c, l) => l.acoes.has("invoca-gy") || l.acoes.has("invoca-banido")),
    bane: fracao((_c, l) => l.acoes.has("bane") || l.acoes.has("gy-bane") || l.custoBane),
    magias: fracao((c) => categoryOf(c) === "spell"),
    armadilhas: fracao((c) => categoryOf(c) === "trap"),
    permanentes: fracao((c) => !monstro(c) && ["Continuous", "Field", "Equip"].includes(c.race)),
    magiaInvoca: fracao((c, l) => categoryOf(c) === "spell" && l.acoes.has("invoca")),
    luzTrevasGY: fracao((c, l) => monstro(c) && (c.attribute === "LIGHT" || c.attribute === "DARK") && (l.zonas.has("Cemitério") || l.zonas.has("Mão"))),
    tipoPrincipal: { race: racas[0]?.[0] ?? "", fracao: (racas[0]?.[1] ?? 0) / pesoM },
    tipos: racas.filter(([, n]) => n / pesoM >= 0.1).length,
    atributos: atributos.filter(([, n]) => n / pesoM >= 0.1).length,
    atribFrac: Object.fromEntries(atributos.map(([a, n]) => [a, n / pesoM])),
    maquinas: (racas.find(([r]) => r === "Machine")?.[1] ?? 0) / pesoM,
    fadas: (racas.find(([r]) => r === "Fairy")?.[1] ?? 0) / pesoM,
    extraPrincipal: { tipo: extraPrincipal?.[0] ?? "", fracao: (extraPrincipal?.[1] ?? 0) / pesoE },
    sincros: (tiposExtra.get("synchro") ?? 0) / pesoE,
    fusoes: (tiposExtra.get("fusion") ?? 0) / pesoE,
    linhas: linhas.length
      ? {
          n: linhas.length,
          invocacoes: media((l) => conta(l, (p) => p.t === "normal" || p.t === "invoca")),
          especiais: media((l) => conta(l, (p) => p.t === "invoca")),
          doExtra: media((l) => conta(l, (p) => p.t === "invoca" && p.de === "extra")),
          doDeck: media((l) => conta(l, (p) => p.t === "invoca" && p.de === "deck")),
          daMao: media((l) => conta(l, (p) => p.t === "normal" || (p.t === "invoca" && p.de === "mao"))),
          doGY: media((l) => conta(l, (p) => p.t === "invoca" && (p.de === "cemiterio" || p.de === "banido"))),
          buscas: media((l) => conta(l, (p) => p.t === "move" && p.de === "deck" && p.para === "mao")),
          envios: media((l) => conta(l, (p) => p.t === "move" && p.de === "deck" && p.para === "cemiterio")),
          ativacoesGY: media((l) => conta(l, (p) => p.t === "ativa" && p.de === "cemiterio")),
          monstrosFinais: media((l) => l.campo.monstros.length),
          magiasFinais: media((l) => l.campo.magias.length),
          tamanho: media((l) => l.passos.length),
        }
      : undefined,
    interacoes: new Map([...porResposta].map(([id, x]) => [id, { pct: x.linhas / linhas.length, primeiro: x.primeiro / x.linhas, corte: x.corte / linhas.length }])),
    pontos: inter.pontos.slice(0, 3).map((p) => ({ passo: p.passo, respostas: p.respostas.length, linhas: p.linhas })),
    handTraps,
    chefes,
  };
}

// ---------------------------------------------------------------- recomendação

export interface NotaNoDeck {
  arquetipo: string;
  nota: number;
  motivo: string;
  /** a nota veio das linhas do motor de regras */
  motor: boolean;
}

export interface Recomendacao {
  id: number;
  card: Card;
  item: ItemCatalogo;
  categoria: CategoriaMeta;
  /** média ponderada pela fração esperada de cada deck (0 a 1) */
  total: number;
  /** a menor nota entre os decks escolhidos (consistência) */
  minimo: number;
  porDeck: NotaNoDeck[];
  /** fração dos decklists de torneio com a carta */
  uso: number;
  /** fração do meta (ponderada) que traz a carta no Side */
  noSide: number;
  /** nota só do confronto com os decks escolhidos (0 a 1) */
  contra: number;
  /** nota pelo uso em torneios (0 a 1) */
  torneio: number;
  /** requisito da carta, quando o seu deck não foi escolhido */
  requisito?: string;
  /** cópias permitidas no formato */
  maximo: number;
  /** cuidado com o seu deck (ex.: floodgate que trava você também) */
  aviso?: string;
  /** cópias sugeridas */
  copias: number;
}

/** Hand traps cuja nota pode vir das linhas do motor (as que o pipeline rejoga na mão do oponente) */
const DO_MOTOR = new Set([
  "Ash Blossom & Joyous Spring",
  "Effect Veiler",
  "Infinite Impermanence",
  "Ghost Ogre & Snow Rabbit",
  "Ghost Belle & Haunted Mansion",
  "Ghost Mourner & Moonlit Chill",
  "Droll & Lock Bird",
  "D.D. Crow",
  "Bystial Magnamhut",
  "Bystial Druiswurm",
  "Dominus Impulse",
  "Dominus Purge",
  "Skull Meister",
  "PSY-Framegear Gamma",
  "Herald of Orange Light",
]);

const limitar = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;

export interface EntradaMetaCall {
  decks: { deck: DeckDoMeta; peso: number; perfil: PerfilDeck }[];
  formato: GameFormat;
  byName: Map<string, Card>;
  uso?: { decks: number; cartas: Record<string, number> };
  /** perfil do seu deck (opcional): avisos de cartas que atrapalham você */
  meuDeck?: PerfilDeck;
  /** ids do seu Main/Extra (para "já está no seu deck") */
  meusIds?: Set<number>;
}

export function recomendar(e: EntradaMetaCall): Recomendacao[] {
  const pesoTotal = e.decks.reduce((s, d) => s + d.peso, 0) || 1;
  const out: Recomendacao[] = [];
  for (const item of CATALOGO) {
    const card = e.byName.get(item.nome);
    if (!card) continue;
    const maximo = copiasPermitidas(card, e.formato);
    if (!maximo) continue;
    const porDeck = e.decks.map(({ deck, perfil }): NotaNoDeck => {
      const h = item.nota(perfil);
      const m = DO_MOTOR.has(item.nome) ? perfil.interacoes.get(card.id) : undefined;
      if (m && perfil.linhas) {
        // linhas do motor: o quanto do combo ela corta (entrar cedo corta mais)
        const nota = limitar(0.6 * m.corte + 0.4 * h.nota);
        const n1 = (x: number) => x.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
        return {
          arquetipo: deck.arquetipo,
          nota,
          motor: true,
          motivo: t("nas {0} linhas do motor, entra no passo {1} de {2} (corta {3} do combo){4}", [perfil.linhas.n, n1(m.primeiro), n1(perfil.linhas.tamanho), pct(m.corte), h.nota > 0.2 ? `; ${h.motivo}` : ""]),
        };
      }
      return { arquetipo: deck.arquetipo, nota: limitar(h.nota), motivo: h.motivo, motor: false };
    });
    const contra = e.decks.reduce((s, d, i) => s + d.peso * porDeck[i].nota, 0) / pesoTotal;
    const minimo = Math.min(...porDeck.map((p) => p.nota));
    // o que o meta já põe no Side (validação de torneio)
    const noSide = e.decks.reduce((s, d) => s + d.peso * (d.deck.nucleo.side.find((x) => x.id === card.id)?.pct ?? 0), 0) / pesoTotal;
    const uso = e.uso ? (e.uso.cartas[card.id] ?? 0) / e.uso.decks : 0;
    // 70% o confronto com os decks escolhidos, 30% o que os jogadores de torneio realmente usam
    const torneio = limitar(uso * 1.4 + noSide * 0.6);
    let total = contra > 0.05 ? 0.7 * contra + 0.3 * torneio : contra;
    let aviso = item.aviso?.(e.meuDeck);
    let requisito: string | undefined;
    if (item.exige) {
      // com o seu deck escolhido, confere o requisito; sem ele, a carta perde força e mostra o requisito
      const falta = e.meuDeck ? item.exige(e.meuDeck) : item.requisito;
      if (falta) {
        if (e.meuDeck) aviso = falta;
        else requisito = falta;
        total *= e.meuDeck ? 0.25 : (item.fatorSemDeck ?? 0.5);
      }
    }
    if (total < 0.08) continue;
    out.push({
      id: card.id,
      card,
      item,
      categoria: item.categoria,
      total,
      minimo,
      porDeck,
      uso,
      noSide,
      contra,
      torneio,
      maximo,
      aviso,
      requisito,
      copias: Math.min(maximo, total >= 0.7 ? 3 : total >= 0.45 ? 2 : 1),
    });
  }
  return out.sort((a, b) => b.total - a.total || b.uso - a.uso);
}

/**
 * Sugestão de listas: Main (interrupções boas contra todos os decks escolhidos) e Side de 15
 * (o resto, das melhores para as piores, com cópias pela nota e pela banlist).
 */
export function sugerirListas(recs: Recomendacao[], vagasMain = 12, vagasSide = 15) {
  const main: { r: Recomendacao; n: number }[] = [];
  const side: { r: Recomendacao; n: number }[] = [];
  let livresMain = vagasMain;
  let livresSide = vagasSide;
  for (const r of recs) {
    const geral = (r.categoria === "hand-trap" || r.categoria === "resposta") && r.minimo >= 0.3 && r.total >= 0.45 && !r.aviso;
    if (geral && livresMain > 0) {
      const n = Math.min(r.copias, livresMain);
      main.push({ r, n });
      livresMain -= n;
    } else if (livresSide > 0 && r.total >= 0.25) {
      const n = Math.min(r.copias, livresSide);
      side.push({ r, n });
      livresSide -= n;
    }
  }
  return { main, side };
}
