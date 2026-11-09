import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardPreview from "../components/CardPreview";
import { ComboCard } from "../components/ComboSearch";
import { initCardDb, useCardDb } from "../db/cardStore";
import { useCombosSalvos } from "../db/combosSalvos";
import { useConta } from "../db/conta";
import { deckDoCombo, type DeckTemporario } from "../db/decks";
import { FORMATS, type GameFormat } from "../db/legality";
import { normalize } from "../db/search";
import { displayName, type Card } from "../db/types";
import type { ComboTeste } from "./TesteJogo";
import "./combos.css";
import "./meus-combos.css";
import { t } from "../i18n";

// Meus Combos: os combos que o jogador salvou (☆ Salvar nos combos calculados, da Comunidade, de IA
// e nos próprios), do mais recente para o mais antigo, com busca e o Teste de Jogo de cada um.

export default function MeusCombos({ onBack, onTestar }: { onBack: () => void; onTestar: (deck: DeckTemporario, combo: ComboTeste) => void }) {
  const db = useCardDb();
  const conta = useConta();
  const { itens } = useCombosSalvos();
  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  useEffect(() => void initCardDb(), []);
  const [formato, setFormato] = useState<GameFormat>("TCG");
  const [filtro, setFiltro] = useState("");

  // prévia ao passar o mouse (mesmo popup da busca)
  const [hover, setHover] = useState<{ card: Card; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const onHover = useCallback((card: Card | null, el?: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (!card || !el) return setHover(null);
    hoverTimer.current = window.setTimeout(() => setHover({ card, rect: el.getBoundingClientRect() }), 300);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // busca pelo título, pelas cartas do combo (nome em português ou inglês) e pelos arquétipos
  const visiveis = useMemo(() => {
    const q = normalize(filtro.trim());
    if (!q) return itens;
    return itens.filter(({ combo }) => {
      const ids = [...combo.iniciais, ...combo.finais];
      const nomes = ids.map((id) => byId.get(id)).filter((c): c is Card => !!c).map((c) => `${displayName(c)} ${c.name}`);
      return normalize([combo.titulo, ...combo.arquetipos, ...nomes].join(" ")).includes(q);
    });
  }, [itens, filtro, byId]);

  const testar = (combo: (typeof itens)[number]["combo"]) =>
    onTestar(deckDoCombo({ mao: combo.iniciais, passos: combo.dados.passos, campo: combo.dados.campo }, byId, formato), {
      mao: combo.iniciais,
      passos: combo.dados.passos,
      qualquer: combo.dados.qualquer,
    });

  return (
    <ScreenShell
      title={t("Meus Combos")}
      accent="magenta"
      onBack={onBack}
      actions={
        <div className="format-switch combos-format" role="radiogroup" aria-label={t("Formato")}>
          {FORMATS.map((f) => (
            <button key={f} role="radio" aria-checked={formato === f} className={formato === f ? "active" : ""} onClick={() => setFormato(f)} title={t("Mostra se cada combo vale na banlist atual do {0}", [f])}>
              {f}
            </button>
          ))}
        </div>
      }
    >
      <div className="meus-combos">
        <p className="tags-note">
          {conta
            ? t("Combos salvos na sua conta: aparecem em qualquer aparelho em que você entrar.")
            : t("Combos salvos neste aparelho. Entre na conta para levá-los com você: os salvos aqui passam para ela.")}
        </p>
        {itens.length > 0 && (
          <label className="field meus-combos-busca">
            <span className="field-label">{t("Procurar (título, carta ou arquétipo)")}</span>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} autoComplete="off" />
          </label>
        )}
        {db.status !== "ready" ? (
          <div className="db-loading">
            <span className="spinner" />
            <p>{db.step ?? t("Carregando base de cartas…")}</p>
          </div>
        ) : !itens.length ? (
          <div className="combos-empty">
            <p>{t("Nenhum combo salvo ainda.")}</p>
            <small>{t("Use ☆ Salvar em qualquer combo (Combos, Guia de Deck, Comunidade) para guardá-lo aqui.")}</small>
          </div>
        ) : (
          <>
            <p className="tags-note">{t("{0} de {1} combo(s)", [visiveis.length, itens.length])}</p>
            {visiveis.map(({ chave, combo }) => (
              <ComboCard key={chave} combo={combo} byId={byId} onHover={onHover} highlight={new Set()} format={formato} onTestar={testar} />
            ))}
          </>
        )}
      </div>
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
