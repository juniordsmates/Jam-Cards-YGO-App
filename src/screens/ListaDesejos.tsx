import { useEffect, useMemo, useState } from "react";
import ScreenShell from "./ScreenShell";
import CardPicker from "../components/CardPicker";
import { initCardDb, useCardDb } from "../db/cardStore";
import { copiasPorCarta, useColecao } from "../db/colecao";
import { useConta } from "../db/conta";
import { cardImage } from "../db/images";
import { adicionarDesejos, definirQuantidadeDesejo, DESEJO_MAX, juntarDesejosDaConta, removerDesejos, useListaDesejos } from "../db/listaDesejos";
import { normalize } from "../db/search";
import { displayName, type Card } from "../db/types";
import { t, LOCALE } from "../i18n";
import "./lista-desejos.css";

// Lista de Desejos: as cartas que o jogador quer conseguir, com a quantidade e quantas já tem na
// coleção. Cartas entram aqui (Adicionar cartas), pelo painel da carta (Busca, Editor de Deck,
// Coleção) e pelo Adicionar deck do Editor. "Selecionar" marca uma por uma ou todas para remover.

type Ordem = "nome" | "recentes" | "faltam";

export default function ListaDesejos({ onBack }: { onBack: () => void }) {
  const db = useCardDb();
  const conta = useConta();
  const { itens } = useListaDesejos();
  const { itens: itensColecao } = useColecao();
  const naColecao = useMemo(() => copiasPorCarta(itensColecao), [itensColecao]);
  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  useEffect(() => void initCardDb(), []);
  // com conta, junta a lista da conta com a deste aparelho
  useEffect(() => {
    if (conta) void juntarDesejosDaConta();
  }, [conta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // adicionar cartas (busca por nome)
  const [novas, setNovas] = useState<Card[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const adicionarNovas = () => {
    adicionarDesejos(novas.map((c) => ({ cartaId: c.id, quantidade: 1 })), true);
    setAviso(t("{0} carta(s) adicionada(s) à lista.", [novas.length]));
    setNovas([]);
  };

  // filtro, ordem e seleção
  const [filtro, setFiltro] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const linhas = useMemo(() => {
    const q = normalize(filtro.trim());
    const nome = (id: number) => (byId.get(id) ? displayName(byId.get(id)!) : `#${id}`);
    return itens
      .filter((i) => !q || normalize(nome(i.cartaId)).includes(q) || normalize(byId.get(i.cartaId)?.name ?? "").includes(q))
      .map((i) => ({ ...i, card: byId.get(i.cartaId), tenho: naColecao.get(i.cartaId) ?? 0 }))
      .sort((a, b) =>
        ordem === "nome"
          ? nome(a.cartaId).localeCompare(nome(b.cartaId), LOCALE)
          : ordem === "faltam"
            ? b.quantidade - b.tenho - (a.quantidade - a.tenho)
            : b.atualizadoEm.localeCompare(a.atualizadoEm),
      );
  }, [itens, filtro, ordem, byId, naColecao]);
  // a seleção só vale para cartas que ainda estão na lista
  useEffect(() => {
    setSelecionadas((s) => new Set([...s].filter((id) => itens.some((i) => i.cartaId === id))));
  }, [itens]);
  const todasVisiveis = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.cartaId));
  const alternar = (id: number) =>
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const alternarTodas = () => setSelecionadas(todasVisiveis ? new Set() : new Set(linhas.map((l) => l.cartaId)));
  const removerSelecionadas = () => {
    removerDesejos([...selecionadas]);
    setAviso(t("{0} carta(s) removida(s) da lista.", [selecionadas.size]));
    setSelecionadas(new Set());
    setConfirmar(false);
  };

  const copias = itens.reduce((s, i) => s + i.quantidade, 0);
  const faltam = itens.reduce((s, i) => s + Math.max(0, i.quantidade - (naColecao.get(i.cartaId) ?? 0)), 0);

  return (
    <ScreenShell title={t("Lista de Desejos")} accent="magenta" onBack={onBack} plain>
      <div className="desejos">
        <section className="ld-bloco ld-adicionar">
          <CardPicker
            label={t("Adicionar cartas")}
            cards={novas}
            onChange={setNovas}
            all={db.cards}
            format="TCG"
            placeholder={t("Nome da carta (português ou inglês)")}
            placeholderMore={t("Acrescentar outra carta…")}
          />
          <button className="ghost-btn" disabled={!novas.length} onClick={adicionarNovas}>
            {t("Adicionar à lista ({0})", [novas.length])}
          </button>
          <p className="tags-note">
            {t("Também dá para adicionar pelo painel da carta (Buscar Carta, Editor de Deck, Minha Coleção) e levar um deck inteiro pelo Editor de Deck (Adicionar deck).")}{" "}
            {conta ? t("A lista fica salva na sua conta.") : t("Sem login, a lista fica só neste aparelho.")}
          </p>
        </section>

        <section className="ld-bloco ld-lista">
          <header className="ld-topo">
            <strong>{t("{0} carta(s) · {1} cópia(s) · faltam {2} para a coleção", [itens.length, copias, faltam])}</strong>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder={t("Filtrar por nome")} aria-label={t("Filtrar por nome")} />
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label={t("Ordem")}>
              <option value="recentes">{t("Mais recentes")}</option>
              <option value="nome">{t("Nome")}</option>
              <option value="faltam">{t("O que mais falta")}</option>
            </select>
          </header>

          {itens.length > 0 && (
            <div className="ld-selecao">
              <label className="respostas-toggle">
                <input type="checkbox" checked={todasVisiveis} onChange={alternarTodas} /> {t("Selecionar todas")}
              </label>
              <span className="tags-note">{t("{0} selecionada(s)", [selecionadas.size])}</span>
              {confirmar ? (
                <>
                  <button className="danger-btn" onClick={removerSelecionadas}>
                    {t("Confirmar: remover {0}", [selecionadas.size])}
                  </button>
                  <button className="ghost-btn" onClick={() => setConfirmar(false)}>
                    {t("Cancelar")}
                  </button>
                </>
              ) : (
                <button className="ghost-btn" disabled={!selecionadas.size} onClick={() => setConfirmar(true)}>
                  {t("Remover selecionadas")}
                </button>
              )}
            </div>
          )}
          {aviso && <p className="conta-ok">{aviso}</p>}

          {!itens.length ? (
            <p className="tags-note ld-vazia">{t("Sua Lista de Desejos está vazia. Adicione cartas acima ou pelo painel de qualquer carta.")}</p>
          ) : !linhas.length ? (
            <p className="tags-note">{t("Nenhuma carta com esse nome na lista.")}</p>
          ) : (
            <ul className="ld-itens">
              {linhas.map((l) => (
                <li key={l.cartaId} className={`${selecionadas.has(l.cartaId) ? "ld-sel" : ""} ${l.tenho >= l.quantidade ? "ld-completa" : ""}`}>
                  <input type="checkbox" checked={selecionadas.has(l.cartaId)} onChange={() => alternar(l.cartaId)} aria-label={t("Selecionar {0}", [l.card ? displayName(l.card) : `#${l.cartaId}`])} />
                  {l.card ? <img src={cardImage(l.card.id, "small")} alt="" loading="lazy" /> : <span className="ld-sem-img" />}
                  <span className="ld-nome">
                    <strong>{l.card ? displayName(l.card) : `#${l.cartaId}`}</strong>
                    <small>{l.tenho >= l.quantidade ? t("✓ Já tenho {0} na coleção", [l.tenho]) : t("Tenho {0} · faltam {1}", [l.tenho, l.quantidade - l.tenho])}</small>
                  </span>
                  <span className="ld-qtd">
                    <button className="ghost-btn" disabled={l.quantidade <= 1} onClick={() => definirQuantidadeDesejo(l.cartaId, l.quantidade - 1)} aria-label={t("Menos uma")}>
                      −
                    </button>
                    <span>{l.quantidade}</span>
                    <button className="ghost-btn" disabled={l.quantidade >= DESEJO_MAX} onClick={() => definirQuantidadeDesejo(l.cartaId, l.quantidade + 1)} aria-label={t("Mais uma")}>
                      +
                    </button>
                  </span>
                  <button className="link-btn ld-tirar" onClick={() => removerDesejos([l.cartaId])} title={t("Tirar da lista")} aria-label={t("Tirar da lista")}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ScreenShell>
  );
}
