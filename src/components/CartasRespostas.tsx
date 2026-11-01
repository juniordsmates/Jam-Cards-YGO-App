import { useMemo, useState } from "react";
import { useCardDb } from "../db/cardStore";
import { EFFECT_KIND_LABELS, readCard } from "../db/effects";
import { respostasDaCarta, type RespostasAoEfeito } from "../db/indicar";
import { indiceDeRespostas } from "../db/respostas";
import { legalIn } from "../db/legality";
import { displayName, type Card } from "../db/types";
import { IDIOMA, LOCALE, t } from "../i18n";

// Buscar Carta → "Cartas respostas": o que pode responder a cada efeito ativado da carta, à Invocação
// dela e o que costuma ser usado contra ela parada no campo (ex.: Typhoon contra Magias de Campo e
// Contínuas). Mesmas regras das Indicações de resposta do Teste Avançado, mais as linhas do motor,
// das cartas mais usadas em torneios para as menos.

/** Respostas visíveis por grupo antes do "mostrar todas" */
const VISIVEIS = 5;

const pct = (x: number) => `${(x * 100).toLocaleString(LOCALE, { maximumFractionDigits: x < 0.1 ? 1 : 0 })}%`;

function Grupo({ g, card, onOpen }: { g: RespostasAoEfeito; card: Card; onOpen: (c: Card) => void }) {
  const [todas, setTodas] = useState(false);
  // texto do efeito no idioma do app (o português, quando a tradução bate frase a frase)
  const textoExibido = g.numero ? readCard(card, IDIOMA === "pt").effects[g.numero - 1]?.text : undefined;
  const titulo =
    g.tipo === "efeito" && g.efeito
      ? `${t("Efeito {0}", [g.numero])} · ${EFFECT_KIND_LABELS[g.efeito.kind]}${g.efeito.zone ? ` (${t(g.efeito.zone)})` : ""}`
      : g.tipo === "ativacao"
        ? t("Ativação da carta")
        : g.tipo === "invocacao"
        ? t("Quando é Invocada")
        : t("Parada no campo");
  const vis = todas ? g.itens : g.itens.slice(0, VISIVEIS);
  return (
    <details className="cr-grupo" open={g.tipo !== "campo" || g.itens.length <= VISIVEIS}>
      <summary>
        <strong>{titulo}</strong> <small>{t("{0} respostas", [g.itens.length])}</small>
      </summary>
      {textoExibido && <p className="cr-efeito">{textoExibido.length > 180 ? `${textoExibido.slice(0, 180)}…` : textoExibido}</p>}
      <ul>
        {vis.map((i) => (
          <li key={i.id}>
            {i.card ? (
              <button className="link-btn" onClick={() => onOpen(i.card!)}>
                {displayName(i.card)}
              </button>
            ) : (
              <span>#{i.id}</span>
            )}
            {i.card && !legalIn(i.card, "TCG") && <span className="cr-selo">{t("só OCG")}</span>}
            <small>
              {" "}
              — {i.motivo}
              {i.uso > 0 && ` · ${t("em {0} dos decks", [pct(i.uso)])}`}
              {!!i.motor && ` · ${t("motor · {0}", [i.motor])}`}
              {(i.fonte === "scripts" || i.fonte === "texto") && ` · ${t("confira")}`}
            </small>
          </li>
        ))}
      </ul>
      {g.itens.length > VISIVEIS && (
        <button className="link-btn" onClick={() => setTodas(!todas)}>
          {todas ? t("Mostrar menos") : t("Ver todas ({0})", [g.itens.length])}
        </button>
      )}
    </details>
  );
}

export default function CartasRespostas({ card, byId, byName, onOpen }: { card: Card; byId: Map<number, Card>; byName: Map<string, Card>; onOpen: (c: Card) => void }) {
  const extras = useCardDb().extras;
  const indice = useMemo(() => (extras?.combos ? indiceDeRespostas(extras.combos) : null), [extras?.combos]);
  const grupos = useMemo(
    () =>
      respostasDaCarta(card, {
        byId,
        byName,
        uso: extras?.uso,
        respondedores: extras?.respondedores,
        indice,
        // legal em algum formato (as só do OCG aparecem marcadas)
        legal: (c) => legalIn(c, "TCG") || legalIn(c, "OCG"),
      }),
    [card, byId, byName, extras?.uso, extras?.respondedores, indice],
  );
  if (!grupos.length) return null;
  return (
    <section className="drawer-section cartas-respostas">
      <h4>{t("Cartas respostas")}</h4>
      <p className="tags-note">
        {t("O que pode responder a cada efeito ativado desta carta, à Invocação dela e o que costuma ser usado contra ela no campo, das cartas mais usadas em torneios. Indicação pelas regras de cada carta e pelo motor de regras: confira o texto.")}
      </p>
      {grupos.map((g, i) => (
        <Grupo key={`${g.tipo}-${g.numero ?? i}`} g={g} card={card} onOpen={onOpen} />
      ))}
    </section>
  );
}
