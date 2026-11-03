import { useEffect, useState } from "react";
import { adicionarDesejos, DESEJO_MAX, useListaDesejos } from "../db/listaDesejos";
import { t } from "../i18n";
import "../screens/lista-desejos.css";

// "Adicionar à Lista de Desejos" de uma carta (painel da carta na Busca e no Editor de Deck):
// abre um campo de quantidade e soma à lista. Com a carta já na lista, mostra quantas há.

export default function BotaoDesejo({ cartaId, className = "" }: { cartaId: number; className?: string }) {
  const lista = useListaDesejos();
  const atual = lista.itens.find((i) => i.cartaId === cartaId)?.quantidade ?? 0;
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState("1");
  const [feito, setFeito] = useState(false);
  // outra carta no painel: começa fechado
  useEffect(() => {
    setAberto(false);
    setFeito(false);
    setQtd("1");
  }, [cartaId]);

  const n = Number(qtd);
  const valida = Number.isInteger(n) && n >= 1 && n <= DESEJO_MAX;
  const adicionar = () => {
    if (!valida) return;
    adicionarDesejos([{ cartaId, quantidade: n }], true);
    setAberto(false);
    setFeito(true);
    window.setTimeout(() => setFeito(false), 2500);
  };

  if (!aberto)
    return (
      <span className={`botao-desejo ${className}`}>
        <button className="ghost-btn" onClick={() => setAberto(true)} title={t("Adicionar à Lista de Desejos")}>
          {atual ? t("♥ Na Lista de Desejos ({0})", [atual]) : t("♡ Lista de Desejos")}
        </button>
        {feito && <small className="conta-ok">{t("✓ Adicionada")}</small>}
      </span>
    );
  return (
    <span className={`botao-desejo botao-desejo-aberto ${className}`}>
      <label>
        {t("Quantidade")}{" "}
        <input
          type="number"
          min={1}
          max={DESEJO_MAX}
          value={qtd}
          autoFocus
          onChange={(e) => setQtd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          aria-label={t("Quantidade para a Lista de Desejos")}
        />
      </label>
      <button className="ghost-btn" disabled={!valida} onClick={adicionar}>
        {t("Adicionar")}
      </button>
      <button className="link-btn" onClick={() => setAberto(false)}>
        {t("Cancelar")}
      </button>
    </span>
  );
}
