// Lado da tela do Simulador: baixa (e guarda) o pacote do motor e conversa com o Worker.
import type { OcgResponse } from "ocgcore-wasm";
import { idbGet, idbSetMany } from "../db/idb";
import { supabase } from "../db/supabase";
import { t } from "../i18n";
import type { ConfigSessao, Quadro } from "./sessao";
import type { DoWorker, ParaWorker } from "./worker";

// O pacote (dados das cartas e scripts do Project Ignis, ~6 MB) fica no bucket privado "camada",
// publicado pelo pipeline (Database-Cards-Ygo, scripts/pacote-motor.ts). motor-versao.json traz só
// a versão, para baixar o pacote de novo apenas quando ele muda.
const BUCKET = "camada";
const CHAVE = "motor-pacote-v1";
/** versão do pacote lido de public/motor.json.gz (desenvolvimento) */
const VERSAO_LOCAL = "dev";

interface PacoteSalvo {
  versao: string;
  dados: ArrayBuffer;
}

async function baixar(nome: string): Promise<Blob | null> {
  const sb = supabase();
  if (!sb) return null;
  const r = await sb.storage.from(BUCKET).download(nome);
  return r.error ? null : r.data;
}

/**
 * Pacote do motor: o salvo neste aparelho, ou o novo do bucket quando a versão mudou.
 * Sem internet, segue com o salvo. Em desenvolvimento, sem pacote no bucket, usa public/motor.json.gz.
 */
export async function obterPacote(aoProgresso?: (msg: string) => void): Promise<ArrayBuffer> {
  const salvo = await idbGet<PacoteSalvo>(CHAVE);
  let versao: string | undefined;
  try {
    const v = await baixar("motor-versao.json");
    versao = v ? ((JSON.parse(await v.text()) as { versao?: string }).versao ?? undefined) : undefined;
  } catch {
    // sem internet: fica o salvo
  }
  if (salvo && (!versao || versao === salvo.versao)) return salvo.dados;
  aoProgresso?.(t("Baixando o motor de regras (cerca de 6 MB, só na primeira vez)…"));
  let dados: ArrayBuffer | undefined;
  if (versao) dados = await (await baixar("motor.json.gz"))?.arrayBuffer();
  if (!dados && import.meta.env.DEV) {
    const r = await fetch("/motor.json.gz");
    if (r.ok) dados = await r.arrayBuffer();
  }
  if (!dados) {
    if (salvo) return salvo.dados;
    throw new Error(t("O motor de regras ainda não está disponível. Tente de novo mais tarde."));
  }
  await idbSetMany({ [CHAVE]: { versao: versao ?? VERSAO_LOCAL, dados } satisfies PacoteSalvo });
  return dados;
}

/** Conversa com o Worker do motor */
export class ClienteSim {
  private worker: Worker;
  private esperaPronto: { ok: (r: { nomes: Record<string, string>; versao: string }) => void; erro: (e: Error) => void } | null = null;

  constructor(
    private aoQuadro: (q: Quadro) => void,
    private aoErro: (msg: string) => void,
  ) {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<DoWorker>) => {
      const m = e.data;
      if (m.tipo === "pronto") {
        this.esperaPronto?.ok({ nomes: m.nomes, versao: m.versao });
        this.esperaPronto = null;
      } else if (m.tipo === "quadro") this.aoQuadro(m.quadro);
      else if (this.esperaPronto) {
        this.esperaPronto.erro(new Error(m.erro));
        this.esperaPronto = null;
      } else this.aoErro(m.erro);
    };
    this.worker.onerror = (e) => {
      const msg = e.message || t("o motor parou");
      if (this.esperaPronto) this.esperaPronto.erro(new Error(msg));
      else this.aoErro(msg);
      this.esperaPronto = null;
    };
  }

  private enviar(m: ParaWorker, transferir: Transferable[] = []) {
    this.worker.postMessage(m, transferir);
  }

  /** Carrega o pacote no motor; devolve os nomes das cartas do motor (inclui fichas) e a versão do pacote */
  carregar(dados: ArrayBuffer): Promise<{ nomes: Record<string, string>; versao: string }> {
    return new Promise((ok, erro) => {
      this.esperaPronto = { ok, erro };
      // cópia: o pacote salvo continua inteiro para a próxima partida
      const copia = dados.slice(0);
      this.enviar({ tipo: "pacote", dados: copia }, [copia]);
    });
  }

  iniciar(cfg: ConfigSessao) {
    this.enviar({ tipo: "iniciar", cfg });
  }

  responder(resp: OcgResponse) {
    this.enviar({ tipo: "responder", resp });
  }

  /** Partida 1x1: jogada do oponente */
  remota(n: number, resp: OcgResponse) {
    this.enviar({ tipo: "remota", n, resp });
  }

  janelas(janelas: "acao" | "todas") {
    this.enviar({ tipo: "janelas", janelas });
  }

  encerrar() {
    this.worker.terminate();
  }
}
