import { useSyncExternalStore } from "react";
import { exportarParaBase, type ComboBase, type DadosCombo } from "./baseCombos";

// Combos só neste aparelho: o Usuário Padrão cria combos (Teste de Jogo ou "Salvar como Combo da
// Comunidade"), mas eles não vão para a base. Ficam aqui, no mesmo formato da tabela combos, e
// podem ser exportados para a base depois (quando a conta passar a Avançado ou Mentor).

const STORAGE = "cartas-combos-locais";
const PREFIXO = "local-";

export const ehLocal = (c: Pick<ComboBase, "id">) => c.id.startsWith(PREFIXO);

function ler(): ComboBase[] {
  try {
    const l = JSON.parse(localStorage.getItem(STORAGE) ?? "") as ComboBase[];
    return Array.isArray(l) ? l.filter((c) => typeof c?.id === "string" && ehLocal(c)) : [];
  } catch {
    return [];
  }
}

let lista: ComboBase[] = ler();
const listeners = new Set<() => void>();
function gravar(nova: ComboBase[]) {
  lista = nova;
  try {
    localStorage.setItem(STORAGE, JSON.stringify(nova));
  } catch {
    // armazenamento indisponível: os combos valem só nesta sessão
  }
  listeners.forEach((l) => l());
}

export const useCombosLocais = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lista,
  );
export const combosLocais = () => lista;

/** Grava o combo no aparelho (mesmos campos do "Criar combo" que vai para a base) */
export function salvarComboLocal(
  campos: { autorId: string | null; autorNome: string; titulo: string; observacoes: string },
  combo: { iniciais: number[]; finais?: number[]; dados: DadosCombo; arquetipos: string[] },
): ComboBase {
  const novo: ComboBase = {
    id: `${PREFIXO}${crypto.randomUUID()}`,
    origem: "comunidade",
    autor_id: campos.autorId,
    autor_nome: campos.autorNome.trim().slice(0, 60) || null,
    titulo: campos.titulo.trim().slice(0, 120),
    arquetipos: combo.arquetipos,
    iniciais: combo.iniciais.slice(0, 10),
    finais: (combo.finais ?? []).slice(0, 20),
    dados: { ...combo.dados, observacoes: campos.observacoes.trim().slice(0, 2000) || undefined },
    conferido_em: null,
    criado_em: new Date().toISOString(),
    publico: false,
  };
  gravar([novo, ...lista]);
  return novo;
}

export function editarComboLocal(
  combo: ComboBase,
  campos: { titulo: string; observacoes: string; passos: DadosCombo["passos"] },
): ComboBase {
  const novo: ComboBase = {
    ...combo,
    titulo: campos.titulo.trim().slice(0, 120),
    dados: { ...combo.dados, passos: campos.passos, observacoes: campos.observacoes.trim().slice(0, 2000) || undefined },
  };
  gravar(lista.map((c) => (c.id === combo.id ? novo : c)));
  return novo;
}

export const excluirComboLocal = (id: string) => gravar(lista.filter((c) => c.id !== id));

/** Envia o combo para a base (conta Avançado ou Mentor) e o tira do aparelho */
export async function exportarComboLocal(combo: ComboBase, compartilhar: boolean): Promise<ComboBase> {
  const enviado = await exportarParaBase(combo, compartilhar);
  excluirComboLocal(combo.id);
  return enviado;
}

/** Exporta todos os combos do aparelho; devolve quantos foram e os erros */
export async function exportarTodos(compartilhar: boolean): Promise<{ enviados: number; erros: string[] }> {
  let enviados = 0;
  const erros: string[] = [];
  for (const c of [...lista]) {
    try {
      await exportarComboLocal(c, compartilhar);
      enviados++;
    } catch (e) {
      erros.push(`${c.titulo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { enviados, erros };
}
