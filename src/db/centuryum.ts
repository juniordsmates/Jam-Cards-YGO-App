// Envio ao Centuryum, a IA principal do Jam Cards (supabase/migrations/20261114000000_centuryum_envios.sql).
// Com a opção "Ajudar a IA a aprender" ligada e a conta logada, o Simulador manda o que cada duelo
// ensinou e o resultado da "Análise da IA". O Centuryum aprende com isso e devolve o conhecimento a
// todos os simuladores pela camada. Nada de nomes: só cartas (ids), jogadas e a prova para refazer o duelo.
import { supabase } from "./supabase";
import type { Aprendizado } from "../sim/sessao";

/** Envia sem atrapalhar o jogo: sem conta logada, sem servidor ou com erro, não faz nada */
export async function enviarAoCenturyum(tipo: "duelo" | "analise", dados: object, versaoMotor: string, versaoApp: string) {
  try {
    const sb = supabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    const corpo = JSON.parse(JSON.stringify(dados, (_, v) => (typeof v === "bigint" ? String(v) : v))) as object;
    await sb.from("centuryum_envios").insert({ tipo, dados: corpo, versao_motor: versaoMotor, versao_app: versaoApp });
  } catch {
    // o envio é um extra: o duelo segue igual
  }
}

/**
 * O que vai de um duelo. Contra a IA (ou IA x IA): a partida inteira, para o Centuryum refazer no motor.
 * Na partida 1x1, só o que é do jogador deste aparelho (o deck, as linhas e as respostas dele): as
 * jogadas e o deck do oponente ficam de fora, porque ele não autorizou. `iaxia`: as duas pontas foram a IA
 * (o Centuryum guarda, mas não aprende jogadas da IA com ela mesma).
 */
export function envioDoDuelo(a: Aprendizado, iaxia = false): object {
  if (a.remoto) return { remoto: true, iaxia: false, deck: a.partida.decks[a.humano], linhas: a.linhas, respostas: a.respostas };
  return { remoto: false, iaxia, humano: a.humano, partida: a.partida, historico: a.historico, linhas: a.linhas, respostas: a.respostas };
}
