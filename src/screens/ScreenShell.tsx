import type { ReactNode } from "react";
import { BackIcon } from "../icons";
import { t } from "../i18n";

type Props = {
  title: string;
  accent: "cyan" | "magenta";
  onBack: () => void;
  /** conteúdo extra à direita do título */
  actions?: ReactNode;
  /** sem a moldura tracejada de "em construção" */
  plain?: boolean;
  children: ReactNode;
};

/** Moldura comum das telas internas: cabeçalho com voltar + área de conteúdo. */
export default function ScreenShell({ title, accent, onBack, actions, plain, children }: Props) {
  return (
    <section className={`screen accent-${accent}`}>
      <header className="screen-header">
        <button className="ghost-btn" onClick={onBack} autoFocus>
          <BackIcon /> {" "}{t("Menu")}</button>
        <h2 className="screen-title">{title}</h2>
        {actions}
        <kbd className="menu-btn-key">{t("Esc")}</kbd>
      </header>
      <div className={plain ? "screen-body-plain" : "screen-body"}>{children}</div>
    </section>
  );
}
