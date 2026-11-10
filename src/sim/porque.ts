// "?" do Simulador: transforma os fatos do motor sobre uma carta (src/sim/sessao.ts, FatosCarta) numa
// explicação de por que o jogador não pôde (ou podia) usá-la naquele momento.
import { OcgMessageType as T, OcgPhase } from "ocgcore-wasm";
import { t } from "../i18n";
import type { Card } from "../db/types";
import { TIPO } from "./regras";
import type { FatosCarta } from "./sessao";

const SINTONIZADOR = 0x1000;

export interface Explicacao {
  /** resposta curta */
  conclusao: string;
  /** fatos e motivos encontrados */
  itens: string[];
}

interface Contexto {
  /** carta perguntada (base do app: texto e tipo) */
  carta: Card | undefined;
  code: number;
  nomeDe: (code: number) => string;
  cartaDe: (code: number) => Card | undefined;
  /** nome do jogador perguntado e do outro */
  jogador: string;
  outro: string;
  /** o jogador perguntado é quem tem a vez (vez = número do jogador no motor) */
  numeroJogador: number;
}

const nomeFase = (f: number) =>
  f & (OcgPhase.BATTLE_START | OcgPhase.BATTLE_STEP | OcgPhase.DAMAGE | OcgPhase.DAMAGE_CAL | OcgPhase.BATTLE)
    ? t("Battle Phase")
    : f === OcgPhase.MAIN1
      ? t("Main Phase 1")
      : f === OcgPhase.MAIN2
        ? t("Main Phase 2")
        : f === OcgPhase.DRAW
          ? t("Draw Phase")
          : f === OcgPhase.STANDBY
            ? t("Standby Phase")
            : f === OcgPhase.END
              ? t("End Phase")
              : "";

const nomeLocal: Record<FatosCarta["locais"][number], string> = {
  mao: t("mão"),
  deck: t("Deck"),
  extra: t("Extra Deck"),
  cemiterio: t("Cemitério"),
  banido: t("banidas"),
  campo: t("campo"),
};

/** Frases do texto que proíbem Invocação-Especial (português, se houver, ou inglês) */
function restricoes(c: Card | undefined): string[] {
  if (!c) return [];
  const frases = (texto: string) => texto.split(/(?<=[.;])\s+|\n/).map((f) => f.trim()).filter(Boolean);
  const pt = frases(c.descPt ?? "").filter((f) => /não pode(m)?\s+(Invocar|ser Invocad)/i.test(f) && /Especial/i.test(f));
  if (pt.length) return pt;
  return frases(c.desc).filter((f) => /cannot (Special Summon|be Special Summoned)/i.test(f));
}

/** Explica, com os fatos do motor, por que a carta não pôde (ou podia) ser usada pelo jogador */
export function explicarPorque(f: FatosCarta, ctx: Contexto): Explicacao {
  const { carta, nomeDe, cartaDe, jogador, outro } = ctx;
  const nome = nomeDe(ctx.code);
  const itens: string[] = [];
  const vezDoJogador = f.vez === ctx.numeroJogador;
  itens.push(t("Momento: turno {0}, {1}, vez de {2}.", [f.turno, nomeFase(f.fase) || "—", vezDoJogador ? jogador : outro]));

  // onde a carta estava
  if (!f.locais.length) {
    itens.push(t("{0} não estava com {1}: nem na mão, no Deck, no Extra Deck, no Cemitério, nas banidas ou no campo.", [nome, jogador]));
    return { conclusao: t("{0} não podia usar {1}: a carta não estava disponível para ele.", [jogador, nome]), itens };
  }
  itens.push(t("{0} estava em: {1}.", [nome, f.locais.map((l) => nomeLocal[l]).join(", ")]));

  // o que o motor oferecia
  const of = f.oferecida;
  if (of && (of.normal || of.especial || of.ativar || of.baixar)) {
    const acoes = [of.normal && t("Invocar por Invocação-Normal ou baixar"), of.especial && t("Invocar por Invocação-Especial"), of.ativar && t("ativar"), of.baixar && t("baixar")].filter(Boolean);
    itens.push(t("O motor oferecia com {0}: {1}.", [nome, acoes.join(", ")]));
    return { conclusao: t("{0} podia usar {1} neste momento; ele escolheu não usar.", [jogador, nome]), itens };
  }
  const decisaoDele = f.decisao?.jogador === ctx.numeroJogador;
  const naMain = decisaoDele && f.decisao?.tipo === T.SELECT_IDLECMD;
  if (of) itens.push(t("O motor não oferecia nenhuma ação com {0} neste momento.", [nome]));
  else if (!decisaoDele) itens.push(t("Neste momento quem decidia era {0}, não {1}.", [outro, jogador]));

  const motivos: string[] = [];
  const tipo = carta?.frame ?? "";
  const doExtra = f.locais.includes("extra") && /^(link|xyz|synchro|fusion)/.test(tipo);
  if (doExtra && !naMain) motivos.push(t("Invocações do Extra Deck pelas regras da própria carta (Link, Xyz, Sincro) só podem ser feitas na Main Phase do próprio turno, quando o jogador tem a ação."));

  // matérias pedidas pelo texto, comparadas com os monstros em campo
  if (doExtra && carta) {
    const pedido = carta.desc.split("\n")[0].trim();
    const deFace = f.monstros.filter((m) => m.faceUp);
    const lista = f.monstros.length
      ? f.monstros
          .map((m) => `${nomeDe(m.code)} (${[m.faceUp ? t("face para cima") : t("face para baixo"), m.tipo & TIPO.EFEITO ? t("de Efeito") : m.tipo & TIPO.FICHA ? t("Ficha") : t("sem efeito")].join(", ")})`)
          .join("; ")
      : t("nenhum");
    itens.push(t("Matérias pedidas: “{0}”. Monstros de {1} no campo: {2}.", [pedido, jogador, lista]));
    const efeito = pedido.match(/(\d+)\+?\s+Effect Monsters?/i);
    const nivel = pedido.match(/(\d+)\+?\s+Level\s+(\d+)\s+monsters?/i);
    const generico = pedido.match(/^(\d+)\+?\s+monsters?/i);
    if (efeito) {
      const ok = deFace.filter((m) => m.tipo & TIPO.EFEITO).length;
      if (ok < Number(efeito[1])) motivos.push(t("Faltavam matérias: {0} pede {1} monstro(s) de Efeito com a face para cima e {2} tinha {3}.", [nome, efeito[1], jogador, ok]));
    } else if (nivel) {
      const ok = deFace.filter((m) => m.nivel === Number(nivel[2]) && !(m.tipo & (TIPO.XYZ | TIPO.LINK))).length;
      if (ok < Number(nivel[1])) motivos.push(t("Faltavam matérias: {0} pede {1} monstro(s) de Nível {2} e {3} tinha {4}.", [nome, nivel[1], nivel[2], jogador, ok]));
    } else if (/Tuner/i.test(pedido) && tipo.startsWith("synchro")) {
      const sint = deFace.filter((m) => m.tipo & SINTONIZADOR).length;
      const outros = deFace.filter((m) => !(m.tipo & SINTONIZADOR)).length;
      if (!sint || !outros) motivos.push(t("Faltavam matérias: {0} pede um Sintonizador e um ou mais não-Sintonizadores com a face para cima ({1} tinha {2} Sintonizador(es) e {3} outro(s)).", [nome, jogador, sint, outros]));
      else itens.push(t("A soma dos Níveis das matérias precisa ser igual ao Nível de {0} ({1}).", [nome, carta.level ?? "?"]));
    } else if (generico && deFace.length < Number(generico[1])) {
      motivos.push(t("Faltavam matérias: {0} pede {1} monstro(s) e {2} tinha {3} com a face para cima.", [nome, generico[1], jogador, deFace.length]));
    }
  }

  // zonas: monstros Link do Extra Deck vão para uma Zona de Monstros Extra ou uma zona apontada por seta Link
  if (doExtra && tipo.startsWith("link")) {
    if (f.emz.minha) motivos.push(t("{0} já tinha um monstro numa Zona de Monstros Extra: outro monstro Link só entra numa zona principal apontada por uma seta Link{1}.", [jogador, f.emz.temLink ? "" : t(", e ele não tinha monstro Link no campo")]));
    else if (!f.emz.livres) motivos.push(t("As Zonas de Monstros Extra estavam ocupadas.", []));
  } else if (doExtra && !f.zonasPrincipaisLivres && !f.emz.livres && !f.emz.minha) {
    motivos.push(t("Não havia zona de monstro livre para {0}.", [jogador]));
  }

  // "uma vez por turno" da própria carta
  if (carta && f.invocadaNoTurno > 0 && /only Special Summon "[^"]+" once per turn/i.test(carta.desc))
    motivos.push(t("{0} só pode ser Invocada por Invocação-Especial uma vez por turno, e já tinha sido neste turno.", [nome]));

  // efeitos ativados no turno ou cartas com a face para cima que proíbem Invocação-Especial
  const vistos = new Set<number>();
  for (const { code, p } of [...f.ativadasNoTurno.map((a) => ({ ...a, ativada: true })), ...f.faceParaCima.map((a) => ({ ...a, ativada: false }))]) {
    if (vistos.has(code)) continue;
    vistos.add(code);
    const frases = restricoes(cartaDe(code));
    if (!frases.length) continue;
    const quem = p === ctx.numeroJogador ? jogador : outro;
    motivos.push(t("Restrição possível: {0} (de {1}): “{2}”", [nomeDe(code), quem, frases.slice(0, 2).join(" ")]));
  }

  itens.push(...motivos);
  const conclusao = motivos.length
    ? t("{0} não podia usar {1} neste momento. Motivo mais provável: {2}", [jogador, nome, motivos[0]])
    : of
      ? t("O motor não oferecia {0} a {1} neste momento, mas a causa não foi identificada automaticamente: confira o texto da carta e os efeitos listados.", [nome, jogador])
      : t("Neste momento {0} não tinha a ação; veja um momento da Main Phase dele na revisão.", [jogador]);
  return { conclusao, itens };
}
