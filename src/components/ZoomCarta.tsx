import { useEffect, useRef, useState } from "react";
import { cardImage } from "../db/images";
import { t } from "../i18n";

// Zoom da carta: em qualquer tela, o botão do meio do mouse sobre a imagem de uma carta abre essa
// carta em tamanho grande (imagem em resolução cheia) no meio da tela. Clicar em qualquer lugar fora
// da imagem (ou Esc) fecha e volta para o que estava sendo feito.

/** id da imagem de uma carta pela URL (site, ygoimg:// do app de computador; pequena, cheia ou recortada) */
const ID_DA_IMAGEM = /\/cards(?:_small|_cropped)?\/(\d+)\.jpg(?:$|\?)/;

function idDaCarta(alvo: EventTarget | null): { id: number; src: string } | null {
  if (!(alvo instanceof HTMLImageElement)) return null;
  const m = ID_DA_IMAGEM.exec(alvo.currentSrc || alvo.src);
  return m ? { id: Number(m[1]), src: alvo.currentSrc || alvo.src } : null;
}

export default function ZoomCarta() {
  const [aberta, setAberta] = useState<{ id: number; src: string } | null>(null);
  const abertaRef = useRef(aberta);
  abertaRef.current = aberta;

  useEffect(() => {
    // mousedown: o botão do meio não liga a rolagem automática do navegador
    const aoPressionar = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const carta = idDaCarta(e.target);
      if (!carta) return;
      e.preventDefault();
      e.stopPropagation();
      setAberta(carta);
    };
    // auxclick: a imagem dentro de um link não abre o link numa aba nova
    const aoClicarMeio = (e: MouseEvent) => {
      if (e.button === 1 && idDaCarta(e.target)) e.preventDefault();
    };
    // Esc fecha só o zoom (fica antes dos atalhos das telas, que voltariam ao menu)
    const aoTeclar = (e: KeyboardEvent) => {
      if (!abertaRef.current || e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setAberta(null);
    };
    document.addEventListener("mousedown", aoPressionar, true);
    document.addEventListener("auxclick", aoClicarMeio, true);
    window.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("mousedown", aoPressionar, true);
      document.removeEventListener("auxclick", aoClicarMeio, true);
      window.removeEventListener("keydown", aoTeclar, true);
    };
  }, []);

  if (!aberta) return null;
  const fechar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAberta(null);
  };
  return (
    <div className="zoom-carta" role="dialog" aria-modal="true" aria-label={t("Carta ampliada")} onMouseDown={fechar} onClick={(e) => e.stopPropagation()} onContextMenu={fechar}>
      <img
        src={cardImage(aberta.id, "full")}
        // a imagem que já estava na tela aparece enquanto a grande carrega
        style={{ backgroundImage: `url("${aberta.src}")` }}
        alt={t("Carta ampliada")}
        draggable={false}
        onLoad={(e) => (e.currentTarget.style.backgroundImage = "none")}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
