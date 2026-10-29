import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/800.css";
import "./styles.css";
import App from "./App";
import { isDesktop } from "./platform";

// Na web, o service worker guarda as imagens das cartas (no desktop o Rust faz isso)
if (!isDesktop && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
