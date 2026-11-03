import { useId, useMemo, useState } from "react";
import { useCardDb } from "../db/cardStore";
import { MAX_ARQUETIPOS } from "../db/baseCombos";
import { IDIOMA, t } from "../i18n";
import "../screens/comunidade.css";

// "Arquétipos vinculados" ao compartilhar um combo: o combo ganha a tag de cada arquétipo e aparece
// na aba Comunidade dele. Sugere os arquétipos das cartas do combo e aceita qualquer arquétipo
// conhecido pelo app (os mesmos da busca). Quem grava confere se o combo tem cartas de cada um
// (arquetiposSemCartas); o aviso de bloqueio fica a cargo de quem usa o componente.

export default function VincularArquetipos({
  valor,
  aoMudar,
  sugeridos,
  semCartas = [],
}: {
  valor: string[];
  aoMudar: (arquetipos: string[]) => void;
  /** arquétipos das cartas do combo (atalhos para marcar) */
  sugeridos: string[];
  /** arquétipos marcados que o combo não justifica (destacados até serem desmarcados) */
  semCartas?: string[];
}) {
  const db = useCardDb();
  const [texto, setTexto] = useState("");
  const listaId = useId();
  const nome = (a: string) => {
    const pt = IDIOMA === "pt" ? db.archetypePt.get(a) : undefined;
    return pt && pt.toLowerCase() !== a.toLowerCase() ? `${a} · ${pt}` : a;
  };
  const marcado = (a: string) => valor.some((v) => v.toLowerCase() === a.toLowerCase());
  const cheio = valor.length >= MAX_ARQUETIPOS;
  const marcar = (a: string) => !marcado(a) && !cheio && aoMudar([...valor, a]);
  const desmarcar = (a: string) => aoMudar(valor.filter((v) => v !== a));

  // o texto digitado vira o arquétipo oficial (em inglês ou pelo nome em português)
  const porNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of db.archetypes) {
      m.set(a.toLowerCase(), a);
      const pt = db.archetypePt.get(a);
      if (pt) m.set(pt.toLowerCase(), a);
    }
    return m;
  }, [db.archetypes, db.archetypePt]);
  const adicionarDigitado = () => {
    const a = porNome.get(texto.trim().toLowerCase().split(" · ")[0]) ?? porNome.get(texto.trim().toLowerCase());
    if (a) {
      marcar(a);
      setTexto("");
    }
  };

  return (
    <div className="field vincular-arq">
      <span className="field-label">{t("Arquétipos vinculados")}</span>
      <div className="chips">
        {valor.map((a) => (
          <button
            key={a}
            type="button"
            className={`chip active ${semCartas.some((s) => s.toLowerCase() === a.toLowerCase()) ? "vincular-sem-cartas" : ""}`}
            onClick={() => desmarcar(a)}
            title={t("Desmarcar")}
          >
            {nome(a)} ×
          </button>
        ))}
        {!valor.length && <small className="tags-note">{t("Nenhum: o combo não aparece na aba Comunidade.")}</small>}
      </div>
      {sugeridos.some((a) => !marcado(a)) && (
        <div className="chips vincular-sugeridos">
          <small className="tags-note">{t("Das cartas do combo:")}</small>
          {sugeridos
            .filter((a) => !marcado(a))
            .map((a) => (
              <button key={a} type="button" className="chip" disabled={cheio} onClick={() => marcar(a)}>
                + {nome(a)}
              </button>
            ))}
        </div>
      )}
      <div className="vincular-outro">
        <input
          list={listaId}
          value={texto}
          disabled={cheio}
          placeholder={cheio ? t("Máximo de {0} arquétipos", [MAX_ARQUETIPOS]) : t("Outro arquétipo (ex.: Kewl Tune)")}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionarDigitado();
            }
          }}
          aria-label={t("Vincular outro arquétipo")}
        />
        <button type="button" className="ghost-btn" disabled={cheio || !texto.trim()} onClick={adicionarDigitado}>
          {t("Vincular")}
        </button>
        <datalist id={listaId}>
          {db.archetypes.map((a) => (
            <option key={a} value={nome(a)} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
