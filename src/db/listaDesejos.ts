import { useSyncExternalStore } from "react";
import { contaAtual } from "./conta";
import { supabase } from "./supabase";
import { t } from "../i18n";

// Lista de Desejos: as cartas que o jogador quer conseguir, uma linha por carta com a quantidade
// (1 a 99). Fica neste dispositivo e, com conta, também na conta (tabela lista_desejos), como a
// Minha Coleção.

export const DESEJO_MAX = 99;

export interface ItemDesejo {
  cartaId: number;
  quantidade: number;
  atualizadoEm: string;
}

interface Estado {
  itens: ItemDesejo[];
}

const STORAGE = "cartas-lista-desejos";

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
    // armazenamento indisponível: a lista vale só nesta sessão
  }
  listeners.forEach((l) => l());
}

export const useListaDesejos = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => estado,
  );

/** Quantidade de uma carta na lista (0 se não está) */
export const naLista = (cartaId: number) => estado.itens.find((i) => i.cartaId === cartaId)?.quantidade ?? 0;

const agora = () => new Date().toISOString();
const limitar = (n: number) => Math.max(1, Math.min(DESEJO_MAX, Math.round(n)));

/**
 * Acrescenta cartas: `somar` soma à quantidade que já está na lista (botão Adicionar de uma carta);
 * sem somar, a carta fica com pelo menos essa quantidade (Adicionar deck: o mesmo deck duas vezes
 * não dobra a lista). Devolve quantas cartas diferentes mudaram.
 */
export function adicionarDesejos(cartas: { cartaId: number; quantidade: number }[], somar: boolean): number {
  const itens = new Map(estado.itens.map((i) => [i.cartaId, i]));
  const mudaram: ItemDesejo[] = [];
  for (const { cartaId, quantidade } of cartas) {
    if (!(cartaId > 0) || !(quantidade > 0)) continue;
    const atual = itens.get(cartaId)?.quantidade ?? 0;
    const nova = limitar(somar ? atual + quantidade : Math.max(atual, quantidade));
    if (nova === atual) continue;
    const item = { cartaId, quantidade: nova, atualizadoEm: agora() };
    itens.set(cartaId, item);
    mudaram.push(item);
  }
  if (mudaram.length) {
    gravar({ itens: [...itens.values()] });
    void sincronizar(mudaram);
  }
  return mudaram.length;
}

/** Troca a quantidade de uma carta (1 a 99) */
export function definirQuantidadeDesejo(cartaId: number, quantidade: number): string | null {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > DESEJO_MAX) return t("A quantidade vai de 1 a 99.");
  const item = { cartaId, quantidade, atualizadoEm: agora() };
  gravar({ itens: estado.itens.map((i) => (i.cartaId === cartaId ? item : i)) });
  void sincronizar([item]);
  return null;
}

/** Tira cartas da lista (as selecionadas, ou uma) */
export function removerDesejos(cartaIds: number[]) {
  const sair = new Set(cartaIds);
  gravar({ itens: estado.itens.filter((i) => !sair.has(i.cartaId)) });
  void apagarNaConta([...sair]);
}

// ---------------------------------------------------------------- conta

// uma operação na conta por vez, na ordem em que foram feitas neste aparelho
let fila: Promise<unknown> = Promise.resolve();
const emFila = <T>(f: () => Promise<T>): Promise<T> => {
  const p = fila.then(f, f);
  fila = p.catch(() => undefined);
  return p;
};

const paraLinha = (i: ItemDesejo, usuarioId: string) => ({ usuario_id: usuarioId, carta_id: i.cartaId, quantidade: i.quantidade });

function sincronizar(itens: ItemDesejo[]) {
  return emFila(async () => {
    const sb = supabase();
    const conta = contaAtual();
    if (!sb || !conta) return;
    for (let i = 0; i < itens.length; i += 500)
      await sb.from("lista_desejos").upsert(itens.slice(i, i + 500).map((x) => paraLinha(x, conta.id)), { onConflict: "usuario_id,carta_id" });
  });
}

function apagarNaConta(cartaIds: number[]) {
  return emFila(async () => {
    const sb = supabase();
    if (!sb || !contaAtual() || !cartaIds.length) return;
    for (let i = 0; i < cartaIds.length; i += 500) await sb.from("lista_desejos").delete().in("carta_id", cartaIds.slice(i, i + 500));
  });
}

/**
 * Junta a lista da conta com a deste dispositivo: a mesma carta fica com a versão alterada por
 * último; o que só existe aqui sobe para a conta, o que só existe na conta desce para cá.
 */
export function juntarDesejosDaConta(): Promise<void> {
  return emFila(async () => {
    const sb = supabase();
    const conta = contaAtual();
    if (!sb || !conta) return;
    const { data, error } = await sb.from("lista_desejos").select("carta_id, quantidade, atualizado_em").limit(5000);
    // tabela ainda não criada (migração pendente) ou sem rede: a lista fica só no aparelho
    if (error || !data) return;
    const porCarta = new Map<number, ItemDesejo>(data.map((r) => [r.carta_id, { cartaId: r.carta_id, quantidade: r.quantidade, atualizadoEm: r.atualizado_em }]));
    const subir: ItemDesejo[] = [];
    for (const local of estado.itens) {
      const r = porCarta.get(local.cartaId);
      if (!r || local.atualizadoEm > r.atualizadoEm) {
        porCarta.set(local.cartaId, local);
        subir.push(local);
      }
    }
    gravar({ itens: [...porCarta.values()] });
    for (let i = 0; i < subir.length; i += 500)
      await sb.from("lista_desejos").upsert(subir.slice(i, i + 500).map((x) => paraLinha(x, conta.id)), { onConflict: "usuario_id,carta_id" });
  });
}
