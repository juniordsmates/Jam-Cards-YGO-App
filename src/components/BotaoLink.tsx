import { useState } from "react";
import { copiarLink, type Rota } from "../rotas";
import { t } from "../i18n";

// "Copiar link": copia o endereço da rota (no app de computador, o do site). `bloqueado`: o link não
// abriria para outra pessoa (ex.: combo só neste aparelho), e o motivo aparece no lugar do botão.
// `aviso`: copia, mas lembra de algo (ex.: combo que só o autor vê).

export default function BotaoLink({ rota, bloqueado, aviso, className = "" }: { rota: Rota; bloqueado?: string; aviso?: string; className?: string }) {
  const [estado, setEstado] = useState<"copiado" | "erro" | null>(null);
  if (bloqueado)
    return (
      <span className={`botao-link botao-link-bloqueado ${className}`} title={bloqueado}>
        {t("🔗 Sem link")}
      </span>
    );
  const copiar = async () => {
    setEstado((await copiarLink(rota)) ? "copiado" : "erro");
    setTimeout(() => setEstado(null), aviso ? 5000 : 2000);
  };
  return (
    <span className={`botao-link ${className}`}>
      <button
        className="link-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void copiar();
        }}
        title={t("Copia o link para compartilhar")}
      >
        {estado === "copiado" ? t("✓ Link copiado") : estado === "erro" ? t("Não foi possível copiar") : t("🔗 Copiar link")}
      </button>
      {estado === "copiado" && aviso && <small className="botao-link-aviso">{aviso}</small>}
    </span>
  );
}
