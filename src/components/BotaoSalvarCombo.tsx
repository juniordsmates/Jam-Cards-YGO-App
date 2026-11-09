import { useState } from "react";
import type { ComboBase } from "../db/baseCombos";
import { removerSalvo, salvarCombo, useCombosSalvos } from "../db/combosSalvos";
import { t } from "../i18n";
import "../screens/meus-combos.css";

/** ☆ Salvar / ★ Salvo: põe o combo em Meus Combos (neste aparelho e, com conta, na conta) ou tira */
export default function BotaoSalvarCombo({ combo }: { combo: ComboBase }) {
  const { itens } = useCombosSalvos();
  const [erro, setErro] = useState<string | null>(null);
  const salvo = itens.some((i) => i.chave === combo.id);
  return (
    <>
      <button
        className={`ghost-btn combo-salvar ${salvo ? "salvo" : ""}`}
        aria-pressed={salvo}
        title={salvo ? t("Tirar de Meus Combos") : t("Salvar em Meus Combos (neste aparelho e, com conta, na conta)")}
        onClick={(e) => {
          // o botão fica no cabeçalho do combo: não abre nem fecha os detalhes
          e.preventDefault();
          e.stopPropagation();
          if (salvo) removerSalvo(combo.id);
          else setErro(salvarCombo(combo));
        }}
      >
        {salvo ? `★ ${t("Salvo")}` : `☆ ${t("Salvar")}`}
      </button>
      {erro && <small className="db-warning">{erro}</small>}
    </>
  );
}
