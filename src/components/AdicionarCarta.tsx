import { useMemo, useState } from "react";
import { cardImage } from "../db/images";
import { legalIn, type GameFormat } from "../db/legality";
import { ehExtra } from "../db/decks";
import { archetypeKey, normalize } from "../db/search";
import { bilingualName, categoryOf, displayName, type Card } from "../db/types";
import { t } from "../i18n";

// Teste Avançado → "Adicionar carta ao oponente": as cartas do oponente não saem de deck nenhum;
// o jogador escolhe a carta e onde ela entra (mão, campo, Cemitério, banidas). "Colocar" só monta o
// cenário; "Invocar"/"Ativar" contam como ação do oponente e geram as indicações de resposta.

export type Destino = "mao" | "monstro" | "monstro-defesa" | "monstro-baixado" | "magia" | "magia-baixada" | "cemiterio" | "banido";

const SUGESTOES = 8;

export default function AdicionarCarta({
  cards,
  formato,
  onAdicionar,
  onFechar,
}: {
  cards: Card[];
  formato: GameFormat;
  /** comoAcao: Invocar/Ativar (o oponente age) em vez de só colocar */
  onAdicionar: (card: Card, destino: Destino, comoAcao: boolean) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<Card | null>(null);
  const sugestoes = useMemo(() => {
    const q = normalize(busca);
    if (q.length < 2) return [];
    const termos = q.split(" ");
    return cards
      .filter((c) => c.frame !== "skill" && c.frame !== "token" && termos.every((t) => c.key.includes(t) || archetypeKey(c).includes(t)))
      .sort((a, b) => Number(legalIn(b, formato)) - Number(legalIn(a, formato)) || (b.views ?? 0) - (a.views ?? 0))
      .slice(0, SUGESTOES);
  }, [busca, cards, formato]);

  const monstro = escolhida && categoryOf(escolhida) === "monster";
  const extra = escolhida && ehExtra(escolhida);
  const botoes: { destino: Destino; label: string; acao?: boolean }[] = !escolhida
    ? []
    : monstro
      ? [
          ...(extra ? [] : [{ destino: "mao" as const, label: t("Para a mão") }]),
          { destino: "monstro", label: t("Colocar no campo (ataque)") },
          { destino: "monstro-defesa", label: t("Colocar no campo (defesa)") },
          ...(extra ? [] : [{ destino: "monstro-baixado" as const, label: t("Colocar baixado") }]),
          { destino: "monstro", label: extra ? t("Invocar do Extra Deck (ação)") : t("Invocar por Invocação-Especial (ação)"), acao: true },
          { destino: "cemiterio", label: t("Para o Cemitério") },
          { destino: "banido", label: t("Banir") },
        ]
      : [
          { destino: "mao", label: t("Para a mão") },
          { destino: "magia-baixada", label: t("Baixar no campo") },
          { destino: "magia", label: t("Colocar virada para cima") },
          { destino: "magia", label: t("Ativar (ação)"), acao: true },
          { destino: "cemiterio", label: t("Para o Cemitério") },
          { destino: "banido", label: t("Banir") },
        ];

  return (
    <div className="tj-criar-fundo" onClick={onFechar}>
      <div className="tj-criar tj-adicionar" role="dialog" aria-label={t("Adicionar carta ao oponente")} onClick={(e) => e.stopPropagation()}>
        <div className="fontes-head">
          <h4>{t("Adicionar carta ao oponente")}</h4>
          <button className="ghost-btn" onClick={onFechar} aria-label={t("Fechar")}>
            ✕
          </button>
        </div>
        <p className="tags-note">
          {t("As cartas do oponente não saem de um deck: adicione só o que precisar. “Colocar” monta o cenário; as opções com “(ação)” contam como jogada do oponente e mostram o que você pode responder.")}</p>
        <label className="field">
          <span className="field-label">{t("Carta (português ou inglês)")}</span>
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("ex.: Ash Blossom, Infinite Impermanence…")} aria-label={t("Buscar carta")} />
        </label>
        {sugestoes.length > 0 && (
          <ul className="tj-adicionar-sugestoes">
            {sugestoes.map((c) => (
              <li key={c.id}>
                <button className={escolhida?.id === c.id ? "active" : ""} onClick={() => setEscolhida(c)} title={bilingualName(c)}>
                  <img src={cardImage(c.id, "small")} alt="" loading="lazy" />
                  <span>{displayName(c)}</span>
                  {!legalIn(c, formato) && <em>{t("fora do {0}", [formato])}</em>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {escolhida && (
          <div className="tj-adicionar-destinos">
            <span className="field-label">{displayName(escolhida)}</span>
            {botoes.map((b) => (
              <button key={b.label} className={`ghost-btn ${b.acao ? "tj-adicionar-acao" : ""}`} onClick={() => onAdicionar(escolhida, b.destino, !!b.acao)}>
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
