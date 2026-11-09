// Worker do Simulador: o motor e a IA rodam aqui, fora da tela, para o planejamento da IA (alguns
// segundos) não travar o app. Mensagens: src/sim/cliente.ts.
import wasmUrl from "ocgcore-wasm/lib/ocgcore.sync.wasm?url";
import type { OcgResponse } from "ocgcore-wasm";
import { abrirMotor, type Motor, type PacoteMotor } from "./regras";
import { Sessao, type ConfigSessao, type Quadro } from "./sessao";

export type ParaWorker =
  | { tipo: "pacote"; dados: ArrayBuffer }
  | { tipo: "iniciar"; cfg: ConfigSessao }
  | { tipo: "responder"; resp: OcgResponse }
  | { tipo: "janelas"; janelas: "acao" | "todas" };

export type DoWorker =
  | { tipo: "pronto"; versao: string; nomes: Record<string, string> }
  | { tipo: "quadro"; quadro: Quadro }
  | { tipo: "erro"; erro: string };

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

onmessage = async (e: MessageEvent<ParaWorker>) => {
  const m = e.data;
  try {
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
    } else if (m.tipo === "janelas") {
      sessao?.definirJanelas(m.janelas);
    }
  } catch (err) {
    enviar({ tipo: "erro", erro: err instanceof Error ? err.message : String(err) });
  }
};
