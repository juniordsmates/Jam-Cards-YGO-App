import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Identificação da build (data e commit), mostrada ao lado da versão: builds da mesma versão
// (ex.: várias publicações da 0.0.1) ficam distinguíveis. Na Action, o commit vem de GITHUB_SHA.
const commit = (process.env.GITHUB_SHA ?? (() => {
  try {
    return execSync("git rev-parse HEAD").toString();
  } catch {
    return "";
  }
})()).trim().slice(0, 7);

// Porta fixa: o Tauri aponta para ela em src-tauri/tauri.conf.json
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
