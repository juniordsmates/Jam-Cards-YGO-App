import { useEffect, useState } from "react";
import ScreenShell from "./ScreenShell";
import { openConta } from "../components/Conta";
import { useConta } from "../db/conta";
import { meusPontos, PONTOS_POR_COMBO, rankingDuelistas, type Duelista, type Leitura } from "../db/conquistas";
import { t, LOCALE } from "../i18n";
import "./comunidade.css";

// Rank: os duelistas com mais pontos. Por enquanto, os pontos vêm só de combos compartilhados
// (5 cada, calculados pelo banco a partir dos combos; ver src/db/conquistas.ts).

const MEDALHA = ["🥇", "🥈", "🥉"];

export default function Rank({ onBack, onComunidade, onConquistas }: { onBack: () => void; onComunidade: () => void; onConquistas: () => void }) {
  const conta = useConta();
  const [lista, setLista] = useState<Leitura<Duelista[]> | null>(null);
  const [meus, setMeus] = useState<Awaited<ReturnType<typeof meusPontos>> | null>(null);

  useEffect(() => {
    let vivo = true;
    void rankingDuelistas().then((r) => vivo && setLista(r));
    return () => void (vivo = false);
  }, []);
  useEffect(() => {
    if (!conta) return setMeus(null);
    let vivo = true;
    void meusPontos(conta.id).then((r) => vivo && setMeus(r));
    return () => void (vivo = false);
  }, [conta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) => n.toLocaleString(LOCALE);

  return (
    <ScreenShell
      title={t("Rank")}
      accent="magenta"
      onBack={onBack}
      plain
      actions={
        <button className="ghost-btn" onClick={onConquistas}>
          {t("Conquistas")} →
        </button>
      }
    >
      <div className="rank">
        <section className="rank-topo">
          <div className="rank-regra">
            <h3>{t("Como ganhar pontos")}</h3>
            <p>
              {t("Compartilhar um combo:")} <strong>{t("{0} pts", [PONTOS_POR_COMBO])}</strong>
            </p>
            <p className="tags-note">
              {t("Vale o Combo da Comunidade compartilhado com todos (Combos ou Teste de Jogo). Tirar o compartilhamento ou excluir o combo tira os pontos dele; salvar o mesmo combo de novo não soma outra vez.")}
            </p>
            <button className="ghost-btn" onClick={onComunidade}>
              {t("Ver a Comunidade por arquétipo")} →
            </button>
          </div>
          <div className="rank-meus">
            {!conta ? (
              <>
                <p>{t("Entre na sua conta para pontuar e aparecer no Rank.")}</p>
                <button className="ghost-btn" onClick={() => openConta()}>
                  {t("Entrar")}
                </button>
              </>
            ) : meus?.ok ? (
              <>
                <span className="rank-meus-pts">{fmt(meus.dados.pontos)}</span>
                <span>{t("seus pontos")}</span>
                <small className="tags-note">
                  {meus.dados.posicao
                    ? t("{0}º lugar · {1} combo(s) compartilhado(s)", [meus.dados.posicao, meus.dados.combos])
                    : t("Compartilhe um combo para entrar no Rank.")}
                </small>
              </>
            ) : (
              <span className="tags-note">{meus ? "—" : t("Carregando…")}</span>
            )}
          </div>
        </section>

        <section className="rank-lista">
          <h3>{t("Duelistas com mais pontos")}</h3>
          {!lista ? (
            <p className="tags-note">{t("Carregando…")}</p>
          ) : !lista.ok ? (
            <p className="db-warning">{lista.indisponivel ? t("O Rank ainda não está ativo neste servidor (falta aplicar a atualização do banco das conquistas).") : lista.erro}</p>
          ) : !lista.dados.length ? (
            <p className="tags-note">{t("Ninguém pontuou ainda. Compartilhe o primeiro combo!")}</p>
          ) : (
            <ol className="rank-tabela">
              {lista.dados.map((d, i) => (
                <li key={d.usuario_id} className={d.usuario_id === conta?.id ? "rank-eu" : ""}>
                  <span className="rank-pos">{MEDALHA[i] ?? `${i + 1}º`}</span>
                  <span className="rank-nome">@{d.usuario}</span>
                  <span className="rank-combos">{t("{0} combo(s)", [d.combos_compartilhados])}</span>
                  <span className="rank-pts">{t("{0} pts", [fmt(d.pontos)])}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </ScreenShell>
  );
}
