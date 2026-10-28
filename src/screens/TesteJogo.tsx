import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ehExtra } from "../db/decks";
import { cardImage } from "../db/images";
import { kindLabel, levelLabel } from "../db/labels";
import {
  aleatorio,
  alternar,
  comprar,
  chanceDeAbrir,
  probabilidadeDaMao,
  probabilidadeGeral,
  embaralharDeck,
  maoDoCombo,
  MAGIAS,
  MONSTROS,
  MONSTROS_EXTRA,
  mover,
  NOMES_ZONA,
  testeDeMao,
  ZONAS_UNICAS,
  type CartaJogo,
  type Tabuleiro,
  type ZonaId,
} from "../db/testeJogo";
import { categoryOf, displayName, type Card } from "../db/types";
import { passoEmTexto, type Passo } from "../db/motor";
import { groupSteps } from "../components/VerifiedCombos";
import { FontesButton } from "../components/Fontes";
import "./teste-jogo.css";

// Teste de Jogo (Solo Mode): sem regras de jogo; o jogador move as cartas à vontade.

const FASES = ["DP", "SP", "M1", "BP", "M2", "EP"] as const;
const PILHAS: ZonaId[] = ["deck", "extra", "cemiterio", "banido"];

type Menu = { uid: string; x: number; y: number } | null;

/** Linha de combo para o "Executar combo": mão inicial e passos */
export interface ComboTeste {
  mao: number[];
  passos: Passo[];
}

export default function TesteJogo({
  nome,
  main,
  extra,
  byId,
  onFechar,
  combo,
}: {
  nome: string;
  main: number[];
  extra: number[];
  byId: Map<number, Card>;
  onFechar: () => void;
  /** aberto pela tela de Combos: habilita o "Executar combo" */
  combo?: ComboTeste;
}) {
  // passo atual do "Executar combo" (null: caixa de passos fechada)
  const [passo, setPasso] = useState<number | null>(null);
  const grupos = combo ? groupSteps(combo.passos) : [];
  const textoPasso = (p: Passo) => {
    const t = passoEmTexto(p, (id) => (id === 0 ? "Ficha" : byId.get(id) ? displayName(byId.get(id)!) : `#${id}`));
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const [t, setT] = useState<Tabuleiro>(() => testeDeMao(main, extra));
  const [lp, setLp] = useState(8000);
  const [lpAjuste, setLpAjuste] = useState("");
  const [fase, setFase] = useState<(typeof FASES)[number]>("M1");
  const [preview, setPreview] = useState<Card | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  // clicar para mover: a carta clicada fica selecionada e o próximo clique numa zona a coloca lá
  const [selecionada, setSelecionada] = useState<string | null>(null);
  // brilho rápido na carta que ativou um efeito
  const [ativada, setAtivada] = useState<string | null>(null);
  // animação de embaralhar (setas em círculo sobre o Deck por 0,5 s)
  const [embaralhando, setEmbaralhando] = useState(false);
  const animarEmbaralhar = () => {
    setEmbaralhando(true);
    setTimeout(() => setEmbaralhando(false), 500);
  };
  const embaralhar = () => {
    setT((a) => embaralharDeck(a));
    animarEmbaralhar();
    registrar("Embaralhou o Deck.");
  };
  /**
   * Fecha a visualização; ao fechar a do Deck, só as cartas que ficaram no Deck são embaralhadas
   * (mão, campo, Cemitério e banidas continuam como estão), como no Duelingbook
   */
  const fecharLista = () => {
    if (lista === "deck") embaralhar();
    setLista(null);
  };
  const [lista, setLista] = useState<ZonaId | null>(null);
  const [log, setLog] = useState<string[]>(["Teste de Mão: Deck embaralhado, 5 cartas compradas."]);
  const arrastando = useRef<string | null>(null);

  const nomeDe = (c: CartaJogo) => {
    const card = byId.get(c.id);
    return card ? displayName(card) : `#${c.id}`;
  };
  const registrar = (msg: string) => setLog((l) => [msg, ...l].slice(0, 60));

  // Esc fecha o menu ou a lista; sem eles, volta ao editor (sem ir ao menu principal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (menu) setMenu(null);
      else if (selecionada) setSelecionada(null);
      else if (lista) fecharLista();
      else if (passo !== null) setPasso(null);
      else onFechar();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [menu, selecionada, lista, passo, onFechar]);

  const executarCombo = () => {
    if (!combo) return;
    setT(maoDoCombo(main, extra, combo.mao));
    setLp(8000);
    setFase("M1");
    setPasso(0);
    setLog([`Executar combo: mão inicial (${combo.mao.map((id) => (byId.get(id) ? displayName(byId.get(id)!) : id)).join(" + ")}).`]);
  };

  // ---------------------------------------------------------------- ações

  const moverPara = (uid: string, para: ZonaId, opts: Parameters<typeof mover>[3] = {}, texto?: string) => {
    setT((atual) => {
      const novo = mover(atual, uid, para, opts);
      return novo;
    });
    if (texto) registrar(texto);
    setMenu(null);
  };

  const livre = (zonas: ZonaId[]) => zonas.find((z) => !t[z].length);

  const acoes = (uid: string): { label: string; fazer: () => void }[] => {
    const achada = (Object.keys(t) as ZonaId[]).map((z) => ({ z, c: t[z].find((c) => c.uid === uid) })).find((x) => x.c);
    if (!achada?.c) return [];
    const { z, c } = achada;
    const card = byId.get(c.id);
    const n = nomeDe(c);
    const out: { label: string; fazer: () => void }[] = [];
    const noCampo = ZONAS_UNICAS.has(z);
    // ativar um efeito: em qualquer zona e posição, só registra (sem regras)
    out.push({
      label: "Ativar efeito",
      fazer: () => {
        const onde = z === "mao" ? "da mão" : z === "cemiterio" ? "no Cemitério" : z === "banido" ? "banida" : z === "deck" ? "no Deck" : z === "extra" ? "no Extra Deck" : `em ${NOMES_ZONA[z]}`;
        registrar(`Ativou o efeito de ${n} (${onde}${c.baixada ? ", virada para baixo" : c.defesa ? ", em defesa" : ""}).`);
        setAtivada(uid);
        setTimeout(() => setAtivada((a) => (a === uid ? null : a)), 1200);
        setMenu(null);
      },
    });
    const monstro = card && categoryOf(card) === "monster";
    if (!noCampo && monstro) {
      const zonaM = card && ehExtra(card) ? livre([...MONSTROS_EXTRA, ...MONSTROS]) : livre(MONSTROS);
      if (zonaM) {
        out.push({ label: "Invocar em ataque", fazer: () => moverPara(uid, zonaM, { baixada: false, defesa: false }, `Invocou ${n}.`) });
        out.push({ label: "Invocar em defesa", fazer: () => moverPara(uid, zonaM, { baixada: false, defesa: true }, `Invocou ${n} em defesa.`) });
        if (!card || !ehExtra(card)) out.push({ label: "Baixar (virado para baixo)", fazer: () => moverPara(uid, zonaM, { baixada: true, defesa: true }, `Baixou um monstro.`) });
      }
    }
    if (!noCampo && card && !monstro) {
      const campo = card.race === "Field";
      const zonaS = campo ? (t["campo-magia"].length ? undefined : "campo-magia") : livre(MAGIAS);
      if (zonaS) {
        out.push({ label: "Ativar", fazer: () => moverPara(uid, zonaS, { baixada: false }, `Ativou ${n}.`) });
        out.push({ label: "Baixar", fazer: () => moverPara(uid, zonaS, { baixada: true }, `Baixou uma carta.`) });
      }
    }
    if (noCampo) {
      out.push({ label: c.baixada ? "Virar para cima" : "Virar para baixo", fazer: () => { setT((a) => alternar(a, uid, "baixada")); registrar(`${c.baixada ? "Virou para cima" : "Virou para baixo"} ${n}.`); setMenu(null); } });
      if (monstro) out.push({ label: c.defesa ? "Posição de ataque" : "Posição de defesa", fazer: () => { setT((a) => alternar(a, uid, "defesa")); registrar(`Mudou a posição de ${n}.`); setMenu(null); } });
      if (c.materiais.length) out.push({ label: `Desanexar matéria (${c.materiais.length})`, fazer: () => moverPara(c.materiais[0].uid, "cemiterio", {}, `Desanexou ${nomeDe(c.materiais[0])}.`) });
    }
    out.push({ label: "Mover (clique na zona)", fazer: () => { setSelecionada(uid); setMenu(null); } });
    if (z !== "mao") out.push({ label: z === "deck" ? "Adicionar à mão" : "Para a mão", fazer: () => moverPara(uid, "mao", {}, `${n} foi para a mão${z === "deck" ? " (do Deck)" : ""}.`) });
    if (z !== "cemiterio") out.push({ label: "Para o Cemitério", fazer: () => moverPara(uid, "cemiterio", {}, `${n} foi para o Cemitério.`) });
    if (z !== "banido") out.push({ label: "Banir", fazer: () => moverPara(uid, "banido", {}, `Baniu ${n}.`) });
    if (card && ehExtra(card)) {
      if (z !== "extra") out.push({ label: "Para o Extra Deck", fazer: () => moverPara(uid, "extra", {}, `${n} voltou para o Extra Deck.`) });
    } else {
      out.push({ label: "Para o topo do Deck", fazer: () => moverPara(uid, "deck", { posicao: "topo" }, `${n} foi para o topo do Deck.`) });
      out.push({ label: "Para o fundo do Deck", fazer: () => moverPara(uid, "deck", { posicao: "fundo" }, `${n} foi para o fundo do Deck.`) });
    }
    return out;
  };

  const comprarUma = () => {
    if (!t.deck.length) return registrar("O Deck acabou.");
    registrar(`Comprou ${nomeDe(t.deck[0])}.`);
    setT((a) => comprar(a));
  };

  // ---------------------------------------------------------------- arrastar

  const arrastar = (uid: string) => (e: DragEvent) => {
    arrastando.current = uid;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", uid);
  };
  const soltar = (para: ZonaId) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const uid = arrastando.current;
    arrastando.current = null;
    if (uid) colocar(uid, para);
  };

  /** Coloca a carta na zona (arrastando ou clicando); em zona ocupada, vira matéria Xyz */
  const colocar = (uid: string, para: ZonaId) => {
    setSelecionada(null);
    const atual = (Object.keys(t) as ZonaId[]).find((z) => t[z].some((c) => c.uid === uid));
    if (atual === para) return;
    const c = (atual && t[atual].find((x) => x.uid === uid)) || null;
    const n = c ? nomeDe(c) : "Carta";
    const ocupada = ZONAS_UNICAS.has(para) && t[para].length > 0;
    // da mão para uma zona de Magia/Armadilha: entra virada para cima (ativar); botão direito tem "Baixar"
    moverPara(uid, para, {}, ocupada ? `${n} foi anexada como matéria.` : `${n} → ${NOMES_ZONA[para]}.`);
  };

  // ---------------------------------------------------------------- render

  // funções de desenho (não componentes): o React não recria o elemento a cada redesenho,
  // o que quebraria cliques e arrastos começados numa carta
  const carta = (c: CartaJogo, pequena = false) => {
    const card = byId.get(c.id);
    const verso = c.baixada;
    return (
      <div
        key={c.uid}
        className={`tj-carta ${c.defesa ? "tj-defesa" : ""} ${pequena ? "tj-pequena" : ""} ${selecionada === c.uid ? "tj-sel" : ""} ${ativada === c.uid ? "tj-ativa" : ""}`}
        draggable
        onDragStart={arrastar(c.uid)}
        onMouseEnter={() => card && setPreview(card)}
        onClick={(e) => {
          e.stopPropagation();
          const zonaDela = (Object.keys(t) as ZonaId[]).find((z) => t[z].some((x) => x.uid === c.uid));
          // com outra carta selecionada, clicar nesta coloca a selecionada na zona dela
          if (selecionada && selecionada !== c.uid && zonaDela) return colocar(selecionada, zonaDela);
          if (!selecionada && zonaDela && PILHAS.includes(zonaDela) && !pequena) return setLista(zonaDela);
          if (pequena && !selecionada) return setMenu({ uid: c.uid, x: e.clientX, y: e.clientY });
          setSelecionada(selecionada === c.uid ? null : c.uid);
        }}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault();
          setMenu({ uid: c.uid, x: e.clientX, y: e.clientY });
        }}
        title={card ? `${displayName(card)} — clique para selecionar e depois clique numa zona; botão direito para ações` : undefined}
        data-card-id={c.id}
      >
        {verso ? <div className="tj-verso" /> : <img src={cardImage(c.id, "small")} alt={card ? displayName(card) : ""} draggable={false} />}
        {c.materiais.length > 0 && <span className="tj-materiais" title="Matérias Xyz">{c.materiais.length}</span>}
      </div>
    );
  };

  const zona = (id: ZonaId) => {
    const cartas = t[id];
    const pilha = PILHAS.includes(id);
    return (
      <div
        key={id}
        className={`tj-zona tj-${id.replace(/\d/, "")} ${selecionada ? "tj-alvo" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={soltar(id)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (id === "deck") setLista("deck");
        }}
        onClick={() => {
          if (selecionada) return colocar(selecionada, id);
          if (id === "deck") return comprarUma();
          if (pilha && cartas.length) setLista(id);
        }}
        title={id === "deck" ? "Clique para comprar; botão direito para visualizar o Deck" : pilha ? `${NOMES_ZONA[id]} — clique para ver` : NOMES_ZONA[id]}
        data-zona={id}
      >
        {cartas[0] && (id === "deck" ? <div className="tj-verso" /> : carta(cartas[0]))}
        {id === "deck" && embaralhando && (
          <span className="tj-embaralhando" aria-label="Embaralhando">
            ⟳
          </span>
        )}
        {pilha && <span className="tj-contagem">{cartas.length}</span>}
        {!cartas.length && <span className="tj-rotulo">{id === "campo-magia" ? "Campo" : id === "cemiterio" ? "Cemitério" : id === "banido" ? "Banidas" : id === "extra" ? "Extra" : ""}</span>}
      </div>
    );
  };

  return (
    <div className="teste-jogo" onContextMenu={(e) => e.preventDefault()}>
      <aside className="tj-esq">
        {preview ? (
          <>
            <img src={cardImage(preview.id, "full")} alt={displayName(preview)} />
            <strong>{displayName(preview)}</strong>
            <small>
              {kindLabel(preview)}
              {categoryOf(preview) === "monster" && levelLabel(preview) && ` · ${levelLabel(preview)}`}
            </small>
            <p>{preview.descPt ?? preview.desc}</p>
          </>
        ) : (
          <p className="tags-note">Passe o mouse sobre uma carta para ver os detalhes.</p>
        )}
      </aside>

      <section className="tj-mesa">
        <div className="tj-campo">
          <div className="tj-l1">
            <span />
            <span />
            {zona("em0")}
            <span />
            {zona("em1")}
            <span />
            {zona("banido")}
          </div>
          <div className="tj-l2">
            {zona("campo-magia")}
            {MONSTROS.map((z) => zona(z))}
            {zona("cemiterio")}
          </div>
          <div className="tj-l3">
            {zona("extra")}
            {MAGIAS.map((z) => zona(z))}
            {zona("deck")}
          </div>
        </div>
        <div className="tj-mao-linha">
        <div className="tj-mao" onDragOver={(e) => e.preventDefault()} onDrop={soltar("mao")} onClick={() => selecionada && colocar(selecionada, "mao")} data-zona="mao">
          {t.mao.map((c) => {
            // chance de abrir ao menos 1 cópia numa mão de 5, pelas cópias no Deck testado
            const copias = main.filter((id) => id === c.id).length;
            const chance = chanceDeAbrir(main.length, copias, 5);
            return (
              <div key={c.uid} className="tj-mao-carta">
                {carta(c)}
                {copias > 0 && (
                  <span
                    className="tj-chance"
                    style={{ background: `hsl(${Math.round(chance * 220)} 75% 38%)` }}
                    title={`Chance de abrir ao menos 1 cópia numa mão de 5: ${copias} ${copias === 1 ? "cópia" : "cópias"} num Deck de ${main.length} (distribuição hipergeométrica, como nos calculadores de probabilidade).`}
                  >
                    {(chance * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                )}
              </div>
            );
          })}
          {!t.mao.length && <span className="tags-note">Mão vazia</span>}
        </div>
        {t.mao.length > 0 && (() => {
          const ids = t.mao.map((c) => c.id);
          // mão exata: estas cartas, em qualquer ordem; geral: qualquer mão com o mesmo perfil
          const p = probabilidadeDaMao(main, ids);
          const geral = probabilidadeGeral(main, ids);
          const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumSignificantDigits: 3 })}%`;
          return (
            <div className="tj-prob-mao">
              <span title={`Chance de abrir exatamente estas ${ids.length} cartas, em qualquer ordem, com este Deck de ${main.length} (hipergeométrica multivariada).`}>
                <span className="field-label">Esta mão</span> <strong>{p > 0 ? pct(p) : "—"}</strong>
                {p > 0 && <small> 1 em {Math.round(1 / p).toLocaleString("pt-BR")}</small>}
              </span>
              {geral.p > 0 && (
                <span className="tj-prob-geral" title={`Chance de abrir qualquer mão com o mesmo perfil: ${geral.perfil}.`}>
                  <span className="field-label">Geral</span> <strong>{pct(geral.p)}</strong> <small>{geral.perfil}</small>
                </span>
              )}
            </div>
          );
        })()}
        </div>
      </section>

      <aside className="tj-dir">
        <h3>{nome}</h3>
        <div className="tj-lp">
          <strong>{lp}</strong>
          <input
            inputMode="numeric"
            placeholder="±"
            value={lpAjuste}
            onChange={(e) => setLpAjuste(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const v = Number(lpAjuste);
              if (!Number.isNaN(v) && v) {
                setLp((x) => Math.max(0, x + v));
                registrar(`LP ${v > 0 ? "+" : ""}${v}.`);
              }
              setLpAjuste("");
            }}
            aria-label="Ajuste de LP (ex.: -1000)"
          />
        </div>
        <div className="tj-fases">
          {FASES.map((f) => (
            <button key={f} className={fase === f ? "active" : ""} onClick={() => setFase(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="tj-botoes">
          {combo && (
            <button className="ghost-btn tj-executar" onClick={executarCombo}>
              Executar combo
            </button>
          )}
          <button
            className="ghost-btn tj-teste-mao"
            title="Recolhe todas as cartas para o Deck e o Extra Deck, embaralha e compra 5 (Teste de Mão)"
            onClick={() => {
              setT(testeDeMao(main, extra));
              animarEmbaralhar();
              setLp(8000);
              setFase("M1");
              setSelecionada(null);
              setPasso(null);
              setLog(["Reiniciado: cartas recolhidas, Deck embaralhado, 5 cartas compradas."]);
            }}
          >
            Reiniciar (Teste de Mão)
          </button>
          <button className="ghost-btn" onClick={comprarUma}>Comprar</button>
          <button className="ghost-btn" onClick={embaralhar}>Embaralhar</button>
          <button className="ghost-btn tj-visualizar" onClick={() => setLista("deck")}>Visualizar Deck</button>
          <button className="ghost-btn" onClick={() => registrar(`Dado: ${aleatorio(6) + 1}.`)}>Dado</button>
          <button className="ghost-btn" onClick={() => registrar(`Moeda: ${aleatorio(2) ? "cara" : "coroa"}.`)}>Moeda</button>
          <button className="ghost-btn" onClick={onFechar}>Voltar ao editor</button>
        </div>
        <ol className="tj-log" aria-label="Histórico">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
        <p className="tags-note">
          Abaixo de cada carta da mão: a chance de abrir ao menos 1 cópia dela numa mão de 5 com este Deck.{" "}
          <FontesButton sites={["otterlord", "deck-probability", "deckcal"]} />
        </p>
        <p className="tags-note">
          Sem regras: arraste uma carta até a zona, ou clique nela e depois na zona; botão direito para ações. O embaralhamento usa o
          gerador aleatório criptográfico do sistema.
        </p>
      </aside>

      {combo && passo !== null && grupos[passo] && (
        <div className="tj-passo" role="status" aria-live="polite">
          <div className="tj-passo-cab">
            <strong>
              Passo {passo + 1} de {grupos.length}
            </strong>
            <button className="link-btn" onClick={() => setPasso(null)} aria-label="Fechar passos">
              ✕
            </button>
          </div>
          <p>{textoPasso(grupos[passo].step)}</p>
          {grupos[passo].subs.length > 0 && (
            <ul>
              {grupos[passo].subs.map((p, i) => (
                <li key={i}>↳ {textoPasso(p)}</li>
              ))}
            </ul>
          )}
          <div className="tj-passo-nav">
            <button className="ghost-btn" disabled={passo === 0} onClick={() => setPasso(passo - 1)}>
              ‹ Anterior
            </button>
            <button className="ghost-btn" disabled={passo >= grupos.length - 1} onClick={() => setPasso(passo + 1)}>
              Próximo ›
            </button>
          </div>
        </div>
      )}

      {lista && (
        <div className="tj-lista" role="dialog" aria-label={NOMES_ZONA[lista]}>
          <div className="fontes-head">
            <h4>
              {NOMES_ZONA[lista]} ({t[lista].length})
            </h4>
            <button className="ghost-btn" onClick={fecharLista} aria-label="Fechar">✕</button>
          </div>
          <div className="tj-lista-cartas">
            {t[lista].map((c) => carta({ ...c, baixada: false }, true))}
          </div>
          <p className="tags-note">
            Clique numa carta para ver as opções (mão, Cemitério, banir, Invocar, Ativar…) ou arraste-a para o campo.
            {lista === "deck" && " Ao fechar, o Deck é embaralhado."}
          </p>
        </div>
      )}

      {menu &&
        createPortal(
          <div className="tj-menu-fundo" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
            <ul className="tj-menu" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 320) }} onClick={(e) => e.stopPropagation()}>
              {acoes(menu.uid).map((a) => (
                <li key={a.label}>
                  <button onClick={a.fazer}>{a.label}</button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
