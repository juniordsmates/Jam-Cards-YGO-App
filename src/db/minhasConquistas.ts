import { useSyncExternalStore } from "react";
import { aoMudarConta, contaAtual } from "./conta";
import { supabase } from "./supabase";
import { conquistaPorId, type IdConquista } from "../data/conquistas";

// Conquistas obtidas: são de cada usuário. Com conta, valem as da conta (tabela conquistas_obtidas),
// com uma cópia neste aparelho por conta; abrir o app em outro aparelho traz as mesmas. Sem login dá
// para desbloquear também: ao entrar, as obtidas sem conta passam para a conta que entrou (e saem do
// aparelho, para não irem para outra conta depois); as da conta descem para cá, sem aviso de desbloqueio.
// "Compartilhar" e "Meu Primeiro Deck" também são concedidas pelo próprio banco, quando o combo
// compartilhado ou o deck chegam à conta; o app só registra aqui para mostrar o aviso na hora.

/** sem login; com conta, a chave leva o id dela */
const STORAGE_VISITANTE = "cartas-conquistas";
const chave = (contaId: string | null) => (contaId ? `${STORAGE_VISITANTE}:${contaId}` : STORAGE_VISITANTE);

interface Estado {
  /** id da conquista → data em que foi obtida */
  obtidas: Record<string, string>;
}

function ler(storage: string): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(storage) ?? "") as Estado;
    return e && typeof e.obtidas === "object" && e.obtidas ? e : { obtidas: {} };
  } catch {
    return { obtidas: {} };
  }
}

/** conta dona do estado em memória (null: sem login) */
let dono: string | null = null;
let estado: Estado = ler(chave(dono));
const listeners = new Set<() => void>();
function gravar(novo: Estado) {
  estado = novo;
  try {
    localStorage.setItem(chave(dono), JSON.stringify(novo));
  } catch {
    // armazenamento indisponível: as conquistas valem só nesta sessão
  }
  listeners.forEach((l) => l());
}

export const useMinhasConquistas = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => estado,
  );

// ---------------------------------------------------------------- aviso de desbloqueio

const ouvintesDesbloqueio = new Set<(id: string) => void>();
/** Avisa cada conquista desbloqueada agora neste aparelho (o aviso na tela, components/AvisoConquista.tsx) */
export function aoDesbloquear(f: (id: string) => void) {
  ouvintesDesbloqueio.add(f);
  return () => void ouvintesDesbloqueio.delete(f);
}

/** Conquistas que o app registra na conta (as outras o banco concede sozinho) */
const PELO_APP = new Set<IdConquista>(["entrando_comunidade", "meu_primeiro_deck"]);

/**
 * Desbloqueia uma conquista (se ainda não estava): grava aqui, mostra o aviso e, com conta,
 * registra na conta.
 */
export function conquistar(id: IdConquista) {
  if (estado.obtidas[id] || !conquistaPorId(id)) return;
  const quando = new Date().toISOString();
  gravar({ obtidas: { ...estado.obtidas, [id]: quando } });
  ouvintesDesbloqueio.forEach((f) => f(id));
  if (contaAtual() && PELO_APP.has(id)) void supabase()?.rpc("registrar_conquista", { conquista: id, quando });
}

/** Junta as conquistas deste aparelho com as da conta */
export async function juntarConquistasDaConta(): Promise<void> {
  const sb = supabase();
  const id = contaAtual()?.id;
  if (!sb || !id) return;
  const { data, error } = await sb.from("conquistas_obtidas").select("conquista_id, obtida_em");
  // tabela ainda não criada (migração pendente) ou sem rede: ficam só no aparelho
  if (error || !data) return;
  // trocou de conta enquanto a consulta ia e voltava: não mistura
  if (dono !== id) return;
  const daConta = new Map(data.map((r) => [r.conquista_id as string, r.obtida_em as string]));
  for (const [id, quando] of Object.entries(estado.obtidas))
    if (!daConta.has(id) && PELO_APP.has(id as IdConquista)) void sb.rpc("registrar_conquista", { conquista: id, quando });
  const obtidas = { ...estado.obtidas };
  for (const [id, quando] of daConta) if (!obtidas[id] || quando < obtidas[id]) obtidas[id] = quando;
  gravar({ obtidas });
}

// ao entrar, sair ou trocar de conta: passa a usar as conquistas dela (e junta com as da conta)
aoMudarConta(() => {
  const id = contaAtual()?.id ?? null;
  if (id === dono) return;
  const visitante = dono === null ? estado : ler(chave(null));
  dono = id;
  let proprio = ler(chave(id));
  if (id && Object.keys(visitante.obtidas).length) {
    // o que foi obtido sem login vai para a conta que entrou e sai do aparelho
    const obtidas = { ...visitante.obtidas, ...proprio.obtidas };
    proprio = { obtidas };
    try {
      localStorage.removeItem(chave(null));
    } catch {
      // armazenamento indisponível
    }
  }
  gravar(proprio);
  if (id) void juntarConquistasDaConta();
});

/** Raridade de cada conquista (% dos duelistas com conta que já a obtiveram), como na Steam */
export async function raridadeConquistas(): Promise<Map<string, number> | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("raridade_conquistas");
  if (error || !Array.isArray(data)) return null;
  return new Map((data as { conquista_id: string; obtidas: number; duelistas: number }[]).map((r) => [r.conquista_id, r.duelistas ? (r.obtidas / r.duelistas) * 100 : 0]));
}
