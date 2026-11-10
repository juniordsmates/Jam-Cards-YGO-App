import { useEffect } from "react";
import { t } from "../i18n";

/** Quem começa com a mão do combo no teste contra a IA */
export type QuemTemOCombo = "eu" | "ia" | "ambos";
export type ModoTeste = "manual" | QuemTemOCombo;

const OPCOES: { id: ModoTeste; titulo: string; dica: string }[] = [
  { id: "manual", titulo: t("Testar Execução do Combo Manualmente"), dica: t("Abre o Teste de Jogo: você move as cartas e segue os passos do combo.") },
  { id: "eu", titulo: t("Teste Contra a IA (Eu Tenho o Combo)"), dica: t("Você começa com a mão do combo no Simulador, e a IA tenta interromper.") },
  { id: "ia", titulo: t("Teste Contra a IA (A IA Tem o Combo)"), dica: t("A IA começa com a mão do combo e tenta executá-lo contra você.") },
  { id: "ambos", titulo: t("Teste Contra a IA (Ambos Temos o Combo)"), dica: t("Os dois começam com a mão do combo; a IA joga primeiro.") },
];

/** "Testar" de um combo: teste manual (Teste de Jogo) ou no Simulador contra a IA */
export default function TestarDialog({ onEscolher, onCancel }: { onEscolher: (m: ModoTeste) => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog testar-dialog" role="dialog" aria-modal="true" aria-labelledby="testar-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="testar-title">{t("Testar")}</h2>
        <div className="testar-opcoes">
          {OPCOES.map((o, i) => (
            <button key={o.id} className="ghost-btn testar-opcao" onClick={() => onEscolher(o.id)} autoFocus={i === 0}>
              <strong>{o.titulo}</strong>
              <small>{o.dica}</small>
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="ghost-btn" onClick={onCancel}>
            {t("Cancelar")}</button>
        </div>
      </div>
    </div>
  );
}
