// O Tauri injeta este objeto na janela nativa; no navegador ele não existe
export const isDesktop = "__TAURI_INTERNALS__" in window;
export const isWindows = navigator.userAgent.includes("Windows");

/** Fecha o app. Retorna false quando não é possível (aba comum do navegador). */
export async function exitApp(): Promise<boolean> {
  if (isDesktop) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
    return true;
  }
  window.close(); // só funciona se a aba foi aberta por script
  return window.closed;
}
