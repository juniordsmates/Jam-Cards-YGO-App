import { useEffect } from "react";
import { t } from "../i18n";

type Props = {
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ExitDialog({ onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="exit-title">{t("Deseja sair?")}</h2>
        <p>{t("Alterações não salvas serão perdidas.")}</p>
        <div className="dialog-actions">
          <button className="ghost-btn" onClick={onCancel} autoFocus>
            {t("Cancelar")}</button>
          <button className="danger-btn" onClick={onConfirm}>
            {t("Sair")}</button>
        </div>
      </div>
    </div>
  );
}
