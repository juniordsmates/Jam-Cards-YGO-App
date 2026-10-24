import { useEffect, useState } from "react";
import ExternalLink from "./ExternalLink";
import {
  cachedTcgApi,
  fetchTcgApi,
  formatMoney,
  getExchangeRates,
  getTcgApiKey,
  matchPrinting,
  setTcgApiKey,
  toBRL,
  type Currency,
  type ExchangeRates,
  type PrintingPrice,
  type TcgApiResult,
} from "../db/prices";
import { rarityInfo } from "../db/rarities";
import { isDesktop } from "../platform";
import type { Card } from "../db/types";

const SIGNUP_URL = "https://tcgapi.dev/signup/";

/** Valor em reais em destaque, com a moeda original embaixo */
function Money({ value, currency, rates }: { value?: number; currency: Currency; rates?: ExchangeRates }) {
  if (value === undefined || Number.isNaN(value) || value <= 0) return <span className="money-empty">—</span>;
  const brl = toBRL(value, currency, rates);
  return (
    <span className="money">
      {brl !== undefined && <strong>{formatMoney(brl, "BRL")}</strong>}
      {currency !== "BRL" && <small>{formatMoney(value, currency)}</small>}
    </span>
  );
}

/** Raridade resumida em sigla colorida (nome completo no title) */
export function RarityBadge({ rarity }: { rarity?: string }) {
  const r = rarityInfo(rarity);
  return (
    <span className="rarity" style={{ background: r.color }} title={r.name}>
      {r.code}
    </span>
  );
}

/**
 * Coleções (com o preço de cada versão) e, depois, os preços: mínimos da YGOPRODeck e a TCG API.
 * Preço da versão: médio da TCG API quando a carta já foi consultada; senão, o da YGOPRODeck.
 */
export default function CardPrices({ card }: { card: Card }) {
  const [rates, setRates] = useState<ExchangeRates>();
  const [apiKey, setApiKey] = useState(getTcgApiKey);
  const [keyDraft, setKeyDraft] = useState("");
  const [tcg, setTcg] = useState<TcgApiResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getExchangeRates().then(setRates);
  }, []);

  // resultado guardado (até 24 horas) aparece sem gastar consulta
  useEffect(() => {
    setTcg(undefined);
    setError("");
    void cachedTcgApi(card).then(setTcg);
  }, [card]);

  const consult = async () => {
    setLoading(true);
    setError("");
    try {
      setTcg(await fetchTcgApi(card, apiKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveKey = () => {
    setTcgApiKey(keyDraft);
    setApiKey(keyDraft.trim());
    setKeyDraft("");
  };

  // cada coleção com a impressão correspondente da TCG API (se houver)
  const tcgPrices = tcg?.prices ?? [];
  const matched = new Set<PrintingPrice>();
  const rows = card.sets.map((s) => {
    const printing = matchPrinting(tcgPrices, s.name, s.rarity);
    if (printing) matched.add(printing);
    const ygoPrice = Number(s.price);
    const tcgValue = printing?.median ?? printing?.market;
    return {
      set: s,
      value: tcgValue ?? (ygoPrice > 0 ? ygoPrice : undefined),
      currency: (printing?.currency ?? "USD") as Currency,
      source: tcgValue !== undefined ? "Preço médio na TCG API" : ygoPrice > 0 ? "Preço na YGOPRODeck" : "Sem preço",
    };
  });
  const unmatched = tcgPrices.filter((p) => !matched.has(p));

  const ygo = card.prices;

  return (
    <>
      {card.sets.length > 0 && (
        <section className="drawer-section">
          <h4>Coleções ({card.sets.length})</h4>
          <ul className="sets">
            {rows.map(({ set, value, currency, source }) => (
              <li key={`${set.code}-${set.rarity}`}>
                <code>{set.code}</code>
                <span>{set.name}</span>
                <span className="set-rarity">
                  <RarityBadge rarity={set.rarity} />
                  <span title={source}>
                    <Money value={value} currency={currency} rates={rates} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="tags-note">
            Preço de cada versão: médio na TCG API quando a carta já foi consultada; senão, o da YGOPRODeck.
          </p>
        </section>
      )}

      <section className="drawer-section prices-section">
        <h4>Preços</h4>

        <dl className="price-list">
          <div>
            <dt>Cardmarket (mínimo)</dt>
            <dd>
              <Money value={Number(ygo?.cardmarket)} currency="EUR" rates={rates} />
            </dd>
          </div>
          <div>
            <dt>TCGplayer (mínimo)</dt>
            <dd>
              <Money value={Number(ygo?.tcgplayer)} currency="USD" rates={rates} />
            </dd>
          </div>
        </dl>

        <div className="tcgapi">
          <div className="tcgapi-head">
            <span className="field-label">TCG API</span>
            {tcg?.remaining !== undefined && <small>{tcg.remaining} consultas restantes hoje</small>}
          </div>

          {!isDesktop ? (
            <p className="tags-note">Disponível no app desktop: a TCG API só aceita consultas fora do navegador.</p>
          ) : !apiKey ? (
            <div className="tcgapi-key">
              <p className="tags-note">
                Para ver o preço médio de cada versão, crie uma chave gratuita em{" "}
                <ExternalLink href={SIGNUP_URL}>tcgapi.dev</ExternalLink> (100 consultas por dia) e cole aqui. Ela
                fica guardada só neste computador.
              </p>
              <div className="tcgapi-key-row">
                <input
                  type="password"
                  placeholder="Chave da TCG API"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  aria-label="Chave da TCG API"
                />
                <button className="ghost-btn" onClick={saveKey} disabled={!keyDraft.trim()}>
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <>
              {tcg && tcg.prices.length === 0 && <p className="tags-note">A TCG API não tem preços para esta carta.</p>}
              {unmatched.length > 0 && (
                <>
                  <p className="tags-note">Outras impressões na TCG API (fora da lista de coleções):</p>
                  <table className="price-table">
                    <thead>
                      <tr>
                        <th>Coleção</th>
                        <th>Raridade</th>
                        <th>Médio</th>
                        <th>Menor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatched.map((p, i) => (
                        <tr key={`${p.set}-${p.rarity}-${p.printing}-${i}`}>
                          <td>
                            {p.set}
                            {p.printing && <small>{p.printing}</small>}
                          </td>
                          <td><RarityBadge rarity={p.rarity} /></td>
                          <td><Money value={p.median ?? p.market} currency={p.currency} rates={rates} /></td>
                          <td><Money value={p.low} currency={p.currency} rates={rates} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {!tcg && (
                <p className="tags-note">Cada consulta gasta 1 das consultas diárias do seu plano; o resultado fica guardado por 24 horas.</p>
              )}
              <div className="tcgapi-actions">
                <button className="ghost-btn" onClick={() => void consult()} disabled={loading}>
                  {loading ? "Consultando…" : tcg ? "Atualizar preços" : "Consultar preços"}
                </button>
                <button
                  className="link-btn"
                  onClick={() => {
                    setTcgApiKey("");
                    setApiKey("");
                  }}
                >
                  Trocar chave
                </button>
              </div>
              {error && <p className="db-warning">{error}</p>}
              {tcg && <p className="tags-note">Consultado em {new Date(tcg.fetchedAt).toLocaleString("pt-BR")}.</p>}
            </>
          )}
        </div>

        <p className="tags-note price-foot">
          {rates
            ? `Valores em reais convertidos pela cotação de ${rates.quotedAt.slice(8, 10)}/${rates.quotedAt.slice(5, 7)} (US$ 1 = ${formatMoney(rates.USD, "BRL")}, € 1 = ${formatMoney(rates.EUR, "BRL")}). `
            : "Sem cotação do dia: valores só na moeda original. "}
          Preços via YGOPRODeck e <ExternalLink href="https://tcgapi.dev">TCG API</ExternalLink>.
        </p>
      </section>
    </>
  );
}
