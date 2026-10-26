import pkg from "../package.json";

// Versão exibida no app. O número vem do package.json (o Tauri e o instalador exigem só
// números); o canal indica a maturidade da versão e muda à mão: Alpha → Beta → (estável).
export const APP_VERSION = pkg.version;
export const APP_CHANNEL = "Alpha";
export const VERSION_LABEL = APP_CHANNEL ? `${APP_VERSION} ${APP_CHANNEL}` : APP_VERSION;

// Data e commit da build (definidos em vite.config.ts)
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;
export const BUILD_COMMIT = __BUILD_COMMIT__;
const built = new Date(__BUILD_DATE__);
/** Ex.: "build 26/10/2026 11:37 · feda945" */
export const BUILD_LABEL = `build ${built.toLocaleDateString("pt-BR")} ${built.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${BUILD_COMMIT ? ` · ${BUILD_COMMIT}` : ""}`;
