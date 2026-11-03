import { useRef, useState, type ReactNode } from "react";
import ScreenShell from "./ScreenShell";
import { CAPITULOS } from "../data/manual";
import "./manual.css";
import { t } from "../i18n";
import Lateral from "../components/Lateral";

/** **negrito** do texto do manual */
const texto = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));

/** "Como Utilizar": manual das telas, com exemplos e as ligações entre elas (conteúdo em src/data/manual.ts) */
export default function Manual({ onBack }: { onBack: () => void }) {
  const [atual, setAtual] = useState(CAPITULOS[0].id);
  const conteudo = useRef<HTMLDivElement>(null);
  // imagens que ainda não foram geradas ficam de fora (sem ícone de imagem quebrada)
  const [semImagem, setSemImagem] = useState<Set<string>>(new Set());

  const ir = (id: string) => {
    setAtual(id);
    conteudo.current?.querySelector(`#manual-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // capítulo em destaque no índice: o que está no topo da área de leitura
  const aoRolar = () => {
    const area = conteudo.current;
    if (!area) return;
    const topo = area.getBoundingClientRect().top;
    const visivel = [...area.querySelectorAll<HTMLElement>("section[data-capitulo]")].filter((s) => s.getBoundingClientRect().top - topo < 120).pop();
    if (visivel?.dataset.capitulo && visivel.dataset.capitulo !== atual) setAtual(visivel.dataset.capitulo);
  };

  return (
    <ScreenShell title={t("Como Utilizar")} accent="cyan" onBack={onBack} plain>
      <div className="manual">
        <Lateral como="nav" className="manual-indice" aria-label={t("Capítulos")} titulo={t("Capítulos")} fecharCom={atual}>
          {CAPITULOS.map((c) => (
            <button key={c.id} className={atual === c.id ? "active" : ""} onClick={() => ir(c.id)}>
              {c.titulo}
            </button>
          ))}
        </Lateral>

        <div className="manual-conteudo" ref={conteudo} onScroll={aoRolar}>
          {CAPITULOS.map((c) => (
            <section key={c.id} id={`manual-${c.id}`} data-capitulo={c.id} className="manual-capitulo">
              <h3>{c.titulo}</h3>
              <p className="manual-resumo">{texto(c.resumo)}</p>
              {c.imagem && !semImagem.has(c.imagem.arquivo) && (
                <figure>
                  <img
                    src={`${import.meta.env.BASE_URL}manual/${c.imagem.arquivo}`}
                    alt={c.imagem.legenda}
                    loading="lazy"
                    onError={() => setSemImagem((s) => new Set(s).add(c.imagem!.arquivo))}
                  />
                  <figcaption>{c.imagem.legenda}</figcaption>
                </figure>
              )}
              {c.topicos.map((t) => (
                <div key={t.titulo} className="manual-topico">
                  <h4>{t.titulo}</h4>
                  <ul>
                    {t.itens.map((item) => (
                      <li key={item} className={item.startsWith("• ") ? "manual-sub" : undefined}>
                        {texto(item.replace(/^• /, ""))}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {c.exemplo && (
                <div className="manual-exemplo">
                  <h4>{c.exemplo.titulo}</h4>
                  <ol>
                    {c.exemplo.passos.map((p) => (
                      <li key={p}>{texto(p)}</li>
                    ))}
                  </ol>
                </div>
              )}
              {c.ligacoes && (
                <div className="manual-ligacoes">
                  <h4>{t("Ligações com outras telas")}</h4>
                  <ul>
                    {c.ligacoes.map((l) => (
                      <li key={l}>{texto(l)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </ScreenShell>
  );
}
