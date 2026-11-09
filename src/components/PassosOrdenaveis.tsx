import { useState, type ReactNode } from "react";
import { foraDaOrdem, moverPasso, naOrdemOriginal } from "../db/baseCombos";
import type { Passo } from "../db/motor";
import { t } from "../i18n";
import "./passos-ordenaveis.css";

/**
 * Passos de um combo para editar (Criar combo e Editar): arrastar um passo muda a ordem (no teclado,
 * Alt + ↑/↓ no passo em foco), ✕ tira o passo e "Voltar para a ordem original" devolve a ordem em
 * que o combo foi criado.
 */
export default function PassosOrdenaveis({
  passos,
  originais,
  onChange,
  render,
  className,
}: {
  passos: Passo[];
  /** ordem em que o combo foi criado */
  originais: Passo[];
  onChange: (passos: Passo[]) => void;
  render: (p: Passo) => ReactNode;
  className: string;
}) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const soltar = (para: number) => {
    if (arrastando !== null && arrastando !== para) onChange(moverPasso(passos, arrastando, para));
    setArrastando(null);
    setSobre(null);
  };
  return (
    <>
      <ol className={`${className} passos-ordenaveis`}>
        {passos.map((p, i) => (
          <li
            key={i}
            draggable
            tabIndex={0}
            className={`${arrastando === i ? "arrastando" : ""} ${sobre === i && arrastando !== i ? (arrastando! < i ? "solta-abaixo" : "solta-acima") : ""}`}
            title={t("Arraste para mudar a ordem (ou Alt + ↑/↓)")}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setArrastando(i);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              soltar(i);
            }}
            onDragEnd={() => {
              setArrastando(null);
              setSobre(null);
            }}
            onKeyDown={(e) => {
              if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
              e.preventDefault();
              const para = e.key === "ArrowUp" ? i - 1 : i + 1;
              if (para < 0 || para >= passos.length) return;
              onChange(moverPasso(passos, i, para));
              // o foco acompanha o passo movido
              const lista = e.currentTarget.parentElement;
              requestAnimationFrame(() => (lista?.children[para] as HTMLElement | undefined)?.focus());
            }}
          >
            <span className="passo-alca" aria-hidden="true">⠿</span>
            {render(p)}
            <button className="link-btn" onClick={() => onChange(passos.filter((_, j) => j !== i))} aria-label={t("Tirar o passo {0}", [i + 1])} title={t("Tirar este passo")}>
              ✕
            </button>
          </li>
        ))}
      </ol>
      {foraDaOrdem(passos, originais) && (
        <button className="link-btn passos-ordem-original" onClick={() => onChange(naOrdemOriginal(passos, originais))}>
          ↺ {t("Voltar para a ordem original")}
        </button>
      )}
    </>
  );
}
