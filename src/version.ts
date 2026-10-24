import pkg from "../package.json";

// Versão exibida no app. O número vem do package.json (o Tauri e o instalador exigem só
// números); o canal indica a maturidade da versão e muda à mão: Alpha → Beta → (estável).
export const APP_VERSION = pkg.version;
export const APP_CHANNEL = "Alpha";
export const VERSION_LABEL = APP_CHANNEL ? `${APP_VERSION} ${APP_CHANNEL}` : APP_VERSION;
