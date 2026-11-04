import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n";

// Rede de segurança: um erro ao desenhar qualquer tela derrubava o app inteiro e deixava o
// navegador em branco. Agora aparece o que aconteceu, com "Voltar ao menu" e "Recarregar", e os
// detalhes ficam guardados (cartas-ultimo-erro) para enviar a quem mantém o app.

const CHAVE = "cartas-ultimo-erro";

interface Estado {
  erro: Error | null;
  detalhes: string;
  copiado: boolean;
}

export default class ErroApp extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null, detalhes: "", copiado: false };

  static getDerivedStateFromError(erro: Error): Partial<Estado> {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    const detalhes = [
      `${new Date().toISOString()} · ${window.location.hash || "#/"} · ${navigator.userAgent}`,
      `${erro.name}: ${erro.message}`,
      (erro.stack ?? "").split("\n").slice(0, 8).join("\n"),
      "componentStack:" + (info.componentStack ?? "").split("\n").slice(0, 8).join("\n"),
    ].join("\n");
    this.setState({ detalhes });
    console.error("[Jam Cards] erro na tela:", erro, info.componentStack);
    try {
      localStorage.setItem(CHAVE, detalhes);
    } catch {
      // sem armazenamento: os detalhes ficam só na tela
    }
  }

  private voltar = () => {
    window.location.hash = "#/";
    this.setState({ erro: null, detalhes: "", copiado: false });
  };

  private copiar = async () => {
    try {
      await navigator.clipboard.writeText(this.state.detalhes);
      this.setState({ copiado: true });
    } catch {
      // sem a API de área de transferência: o texto continua selecionável na tela
    }
  };

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="erro-app" role="alert">
        <div className="erro-app-caixa">
          <h1>{t("Algo deu errado nesta tela")}</h1>
          <p>{t("O app não perdeu seus dados. Volte ao menu ou recarregue a página.")}</p>
          <p className="erro-app-msg">{this.state.erro.message}</p>
          <div className="erro-app-acoes">
            <button className="ghost-btn" onClick={this.voltar}>
              {t("Voltar ao menu")}
            </button>
            <button className="ghost-btn" onClick={() => window.location.reload()}>
              {t("Recarregar")}
            </button>
            <button className="link-btn" onClick={() => void this.copiar()}>
              {this.state.copiado ? t("✓ Detalhes copiados") : t("Copiar detalhes do erro")}
            </button>
          </div>
          <details>
            <summary>{t("Detalhes")}</summary>
            <pre>{this.state.detalhes}</pre>
          </details>
        </div>
      </div>
    );
  }
}
