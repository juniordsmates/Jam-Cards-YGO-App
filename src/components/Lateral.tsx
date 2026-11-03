import { useEffect, useRef, useState, useSyncExternalStore, type HTMLAttributes, type ReactNode } from "react";
import { t } from "../i18n";

// Painel lateral das telas (filtros, lista de decks, índice…). No computador fica na coluna de
// sempre. No celular vira uma gaveta: recolhida, sobra só um botão com a seta (› na esquerda, ‹ na
// direita) na borda da tela; aberta, cobre parte da tela por cima do conteúdo e fecha pela seta,
// pelo fundo escurecido ou quando algo é escolhido nela (`fecharCom`).

/** Largura em que o layout passa para o de celular (o mesmo de styles.css) */
export const CELULAR = "(max-width: 760px)";

const assinar = (aviso: () => void) => {
  const m = window.matchMedia(CELULAR);
  m.addEventListener("change", aviso);
  return () => m.removeEventListener("change", aviso);
};

/** A tela está no tamanho de celular */
export function useCelular(): boolean {
  return useSyncExternalStore(assinar, () => window.matchMedia(CELULAR).matches, () => false);
}

type Props = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** lado da tela; define a borda do botão e o sentido da seta */
  lado?: "esq" | "dir";
  /** nome do painel (no topo da gaveta e no botão, para leitores de tela) */
  titulo: string;
  /** elemento usado (aside, nav ou section, como era na tela) */
  como?: "aside" | "nav" | "section" | "div";
  /** no celular, abre a gaveta quando este valor muda para algo verdadeiro (ex.: carta aberta) */
  abrirCom?: unknown;
  /** no celular, fecha a gaveta quando este valor muda (ex.: deck escolhido na lista) */
  fecharCom?: unknown;
  /** começa aberta no celular (ex.: tela que ainda não tem nada escolhido) */
  inicialAberta?: boolean;
  children: ReactNode;
};

export default function Lateral({ lado = "esq", titulo, como = "aside", abrirCom, fecharCom, inicialAberta = false, className = "", children, ...resto }: Props) {
  const celular = useCelular();
  const [aberta, setAberta] = useState(inicialAberta);
  const primeira = useRef(true);

  useEffect(() => {
    if (abrirCom) setAberta(true);
  }, [abrirCom]);
  useEffect(() => {
    // a primeira renderização não conta (senão o valor inicial já fecharia a gaveta)
    if (primeira.current) return void (primeira.current = false);
    setAberta(false);
  }, [fecharCom]);

  const Tag = como;
  const seta = (abrir: boolean) => ((lado === "esq") === abrir ? "›" : "‹");
  return (
    <>
      <Tag className={`${className} lateral lateral-${lado}${aberta ? " lateral-aberta" : ""}`} {...resto}>
        {celular && aberta && (
          <div className="lateral-topo">
            <strong>{titulo}</strong>
            <button className="lateral-fechar" onClick={() => setAberta(false)} aria-label={t("Recolher {0}", [titulo])}>
              {seta(false)}
            </button>
          </div>
        )}
        {children}
      </Tag>
      {celular && aberta && <div className="lateral-fundo" onClick={() => setAberta(false)} aria-hidden="true" />}
      {celular && !aberta && (
        <button className={`lateral-botao lateral-botao-${lado}`} onClick={() => setAberta(true)} aria-label={t("Abrir {0}", [titulo])} title={titulo}>
          {seta(true)}
        </button>
      )}
    </>
  );
}
