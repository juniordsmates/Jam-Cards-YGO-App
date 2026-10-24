import { useEffect, useState } from "react";
import {
  cachedTcgApi,
  fetchTcgApi,
  formatMoney,
  getExchangeRates,
  getTcgApiKey,
  setTcgApiKey,
  toBRL,
  type Currency,
  type ExchangeRates,
  type TcgApiResult,
} from "../db/prices";
import { isDesktop } from "../platform";
import type { Card } from "../db/types";

const SIGNUP_URL = "https://tcgapi.dev/signup/";

/** Valor na moeda original com o equivalente em reais ao lado */
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

/** Preços da carta em reais: YGOPRODeck (sempre) e TCG API por impressão (desktop, com chave) */
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

  const ygo = card.prices;
  const cm = Number(ygo?.cardmarket);
  const tp = Number(ygo?.tcgplayer);

  return (
    <section className="drawer-section prices-section">
      <h4>Preços</h4>

      <dl className="price-list">
        <div>
          <dt>Cardmarket (mínimo)</dt>
          <dd>
            <Money value={cm} currency="EUR" rates={rates} />
          </dd>
        </div>
        <div>
          <dt>TCGplayer (mínimo)</dt>
          <dd>
            <Money value={tp} currency="USD" rates={rates} />
          </dd>
        </div>
      </dl>

      <div className="tcgapi">
        <div className="tcgapi-head">
          <span className="field-label">TCGplayer por impressão</span>
          {tcg?.remaining !== undefined && <small>{tcg.remaining} consultas restantes hoje</small>}
        </div>

        {!isDesktop ? (
          <p className="tags-note">Disponível no app desktop: a TCG API só aceita consultas fora do navegador.</p>
        ) : !apiKey ? (
          <div className="tcgapi-key">
            <p className="tags-note">
              Para ver o preço de cada impressão, crie uma chave gratuita em{" "}
              <a href={SIGNUP_URL} target="_blank" rel="noreferrer">tcgapi.dev</a> (100 consultas por dia) e cole aqui. Ela fica
              guardada só neste computador.
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
            {tcg ? (
              tcg.prices.length === 0 ? (
                <p className="tags-note">A TCG API não tem preços para esta carta.</p>
              ) : (
                <table className="price-table">
                  <thead>
                    <tr>
                      <th>Coleção</th>
                      <th>Raridade</th>
                      <th>Mercado</th>
                      <th>Menor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tcg.prices.map((p, i) => (
                      <tr key={`${p.set}-${p.rarity}-${p.printing}-${i}`}>
                        <td>
                          {p.set}
                          {p.printing && <small>{p.printing}</small>}
                        </td>
                        <td>{p.rarity ?? "—"}</td>
                        <td><Money value={p.market} currency={p.currency} rates={rates} /></td>
                        <td><Money value={p.low} currency={p.currency} rates={rates} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
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
        Preços via YGOPRODeck e <a href="https://tcgapi.dev" target="_blank" rel="noreferrer">TCG API</a>.
      </p>
    </section>
  );
}
