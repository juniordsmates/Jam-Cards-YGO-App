import type { MouseEvent, ReactNode } from "react";
import { isDesktop } from "../platform";
import { t } from "../i18n";

/** Abre um endereço da web no navegador padrão (desktop) ou numa aba nova (web) */
export async function openExternal(url: string) {
  if (isDesktop) {
    // a janela do app não abre janelas novas: o plugin opener manda o link para o navegador do sistema
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

type Props = {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
};

/** Link para fora do app: sempre abre no navegador externo */
export default function ExternalLink({ href, className, title, children }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    void openExternal(href);
  };
  return (
    <a className={className} href={href} title={title ?? t("Abrir no navegador")} target="_blank" rel="noreferrer" onClick={onClick}>
      {children}
    </a>
  );
}
