import { useSyncExternalStore } from "react";
import { aoMudarConta, contaAtual } from "./conta";
import { supabase } from "./supabase";
import type { ComboBase } from "./baseCombos";
import type { LinhaCombo, Passo } from "./motor";
import { t } from "../i18n";

// Meus Combos: combos que o jogador salvou para abrir de novo rápido. Cada item guarda uma cópia do
// combo. Com conta, valem os da conta (tabela combos_salvos), com uma cópia neste aparelho por
// conta; sem login, ficam no aparelho e passam para a conta que entrar (como as conquistas).

export const MAX_SALVOS = 500;

export interface ComboSalvo {
  chave: string;
  combo: ComboBase;
  salvoEm: string;
  /** salvo com conta, mas ainda não chegou nela (sem rede): sobe na próxima junção */
  pendente?: boolean;
}

interface Estado {
  itens: ComboSalvo[];
}

const STORAGE_VISITANTE = "cartas-combos-salvos";
const chaveStorage = (contaId: string | null) => (contaId ? `${STORAGE_VISITANTE}:${contaId}` : STORAGE_VISITANTE);

function ler(storage: string): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(storage) ?? "") as Estado;
    return Array.isArray(e.itens) ? e : { itens: [] };
  } catch {
    return { itens: [] };
  }
}

/** conta dona do estado em memória (null: sem login) */
let dono: string | null = null;
let estado: Estado = ler(chaveStorage(null));
const listeners = new Set<() => void>();
function gravar(novo: Estado) {
  estado = novo;
  try {
    localStorage.setItem(chaveStorage(dono), JSON.stringify(novo));
  } catch {
    // armazenamento indisponível: vale só nesta sessão
  }
  listeners.forEach((l) => l());
}

export const useCombosSalvos = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => estado,
  );

export const estaSalvo = (chave: string) => estado.itens.some((i) => i.chave === chave);

// ---------------------------------------------------------------- combos do App

/** Hash curto e estável de um texto (FNV-1a), para dar um id às linhas calculadas */
function hash(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Linha calculada pelo App no formato de um combo da base, para salvar e mostrar em Meus Combos.
 * O id vem da mão e dos passos (a mesma linha recalculada continua com o mesmo id); as respostas
 * do oponente ficam de fora (só pesam na cópia).
 */
export function linhaComoCombo(l: LinhaCombo, titulo: string): ComboBase {
  const passos = l.passos.map((p): Passo => {
    const q: Passo = { ...p };
    delete q.resp;
    return q;
  });
  return {
    id: `app:${hash(JSON.stringify([l.mao, passos]))}`,
    origem: "app",
    autor_id: null,
    autor_nome: null,
    titulo,
    arquetipos: [],
    iniciais: l.mao,
    finais: [...l.campo.monstros, ...l.campo.magias.map(([c]) => c)],
    dados: { passos, campo: l.campo, ...(l.qualquer ? { qualquer: l.qualquer } : {}) },
    conferido_em: null,
    criado_em: new Date().toISOString(),
    publico: false,
  };
}

// ---------------------------------------------------------------- salvar e tirar

/** Salva o combo em Meus Combos (devolve uma mensagem de erro, ou null) */
export function salvarCombo(combo: ComboBase): string | null {
  if (estaSalvo(combo.id)) return null;
  if (estado.itens.length >= MAX_SALVOS) return t("Limite de {0} combos salvos.", [MAX_SALVOS]);
  const item: ComboSalvo = { chave: combo.id, combo, salvoEm: new Date().toISOString(), ...(dono ? { pendente: true } : {}) };
  gravar({ itens: [item, ...estado.itens] });
  if (dono) void subir([item]);
  return null;
}

/** Tira o combo de Meus Combos */
export function removerSalvo(chave: string) {
  gravar({ itens: estado.itens.filter((i) => i.chave !== chave) });
  const conta = dono;
  if (conta) void emFila(async () => {
    const sb = supabase();
    if (sb && contaAtual()?.id === conta) await sb.from("combos_salvos").delete().eq("chave", chave);
  });
}

// ---------------------------------------------------------------- conta

// uma operação na conta por vez, na ordem em que foram feitas neste aparelho
let fila: Promise<unknown> = Promise.resolve();
const emFila = <T>(f: () => Promise<T>): Promise<T> => {
  const p = fila.then(f, f);
  fila = p.catch(() => undefined);
  return p;
};

const paraLinha = (i: ComboSalvo, usuarioId: string) => ({ usuario_id: usuarioId, chave: i.chave, combo: i.combo, salvo_em: i.salvoEm });

/** Envia itens à conta; os que chegaram deixam de ser pendentes */
function subir(itens: ComboSalvo[]) {
  const conta = dono;
  return emFila(async () => {
    const sb = supabase();
    if (!sb || !conta || contaAtual()?.id !== conta || !itens.length) return;
    const { error } = await sb.from("combos_salvos").upsert(itens.map((i) => paraLinha(i, conta)), { onConflict: "usuario_id,chave" });
    if (error || dono !== conta) return;
    const enviados = new Set(itens.map((i) => i.chave));
    gravar({ itens: estado.itens.map((i) => (enviados.has(i.chave) ? { ...i, pendente: undefined } : i)) });
  });
}

/**
 * Junta com a conta: valem os combos da conta, mais os salvos aqui que ainda não chegaram nela
 * (pendentes ou salvos sem login), que sobem agora.
 */
export function juntarSalvosDaConta(): Promise<void> {
  const conta = dono;
  return emFila(async () => {
    const sb = supabase();
    if (!sb || !conta || contaAtual()?.id !== conta) return;
    const { data, error } = await sb.from("combos_salvos").select("chave, combo, salvo_em").order("salvo_em", { ascending: false }).limit(MAX_SALVOS);
    // tabela ainda não criada (migração pendente) ou sem rede: ficam os do aparelho
    if (error || !data || dono !== conta) return;
    const daConta: ComboSalvo[] = data.map((r) => ({ chave: r.chave as string, combo: r.combo as ComboBase, salvoEm: r.salvo_em as string }));
    const naConta = new Set(daConta.map((i) => i.chave));
    const subirAgora = estado.itens.filter((i) => i.pendente && !naConta.has(i.chave));
    gravar({ itens: [...subirAgora, ...daConta].sort((a, b) => b.salvoEm.localeCompare(a.salvoEm)) });
    if (subirAgora.length) {
      const { error: e2 } = await sb.from("combos_salvos").upsert(subirAgora.map((i) => paraLinha(i, conta)), { onConflict: "usuario_id,chave" });
      if (!e2 && dono === conta) {
        const enviados = new Set(subirAgora.map((i) => i.chave));
        gravar({ itens: estado.itens.map((i) => (enviados.has(i.chave) ? { ...i, pendente: undefined } : i)) });
      }
    }
  });
}

// ao entrar, sair ou trocar de conta: passa a usar os combos salvos dela (e junta com a conta)
aoMudarConta(() => {
  const id = contaAtual()?.id ?? null;
  if (id === dono) return;
  const visitante = dono === null ? estado : ler(chaveStorage(null));
  dono = id;
  let proprio = ler(chaveStorage(id));
  if (id && visitante.itens.length) {
    // o que foi salvo sem login vai para a conta que entrou e sai do aparelho
    const ja = new Set(proprio.itens.map((i) => i.chave));
    proprio = { itens: [...visitante.itens.filter((i) => !ja.has(i.chave)).map((i) => ({ ...i, pendente: true })), ...proprio.itens] };
    try {
      localStorage.removeItem(chaveStorage(null));
    } catch {
      // armazenamento indisponível
    }
  }
  gravar(proprio);
  if (id) void juntarSalvosDaConta();
});
