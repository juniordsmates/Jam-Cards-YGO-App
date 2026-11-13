import { useState } from "react";
import { t } from "../i18n";
import { openConta } from "./Conta";
import { buscarDecksComIA, getConfigIA, temPesquisaWeb, type DecksIA, type ReferenciaIA } from "../db/ia";
import { juntarReferencias, normalizarUrl, salvarGuiaDeck, type GuiaDeckBanco, type ReferenciaDeck } from "../db/guiasDeck";

/**
 * Guia de Deck → "Buscar novos decks" (administrador): a IA configurada pesquisa nos sites do app
 * referências novas para os decks do guia e decks que ainda faltam. Nada é salvo sem revisão: o
 * administrador marca o que entra e salva.
 */
export default function BuscaDecks({ existentes, guias, onSalvo, onFechar }: { existentes: string[]; guias: GuiaDeckBanco[]; onSalvo: (salvos: GuiaDeckBanco[]) => void; onFechar: () => void }) {
  const cfg = getConfigIA();
  const [progresso, setProgresso] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [achados, setAchados] = useState<{ decks: DecksIA; resposta: string } | null>(null);
  // marcados: "arquétipo|url" (referência) e "novo|arquétipo" (deck novo)
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const guiaDe = (a: string) => guias.find((g) => g.arquetipo.toLowerCase() === a.toLowerCase());
  const jaSalva = (a: string, url: string) => !!guiaDe(a)?.referencias.some((r) => normalizarUrl(r.url) === normalizarUrl(url));

  const buscar = async () => {
    setBuscando(true);
    setErro("");
    setAchados(null);
    try {
      const r = await buscarDecksComIA(cfg, { existentes, onProgresso: setProgresso });
      // só o que o guia ainda não tem
      const existentesNovos = r.decks.existentes
        .map((e) => ({ ...e, arquetipo: existentes.find((x) => x.toLowerCase() === e.arquetipo.toLowerCase()) ?? e.arquetipo, referencias: e.referencias.filter((ref) => !jaSalva(e.arquetipo, ref.url)) }))
        .filter((e) => e.referencias.length && existentes.some((x) => x.toLowerCase() === e.arquetipo.toLowerCase()));
      const novos = r.decks.novos.filter((n) => !existentes.some((x) => x.toLowerCase() === n.arquetipo.toLowerCase()));
      const decks = { existentes: existentesNovos, novos };
      setAchados({ decks, resposta: r.resposta });
      setMarcados(new Set([...existentesNovos.flatMap((e) => e.referencias.map((ref) => `${e.arquetipo}|${ref.url}`)), ...novos.flatMap((n) => [`novo|${n.arquetipo}`, ...n.referencias.map((ref) => `${n.arquetipo}|${ref.url}`)])]));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBuscando(false);
      setProgresso("");
    }
  };

  const alternar = (k: string) => {
    const s = new Set(marcados);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setMarcados(s);
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const comoDeck = (r: ReferenciaIA): ReferenciaDeck => ({ ...r, encontrado_em: hoje });

  const salvar = async () => {
    if (!achados) return;
    setSalvando(true);
    setErro("");
    try {
      const salvos: GuiaDeckBanco[] = [];
      for (const e of achados.decks.existentes) {
        const refs = e.referencias.filter((r) => marcados.has(`${e.arquetipo}|${r.url}`)).map(comoDeck);
        if (!refs.length) continue;
        const g = guiaDe(e.arquetipo) ?? { arquetipo: e.arquetipo, lista: null, textos: {}, referencias: [], revisado: hoje };
        salvos.push(await salvarGuiaDeck({ ...g, referencias: juntarReferencias(g.referencias, refs) }));
      }
      for (const n of achados.decks.novos) {
        if (!marcados.has(`novo|${n.arquetipo}`)) continue;
        const refs = n.referencias.filter((r) => marcados.has(`${n.arquetipo}|${r.url}`)).map(comoDeck);
        const textos = n.motivo ? { pt: { resumo: n.motivo, iniciais: [], avancadas: [] } } : {};
        salvos.push(await salvarGuiaDeck({ arquetipo: n.arquetipo, lista: null, textos, referencias: refs, revisado: hoje }));
      }
      onSalvo(salvos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const referencia = (a: string, r: ReferenciaIA) => (
    <li key={r.url}>
      <label>
        <input type="checkbox" checked={marcados.has(`${a}|${r.url}`)} onChange={() => alternar(`${a}|${r.url}`)} />{" "}
        <a href={r.url} target="_blank" rel="noreferrer">
          {r.titulo}
        </a>{" "}
        <small>
          · {r.site} · {r.idioma.toUpperCase()}
        </small>
      </label>
      {r.resumo && <p className="tags-note">{r.resumo}</p>}
    </li>
  );

  const nada = achados && !achados.decks.existentes.length && !achados.decks.novos.length;

  return (
    <section className="gd-busca">
      <h4>{t("Buscar novos decks")}</h4>
      <p className="tags-note">{t("A IA pesquisa nos sites que o app já usa como fonte (botão Fontes) referências novas sobre os decks do guia e decks competitivos que ainda faltam. Revise e marque o que entra antes de salvar.")}</p>
      {!cfg.chave && cfg.provedor !== "ollama" && cfg.provedor !== "lmstudio" ? (
        <p className="db-warning">
          {t("Configure uma IA com a sua chave em Minha conta → IAs.")}{" "}
          <button className="link-btn" onClick={() => openConta()}>
            {t("Abrir Minha conta")}
          </button>
        </p>
      ) : !temPesquisaWeb(cfg) ? (
        <p className="db-warning">{t("Buscar novos decks precisa de uma IA com pesquisa na web: Claude, ou um modelo do OpenRouter com :online no fim.")}</p>
      ) : (
        <button className="ghost-btn" onClick={() => void buscar()} disabled={buscando || salvando}>
          {buscando ? progresso || t("Buscando…") : achados ? t("Buscar de novo") : t("Buscar agora")}
        </button>
      )}
      {erro && <p className="db-warning">{erro}</p>}
      {nada && <p className="tags-note">{achados.resposta || t("A IA não encontrou referências novas.")}</p>}
      {achados && achados.decks.existentes.length > 0 && (
        <div className="gd-bloco">
          <h4>{t("Decks que já estão no guia")}</h4>
          {achados.decks.existentes.map((e) => (
            <div key={e.arquetipo}>
              <h5>{e.arquetipo}</h5>
              <ul className="gd-referencias">{e.referencias.map((r) => referencia(e.arquetipo, r))}</ul>
            </div>
          ))}
        </div>
      )}
      {achados && achados.decks.novos.length > 0 && (
        <div className="gd-bloco">
          <h4>{t("Decks novos")}</h4>
          {achados.decks.novos.map((n) => (
            <div key={n.arquetipo}>
              <label>
                <input type="checkbox" checked={marcados.has(`novo|${n.arquetipo}`)} onChange={() => alternar(`novo|${n.arquetipo}`)} /> <strong>{n.arquetipo}</strong>
              </label>
              {n.motivo && <p className="tags-note">{n.motivo}</p>}
              {n.referencias.length > 0 && <ul className="gd-referencias">{n.referencias.map((r) => referencia(n.arquetipo, r))}</ul>}
            </div>
          ))}
        </div>
      )}
      <div className="dialog-actions">
        <button className="ghost-btn" onClick={onFechar} disabled={salvando}>
          {t("Fechar")}
        </button>
        {achados && !nada && (
          <button className="ghost-btn" onClick={() => void salvar()} disabled={salvando || !marcados.size}>
            {salvando ? t("Salvando…") : t("Salvar selecionados")}
          </button>
        )}
      </div>
    </section>
  );
}
