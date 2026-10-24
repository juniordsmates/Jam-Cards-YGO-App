import { isDesktop, isWindows } from "../platform";

export type ImageSize = "small" | "full" | "cropped";

const DIRS: Record<ImageSize, string> = {
  small: "cards_small",
  full: "cards",
  cropped: "cards_cropped",
};

/**
 * URL da imagem de uma carta.
 * - Desktop: protocolo próprio `ygoimg`, servido pelo Rust a partir do cache em disco
 *   (baixa da YGOPRODeck uma única vez por imagem).
 * - Web: URL original; o service worker (public/sw.js) guarda cada imagem no cache.
 */
export function cardImage(imageId: number, size: ImageSize) {
  const path = `${DIRS[size]}/${imageId}.jpg`;
  if (isDesktop) {
    // No Windows (WebView2) protocolos próprios usam http://<nome>.localhost
    return isWindows ? `http://ygoimg.localhost/${path}` : `ygoimg://localhost/${path}`;
  }
  return `https://images.ygoprodeck.com/images/${path}`;
}
