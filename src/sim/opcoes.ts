// Opções de resposta para uma decisão do motor (base: src/motor/explorer.ts do pipeline, para
// qualquer jogador). A IA escolhe entre elas; a tela monta as escolhas do jogador direto da mensagem.
import { OcgLocation as L, OcgMessageType as T, OcgResponseType as R, type OcgMessage, type OcgResponse, type SelectFieldPlace } from "ocgcore-wasm";
import { TIPO } from "./regras";

export interface RefCarta {
  code: number;
  controller: number;
  location: number;
  sequence: number;
}

export interface Opcao {
  resp: OcgResponse;
  /** ação de jogo (para a IA ordenar e para o estado visto) */
  acao?: { k: "normal" | "especial" | "ativa" | "baixa" | "baixa-monstro" | "posicao" | "ataque" | "fase"; code?: number; desc?: string };
  /** cartas escolhidas */
  escolha?: RefCarta[];
  /** não ativar um efeito opcional */
  recusa?: boolean;
}

/** Combinações de índices com tamanho entre min e max (no máximo `cap`) */
export function combinacoes(n: number, min: number, max: number, cap: number): number[][] {
  const out: number[][] = [];
  const rec = (inicio: number, cur: number[]) => {
    if (out.length >= cap) return;
    if (cur.length >= Math.max(min, 1)) out.push([...cur]);
    if (cur.length === max) return;
    for (let i = inicio; i < n; i++) {
      cur.push(i);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

// cópias da mesma carta fora do campo são equivalentes; no campo, a zona importa
const chaveCarta = (c: RefCarta) => (c.location & (L.MZONE | L.SZONE) ? `${c.controller}:${c.code}@${c.location}.${c.sequence}` : `${c.controller}:${c.code}@${c.location}`);

/**
 * Zonas livres de uma SELECT_PLACE/SELECT_DISFIELD. Bits ligados em `field_mask` = zonas proibidas;
 * os 16 primeiros são do jogador que escolhe, os outros do oponente. `player` na resposta é absoluto.
 */
export function zonasLivres(d: Extract<OcgMessage, { type: T.SELECT_PLACE | T.SELECT_DISFIELD }>) {
  const out: SelectFieldPlace[] = [];
  for (let i = 0; i < 32; i++) {
    if (d.field_mask & (1 << i)) continue;
    const bit = i % 16;
    if (bit === 7 || bit > 15) continue;
    const player = i >= 16 ? 1 - d.player : d.player;
    out.push({ player, location: (bit < 8 ? L.MZONE : L.SZONE) as L, sequence: bit < 8 ? bit : bit - 8 });
  }
  return out;
}

/** Opções do jogador da decisão. `tipo`: tipo da carta pelo id (para baixar só o que interessa) */
export function opcoesDe(d: OcgMessage, tipo: (code: number) => number): Opcao[] {
  const o: Opcao[] = [];
  switch (d.type) {
    case T.SELECT_IDLECMD:
      d.activates.forEach((c, i) => o.push({ resp: { type: R.SELECT_IDLECMD, action: 5, index: i }, acao: { k: "ativa", code: c.code, desc: String(c.description) } }));
      d.special_summons.forEach((c, i) => o.push({ resp: { type: R.SELECT_IDLECMD, action: 1, index: i }, acao: { k: "especial", code: c.code } }));
      d.summons.forEach((c, i) => o.push({ resp: { type: R.SELECT_IDLECMD, action: 0, index: i }, acao: { k: "normal", code: c.code } }));
      d.monster_sets.forEach((c, i) => o.push({ resp: { type: R.SELECT_IDLECMD, action: 3, index: i }, acao: { k: "baixa-monstro", code: c.code } }));
      // baixar só Armadilhas e Magias Rápidas: as que servem de interrupção
      d.spell_sets.forEach((c, i) => {
        if (tipo(c.code) & (TIPO.ARMADILHA | TIPO.RAPIDA)) o.push({ resp: { type: R.SELECT_IDLECMD, action: 4, index: i }, acao: { k: "baixa", code: c.code } });
      });
      d.pos_changes.forEach((c, i) => o.push({ resp: { type: R.SELECT_IDLECMD, action: 2, index: i }, acao: { k: "posicao", code: c.code } }));
      if (d.to_bp) o.push({ resp: { type: R.SELECT_IDLECMD, action: 6, index: null }, acao: { k: "fase", desc: "bp" } });
      if (d.to_ep) o.push({ resp: { type: R.SELECT_IDLECMD, action: 7, index: null }, acao: { k: "fase", desc: "ep" } });
      break;
    case T.SELECT_BATTLECMD:
      d.attacks.forEach((c, i) => o.push({ resp: { type: R.SELECT_BATTLECMD, action: 1, index: i }, acao: { k: "ataque", code: c.code } }));
      d.chains.forEach((c, i) => o.push({ resp: { type: R.SELECT_BATTLECMD, action: 0, index: i }, acao: { k: "ativa", code: c.code, desc: String(c.description) } }));
      if (d.to_m2) o.push({ resp: { type: R.SELECT_BATTLECMD, action: 2, index: null }, acao: { k: "fase", desc: "m2" } });
      if (d.to_ep) o.push({ resp: { type: R.SELECT_BATTLECMD, action: 3, index: null }, acao: { k: "fase", desc: "ep" } });
      break;
    case T.SELECT_CHAIN:
      d.selects.forEach((c, i) => o.push({ resp: { type: R.SELECT_CHAIN, index: i }, acao: { k: "ativa", code: c.code, desc: String(c.description) } }));
      if (!d.forced) o.push({ resp: { type: R.SELECT_CHAIN, index: null }, recusa: d.selects.length > 0 });
      break;
    case T.SELECT_EFFECTYN:
      o.push({ resp: { type: R.SELECT_EFFECTYN, yes: true }, acao: { k: "ativa", code: d.code, desc: String(d.description) } });
      o.push({ resp: { type: R.SELECT_EFFECTYN, yes: false }, recusa: true });
      break;
    case T.SELECT_YESNO:
      o.push({ resp: { type: R.SELECT_YESNO, yes: true } }, { resp: { type: R.SELECT_YESNO, yes: false } });
      break;
    case T.SELECT_OPTION:
      d.options.forEach((_, i) => o.push({ resp: { type: R.SELECT_OPTION, index: i } }));
      break;
    case T.SELECT_CARD:
      for (const c of combinacoes(d.selects.length, d.min, d.max, 60)) o.push({ resp: { type: R.SELECT_CARD, indicies: c }, escolha: c.map((i) => d.selects[i]) });
      if (!o.length && d.can_cancel) o.push({ resp: { type: R.SELECT_CARD, indicies: null } });
      break;
    case T.SELECT_TRIBUTE:
      for (const c of combinacoes(d.selects.length, d.min, d.max, 60)) o.push({ resp: { type: R.SELECT_TRIBUTE, indicies: c }, escolha: c.map((i) => d.selects[i]) });
      if (!o.length && d.can_cancel) o.push({ resp: { type: R.SELECT_TRIBUTE, indicies: null } });
      break;
    case T.SELECT_UNSELECT_CARD:
      d.select_cards.forEach((c, i) => o.push({ resp: { type: R.SELECT_UNSELECT_CARD, index: i }, escolha: [c] }));
      if (d.can_finish || (!d.select_cards.length && d.can_cancel)) o.push({ resp: { type: R.SELECT_UNSELECT_CARD, index: null } });
      break;
    case T.SELECT_SUM: {
      // materiais cuja soma de Níveis (cada carta pode ter dois valores) bate com o pedido; com
      // select_max (Ritual), a soma pode passar, mas sem carta sobrando: tirar qualquer uma deixa abaixo
      const niveis = (amount: number) => [amount & 0xffff, amount >> 16].filter(Boolean);
      const must = d.selects_must.map((c) => niveis(c.amount));
      const valido = (c: number[]) => {
        const total = c.length + must.length;
        if ((d.min && total < d.min) || (d.max && total > d.max)) return false;
        // cada combinação de valores das cartas escolhidas (no máximo 2 por carta)
        let somas: number[][] = [[]];
        for (const vs of [...must, ...c.map((i) => niveis(d.selects[i].amount))]) somas = somas.flatMap((s) => vs.map((v) => [...s, v]));
        return somas.some((vs) => {
          const s = vs.reduce((a, b) => a + b, 0);
          return d.select_max ? s >= d.amount && s - Math.min(...vs) < d.amount : s === d.amount;
        });
      };
      const max = Math.min(d.selects.length, d.max ? d.max - must.length : 6, 6);
      // das combinações menores para as maiores (gasta menos materiais)
      for (let k = 1; k <= max && o.length < 12; k++)
        for (const c of combinacoes(d.selects.length, k, k, 3000)) {
          if (valido(c)) o.push({ resp: { type: R.SELECT_SUM, indicies: c }, escolha: c.map((i) => d.selects[i]) });
          if (o.length >= 12) break;
        }
      break;
    }
    case T.SELECT_PLACE:
    case T.SELECT_DISFIELD: {
      // o motor pede `count` zonas; a IA fica com as primeiras livres (do lado de quem escolhe, se der)
      const livres = zonasLivres(d);
      const minhas = livres.filter((z) => z.player === d.player);
      const places = [...minhas, ...livres.filter((z) => z.player !== d.player)].slice(0, Math.max(1, d.count));
      if (places.length) o.push({ resp: d.type === T.SELECT_PLACE ? { type: R.SELECT_PLACE, places } : { type: R.SELECT_DISFIELD, places } });
      break;
    }
    case T.SELECT_POSITION:
      for (const p of [1, 4, 8, 2]) if (d.positions & p) o.push({ resp: { type: R.SELECT_POSITION, position: p as 1 } });
      break;
    case T.SORT_CARD:
    case T.SORT_CHAIN:
      o.push({ resp: { type: R.SORT_CARD, order: null } });
      break;
    case T.ANNOUNCE_NUMBER:
      d.options.forEach((_, i) => o.push({ resp: { type: R.ANNOUNCE_NUMBER, value: i } }));
      break;
    case T.ANNOUNCE_RACE:
    case T.ANNOUNCE_ATTRIB: {
      const bits: number[] = [];
      const disp = Number(d.available);
      for (let b = 0; b < 32 && bits.length < d.count; b++) if (disp & (1 << b)) bits.push(1 << b);
      o.push(
        d.type === T.ANNOUNCE_RACE
          ? { resp: { type: R.ANNOUNCE_RACE, races: bits.map((b) => BigInt(b)) as never } }
          : { resp: { type: R.ANNOUNCE_ATTRIB, attributes: bits as never } },
      );
      break;
    }
    case T.SELECT_COUNTER: {
      // distribui os marcadores pela ordem das cartas, sem passar do que cada uma tem
      let falta = d.count;
      o.push({ resp: { type: R.SELECT_COUNTER, counters: d.cards.map((c) => { const n = Math.min(falta, c.count); falta -= n; return n; }) } });
      break;
    }
    case T.ROCK_PAPER_SCISSORS:
      o.push({ resp: { type: R.ROCK_PAPER_SCISSORS, value: (1 + Math.floor(Math.random() * 3)) as 1 } });
      break;
  }
  const vistos = new Set<string>();
  return o.filter((x) => {
    if (!x.escolha) return true;
    const k = x.escolha.map(chaveCarta).sort().join("+");
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}
