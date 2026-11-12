// Meta Call → "Aplicar Deck": o deck do jogador em imagens (Main, Extra e Side), com a borda destacada
// nas cartas que servem contra os decks esperados, os confrontos de cada uma e a chance de abrir
// (o mesmo cálculo do Teste de Jogo: hipergeométrica, ao menos 1 cópia na mão inicial).
import { useMemo, useState, type PointerEvent } from "react";
import type { Deck } from "../db/decks";
import { cardImage } from "../db/images";
import type { Recomendacao } from "../db/metaCall";
import { chanceDeAbrir, chanceDeAbrirAoMenos } from "../db/testeJogo";
import { displayName, type Card } from "../db/types";
import { LOCALE, t } from "../i18n";

/** nota a partir da qual a carta "serve" contra o deck (a mesma faixa das recomendações boas) */
const SERVE = 0.3;

/** eficácia pela nota contra o confronto: Alta (verde), Média (amarela), Baixa (vermelha) */
const EFICACIA = [
  { min: 0.6, id: "alta", rotulo: t("Alta") },
  { min: SERVE, id: "media", rotulo: t("Média") },
  { min: -1, id: "baixa", rotulo: t("Baixa") },
] as const;
const eficaciaDe = (nota: number) => EFICACIA.find((e) => nota >= e.min)!;

const pct = (x: number) => `${(x * 100).toLocaleString(LOCALE, { maximumFractionDigits: x < 0.1 ? 1 : 0 })}%`;

type Parte = "main" | "extra" | "side";

interface Props {
  deck: Deck;
  /** arquétipos escolhidos no Meta Call, na ordem da tela */
  arquetipos: string[];
  recs: Recomendacao[];
  byId: Map<number, Card>;
  comPrevia: (c: Card) => { onPointerEnter: (e: PointerEvent<HTMLElement>) => void; onPointerLeave: () => void };
}

export default function DeckNoMeta({ deck, arquetipos, recs, byId, comPrevia }: Props) {
  // confronto em foco: só as cartas que servem contra ele ficam destacadas
  const [foco, setFoco] = useState<string | null>(null);
  const canon = (id: number) => byId.get(id)?.id ?? id;
  const porCarta = useMemo(() => new Map(recs.map((r) => [r.id, r])), [recs]);

  /** contra quais decks a carta serve (nota de cada um) */
  const serveContra = (id: number) => (porCarta.get(canon(id))?.porDeck ?? []).filter((n) => n.nota >= SERVE);
  const copias = (lista: number[], id: number) => lista.filter((x) => canon(x) === canon(id)).length;
  const N = deck.main.length;

  // resumo por confronto: cópias úteis no Main e no Side e a chance de abrir ao menos uma
  const resumo = useMemo(
    () =>
      arquetipos.map((arq) => {
        const util = (ids: number[]) => ids.filter((id) => serveContra(id).some((n) => n.arquetipo === arq));
        const main = util(deck.main);
        const side = util(deck.side);
        // ao menos 1, 2 e 3 cartas úteis na mão: [5 cartas (indo primeiro), 6 (indo segundo)]
        const abre = (k: number) => [1, 2, 3].map((m) => [chanceDeAbrirAoMenos(N, k, m, 5), chanceDeAbrirAoMenos(N, k, m, 6)] as const);
        return {
          arq,
          main: main.length,
          side: side.length,
          abre: abre(main.length),
          // jogo 2: as do Side entram no lugar de cartas que não servem (o Main fica do mesmo tamanho)
          comSide: abre(Math.min(N, main.length + side.length)),
        };
      }),
    [arquetipos, deck, porCarta], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const carta = (id: number, parte: Parte, i: number) => {
    const c = byId.get(id);
    const contra = parte === "extra" ? [] : serveContra(id);
    const destaque = foco ? contra.some((n) => n.arquetipo === foco) : contra.length > 0;
    // chance de abrir: no Main, com as cópias dele; no Side, depois de entrar no lugar de outra carta
    const k = parte === "side" ? copias(deck.side, id) : copias(deck.main, id);
    const titulo = c
      ? contra.length
        ? `${displayName(c)} — ${t("serve contra: {0}", [contra.map((n) => `${n.arquetipo} (${pct(n.nota)})`).join(", ")])} · ${parte === "side" ? t("depois de entrar do Side: abre em {0}", [pct(chanceDeAbrir(N, k))]) : t("abre em {0} (5 cartas)", [pct(chanceDeAbrir(N, k))])}`
        : displayName(c)
      : `#${id}`;
    // eficácia: contra o confronto em foco ou, em "Todos", a média ponderada pelos % dos decks esperados
    const r = parte === "extra" ? undefined : porCarta.get(canon(id));
    const nota = r ? (foco ? (r.porDeck.find((n) => n.arquetipo === foco)?.nota ?? 0) : r.contra) : undefined;
    const ef = nota !== undefined ? eficaciaDe(nota) : undefined;
    return (
      <figure key={`${parte}-${i}`} className={`dm-carta ${destaque ? "dm-destaque" : contra.length || foco ? "dm-apagada" : ""}`} title={titulo} {...(c ? comPrevia(c) : {})}>
        {c ? <img src={cardImage(c.id, "small")} alt={displayName(c)} loading="lazy" /> : <span className="dm-sem">#{id}</span>}
        {(destaque || ef) && (
          <figcaption>
            {destaque && <span className="dm-pct">{pct(chanceDeAbrir(N, k))}</span>}
            {ef && (
              <span className={`dm-ef dm-ef-${ef.id}`} title={t("Eficácia {0} ({1})", [ef.rotulo, pct(nota!)])}>
                {ef.rotulo}
              </span>
            )}
          </figcaption>
        )}
      </figure>
    );
  };

  const faixa = (parte: Parte, rotulo: string, ids: number[]) =>
    ids.length ? (
      <div className={`dm-faixa dm-${parte}`}>
        <span className="dm-rotulo">
          {rotulo} <small>{ids.length}</small>
        </span>
        <div className="dm-grade">{ids.map((id, i) => carta(id, parte, i))}</div>
      </div>
    ) : null;

  // cartas úteis do deck, uma vez cada, com os confrontos
  const uteis = useMemo(() => {
    const vistos = new Set<number>();
    const out: { id: number; parte: "main" | "side"; contra: ReturnType<typeof serveContra>; k: number }[] = [];
    for (const parte of ["main", "side"] as const)
      for (const id of deck[parte]) {
        const c = canon(id);
        if (vistos.has(c)) continue;
        const contra = serveContra(id);
        if (!contra.length) continue;
        vistos.add(c);
        out.push({ id, parte, contra, k: copias(deck[parte], id) });
      }
    return out;
  }, [deck, porCarta]); // eslint-disable-line react-hooks/exhaustive-deps

  // cartas de resposta do deck que quase não servem contra estes decks (com a melhor nota entre eles)
  const fracas = useMemo(() => {
    const vistos = new Set<number>();
    const out: { id: number; parte: "main" | "side"; melhor: { arquetipo: string; nota: number } | undefined }[] = [];
    for (const parte of ["main", "side"] as const)
      for (const id of deck[parte]) {
        const c = canon(id);
        const r = porCarta.get(c);
        if (!r || vistos.has(c) || serveContra(id).length) continue;
        vistos.add(c);
        const melhor = [...r.porDeck].sort((a, b) => b.nota - a.nota)[0];
        out.push({ id, parte, melhor });
      }
    return out;
  }, [deck, porCarta]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="dm" aria-label={t("Seu deck contra este meta")}>
      <header className="dm-cab">
        <h3>{t("{0} contra este meta", [deck.nome])}</h3>
        <div className="dm-focos" role="radiogroup" aria-label={t("Destacar as cartas contra")}>
          <button role="radio" aria-checked={!foco} className={!foco ? "active" : ""} onClick={() => setFoco(null)}>
            {t("Todos")}
          </button>
          {arquetipos.map((a) => (
            <button key={a} role="radio" aria-checked={foco === a} className={foco === a ? "active" : ""} onClick={() => setFoco(foco === a ? null : a)}>
              {a}
            </button>
          ))}
        </div>
      </header>

      <table className="dm-resumo">
        <thead>
          <tr>
            <th>{t("Confronto")}</th>
            <th>{t("Cartas úteis no Main")}</th>
            <th>{t("Ao menos 1")}</th>
            <th>{t("Ao menos 2")}</th>
            <th>{t("Ao menos 3")}</th>
            <th>{t("No Side")}</th>
            <th>{t("Jogo 2, com o Side (1 / 2 / 3)")}</th>
          </tr>
        </thead>
        <tbody>
          {resumo.map((r) => (
            <tr key={r.arq} className={foco === r.arq ? "dm-linha-foco" : ""} onClick={() => setFoco(foco === r.arq ? null : r.arq)}>
              <td>{r.arq}</td>
              <td>{r.main}</td>
              {r.abre.map(([cinco, seis], m) => (
                <td key={m} title={t("{0} indo primeiro (5 cartas) · {1} indo segundo (6 cartas)", [pct(cinco), pct(seis)])}>
                  <strong>{pct(cinco)}</strong> / {pct(seis)}
                </td>
              ))}
              <td>{r.side}</td>
              <td>{r.side ? r.comSide.map(([cinco]) => pct(cinco)).join(" / ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {faixa("main", t("Main"), deck.main)}
      {faixa("extra", t("Extra"), deck.extra)}
      {deck.side.length ? (
        faixa("side", t("Side"), deck.side)
      ) : (
        <div className="dm-faixa dm-side">
          <span className="dm-rotulo">
            {t("Side")} <small>0</small>
          </span>
          <small className="tags-note">{t("Side vazio: monte até 15 cartas no Editor de Deck (Shift+clique na busca). A sugestão de Side do Meta Call está logo abaixo.")}</small>
        </div>
      )}

      {uteis.length ? (
        <ul className="dm-lista">
          {uteis
            .filter((u) => !foco || u.contra.some((n) => n.arquetipo === foco))
            .map((u) => {
              const c = byId.get(u.id);
              return (
                <li key={`${u.parte}-${u.id}`}>
                  <strong>
                    {c ? displayName(c) : `#${u.id}`} ×{u.k}
                    {u.parte === "side" && <small className="dm-selo-side"> {t("Side")}</small>}
                  </strong>
                  <small>
                    {t("abre em {0}", [pct(chanceDeAbrir(N, u.k))])}
                    {u.parte === "side" && ` ${t("(depois de entrar do Side)")}`} · {u.contra.map((n) => `${n.arquetipo}: ${n.motivo}`).join(" · ")}
                  </small>
                </li>
              );
            })}
        </ul>
      ) : (
        <p className="tags-note">{t("Nenhuma carta do seu deck aparece entre as recomendações contra os decks escolhidos.")}</p>
      )}
      {fracas.length > 0 && (
        <p className="tags-note dm-fracas">
          {t("Pouco servem contra estes decks:")}{" "}
          {fracas
            .map((f) => {
              const c = byId.get(f.id);
              const nome = c ? displayName(c) : `#${f.id}`;
              return `${nome}${f.parte === "side" ? ` (${t("Side")})` : ""}${f.melhor ? ` — ${t("melhor contra {0}: {1}", [f.melhor.arquetipo, pct(f.melhor.nota)])}` : ""}`;
            })
            .join("; ")}
        </p>
      )}
      <small className="tags-note">{t("Eficácia: a nota da carta contra o confronto em foco (em \"Todos\", a média ponderada pelos % dos decks esperados): Alta a partir de 60%, Média a partir de 30%, Baixa abaixo disso.")}{" "}
        {t("Chance de abrir ao menos 1, 2 ou 3 cartas úteis na mão inicial (5 cartas indo primeiro / 6 indo segundo), pelo mesmo cálculo do Teste de Jogo. Nas cartas, a chance de abrir ao menos 1 cópia. As do Side contam como se entrassem no lugar de cartas que não servem no confronto.")}</small>
    </section>
  );
}
