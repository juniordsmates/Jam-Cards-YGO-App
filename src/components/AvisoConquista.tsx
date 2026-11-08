import { useEffect, useState } from "react";
import { conquistaPorId, NIVEL_LABEL } from "../data/conquistas";
import { cardImage } from "../db/images";
import { aoDesbloquear } from "../db/minhasConquistas";
import { TrophyIcon } from "../icons";
import { t } from "../i18n";
import "../screens/conquistas.css";

// Aviso de conquista desbloqueada (como o do PS5): aparece no canto da tela por alguns segundos,
// em qualquer tela. Várias de uma vez entram em fila. Clicar abre a tela de Conquistas.

const DURACAO = 5000;

export default function AvisoConquista() {
  const [fila, setFila] = useState<string[]>([]);
  useEffect(() => aoDesbloquear((id) => setFila((f) => [...f, id])), []);
  const atual = fila[0];
  useEffect(() => {
    if (!atual) return;
    const tm = window.setTimeout(() => setFila((f) => f.slice(1)), DURACAO);
    return () => window.clearTimeout(tm);
  }, [atual]);

  const c = atual ? conquistaPorId(atual) : undefined;
  if (!c) return null;
  return (
    <button
      key={atual}
      className="aviso-conquista"
      role="status"
      onClick={() => {
        setFila((f) => f.slice(1));
        window.location.hash = "#/conquistas";
      }}
      title={t("Ver conquistas")}
    >
      <img src={cardImage(c.cartaId, "cropped")} alt="" />
      <span className="aviso-conquista-texto">
        <small>
          <TrophyIcon /> {t("Conquista desbloqueada")}
        </small>
        <strong>{c.nome}</strong>
        <span className={`cq-nivel cq-nivel-${c.nivel}`}>{NIVEL_LABEL[c.nivel]}</span>
      </span>
    </button>
  );
}
