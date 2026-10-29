import { useMemo, useState, type ReactNode } from "react";
import { ComboCard, paraComboBase } from "./ComboSearch";
import { openContaIA } from "./Conta";
import type { ComboBase } from "../db/baseCombos";
import { ehLinkYouTube, getConfigDe, iaConfigurada, importarComboDeVideo } from "../db/ia";
import type { GameFormat } from "../db/legality";
import { normalize } from "../db/search";
import type { Card } from "../db/types";

type Hover = (card: Card | null, el?: HTMLElement) => void;

/**
 * Experimental: importar combo de um vídeo do YouTube. O Gemini (com a chave do usuário) assiste
 * ao vídeo e devolve os passos; cada combo aparece como sugestão de IA, para conferir e, se estiver
 * certo, salvar como Combo da Comunidade.
 */
export default function ComboDeVideo({
  tabs,
  all,
  byId,
  format,
  onHover,
  onEditar,
}: {
  tabs: ReactNode;
  all: Card[];
  byId: Map<number, Card>;
  format: GameFormat;
  onHover: Hover;
  /** "Editar e Importar": abre o combo no Teste de Jogo para refazer os passos */
  onEditar?: (combo: ComboBase) => void;
}) {
  const [link, setLink] = useState("");
  const [estado, setEstado] = useState<{ status: "parado" | "lendo" | "pronto" | "erro"; progresso?: string; combos: ComboBase[]; aviso?: string; erro?: string }>({
    status: "parado",
    combos: [],
  });
  const gemini = getConfigDe("gemini");
  const pronto = iaConfigurada(gemini);

  // carta pelo nome em inglês ou português (os nomes que o Gemini devolve)
  const porNome = useMemo(() => {
    const m = new Map<string, Card>();
    for (const c of all) {
      if (c.frame === "skill" || c.frame === "token") continue;
      m.set(normalize(c.name), c);
      if (c.namePt) m.set(normalize(c.namePt), c);
    }
    return m;
  }, [all]);

  const ler = async () => {
    setEstado({ status: "lendo", progresso: "Enviando o vídeo ao Gemini…", combos: [] });
    try {
      const r = await importarComboDeVideo(gemini, link, {
        acharCarta: (nome) => porNome.get(normalize(nome)),
        onProgresso: (progresso) => setEstado((e) => ({ ...e, progresso })),
      });
      const faltando = [...new Set(r.sugestoes.flatMap((s) => s.naoEncontradas))];
      setEstado({
        status: "pronto",
        combos: r.sugestoes.map((s, i) => paraComboBase(s, i)),
        aviso: [r.resposta, faltando.length ? `Cartas que o Gemini citou e não estão na base: ${faltando.join(", ")}.` : ""].filter(Boolean).join(" "),
      });
    } catch (e) {
      setEstado({ status: "erro", combos: [], erro: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="combos combo-video">
      <section className="combos-setup">
        {tabs}
        <label className="field">
          <span className="field-label">Link do vídeo (YouTube)</span>
          <input
            className="cv-link"
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pronto && ehLinkYouTube(link) && void ler()}
          />
        </label>
        <button className="ghost-btn cs-buscar" disabled={!pronto || !ehLinkYouTube(link) || estado.status === "lendo"} onClick={() => void ler()}>
          {estado.status === "lendo" ? "Lendo o vídeo…" : "Ler combo do vídeo"}
        </button>
        {!pronto ? (
          <p className="db-warning">
            Precisa do Gemini cadastrado.{" "}
            <button className="link-btn" onClick={() => openContaIA("gemini")}>
              Cadastrar o Gemini (com tutorial)
            </button>
          </p>
        ) : (
          <p className="tags-note">
            Usando o Gemini ({gemini.modelo}).{" "}
            <button className="link-btn" onClick={() => openContaIA("gemini")}>
              Ver o cadastro
            </button>
          </p>
        )}
        <p className="tags-note">
          <strong>Experimental:</strong> o Gemini assiste ao vídeo (só vídeos públicos) e transcreve o combo. Pode errar cartas ou passos,
          principalmente em combos rápidos: confira antes de salvar. Cada vídeo usa a sua cota do Gemini.
        </p>
      </section>

      <section className="combos-result">
        {estado.status === "parado" && (
          <div className="combos-empty">
            <p>Importar combo de vídeo</p>
            <small>Cole o link de um vídeo de combo do YouTube e clique em Ler combo do vídeo. O resultado aparece aqui para você conferir e salvar como Combo da Comunidade.</small>
          </div>
        )}
        {estado.status === "lendo" && (
          <div className="db-loading">
            <span className="spinner" />
            <p>{estado.progresso}</p>
          </div>
        )}
        {estado.status === "erro" && <p className="db-warning">{estado.erro}</p>}
        {estado.status === "pronto" && (
          <section className="known-combos ia-section" aria-label="Combos do vídeo">
            <h4>Combos do vídeo ({estado.combos.length})</h4>
            {estado.aviso && <p className="tags-note">{estado.aviso}</p>}
            {onEditar && estado.combos.length > 0 && (
              <p className="tags-note">
                <strong>Editar e Importar</strong>: abre o combo no Teste de Jogo, com as cartas dele num deck temporário e os passos lidos
                do vídeo como guia. Refaça o combo (pulando ou acrescentando etapas) e salve pelo Criar combo.
              </p>
            )}
            {estado.combos.map((c) => (
              <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={new Set()} format={format} onTestar={onEditar} rotuloTestar="✎ Editar e Importar" />
            ))}
          </section>
        )}
      </section>
    </div>
  );
}
