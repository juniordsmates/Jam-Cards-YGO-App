// Worker do Simulador: o motor e a IA rodam aqui, fora da tela, para o planejamento da IA (alguns
// segundos) não travar o app. Mensagens: src/sim/cliente.ts.
import wasmUrl from "ocgcore-wasm/lib/ocgcore.sync.wasm?url";
import type { OcgResponse } from "ocgcore-wasm";
import { abrirMotor, type ComandoFicha, type Jogada, type Motor, type PacoteMotor } from "./regras";
import { Sessao, type Aprendizado, type ConfigSessao, type Quadro } from "./sessao";

export type ParaWorker =
  | { tipo: "pacote"; dados: ArrayBuffer }
  | { tipo: "iniciar"; cfg: ConfigSessao }
  | { tipo: "responder"; resp: OcgResponse }
  | { tipo: "janelas"; janelas: "acao" | "todas" }
  /** partida 1x1: jogada do oponente na posição n do histórico */
  | { tipo: "remota"; n: number; resp: Jogada }
  /** o que o duelo ensinou até agora (para quem desiste antes do fim) */
  | { tipo: "aprendizado" }
  /** "Criar Token": Ficha com os dados escolhidos */
  | { tipo: "ficha"; dados: Pick<ComandoFicha, "nome" | "nivel" | "atributo" | "raca" | "atk" | "def" | "posicao"> & { sequencia?: number } }
  /** revisão: momentos da partida (quem decide em cada posição do histórico) */
  | { tipo: "linha-do-tempo"; id: number; cfg: ConfigSessao }
  /** revisão: o duelo refeito até a posição k */
  | { tipo: "momento"; id: number; cfg: ConfigSessao; k: number }
  /** "?": fatos do motor sobre uma carta, no duelo em andamento (cfg ausente) ou na posição k */
  | { tipo: "fatos"; id: number; cfg?: ConfigSessao; k?: number; code: number; jogador: number };

export type DoWorker =
  | { tipo: "pronto"; versao: string; nomes: Record<string, string> }
  | { tipo: "quadro"; quadro: Quadro }
  | { tipo: "aprendizado"; dados: Aprendizado | null }
  | { tipo: "resultado"; id: number; dados: unknown }
  | { tipo: "erro"; erro: string; id?: number };

let motor: Motor | null = null;
let sessao: Sessao | null = null;

const enviar = (m: DoWorker) => postMessage(m);
const quadro = (q: Quadro) => enviar({ tipo: "quadro", quadro: q });

/** O pacote chega comprimido (gzip); um JSON puro também vale */
async function lerPacote(dados: ArrayBuffer): Promise<PacoteMotor> {
  const b = new Uint8Array(dados);
  const gz = b[0] === 0x1f && b[1] === 0x8b;
  const texto = gz ? await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(b);
  const p = JSON.parse(texto) as PacoteMotor;
  if (p.formato !== 1 || !p.arquivos) throw new Error("pacote do motor em formato desconhecido");
  return p;
}

/** Sessão temporária com o duelo refeito até a posição k (sem IA, sem passar janelas sozinha) */
function refazer(cfg: ConfigSessao, k?: number): Sessao {
  if (!motor) throw new Error("motor ainda não carregado");
  const historico = cfg.historico ?? [];
  const s = new Sessao(motor, { ...cfg, remoto: true, janelas: "todas", historico: historico.slice(0, k ?? historico.length) });
  s.avancar();
  return s;
}

onmessage = async (e: MessageEvent<ParaWorker>) => {
  const m = e.data;
  try {
    if (m.tipo === "linha-do-tempo" || m.tipo === "momento" || m.tipo === "fatos") {
      try {
        let dados: unknown;
        if (m.tipo === "linha-do-tempo") {
          // um passo por resposta: o momento antes de cada uma (e o do fim)
          const s = refazer({ ...m.cfg, historico: [] });
          const momentos = [s.momento()];
          for (const r of m.cfg.historico ?? []) {
            s.passo(r);
            momentos.push(s.momento());
          }
          s.encerrar();
          dados = momentos;
        } else if (m.tipo === "momento") {
          const s = refazer(m.cfg, m.k);
          dados = { quadro: { ...s.quadro(), pedido: null }, momento: s.momento() };
          s.encerrar();
        } else if (m.cfg) {
          const s = refazer(m.cfg, m.k);
          dados = s.fatos(m.code, m.jogador);
          s.encerrar();
        } else {
          if (!sessao) throw new Error("nenhum duelo em andamento");
          dados = sessao.fatos(m.code, m.jogador);
        }
        enviar({ tipo: "resultado", id: m.id, dados });
      } catch (err) {
        enviar({ tipo: "erro", id: m.id, erro: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (m.tipo === "pacote") {
      const pacote = await lerPacote(m.dados);
      motor = await abrirMotor(pacote, { url: wasmUrl });
      enviar({ tipo: "pronto", versao: pacote.versao, nomes: pacote.nomes });
    } else if (m.tipo === "iniciar") {
      if (!motor) throw new Error("motor ainda não carregado");
      sessao = new Sessao(motor, m.cfg);
      quadro(sessao.avancar(quadro));
    } else if (m.tipo === "responder") {
      if (!sessao) throw new Error("nenhum duelo em andamento");
      quadro(sessao.responder(m.resp, quadro));
    } else if (m.tipo === "ficha") {
      if (!sessao) throw new Error("nenhum duelo em andamento");
      quadro(sessao.criarFicha(m.dados));
    } else if (m.tipo === "aprendizado") {
      enviar({ tipo: "aprendizado", dados: sessao?.aprendizado() ?? null });
    } else if (m.tipo === "remota") {
      const q = sessao?.receberRemota(m.n, m.resp);
      if (q) quadro(q);
    } else if (m.tipo === "janelas") {
      sessao?.definirJanelas(m.janelas);
    }
  } catch (err) {
    enviar({ tipo: "erro", erro: err instanceof Error ? err.message : String(err) });
  }
};
