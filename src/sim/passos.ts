// Cópia de Database-Cards-Ygo/src/motor/passos.ts (o original fica lá; ao mudar, copie para cá):
// só os imports mudam. No app, monta os passos dos turnos do jogador no Simulador.
import { OcgMessageType as T, type OcgMessage } from "ocgcore-wasm";
import { TIPO } from "./regras";

const TYPE = { MONSTER: TIPO.MONSTRO, RITUAL: TIPO.RITUAL, XYZ: TIPO.XYZ, LINK: TIPO.LINK, SYNCHRO: TIPO.SINCRO, FUSION: TIPO.FUSAO, TOKEN: TIPO.FICHA } as const;
/** janela de resposta do oponente que o explorador do pipeline anota no registro (não aparece no app) */
const MSG_RESPOSTAS = 9001;
// Converte o registro de mensagens do motor em passos de combo (só ids e zonas, sem texto de carta)

export type Zona = "deck" | "mao" | "campo" | "magia" | "cemiterio" | "banido" | "extra" | "material" | "campo-magia" | "pendulo" | "fora";
export type Metodo = "xyz" | "link" | "sincro" | "fusao" | "ritual";

/** cartas do oponente que poderiam responder logo depois deste passo */
type ComRespostas = { resp?: number[] };

export type Passo = ComRespostas & (
  | { t: "normal"; c: number }
  | { t: "baixa"; c: number }
  | { t: "ativa"; c: number; de: Zona }
  | { t: "invoca"; c: number; de: Zona; m?: Metodo; mat?: number[]; por?: number }
  | { t: "move"; c: number; de: Zona; para: Zona; por?: number }
  | { t: "compra"; c: number[] }
);

interface Loc {
  controller: number;
  location: number;
  overlay_sequence?: number;
}

export function zona(l: Loc): Zona {
  // o ocgcore-wasm informa materiais Xyz com overlay_sequence (o bit de material não vem na location)
  if (l.overlay_sequence !== undefined) return "material";
  switch (l.location) {
    case 1: return "deck";
    case 2: return "mao";
    case 4: return "campo";
    case 8: return "magia";
    case 16: return "cemiterio";
    case 32: return "banido";
    case 64: return "extra";
    case 256: return "campo-magia";
    case 512: return "pendulo";
    // Fichas (Tokens) saem do jogo: location 0
    case 0: return "fora";
    default: return "campo";
  }
}

function metodo(type: number, de: Zona): Metodo | undefined {
  if (type & TYPE.RITUAL && type & TYPE.MONSTER) return "ritual";
  if (de !== "extra") return undefined;
  if (type & TYPE.XYZ) return "xyz";
  if (type & TYPE.LINK) return "link";
  if (type & TYPE.SYNCHRO) return "sincro";
  if (type & TYPE.FUSION) return "fusao";
  return undefined;
}

/** Passos de um jogador (o 0, por padrão) a partir do registro completo do turno */
export function passosDoLog(log: OcgMessage[], typeOf: (code: number) => number, jogador = 0): Passo[] {
  const out: (Passo | null)[] = [];
  const chain: number[] = [];
  let por: number | undefined;
  // movimentos desde a última âncora (ativação, resolução, invocação): candidatos a material
  let buffer: number[] = [];
  let lastMove: { c: number; de: Zona; idx: number } | undefined;
  // carta cuja resolução acabou de terminar (Magia/Armadilha que vai ao Cemitério depois de resolver)
  let solved: number | undefined;

  const anchor = () => {
    buffer = [];
  };

  for (const m of log) {
    if ((m.type as number) === MSG_RESPOSTAS) {
      // janela de resposta do oponente: anexa ao último passo já registrado
      const codes = (m as unknown as { codes: number[] }).codes;
      const last = [...out].reverse().find((p): p is Passo => p !== null);
      if (last) last.resp = [...new Set([...(last.resp ?? []), ...codes])];
      continue;
    }
    switch (m.type) {
      case T.CHAINING:
        if (m.controller !== jogador) break;
        chain.push(m.code);
        // Magia/Armadilha ativada da mão: o motor primeiro move a carta para a zona
        if (lastMove?.c === m.code && lastMove.idx === out.length - 1 && lastMove.de === "mao") {
          out[lastMove.idx] = null;
          out.push({ t: "ativa", c: m.code, de: "mao" });
        } else {
          // ativar a carta e, logo em seguida, o efeito dela (Contínuas): um passo só
          const prev = out[out.length - 1];
          if (!(prev?.t === "ativa" && prev.c === m.code)) out.push({ t: "ativa", c: m.code, de: zona(m) });
        }
        lastMove = undefined;
        anchor();
        break;
      case T.CHAIN_SOLVING:
        por = chain[m.chain_size - 1];
        anchor();
        break;
      case T.CHAIN_SOLVED:
        solved = por;
        por = undefined;
        anchor();
        break;
      case T.CHAIN_END:
        chain.length = 0;
        por = undefined;
        break;
      case T.DRAW:
        if (m.player === jogador && m.drawn.length) out.push({ t: "compra", c: m.drawn.map((d) => d.code) });
        break;
      case T.MOVE: {
        if (m.from.controller !== jogador && m.to.controller !== jogador) break;
        const de = zona(m.from);
        const para = zona(m.to);
        const after = solved;
        solved = undefined;
        // materiais passando de um Xyz para o que é invocado sobre ele
        if (de === "material" && para === "material") break;
        // a Magia/Armadilha que resolveu sai do campo: consequência natural, não um passo
        if (after === m.card && (de === "magia" || de === "campo-magia") && para === "cemiterio") break;
        out.push({ t: "move", c: m.card, de, para, ...(por ? { por } : {}) });
        lastMove = { c: m.card, de, idx: out.length - 1 };
        buffer.push(out.length - 1);
        break;
      }
      case T.SUMMONING:
        if (m.controller !== jogador) break;
        if (lastMove?.c === m.code) out[lastMove.idx] = null;
        out.push({ t: "normal", c: m.code });
        anchor();
        break;
      case T.SET:
        if (m.controller !== jogador) break;
        if (lastMove?.c === m.code) out[lastMove.idx] = null;
        out.push({ t: "baixa", c: m.code });
        anchor();
        break;
      case T.SPSUMMONING: {
        if (m.controller !== jogador) break;
        let de: Zona = "deck";
        if (lastMove?.c === m.code) {
          de = lastMove.de;
          out[lastMove.idx] = null;
        }
        const type = typeOf(m.code);
        const met = metodo(type, de);
        const passo: Passo = { t: "invoca", c: m.code, de, ...(met ? { m: met } : {}), ...(por ? { por } : {}) };
        if (met) {
          // materiais: cartas que saíram do campo/mão para material, Cemitério ou banidas logo antes
          const mat: number[] = [];
          for (const idx of buffer) {
            const p = out[idx];
            if (p?.t === "move" && p.c !== m.code && (p.de === "campo" || p.de === "mao") && ["material", "cemiterio", "banido", "fora"].includes(p.para)) {
              mat.push(p.c);
              out[idx] = null;
            }
          }
          if (mat.length) passo.mat = mat;
        }
        out.push(passo);
        anchor();
        break;
      }
    }
  }
  // Fichas não estão na base de cartas: id 0 (o app mostra "Ficha")
  const ficha = (c: number) => (typeOf(c) & TYPE.TOKEN ? 0 : c);
  return out
    .filter((p): p is Passo => p !== null && !(p.t === "move" && p.para === "fora"))
    .map((p) => {
      if (p.t === "compra") return p;
      const q = { ...p, c: ficha(p.c) } as Passo;
      if (q.t === "invoca" && q.mat) q.mat = q.mat.map(ficha);
      return q;
    });
}
