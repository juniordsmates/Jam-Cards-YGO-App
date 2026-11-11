// Replays compartilhados do Simulador (supabase/migrations/20261111000000_replays_compartilhados.sql).
// O replay vai para o servidor e volta um link curto (#/replay/<código>), que qualquer pessoa abre,
// mesmo sem conta. Cada link vale por 10 dias; criar exige conta (até 3 links ativos; 20 no Premium).
import { supabase } from "./supabase";
import { t } from "../i18n";
import { exportarReplay, lerReplay, type DueloGuardado } from "../sim/aprendizado";

function cliente() {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  return sb;
}

/** Erro do banco em texto para o jogador (sem a migração, a tabela não existe) */
function falha(error: { message: string; code?: string }): Error {
  if (error.code === "PGRST205" || error.code === "42P01") return new Error(t("O compartilhamento de replays ainda não foi ativado no servidor do app."));
  return new Error(error.message);
}

/**
 * O que vai no link: só o necessário para refazer o duelo (sem o que ele ensinou). Na partida 1x1, o
 * nome do oponente vira "Oponente" (ele não autorizou o compartilhamento).
 */
function publico(d: DueloGuardado): DueloGuardado {
  const rotulos = d.rotulos && d.remoto ? { ...d.rotulos, oponente: t("Oponente") } : d.rotulos;
  return { partida: d.partida, humano: d.humano, remoto: d.remoto, historico: d.historico, linhas: [], respostas: [], quando: d.quando, versaoMotor: d.versaoMotor, versaoApp: d.versaoApp, ...(rotulos ? { rotulos } : {}) };
}

/** Envia o replay e devolve o código e a validade do link */
export async function compartilharReplay(d: DueloGuardado): Promise<{ codigo: string; expira: string }> {
  const dados = JSON.parse(exportarReplay(publico(d))) as object;
  const { data, error } = await cliente()
    .from("replays_compartilhados")
    .insert({ dados, versao_motor: d.versaoMotor, versao_app: d.versaoApp })
    .select("codigo, expira_em")
    .single();
  if (error) throw falha(error);
  return { codigo: data.codigo as string, expira: data.expira_em as string };
}

/** Replay de um link (null: não existe ou já venceu) */
export async function obterReplay(codigo: string): Promise<DueloGuardado | null> {
  const { data, error } = await cliente().from("replays_compartilhados").select("dados, versao_motor").eq("codigo", codigo).maybeSingle();
  if (error) throw falha(error);
  if (!data) return null;
  return { ...lerReplay(JSON.stringify(data.dados)), versaoMotor: data.versao_motor as string };
}

/** Apaga o link (só quem criou consegue) */
export async function apagarReplay(codigo: string) {
  const { error } = await cliente().from("replays_compartilhados").delete().eq("codigo", codigo);
  if (error) throw falha(error);
}
