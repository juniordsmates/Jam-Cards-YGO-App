import type { PerfilDeck } from "../db/metaCall";
import { t, LOCALE } from "../i18n";

// Meta Call: cartas usadas contra o meta e como cada uma pontua contra um deck (0 a 1), a partir do
// perfil dele (o que o motor do deck faz, lido do texto oficial, e as linhas do motor de regras).
// Os textos de "papel" e das condições seguem o texto oficial de cada carta (cartas.json da base).
// A banlist do formato decide se a carta entra e com quantas cópias.

export type CategoriaMeta = "hand-trap" | "resposta" | "segundo" | "side";

export const CATEGORIAS: { id: CategoriaMeta; label: string; hint: string }[] = [
  { id: "hand-trap", label: t("Hand traps"), hint: t("Da mão, no turno do oponente: param o combo") },
  { id: "resposta", label: t("Respostas"), hint: t("Armadilhas e Magias Rápidas baixadas que negam ou removem") },
  { id: "segundo", label: t("Jogando em segundo"), hint: t("Quebram o campo final do oponente") },
  { id: "side", label: t("Side e floodgates"), hint: t("Cartas específicas contra um tipo de deck") },
];

export interface ItemCatalogo {
  /** nome oficial em inglês */
  nome: string;
  categoria: CategoriaMeta;
  /** o que a carta faz, em uma linha */
  papel: string;
  nota: (p: PerfilDeck) => { nota: number; motivo: string };
  /** cuidado com o seu deck (a carta também atrapalha você) */
  aviso?: (meu?: PerfilDeck) => string | undefined;
  /** o que o seu deck precisa ter; sem isso a carta quase não serve */
  exige?: (meu: PerfilDeck) => string | undefined;
  /** o requisito em texto, mostrado quando o seu deck não foi escolhido */
  requisito?: string;
  /** peso da carta sem saber o seu deck (padrão 0,5) */
  fatorSemDeck?: number;
  /** choke points além da regra de resposta da carta (src/data/interrupcoes.ts) */
  alvo?: TipoAlvo;
}

/** Que cartas do deck a carta acerta, quando não é (só) uma resposta a uma ação */
export type TipoAlvo = "nibiru" | "chefes" | "finais" | "finais-monstros" | "backrow" | "permanentes" | "handtraps" | "magias" | "cemiterio" | "efeitoCampo" | "tipo" | "maquinas";

const L = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const n1 = (x: number) => x.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
/** soma das frações das listas que jogam hand traps (≈ hand traps por deck) */
const hts = (p: PerfilDeck) => p.handTraps.filter((h) => !h.side).reduce((s, h) => s + h.pct, 0);
const chefes = (p: PerfilDeck) => p.chefes.reduce((s, c) => s + c.pct, 0);
const atrib = (meu: PerfilDeck | undefined, lista: string[]) => (meu ? lista.reduce((s, a) => s + (meu.atribFrac[a] ?? 0), 0) : 0);
const travaAtributos = (lista: string[], nomes: string) => (meu?: PerfilDeck) => {
  const f = atrib(meu, lista);
  return f >= 0.2 ? t("da mão, você não ativa mais efeitos de monstros {0} no Duelo ({1} dos monstros do seu deck)", [nomes, pct(f)]) : undefined;
};

export const CATALOGO: ItemCatalogo[] = [
  // ------------------------------------------------------------------ hand traps
  {
    nome: "Ash Blossom & Joyous Spring",
    categoria: "hand-trap",
    papel: t("nega efeitos que buscam, Invocam ou enviam do Deck"),
    nota: (p) => ({
      nota: p.ash * 1.7 + (p.linhas ? Math.min(0.25, (p.linhas.buscas + p.linhas.envios) / 12) : 0),
      motivo: t("{0} do motor busca, Invoca ou envia do Deck", [pct(p.ash)]),
    }),
  },
  {
    nome: "Droll & Lock Bird",
    categoria: "hand-trap",
    papel: t("depois da primeira busca, ninguém adiciona do Deck no turno"),
    nota: (p) => ({
      nota: p.busca * 1.3 + (p.linhas ? Math.min(0.4, p.linhas.buscas / 5) : 0),
      motivo: t("{0} do motor busca no Deck{1}", [pct(p.busca), p.linhas ? t("; {0} buscas por combo", [n1(p.linhas.buscas)]) : ""]),
    }),
  },
  {
    nome: "Infinite Impermanence",
    alvo: "efeitoCampo",
    categoria: "hand-trap",
    papel: t("nega os efeitos de um monstro (da mão, sem cartas no seu campo)"),
    nota: (p) => ({ nota: p.efeitoCampo * 1.5, motivo: t("{0} do deck depende de efeitos de monstro no campo", [pct(p.efeitoCampo)]) }),
  },
  {
    nome: "Effect Veiler",
    alvo: "efeitoCampo",
    categoria: "hand-trap",
    papel: t("nega os efeitos de um monstro (só na Main Phase do oponente)"),
    nota: (p) => ({ nota: p.efeitoCampo * 1.4, motivo: t("{0} do deck depende de efeitos de monstro no campo", [pct(p.efeitoCampo)]) }),
  },
  {
    nome: "Ghost Ogre & Snow Rabbit",
    alvo: "efeitoCampo",
    categoria: "hand-trap",
    papel: t("destrói a carta que ativou efeito no campo (não nega)"),
    nota: (p) => ({ nota: (p.efeitoCampo + p.permanentes) * 1.0, motivo: t("efeitos no campo em {0} do deck e {1} de Magias/Armadilhas que ficam no campo", [pct(p.efeitoCampo), pct(p.permanentes)]) }),
  },
  {
    nome: "Ghost Belle & Haunted Mansion",
    alvo: "cemiterio",
    categoria: "hand-trap",
    papel: t("nega efeitos que tiram cartas do Cemitério"),
    nota: (p) => ({ nota: p.usaGY * 1.9, motivo: t("{0} do motor adiciona, Invoca ou bane do Cemitério", [pct(p.usaGY)]) }),
  },
  {
    nome: "Ghost Mourner & Moonlit Chill",
    categoria: "hand-trap",
    papel: t("nega os efeitos de um monstro Invocado por Invocação-Especial"),
    nota: (p) => ({
      nota: (p.invocaPorEfeito * 0.8 + (p.linhas ? Math.min(0.4, p.linhas.especiais / 15) : 0)) * 0.7,
      motivo: t("{0} do motor Invoca por Invocação-Especial", [pct(p.invocaPorEfeito)]),
    }),
  },
  {
    nome: "Nibiru, the Primal Being",
    alvo: "nibiru",
    categoria: "hand-trap",
    papel: t("depois de 5 Invocações, troca o campo do oponente por uma Ficha"),
    nota: (p) =>
      p.linhas
        ? { nota: (p.linhas.invocacoes - 3) / 6, motivo: t("{0} Invocações por combo (Nibiru a partir de 5)", [n1(p.linhas.invocacoes)]) }
        : { nota: p.invocaExtra * 0.9, motivo: t("estimado: muitas Invocações do Extra Deck") },
  },
  {
    nome: "D.D. Crow",
    alvo: "cemiterio",
    categoria: "hand-trap",
    papel: t("bane uma carta do Cemitério do oponente"),
    nota: (p) => ({ nota: p.efeitoGY * 1.1, motivo: t("{0} do motor tem efeito no Cemitério", [pct(p.efeitoGY)]) }),
  },
  {
    nome: "Bystial Magnamhut",
    categoria: "hand-trap",
    papel: t("bane um monstro LUZ/TREVAS de um Cemitério e se Invoca"),
    nota: (p) => ({ nota: p.luzTrevasGY * 1.8, motivo: t("{0} do motor são monstros LUZ/TREVAS que passam pelo Cemitério", [pct(p.luzTrevasGY)]) }),
  },
  {
    nome: "Bystial Druiswurm",
    categoria: "hand-trap",
    papel: t("bane um monstro LUZ/TREVAS de um Cemitério e se Invoca"),
    nota: (p) => ({ nota: p.luzTrevasGY * 1.7, motivo: t("{0} do motor são monstros LUZ/TREVAS que passam pelo Cemitério", [pct(p.luzTrevasGY)]) }),
  },
  {
    nome: "Mulcharmy Fuwalos",
    categoria: "hand-trap",
    papel: t("compra 1 a cada Invocação-Especial do Deck ou do Extra Deck (sem cartas no seu campo)"),
    nota: (p) =>
      p.linhas
        ? { nota: (p.linhas.doExtra + p.linhas.doDeck) / 4, motivo: t("{0} Invocações do Deck/Extra Deck por combo", [n1(p.linhas.doExtra + p.linhas.doDeck)]) }
        : { nota: (p.invocaDeck + p.invocaExtra) * 1.3, motivo: t("{0} do motor Invoca do Deck ou do Extra Deck", [pct(p.invocaDeck + p.invocaExtra)]) },
  },
  {
    nome: "Mulcharmy Purulia",
    categoria: "hand-trap",
    papel: t("compra 1 a cada Invocação da mão (sem cartas no seu campo)"),
    nota: (p) =>
      p.linhas
        ? { nota: p.linhas.daMao / 4, motivo: t("{0} Invocações da mão por combo", [n1(p.linhas.daMao)]) }
        : { nota: p.invocaMao * 1.6, motivo: t("{0} do motor Invoca da mão", [pct(p.invocaMao)]) },
  },
  {
    nome: "Mulcharmy Meowls",
    categoria: "hand-trap",
    papel: t("compra 1 a cada Invocação-Especial do Cemitério ou das banidas (sem cartas no seu campo)"),
    nota: (p) =>
      p.linhas && p.linhas.doGY > 0
        ? { nota: p.linhas.doGY / 3, motivo: t("{0} Invocações do Cemitério/banidas por combo", [n1(p.linhas.doGY)]) }
        : { nota: p.invocaGY * 1.6, motivo: t("{0} do motor Invoca do Cemitério ou das banidas", [pct(p.invocaGY)]) },
  },
  {
    nome: 'Maxx "C"',
    categoria: "hand-trap",
    papel: t("compra 1 a cada Invocação-Especial do oponente no turno"),
    nota: (p) =>
      p.linhas ? { nota: p.linhas.especiais / 8, motivo: t("{0} Invocações-Especiais por combo", [n1(p.linhas.especiais)]) } : { nota: p.invocaPorEfeito * 1.3, motivo: t("{0} do motor Invoca", [pct(p.invocaPorEfeito)]) },
  },
  {
    nome: "Dominus Impulse",
    categoria: "hand-trap",
    papel: t("Armadilha (da mão se o oponente controlar carta): nega efeito que Invoca por Invocação-Especial"),
    nota: (p) => ({ nota: p.invocaPorEfeito * 1.4, motivo: t("{0} do motor tem efeito que Invoca", [pct(p.invocaPorEfeito)]) }),
    aviso: travaAtributos(["LIGHT", "EARTH", "WIND"], t("LUZ, TERRA e VENTO")),
  },
  {
    nome: "Dominus Purge",
    categoria: "hand-trap",
    papel: t("Armadilha (da mão se o oponente controlar carta): nega efeito que adiciona do Deck à mão"),
    nota: (p) => ({ nota: p.busca * 1.5, motivo: t("{0} do motor busca no Deck", [pct(p.busca)]) }),
    aviso: travaAtributos(["DARK", "WATER", "FIRE"], t("TREVAS, ÁGUA e FOGO")),
  },
  {
    nome: "Dominus Spark",
    categoria: "hand-trap",
    papel: t("Armadilha: depois de efeito de monstro na mão ou no Cemitério, bane 1 monstro do oponente"),
    nota: (p) => ({ nota: p.efeitoMaoGY * 1.0, motivo: t("{0} do motor ativa efeitos de monstro na mão ou no Cemitério", [pct(p.efeitoMaoGY)]) }),
    aviso: travaAtributos(["EARTH", "WATER", "FIRE", "WIND"], t("TERRA, ÁGUA, FOGO e VENTO")),
  },
  {
    nome: "Skull Meister",
    alvo: "cemiterio",
    categoria: "hand-trap",
    papel: t("nega um efeito ativado no Cemitério"),
    nota: (p) => ({ nota: p.efeitoGY * 0.9, motivo: t("{0} do motor ativa efeitos no Cemitério", [pct(p.efeitoGY)]) }),
  },
  {
    nome: "PSY-Framegear Gamma",
    categoria: "hand-trap",
    papel: t("nega a ativação de efeito de monstro (só sem monstros no seu campo)"),
    nota: (p) => ({ nota: (p.efeitoCampo + p.efeitoMaoGY) * 0.6, motivo: t("nega o primeiro efeito de monstro; melhor jogando em segundo, com o campo vazio") }),
  },
  {
    nome: "Herald of Orange Light",
    categoria: "hand-trap",
    papel: t("nega a ativação de efeito de monstro (descarta outro monstro Fada)"),
    nota: (p) => ({ nota: (p.efeitoCampo + p.efeitoMaoGY) * 0.7, motivo: t("nega efeito de monstro em qualquer lugar") }),
    exige: (meu) => (meu.fadas < 0.15 ? t("precisa de outro monstro Fada na mão: o seu deck quase não tem Fadas") : undefined),
    requisito: t("precisa de outro monstro Fada na mão"),
    fatorSemDeck: 0.4,
  },
  {
    nome: "Artifact Lancea",
    categoria: "hand-trap",
    papel: t("no turno do oponente, ninguém pode banir cartas"),
    nota: (p) => ({ nota: p.bane * 1.3, motivo: t("{0} do motor bane cartas (no efeito ou no custo)", [pct(p.bane)]) }),
  },
  {
    nome: "Fydraulis Harmonia",
    categoria: "hand-trap",
    papel: t("quando um monstro do oponente ativa efeito: se Invoca e, revelando 6 Sincros, destrói 1 monstro"),
    nota: (p) => ({ nota: p.efeitoCampo * 0.9, motivo: t("{0} do deck usa efeitos de monstro no campo", [pct(p.efeitoCampo)]) }),
    exige: (meu) => (meu.sincros < 0.3 ? t("precisa de Monstros Sincro no Extra Deck para revelar") : undefined),
    requisito: t("precisa de Monstros Sincro no Extra Deck"),
    fatorSemDeck: 0.5,
  },
  {
    nome: 'Retaliating "C"',
    categoria: "hand-trap",
    papel: t("contra Magia que Invoca: se Invoca e bane o que iria ao Cemitério"),
    nota: (p) => ({ nota: p.magiaInvoca * 1.6, motivo: t("{0} do motor são Magias que Invocam", [pct(p.magiaInvoca)]) }),
  },
  {
    nome: "Dimension Shifter",
    alvo: "cemiterio",
    categoria: "hand-trap",
    papel: t("sem cartas no seu Cemitério: até o fim do próximo turno, o que iria ao Cemitério é banido"),
    nota: (p) => ({ nota: (p.efeitoGY + p.usaGY + p.enviaDeck) * 0.9, motivo: t("o deck depende do Cemitério ({0} com efeito lá)", [pct(p.efeitoGY)]) }),
    aviso: (meu) => (meu && meu.efeitoGY >= 0.25 ? t("também bane as suas cartas ({0} do seu motor usa o Cemitério)", [pct(meu.efeitoGY)]) : undefined),
  },

  // ------------------------------------------------------------------ respostas (baixadas)
  {
    nome: "Solemn Judgment",
    categoria: "resposta",
    papel: t("nega uma Invocação ou a ativação de Magia/Armadilha (metade dos PV)"),
    nota: (p) => ({ nota: 0.3 + p.invocaExtra * 0.3 + (p.magias + p.armadilhas) * 0.3, motivo: t("para a Invocação do Extra Deck ou a Magia principal do combo") }),
  },
  {
    nome: "Solemn Strike",
    categoria: "resposta",
    papel: t("nega uma Invocação-Especial ou ativação de efeito de monstro (1500 PV)"),
    nota: (p) => ({ nota: 0.25 + (p.efeitoCampo + p.efeitoMaoGY) * 0.3, motivo: t("para o primeiro monstro ou efeito de monstro importante") }),
  },
  {
    nome: "Solemn Warning",
    categoria: "resposta",
    papel: t("nega Invocação ou efeito que Invoca (2000 PV)"),
    nota: (p) => ({ nota: 0.25 + p.invocaPorEfeito * 0.4, motivo: t("{0} do motor tem efeito que Invoca", [pct(p.invocaPorEfeito)]) }),
  },
  {
    nome: "Solemn Accusation",
    alvo: "backrow",
    categoria: "resposta",
    papel: t("nega a ativação de Magia/Armadilha (destrói ou bane, e trava o nome)"),
    nota: (p) => ({ nota: (p.magias + p.armadilhas) * 1.4, motivo: t("{0} do motor são Magias/Armadilhas", [pct(p.magias + p.armadilhas)]) }),
  },
  {
    nome: "Red Reboot",
    alvo: "backrow",
    categoria: "resposta",
    papel: t("nega uma Armadilha e o oponente não ativa mais Armadilhas no turno"),
    nota: (p) => ({ nota: p.armadilhas * 2.2, motivo: t("{0} do motor são Armadilhas", [pct(p.armadilhas)]) }),
  },
  {
    nome: "Called by the Grave",
    alvo: "handtraps",
    categoria: "resposta",
    papel: t("bane um monstro do Cemitério e nega os efeitos das cópias (vence hand traps)"),
    nota: (p) => ({
      nota: hts(p) * 0.22 + p.efeitoGY * 0.5,
      motivo: t("o deck joga ~{0} hand traps no Main{1}", [n1(hts(p)), p.efeitoGY > 0.2 ? t(" e {0} do motor usa o Cemitério", [pct(p.efeitoGY)]) : ""]),
    }),
  },
  {
    nome: "Crossout Designator",
    alvo: "handtraps",
    categoria: "resposta",
    papel: t("declara um nome e nega as cópias até o fim do turno (precisa de uma no seu Deck)"),
    nota: (p) => ({ nota: hts(p) * 0.22, motivo: t("o deck joga ~{0} hand traps; declare uma que você também joga", [n1(hts(p))]) }),
  },
  {
    nome: "Cosmic Cyclone",
    alvo: "backrow",
    categoria: "resposta",
    papel: t("bane uma Magia/Armadilha (1000 PV)"),
    nota: (p) => ({ nota: p.permanentes * 1.6 + p.armadilhas * 0.5, motivo: t("{0} de Magias/Armadilhas que ficam no campo", [pct(p.permanentes)]) }),
  },
  {
    nome: "Twin Twisters",
    alvo: "backrow",
    categoria: "resposta",
    papel: t("descarta 1 e destrói até 2 Magias/Armadilhas"),
    nota: (p) => ({ nota: p.permanentes * 1.5 + p.armadilhas * 0.6, motivo: t("{0} de Magias/Armadilhas que ficam no campo", [pct(p.permanentes)]) }),
  },
  {
    nome: "Mystical Space Typhoon",
    alvo: "backrow",
    categoria: "resposta",
    papel: t("destrói uma Magia/Armadilha"),
    nota: (p) => ({ nota: (p.permanentes * 1.5 + p.armadilhas * 0.5) * 0.9, motivo: t("{0} de Magias/Armadilhas que ficam no campo", [pct(p.permanentes)]) }),
  },
  {
    nome: "Typhoon",
    alvo: "permanentes",
    categoria: "resposta",
    papel: t("destrói uma Magia/Armadilha virada para cima (da mão, se o oponente tiver 2+ e você nenhuma)"),
    // da mão (oponente com 2+ Magias/Armadilhas e você sem nenhuma): vale mais contra quem baixa muitas
    // cartas, mas só se houver alvo virado para cima (ela não destrói carta baixada)
    nota: (p) => ({
      nota: p.permanentes * (1.5 + Math.min(0.5, p.armadilhas)),
      motivo: p.viradasFinais
        ? t("termina o combo com ~{0} Magias/Armadilhas viradas para cima; ativa da mão contra quem baixa muitas cartas", [n1(p.viradasFinais)])
        : t("{0} de Magias/Armadilhas que ficam no campo", [pct(p.permanentes)]),
    }),
  },
  {
    nome: "Book of Moon",
    alvo: "chefes",
    categoria: "resposta",
    papel: t("vira um monstro para baixo"),
    nota: (p) => ({ nota: (p.efeitoCampo * 0.8 + Math.min(1, chefes(p)) * 0.2) * 0.6, motivo: t("tira os efeitos de campo de um monstro") }),
  },
  {
    nome: "Skill Drain",
    alvo: "efeitoCampo",
    categoria: "resposta",
    papel: t("nega os efeitos de todos os monstros virados para cima no campo (1000 PV)"),
    nota: (p) => ({ nota: p.efeitoCampo * 0.8, motivo: t("{0} do deck depende de efeitos de monstro no campo", [pct(p.efeitoCampo)]) }),
    aviso: (meu) => (meu && meu.efeitoCampo >= 0.3 ? t("também nega os seus monstros ({0} do seu deck usa efeitos no campo)", [pct(meu.efeitoCampo)]) : undefined),
  },

  // ------------------------------------------------------------------ jogando em segundo
  {
    nome: "Dark Ruler No More",
    alvo: "chefes",
    categoria: "segundo",
    papel: t("nega os efeitos de todos os monstros do oponente no turno (sem resposta de monstros)"),
    nota: (p) =>
      p.linhas
        ? { nota: p.linhas.monstrosFinais / 4 + Math.min(1, chefes(p)) * 0.1, motivo: t("{0} monstros no campo final", [n1(p.linhas.monstrosFinais)]) }
        : { nota: chefes(p) * 0.3, motivo: t("monstros com negação no campo final") },
  },
  {
    nome: "Evenly Matched",
    alvo: "finais",
    categoria: "segundo",
    papel: t("no fim da Battle Phase, o oponente bane virado para baixo até ficar com o mesmo número de cartas"),
    nota: (p) =>
      p.linhas
        ? { nota: (p.linhas.monstrosFinais + p.linhas.magiasFinais - 1) / 5, motivo: t("{0} cartas no campo final", [n1(p.linhas.monstrosFinais + p.linhas.magiasFinais)]) }
        : { nota: 0.5, motivo: t("contra campos grandes") },
  },
  {
    nome: "Lightning Storm",
    alvo: "finais",
    categoria: "segundo",
    papel: t("sem cartas viradas para cima: destrói os monstros em ataque ou as Magias/Armadilhas do oponente"),
    nota: (p) =>
      p.linhas
        ? { nota: Math.max(p.linhas.monstrosFinais, p.linhas.magiasFinais * 1.3) / 4, motivo: t("campo final: {0} monstros, {1} Magias/Armadilhas", [n1(p.linhas.monstrosFinais), n1(p.linhas.magiasFinais)]) }
        : { nota: 0.45 + p.armadilhas * 0.5, motivo: t("contra campo de monstros ou de Armadilhas") },
  },
  {
    nome: "Harpie's Feather Duster",
    alvo: "backrow",
    categoria: "segundo",
    papel: t("destrói todas as Magias/Armadilhas do oponente"),
    nota: (p) => ({
      nota: p.armadilhas * 1.5 + p.permanentes + (p.linhas ? p.linhas.magiasFinais / 4 : 0),
      motivo: t("{0} do motor são Armadilhas{1}", [pct(p.armadilhas), p.linhas ? t("; {0} Magias/Armadilhas no campo final", [n1(p.linhas.magiasFinais)]) : ""]),
    }),
  },
  {
    nome: "Raigeki",
    alvo: "finais-monstros",
    categoria: "segundo",
    papel: t("destrói todos os monstros do oponente"),
    nota: (p) => (p.linhas ? { nota: p.linhas.monstrosFinais / 4, motivo: t("{0} monstros no campo final", [n1(p.linhas.monstrosFinais)]) } : { nota: 0.4, motivo: t("contra campos de monstros") }),
  },
  {
    nome: "Forbidden Droplet",
    alvo: "chefes",
    categoria: "segundo",
    papel: t("nega e corta o ATK de vários monstros; o oponente não responde com o mesmo tipo de carta"),
    nota: (p) => ({ nota: Math.min(1, chefes(p)) * 0.35 + p.efeitoCampo * 0.4, motivo: p.chefes.length ? t("contra os monstros com negação do campo final") : t("contra efeitos de monstro no campo") }),
  },
  {
    nome: "Gameciel, the Sea Turtle Kaiju",
    alvo: "chefes",
    categoria: "segundo",
    papel: t("oferece um monstro do oponente para Invocar no campo dele (tira um chefe)"),
    nota: (p) => ({ nota: Math.min(1, chefes(p)) * 0.55 * (p.linhas && p.linhas.monstrosFinais > 3 ? 0.7 : 1), motivo: p.chefes.length ? t("tira um chefe que nega sem destruí-lo nem mirá-lo") : t("tira um monstro do campo") }),
  },
  {
    nome: "Dogoran, the Mad Flame Kaiju",
    alvo: "chefes",
    categoria: "segundo",
    papel: t("oferece um monstro do oponente; depois, pode destruir todos os monstros dele"),
    nota: (p) => ({ nota: Math.min(1, chefes(p)) * 0.45, motivo: t("tira um chefe sem destruí-lo nem mirá-lo") }),
  },
  {
    nome: "Super Polymerization",
    alvo: "chefes",
    categoria: "segundo",
    papel: t("Fusão com monstros do campo do oponente, sem resposta"),
    nota: (p) => ({ nota: (Math.min(1, chefes(p)) * 0.3 + (p.linhas ? p.linhas.monstrosFinais / 8 : 0.2)) * 0.8, motivo: t("usa os monstros do oponente como matéria") }),
    exige: (meu) => (meu.fusoes < 0.15 ? t("precisa de Monstros de Fusão no seu Extra Deck") : undefined),
    requisito: t("precisa de Monstros de Fusão no Extra Deck"),
    fatorSemDeck: 0.6,
  },
  {
    nome: "Triple Tactics Talent",
    alvo: "handtraps",
    categoria: "segundo",
    papel: t("se o oponente ativou efeito de monstro no seu turno: compra 2, rouba um monstro ou tira uma carta da mão"),
    nota: (p) => ({ nota: hts(p) * 0.25, motivo: t("o deck joga ~{0} hand traps (ativados no seu turno)", [n1(hts(p))]) }),
  },
  {
    nome: "Triple Tactics Thrust",
    alvo: "handtraps",
    categoria: "segundo",
    papel: t("se o oponente ativou efeito de monstro no turno: baixa uma Magia/Armadilha Normal do Deck"),
    nota: (p) => ({ nota: hts(p) * 0.2, motivo: t("o deck joga ~{0} hand traps (ativados no seu turno)", [n1(hts(p))]) }),
  },

  // ------------------------------------------------------------------ side e floodgates
  {
    nome: "Thunder King Rai-Oh",
    categoria: "side",
    papel: t("no campo: ninguém busca no Deck; nega uma Invocação-Especial"),
    nota: (p) => ({ nota: (p.busca * 0.9 + p.invocaExtra * 0.3) * 0.7, motivo: t("{0} do motor busca no Deck", [pct(p.busca)]) }),
  },
  {
    nome: "Imperial Order",
    alvo: "magias",
    categoria: "side",
    papel: t("nega os efeitos das Magias no campo"),
    nota: (p) => ({ nota: p.magias * 1.8, motivo: t("{0} do motor são Magias", [pct(p.magias)]) }),
    aviso: (meu) => (meu && meu.magias >= 0.25 ? t("também nega as suas Magias ({0} do seu motor)", [pct(meu.magias)]) : undefined),
  },
  {
    nome: "Anti-Spell Fragrance",
    alvo: "magias",
    categoria: "side",
    papel: t("Magias precisam ser baixadas e esperar um turno"),
    nota: (p) => ({ nota: p.magias * 1.6, motivo: t("{0} do motor são Magias", [pct(p.magias)]) }),
    aviso: (meu) => (meu && meu.magias >= 0.25 ? t("também trava as suas Magias ({0} do seu motor)", [pct(meu.magias)]) : undefined),
  },
  {
    nome: "Macro Cosmos",
    alvo: "cemiterio",
    categoria: "side",
    papel: t("no campo, o que iria ao Cemitério é banido"),
    nota: (p) => ({ nota: (p.efeitoGY + p.usaGY) * 1.1, motivo: t("o deck depende do Cemitério ({0} com efeito lá)", [pct(p.efeitoGY)]) }),
    aviso: (meu) => (meu && meu.efeitoGY >= 0.25 ? t("também bane as suas cartas ({0} do seu motor usa o Cemitério)", [pct(meu.efeitoGY)]) : undefined),
  },
  {
    nome: "Dimensional Barrier",
    categoria: "side",
    papel: t("declara Fusão, Sincro, Xyz, Ritual ou Pêndulo: ninguém Invoca desse tipo no turno"),
    nota: (p) => ({
      nota: p.extraPrincipal.fracao * (p.linhas ? Math.min(1, p.linhas.doExtra / 2) : p.invocaExtra) * 1.1,
      motivo: t("{0} do Extra Deck é {1}", [pct(p.extraPrincipal.fracao), TIPO_EXTRA[p.extraPrincipal.tipo] ?? p.extraPrincipal.tipo]),
    }),
  },
  {
    nome: "There Can Be Only One",
    alvo: "tipo",
    categoria: "side",
    papel: t("cada jogador só controla 1 monstro de cada Tipo"),
    nota: (p) => ({ nota: (p.tipoPrincipal.fracao - 0.45) * 1.8, motivo: t("{0} dos monstros são {1}", [pct(p.tipoPrincipal.fracao), p.tipoPrincipal.race]) }),
    aviso: (meu) => (meu && meu.tipoPrincipal.fracao >= 0.5 ? t("também limita você ({0} dos seus monstros são {1})", [pct(meu.tipoPrincipal.fracao), meu.tipoPrincipal.race]) : undefined),
  },
  {
    nome: "Rivalry of Warlords",
    alvo: "tipo",
    categoria: "side",
    papel: t("cada jogador só controla monstros de 1 Tipo"),
    nota: (p) => ({ nota: (p.tipos - 1) * 0.3, motivo: t("{0} Tipos de monstro no deck", [p.tipos]) }),
    aviso: (meu) => (meu && meu.tipos > 1 ? t("também limita você ({0} Tipos de monstro no seu deck)", [meu.tipos]) : undefined),
  },
  {
    nome: "Gozen Match",
    alvo: "tipo",
    categoria: "side",
    papel: t("cada jogador só controla monstros de 1 Atributo"),
    nota: (p) => ({ nota: (p.atributos - 1) * 0.3, motivo: t("{0} Atributos de monstro no deck", [p.atributos]) }),
    aviso: (meu) => (meu && meu.atributos > 1 ? t("também limita você ({0} Atributos no seu deck)", [meu.atributos]) : undefined),
  },
  {
    nome: "System Down",
    alvo: "maquinas",
    categoria: "side",
    papel: t("bane todos os monstros Máquina do campo e do Cemitério do oponente"),
    nota: (p) => ({ nota: p.maquinas * 1.4, motivo: t("{0} dos monstros são Máquina", [pct(p.maquinas)]) }),
  },
];

const TIPO_EXTRA: Record<string, string> = { fusion: t("Fusão"), synchro: t("Sincro"), xyz: t("Xyz"), link: t("Link") };

/** Notas do catálogo sempre entre 0 e 1 */
for (const item of CATALOGO) {
  const f = item.nota;
  item.nota = (p) => {
    const r = f(p);
    return { ...r, nota: L(r.nota) };
  };
}
