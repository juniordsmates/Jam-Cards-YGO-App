import { useEffect, useState } from "react";
import ScreenShell from "./ScreenShell";
import { openConta } from "../components/Conta";
import { CONQUISTAS, NIVEL_LABEL, type Conquista } from "../data/conquistas";
import { useConta } from "../db/conta";
import { cardImage } from "../db/images";
import { raridadeConquistas, useMinhasConquistas } from "../db/minhasConquistas";
import { TrophyIcon } from "../icons";
import { t, LOCALE } from "../i18n";
import "./conquistas.css";

// Conquistas: todas as do catálogo, com o ícone (arte da carta), a descrição, o nível (como os
// troféus do PS5), a data em que foi obtida e a raridade (% dos duelistas que já obtiveram, como
// na Steam). As bloqueadas aparecem apagadas; as secretas escondem nome e descrição.

export default function Conquistas({ onBack, onRank }: { onBack: () => void; onRank: () => void }) {
  const conta = useConta();
  const { obtidas } = useMinhasConquistas();
  const [raridade, setRaridade] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    let vivo = true;
    void raridadeConquistas().then((r) => vivo && setRaridade(r));
    return () => void (vivo = false);
  }, [obtidas]);

  const total = CONQUISTAS.length;
  const feitas = CONQUISTAS.filter((c) => obtidas[c.id]).length;
  const pct = total ? Math.round((feitas / total) * 100) : 0;

  return (
    <ScreenShell
      title={t("Conquistas")}
      accent="magenta"
      onBack={onBack}
      plain
      actions={
        <button className="ghost-btn" onClick={onRank}>
          {t("Rank")} →
        </button>
      }
    >
      <div className="conquistas">
        <section className="cq-resumo">
          <span className="cq-trofeu" aria-hidden>
            <TrophyIcon />
          </span>
          <div className="cq-progresso">
            <strong>{t("{0} de {1} conquistas · {2}%", [feitas, total, pct])}</strong>
            <span className="cq-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("Progresso das conquistas")}>
              <span style={{ width: `${pct}%` }} />
            </span>
            <small className="tags-note">
              {conta ? t("Suas conquistas ficam salvas na sua conta.") : t("Sem login, as conquistas ficam só neste aparelho. Ao entrar, elas vão para a sua conta.")}
            </small>
          </div>
          {!conta && (
            <button className="ghost-btn" onClick={() => openConta()}>
              {t("Entrar")}
            </button>
          )}
        </section>

        <ul className="cq-lista">
          {CONQUISTAS.map((c) => (
            <CartaoConquista key={c.id} c={c} obtidaEm={obtidas[c.id]} raridade={raridade?.get(c.id)} />
          ))}
        </ul>
      </div>
    </ScreenShell>
  );
}

function CartaoConquista({ c, obtidaEm, raridade }: { c: Conquista; obtidaEm?: string; raridade?: number }) {
  const escondida = c.secreta && !obtidaEm;
  return (
    <li className={`cq-item ${obtidaEm ? "cq-obtida" : "cq-bloqueada"}`}>
      <span className="cq-icone">
        <img src={cardImage(c.cartaId, "cropped")} alt="" loading="lazy" />
        {!obtidaEm && <span className="cq-cadeado" aria-hidden>🔒</span>}
      </span>
      <span className="cq-texto">
        <strong>{escondida ? t("Conquista secreta") : c.nome}</strong>
        <span>{escondida ? t("Continue jogando para descobrir.") : c.descricao}</span>
        <small className="cq-rodape">
          <span className={`cq-nivel cq-nivel-${c.nivel}`}>{NIVEL_LABEL[c.nivel]}</span>
          <span>{obtidaEm ? t("Obtida em {0}", [new Date(obtidaEm).toLocaleDateString(LOCALE)]) : t("Bloqueada")}</span>
          {raridade !== undefined && <span className="tags-note">{t("{0}% dos duelistas", [raridade.toLocaleString(LOCALE, { maximumFractionDigits: 1 })])}</span>}
        </small>
      </span>
    </li>
  );
}
