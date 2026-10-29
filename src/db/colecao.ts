import { useSyncExternalStore } from "react";
import { contaAtual } from "./conta";
import { supabase } from "./supabase";
import { normalize } from "./search";
import type { Card } from "./types";

// Minha Coleção: as cartas que o usuário possui, guardadas neste dispositivo e, com conta, também
// na conta (tabela colecao). Uma linha por carta + impressão + detalhes; a quantidade vai de 1 a 99.
// Impressão, idioma, edição e estado são opcionais: "" = "Não aplicado".

export const IDIOMAS = ["Português", "Inglês", "Japonês", "Espanhol", "Francês", "Alemão", "Italiano", "Coreano", "Chinês"];
export const EDICOES: { id: string; label: string }[] = [
  { id: "primeira", label: "1ª edição" },
  { id: "ilimitada", label: "Ilimitada" },
  { id: "limitada", label: "Limitada" },
];
export const ESTADOS: { id: string; label: string }[] = [
  { id: "NM", label: "Nova (NM)" },
  { id: "LP", label: "Pouco usada (LP)" },
  { id: "MP", label: "Usada (MP)" },
  { id: "HP", label: "Muito usada (HP)" },
  { id: "DMG", label: "Danificada (DMG)" },
];
export const QUANTIDADE_MAX = 99;

export interface ItemColecao {
  cartaId: number;
  /** código da impressão (ex.: MP24-EN001) e raridade; "" = não aplicado */
  setCode: string;
  raridade: string;
  idioma: string;
  edicao: string;
  estado: string;
  quantidade: number;
  atualizadoEm: string;
}

export type DetalhesItem = Omit<ItemColecao, "quantidade" | "atualizadoEm">;

/** Mesma carta com os mesmos detalhes = mesmo item (a quantidade soma) */
export const chaveItem = (i: DetalhesItem) => [i.cartaId, i.setCode, i.raridade, i.idioma, i.edicao, i.estado].join("|");

interface Estado {
  itens: ItemColecao[];
}

const STORAGE = "cartas-colecao";

function ler(): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(STORAGE) ?? "") as Estado;
    return Array.isArray(e.itens) ? e : { itens: [] };
  } catch {
    return { itens: [] };
  }
}

let estado: Estado = ler();
const listeners = new Set<() => void>();
function gravar(novo: Estado) {
  estado = novo;
  try {
    localStorage.setItem(STORAGE, JSON.stringify(novo));
  } catch {
    // armazenamento indisponível: a coleção vale só nesta sessão
  }
  listeners.forEach((l) => l());
}

export const useColecao = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => estado,
  );

/** Quantidade digitada válida: inteiro de 1 a 99 (0 não vale) */
export function quantidadeValida(texto: string, max = QUANTIDADE_MAX): number | null {
  if (!/^\d{1,2}$/.test(texto.trim())) return null;
  const n = Number(texto);
  return n >= 1 && n <= max ? n : null;
}

/** Acrescenta cópias; se o item já existe, soma (sem passar de 99). Devolve o erro, se houver. */
export function adicionarNaColecao(detalhes: DetalhesItem, quantidade: number): string | null {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAX) return "A quantidade vai de 1 a 99.";
  const chave = chaveItem(detalhes);
  const atual = estado.itens.find((i) => chaveItem(i) === chave);
  const total = (atual?.quantidade ?? 0) + quantidade;
  if (total > QUANTIDADE_MAX) return `Com essas cópias, este item passaria de ${QUANTIDADE_MAX} (já há ${atual?.quantidade ?? 0}).`;
  const item: ItemColecao = { ...detalhes, quantidade: total, atualizadoEm: new Date().toISOString() };
  gravar({ itens: atual ? estado.itens.map((i) => (chaveItem(i) === chave ? item : i)) : [...estado.itens, item] });
  void sincronizar(item);
  return null;
}

/** Retira cópias de um item (todas: o item sai da coleção) */
export function retirarDaColecao(chave: string, quantidade: number): string | null {
  const atual = estado.itens.find((i) => chaveItem(i) === chave);
  if (!atual) return "Item não encontrado na coleção.";
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > atual.quantidade) return `Retire de 1 a ${atual.quantidade}.`;
  const resto = atual.quantidade - quantidade;
  if (resto === 0) {
    gravar({ itens: estado.itens.filter((i) => chaveItem(i) !== chave) });
    void apagarNaConta(atual);
  } else {
    const item = { ...atual, quantidade: resto, atualizadoEm: new Date().toISOString() };
    gravar({ itens: estado.itens.map((i) => (chaveItem(i) === chave ? item : i)) });
    void sincronizar(item);
  }
  return null;
}

/** Cópias de cada carta na coleção, somando todas as impressões e detalhes */
export function copiasPorCarta(itens: ItemColecao[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const i of itens) m.set(i.cartaId, (m.get(i.cartaId) ?? 0) + i.quantidade);
  return m;
}

/** Preço da impressão em dólar (YGOPRODeck/TCGplayer); sem impressão, o preço geral da carta */
export function precoUSD(item: Pick<ItemColecao, "setCode" | "raridade">, card: Card | undefined): number | undefined {
  if (!card) return undefined;
  // impressão em outro idioma (GFP2-PT175): o preço da mesma impressão em inglês
  const codigos = [item.setCode, item.setCode.replace(/-[A-Z]{2}(?=\d)/, "-EN")];
  const impressao = item.setCode
    ? codigos.map((cod) => card.sets.find((s) => s.code === cod && (!item.raridade || s.rarity === item.raridade))).find(Boolean)
    : undefined;
  const v = Number(impressao?.price ?? card.prices?.tcgplayer);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

// ---------------------------------------------------------------- importar lista (MYP Cards)

/** Idioma pela região do código da impressão (GFP2-EN175 → Inglês) */
const IDIOMA_DA_REGIAO: Record<string, string> = {
  EN: "Inglês", PT: "Português", SP: "Espanhol", FR: "Francês", DE: "Alemão", IT: "Italiano", JP: "Japonês", KR: "Coreano", AE: "Inglês",
};

export interface LinhaImportada {
  linha: string;
  quantidade: number;
  detalhes?: DetalhesItem;
  /** por que a linha não entrou */
  erro?: string;
}

/**
 * Lê uma lista no padrão da MYP Cards ("1 #Mago Negro [GFTP] GFTP-EN128", com a raridade entre
 * parênteses no nome quando houver) ou só "quantidade nome". A carta é achada pelo código da
 * impressão; sem ele na base, pelo nome em português ou inglês. O idioma vem do código.
 */
export function lerListaMYP(texto: string, cards: Card[]): LinhaImportada[] {
  const porCodigo = new Map<string, { card: Card; raridade: string }[]>();
  const porNome = new Map<string, Card>();
  for (const c of cards) {
    if (c.frame === "skill" || c.frame === "token") continue;
    for (const s of c.sets) {
      const k = s.code.toUpperCase();
      porCodigo.set(k, [...(porCodigo.get(k) ?? []), { card: c, raridade: s.rarity }]);
    }
    porNome.set(normalize(c.name), c);
    if (c.namePt) porNome.set(normalize(c.namePt), c);
  }
  const out: LinhaImportada[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const m = linha.match(/^(\d+)\s*x?\s+#?(.+?)(?:\s+\[([^\]]+)\])?(?:\s+([A-Z0-9]+-[A-Z]{0,2}\d+[A-Z]?))?\s*$/i);
    if (!m) {
      out.push({ linha, quantidade: 0, erro: "Linha fora do padrão (quantidade, nome e código)." });
      continue;
    }
    const quantidade = Number(m[1]);
    if (quantidade < 1 || quantidade > QUANTIDADE_MAX) {
      out.push({ linha, quantidade, erro: "Quantidade fora de 1 a 99." });
      continue;
    }
    // "(Starlight Rare)", "(Extended Art)"…: a raridade é o parêntese que termina em "Rare"
    const parenteses = [...m[2].matchAll(/\(([^)]+)\)/g)].map((x) => x[1].trim());
    const raridadeLida = parenteses.find((x) => /rare$/i.test(x)) ?? "";
    const nome = m[2].replace(/\([^)]*\)/g, "").trim();
    const codigo = (m[4] ?? "").toUpperCase();
    const regiao = codigo.match(/-([A-Z]{2})\d/)?.[1] ?? "";
    // impressões em outros idiomas (GFP2-PT175) usam o código em inglês da base
    const candidatas = porCodigo.get(codigo) ?? (regiao ? porCodigo.get(codigo.replace(`-${regiao}`, "-EN")) : undefined) ?? [];
    const peloNome = porNome.get(normalize(nome));
    const daCarta = peloNome ? candidatas.filter((x) => x.card.id === peloNome.id) : [];
    const opcoes = daCarta.length ? daCarta : candidatas;
    const impressao =
      opcoes.find((x) => raridadeLida && x.raridade.toLowerCase() === raridadeLida.toLowerCase()) ?? (opcoes.length === 1 ? opcoes[0] : undefined);
    const card = impressao?.card ?? opcoes[0]?.card ?? peloNome;
    if (!card) {
      out.push({ linha, quantidade, erro: "Carta não encontrada (nem pelo código, nem pelo nome)." });
      continue;
    }
    out.push({
      linha,
      quantidade,
      detalhes: {
        cartaId: card.id,
        setCode: opcoes.length ? codigo : "",
        // várias raridades no mesmo código e nenhuma no texto: fica "Não aplicado"
        raridade: impressao?.raridade ?? "",
        idioma: IDIOMA_DA_REGIAO[regiao] ?? "",
        edicao: "",
        estado: "",
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------- conta

// uma sincronização por vez (como nos decks): alterações seguidas não se atropelam
let fila: Promise<unknown> = Promise.resolve();
const emFila = <T>(f: () => Promise<T>): Promise<T> => {
  const p = fila.then(f, f);
  fila = p.catch(() => undefined);
  return p;
};

const CONFLITO = "usuario_id,carta_id,set_code,raridade,idioma,edicao,estado";
const paraLinha = (i: ItemColecao, usuarioId: string) => ({
  usuario_id: usuarioId,
  carta_id: i.cartaId,
  set_code: i.setCode,
  raridade: i.raridade,
  idioma: i.idioma,
  edicao: i.edicao,
  estado: i.estado,
  quantidade: i.quantidade,
});

function sincronizar(item: ItemColecao) {
  return emFila(async () => {
    const sb = supabase();
    const conta = contaAtual();
    if (!sb || !conta) return;
    await sb.from("colecao").upsert(paraLinha(item, conta.id), { onConflict: CONFLITO });
  });
}

function apagarNaConta(item: ItemColecao) {
  return emFila(async () => {
    const sb = supabase();
    if (!sb || !contaAtual()) return;
    await sb
      .from("colecao")
      .delete()
      .match({ carta_id: item.cartaId, set_code: item.setCode, raridade: item.raridade, idioma: item.idioma, edicao: item.edicao, estado: item.estado });
  });
}

/**
 * Junta a coleção da conta com a deste dispositivo: o mesmo item fica com a versão alterada por
 * último; o que só existe aqui sobe para a conta, o que só existe na conta desce para cá.
 */
export function juntarColecaoDaConta(): Promise<void> {
  return emFila(async () => {
    const sb = supabase();
    const conta = contaAtual();
    if (!sb || !conta) return;
    const remotos: ItemColecao[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb
        .from("colecao")
        .select("carta_id, set_code, raridade, idioma, edicao, estado, quantidade, atualizado_em")
        .order("id")
        .range(de, de + 999);
      if (error || !data) return;
      remotos.push(
        ...data.map((r) => ({
          cartaId: r.carta_id,
          setCode: r.set_code,
          raridade: r.raridade,
          idioma: r.idioma,
          edicao: r.edicao,
          estado: r.estado,
          quantidade: r.quantidade,
          atualizadoEm: r.atualizado_em,
        })),
      );
      if (data.length < 1000) break;
    }
    const porChave = new Map(remotos.map((r) => [chaveItem(r), r]));
    const subir: ItemColecao[] = [];
    for (const local of estado.itens) {
      const r = porChave.get(chaveItem(local));
      if (!r || local.atualizadoEm > r.atualizadoEm) {
        porChave.set(chaveItem(local), local);
        subir.push(local);
      }
    }
    gravar({ itens: [...porChave.values()] });
    for (let i = 0; i < subir.length; i += 500)
      await sb.from("colecao").upsert(subir.slice(i, i + 500).map((x) => paraLinha(x, conta.id)), { onConflict: CONFLITO });
  });
}
