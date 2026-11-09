import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { OcgLocation as L, OcgMessageType as T, OcgPhase, OcgResponseType as R, type OcgResponse, type SelectFieldPlace } from "ocgcore-wasm";
import ScreenShell from "./ScreenShell";
import Lateral from "../components/Lateral";
import { useCardDb } from "../db/cardStore";
import { useDecks } from "../db/decks";
import { cardImage } from "../db/images";
import { kindLabel } from "../db/labels";
import { displayName, type Card } from "../db/types";
import { aleatorio } from "../db/testeJogo";
import { t } from "../i18n";
import { ClienteSim, obterPacote } from "../sim/cliente";
import { zonasLivres } from "../sim/opcoes";
import type { LinhaIA, NivelIA } from "../sim/ia";
import type { CartaSim, EventoSim, PedidoSim, Quadro } from "../sim/sessao";
import type { DeckSim } from "../sim/regras";
import "./teste-jogo.css";
import "./simulador.css";

// Simulador: duelo com as regras do jogo (motor do EDOPro, Project Ignis) contra a IA, com o seu
// deck e um deck seu ou do meta. O motor e a IA rodam num Worker (src/sim/); esta tela mostra o
// campo e pergunta ao jogador cada decisão que o motor pede.

const NIVEIS: { id: NivelIA; label: string; hint: string }[] = [
  { id: "passiva", label: t("Passiva"), hint: t("Só passa a vez: para treinar os seus combos") },
  { id: "facil", label: t("Fácil"), hint: t("Joga sem planejar e quase não responde") },
  { id: "normal", label: t("Normal"), hint: t("Planeja o turno e responde às vezes") },
  { id: "dificil", label: t("Difícil"), hint: t("Planeja mais e responde sempre que pode") },
];

const FASES: [number, string][] = [
  [OcgPhase.DRAW, "DP"],
  [OcgPhase.STANDBY, "SP"],
  [OcgPhase.MAIN1, "M1"],
  [OcgPhase.BATTLE_START, "BP"],
  [OcgPhase.MAIN2, "M2"],
  [OcgPhase.END, "EP"],
];
const siglaFase = (f: number) => (f & (OcgPhase.BATTLE_START | OcgPhase.BATTLE_STEP | OcgPhase.DAMAGE | OcgPhase.DAMAGE_CAL | OcgPhase.BATTLE) ? "BP" : FASES.find(([v]) => v === f)?.[1] ?? "");

// títulos das escolhas, pela dica do motor (HINTMSG_* do constant.lua do Project Ignis)
const DICAS: Record<string, string> = {
  RELEASE: t("Escolha o que oferecer como Tributo"),
  TRIBUTE: t("Escolha o que oferecer como Tributo"),
  DISCARD: t("Escolha a carta para descartar"),
  DESTROY: t("Escolha a carta para destruir"),
  REMOVE: t("Escolha a carta para banir"),
  TOGRAVE: t("Escolha a carta para enviar ao Cemitério"),
  RTOGRAVE: t("Escolha a carta para enviar ao Cemitério"),
  RTOHAND: t("Escolha a carta para devolver à mão"),
  ATOHAND: t("Escolha a carta para adicionar à mão"),
  TODECK: t("Escolha a carta para devolver ao Deck"),
  SUMMON: t("Escolha o monstro para Invocar por Invocação-Normal"),
  SPSUMMON: t("Escolha o monstro para Invocar por Invocação-Especial"),
  SET: t("Escolha a carta para baixar"),
  FMATERIAL: t("Escolha as matérias de Fusão"),
  SMATERIAL: t("Escolha as matérias de Sincro"),
  XMATERIAL: t("Escolha as matérias Xyz"),
  LMATERIAL: t("Escolha as matérias de Link"),
  FACEUP: t("Escolha uma carta com a face para cima"),
  FACEDOWN: t("Escolha uma carta com a face para baixo"),
  ATTACK: t("Escolha um monstro em Posição de Ataque"),
  DEFENSE: t("Escolha um monstro em Posição de Defesa"),
  EQUIP: t("Escolha a carta para equipar"),
  REMOVEXYZ: t("Escolha a matéria Xyz para desassociar"),
  DEATTACHFROM: t("Escolha de qual monstro desassociar a matéria"),
  ATTACH: t("Escolha a carta para anexar como matéria"),
  CONTROL: t("Escolha o monstro para controlar"),
  DESREPLACE: t("Escolha a carta para substituir a destruição"),
  CONFIRM: t("Escolha a carta para revelar"),
  TOFIELD: t("Escolha a carta para colocar no campo"),
  POSCHANGE: t("Escolha o monstro para mudar de posição"),
  SELF: t("Escolha uma das suas cartas"),
  OPPO: t("Escolha uma carta do oponente"),
  ATTACKTARGET: t("Escolha o alvo do ataque"),
  EFFECT: t("Escolha a carta do efeito"),
  TARGET: t("Escolha o alvo"),
  NEGATE: t("Escolha a carta para negar"),
  APPLYTO: t("Escolha a carta que recebe o efeito"),
  ATKDEF: t("Escolha o monstro"),
  RESOLVECARD: t("Escolha a carta a resolver"),
  RESOLVEEFFECT: t("Escolha o efeito a resolver"),
  OPTION: t("Escolha uma opção"),
  POSITION: t("Escolha a posição"),
  ZONE: t("Escolha a zona"),
  TOZONE: t("Escolha a zona de destino"),
  DISABLEZONE: t("Escolha a zona a desativar"),
  COUNTER: t("Escolha os marcadores"),
};

const ATRIBUTOS: [number, string][] = [
  [0x1, t("TERRA")],
  [0x2, t("ÁGUA")],
  [0x4, t("FOGO")],
  [0x8, t("VENTO")],
  [0x10, t("LUZ")],
  [0x20, t("TREVAS")],
  [0x40, t("DIVINO")],
];
const TIPOS_MONSTRO = [
  t("Guerreiro"), t("Mago"), t("Fada"), t("Demônio"), t("Zumbi"), t("Máquina"), t("Aqua"), t("Piro"), t("Rocha"), t("Besta Alada"), t("Planta"), t("Inseto"), t("Trovão"),
  t("Dragão"), t("Besta"), t("Besta-Guerreira"), t("Dinossauro"), t("Peixe"), t("Serpente Marinha"), t("Réptil"), t("Psíquico"), t("Besta Divina"), t("Deus Criador"), t("Wyrm"), t("Ciberso"), t("Ilusão"),
];

const QUEM_COMECA: { id: Config["primeiro"]; label: string }[] = [
  { id: "eu", label: t("Eu") },
  { id: "ia", label: t("IA") },
  { id: "sorteio", label: t("Sorteio") },
];

const POSICOES: [number, string][] = [
  [1, t("Ataque")],
  [4, t("Defesa")],
  [8, t("Defesa, virada para baixo")],
  [2, t("Ataque, virada para baixo")],
];

interface Acao {
  rotulo: string;
  resp: OcgResponse;
}

/** Chave de uma carta no motor: dono, local e posição na zona */
const chave = (controller: number, location: number, sequence: number) => `${controller}:${location}:${sequence}`;
const virada = (pos: number) => (pos & 0xa) !== 0;

const CONFIG = "simulador-config";
interface Config {
  meu: string;
  ia: string;
  nivel: NivelIA;
  primeiro: "eu" | "ia" | "sorteio";
  /** pausar em todas as janelas de resposta (senão, só depois de uma jogada da IA) */
  todasJanelas?: boolean;
}
function lerConfig(): Partial<Config> {
  try {
    return JSON.parse(localStorage.getItem(CONFIG) ?? "{}") as Partial<Config>;
  } catch {
    return {};
  }
}
function gravarConfig(c: Config) {
  try {
    localStorage.setItem(CONFIG, JSON.stringify(c));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

interface DeckOpcao {
  valor: string;
  nome: string;
  deck: DeckSim;
  linhas: LinhaIA[];
}

export default function Simulador({ onBack }: { onBack: () => void }) {
  const db = useCardDb();
  const { decks } = useDecks();
  const byId = useMemo(() => {
    const m = new Map<number, Card>();
    for (const c of db.cards) for (const id of [c.id, ...c.images]) if (!m.has(id)) m.set(id, c);
    return m;
  }, [db.cards]);

  // decks: os seus (Editor de Deck) e os de torneio que o motor já jogou (camada: combos calculados)
  const opcoes = useMemo<DeckOpcao[]>(() => {
    const combos = db.extras?.combos;
    const linhas = combos?.linhas ?? [];
    const meus = decks
      .filter((d) => !d.temporario && d.main.length)
      .map((d) => {
        const ids = new Set(d.main);
        return { valor: `meu:${d.id}`, nome: d.nome, deck: { main: d.main, extra: d.extra }, linhas: linhas.filter((l) => l.mao.every((c) => ids.has(c))) };
      });
    const meta = (combos?.decks ?? []).flatMap((d, i) => {
      const lista = d.listas?.find((l) => l.formatos.includes("TCG")) ?? d.listas?.[0];
      if (!lista) return [];
      return [{ valor: `meta:${i}`, nome: `${d.nome}${d.evento ? ` · ${d.evento}` : ""}`, deck: { main: lista.main, extra: lista.extra }, linhas: linhas.filter((l) => l.deck === i) }];
    });
    return [...meus, ...meta];
  }, [decks, db.extras?.combos]);

  const salvo = useMemo(lerConfig, []);
  const [cfg, setCfg] = useState<Config>(() => ({ meu: salvo.meu ?? "", ia: salvo.ia ?? "", nivel: salvo.nivel ?? "normal", primeiro: salvo.primeiro ?? "sorteio" }));
  const meu = opcoes.find((o) => o.valor === cfg.meu) ?? opcoes[0];
  const doIA = opcoes.find((o) => o.valor === cfg.ia) ?? opcoes.find((o) => o.valor.startsWith("meta:")) ?? opcoes[0];

  const [etapa, setEtapa] = useState<"config" | "carregando" | "duelo">("config");
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [pensando, setPensando] = useState(false);
  const [registro, setRegistro] = useState<EventoSim[]>([]);
  const [eu, setEu] = useState<0 | 1>(0);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; acoes: Acao[] } | null>(null);
  const [lista, setLista] = useState<{ titulo: string; cartas: { c: CartaSim; k: string; oculta: boolean }[] } | null>(null);
  const [sair, setSair] = useState(false);
  const cliente = useRef<ClienteSim | null>(null);

  useEffect(() => () => cliente.current?.encerrar(), []);

  const nomeDe = (code: number) => {
    const c = byId.get(code);
    return c ? displayName(c) : nomes[code] ?? `#${code}`;
  };

  async function iniciar() {
    if (!meu || !doIA) return;
    gravarConfig({ ...cfg, meu: meu.valor, ia: doIA.valor });
    setEtapa("carregando");
    setErro(null);
    setAviso(null);
    try {
      const dados = await obterPacote(setProgresso);
      cliente.current?.encerrar();
      const c = new ClienteSim(receber, (msg) => setErro(msg));
      cliente.current = c;
      setProgresso(t("Abrindo o motor de regras…"));
      const n = await c.carregar(dados);
      setNomes(n);
      // cartas que o motor não tem ficam de fora do duelo
      const fora = [...meu.deck.main, ...meu.deck.extra].filter((id) => !(id in n));
      if (fora.length) setAviso(t("{0} carta(s) do seu deck ainda não existem no motor e ficaram de fora: {1}.", [fora.length, [...new Set(fora)].map(nomeDe).join(", ")]));
      const humano = cfg.primeiro === "eu" ? 0 : cfg.primeiro === "ia" ? 1 : (aleatorio(2) as 0 | 1);
      // o motor sempre dá o primeiro turno ao jogador 0
      const par: [DeckSim, DeckSim] = humano === 0 ? [meu.deck, doIA.deck] : [doIA.deck, meu.deck];
      const semente = Array.from(crypto.getRandomValues(new Uint32Array(4)), String) as [string, string, string, string];
      setEu(humano);
      setRegistro([]);
      setQuadro(null);
      setPensando(true);
      setEtapa("duelo");
      c.iniciar({ partida: { decks: par, semente }, humano, nivel: cfg.nivel, linhas: doIA.linhas, janelas: cfg.todasJanelas ? "todas" : "acao" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setEtapa("config");
    }
  }

  function receber(q: Quadro) {
    setPensando(!!q.pensando);
    setQuadro(q);
    if (q.eventos.length) setRegistro((r) => [...r, ...q.eventos].slice(-400));
  }

  function responder(resp: OcgResponse) {
    setMenu(null);
    setLista(null);
    setQuadro((q) => (q ? { ...q, pedido: null } : q));
    setPensando(true);
    cliente.current?.responder(resp);
  }

  // Esc: fecha menu e listas; no duelo, pede confirmação antes de voltar ao menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menu || lista) {
        e.preventDefault();
        setMenu(null);
        setLista(null);
      } else if (etapa === "duelo" && !quadro?.fim && !sair) {
        e.preventDefault();
        setSair(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [menu, lista, etapa, quadro?.fim, sair]);

  const pedido = quadro?.pedido ?? null;
  const d = pedido?.msg;
  const texto = (desc: bigint | number) => pedido?.textos[String(desc)];

  // ações sobre as cartas (Main Phase e Battle Phase): chave da carta → ações
  const acoes = useMemo(() => {
    const m = new Map<string, Acao[]>();
    if (!d) return m;
    const add = (c: { controller: number; location: number; sequence: number }, a: Acao) => {
      const k = chave(c.controller, c.location, c.sequence);
      m.set(k, [...(m.get(k) ?? []), a]);
    };
    const efeito = (desc: bigint) => {
      const s = texto(desc);
      return s ? `${t("Ativar")}: ${s}` : t("Ativar");
    };
    if (d.type === T.SELECT_IDLECMD) {
      d.activates.forEach((c, i) => add(c, { rotulo: efeito(c.description), resp: { type: R.SELECT_IDLECMD, action: 5, index: i } }));
      d.summons.forEach((c, i) => add(c, { rotulo: t("Invocar por Invocação-Normal"), resp: { type: R.SELECT_IDLECMD, action: 0, index: i } }));
      d.special_summons.forEach((c, i) => add(c, { rotulo: t("Invocar por Invocação-Especial"), resp: { type: R.SELECT_IDLECMD, action: 1, index: i } }));
      d.monster_sets.forEach((c, i) => add(c, { rotulo: t("Baixar"), resp: { type: R.SELECT_IDLECMD, action: 3, index: i } }));
      d.spell_sets.forEach((c, i) => add(c, { rotulo: t("Baixar"), resp: { type: R.SELECT_IDLECMD, action: 4, index: i } }));
      d.pos_changes.forEach((c, i) => add(c, { rotulo: t("Mudar a posição de batalha"), resp: { type: R.SELECT_IDLECMD, action: 2, index: i } }));
    } else if (d.type === T.SELECT_BATTLECMD) {
      d.attacks.forEach((c, i) => add(c, { rotulo: c.can_direct ? t("Atacar (direto, se não houver alvo)") : t("Atacar"), resp: { type: R.SELECT_BATTLECMD, action: 1, index: i } }));
      d.chains.forEach((c, i) => add(c, { rotulo: efeito(c.description), resp: { type: R.SELECT_BATTLECMD, action: 0, index: i } }));
    }
    return m;
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  // SELECT_PLACE: zonas livres e as já marcadas
  const [zonas, setZonas] = useState<SelectFieldPlace[]>([]);
  useEffect(() => setZonas([]), [d]);
  const livres = useMemo(() => (d && (d.type === T.SELECT_PLACE || d.type === T.SELECT_DISFIELD) ? zonasLivres(d) : []), [d]);
  const escolherZona = (z: SelectFieldPlace) => {
    if (!d || (d.type !== T.SELECT_PLACE && d.type !== T.SELECT_DISFIELD)) return;
    const novas = [...zonas, z];
    if (novas.length >= Math.max(1, d.count)) responder(d.type === T.SELECT_PLACE ? { type: R.SELECT_PLACE, places: novas } : { type: R.SELECT_DISFIELD, places: novas });
    else setZonas(novas);
  };

  if (etapa !== "duelo" || !quadro) {
    return (
      <ScreenShell title={t("Simulador")} accent="magenta" onBack={onBack}>
        <div className="sim-config">
          <p className="tags-note">
            {t("Duelo com as regras do jogo contra a IA. O motor é o do EDOPro (Project Ignis): custos, condições, cadeias e “uma vez por turno” valem como no jogo.")}
          </p>
          {!opcoes.length ? (
            <p>{t("Monte um deck no Editor de Deck para duelar.")}</p>
          ) : (
            <>
              <label className="sim-campo">
                <span className="field-label">{t("Seu deck")}</span>
                <select value={meu?.valor} onChange={(e) => setCfg({ ...cfg, meu: e.target.value })}>
                  {opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.valor.startsWith("meta:") ? `${t("Torneio")}: ${o.nome}` : o.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sim-campo">
                <span className="field-label">{t("Deck da IA")}</span>
                <select value={doIA?.valor} onChange={(e) => setCfg({ ...cfg, ia: e.target.value })}>
                  {opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.valor.startsWith("meta:") ? `${t("Torneio")}: ${o.nome}` : o.nome}
                    </option>
                  ))}
                </select>
                {doIA && <small className="tags-note">{doIA.linhas.length ? t("A IA conhece {0} linha(s) de combo deste deck.", [doIA.linhas.length]) : t("Sem linhas de combo conhecidas: a IA monta as jogadas sozinha.")}</small>}
              </label>
              <fieldset className="sim-campo">
                <legend className="field-label">{t("Nível da IA")}</legend>
                <div className="sim-niveis">
                  {NIVEIS.map((n) => (
                    <button key={n.id} className={`ghost-btn ${cfg.nivel === n.id ? "sim-ativo" : ""}`} onClick={() => setCfg({ ...cfg, nivel: n.id })} title={n.hint} aria-pressed={cfg.nivel === n.id}>
                      {n.label}
                    </button>
                  ))}
                </div>
                <small className="tags-note">{NIVEIS.find((n) => n.id === cfg.nivel)?.hint}</small>
              </fieldset>
              <fieldset className="sim-campo">
                <legend className="field-label">{t("Quem começa")}</legend>
                <div className="sim-niveis">
                  {QUEM_COMECA.map(({ id, label }) => (
                    <button key={id} className={`ghost-btn ${cfg.primeiro === id ? "sim-ativo" : ""}`} onClick={() => setCfg({ ...cfg, primeiro: id })} aria-pressed={cfg.primeiro === id}>
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button className="ghost-btn sim-duelar" onClick={iniciar} disabled={etapa === "carregando"}>
                {etapa === "carregando" ? progresso || t("Preparando…") : t("Duelar")}
              </button>
            </>
          )}
          {erro && (
            <p className="conta-erro" role="alert">
              {erro}
            </p>
          )}
          <p className="tags-note sim-licenca">
            {t("Motor de regras: ocgcore e scripts das cartas do Project Ignis (EDOPro), licença AGPL-3.0. Os textos dos efeitos nas escolhas vêm em inglês, como nos scripts.")}
          </p>
        </div>
      </ScreenShell>
    );
  }

  const op = (1 - eu) as 0 | 1;
  const est = quadro.estado;
  const meuLado = est.lados[eu];
  const lado2 = est.lados[op];
  const minhaVez = est.vez === eu;

  const abrirMenu = (e: MouseEvent, lista: Acao[]) => {
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, acoes: lista });
  };

  // carta desenhada (não componente, para o React não recriar o elemento a cada quadro)
  const carta = (c: CartaSim, k: string, oculta: boolean, monstro = false) => {
    const ac = acoes.get(k);
    const verso = oculta;
    return (
      <div
        key={k}
        className={`tj-carta ${monstro && c.pos & 0xc ? "tj-defesa" : ""} ${ac ? "sim-acao" : ""} ${!oculta && virada(c.pos) ? "sim-baixada" : ""}`}
        onMouseEnter={() => !verso && setPreview(c.code)}
        onClick={(e) => {
          if (ac) abrirMenu(e, ac);
          else if (!verso) setPreview(c.code);
        }}
        title={verso ? t("Carta virada para baixo") : nomeDe(c.code)}
        data-card-id={verso ? undefined : c.code}
      >
        {verso ? <div className="tj-verso" /> : <img src={cardImage(c.code, "small")} alt={nomeDe(c.code)} draggable={false} onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />}
        {c.mat && c.mat.length > 0 && (
          <span className="tj-materiais" title={t("Matérias Xyz")}>
            {c.mat.length}
          </span>
        )}
        {monstro && !verso && c.atk !== undefined && c.pos & 5 ? (
          <span className="sim-atk">
            {c.atk}/{c.def}
          </span>
        ) : null}
      </div>
    );
  };

  // zona do campo: p = dono, location/sequence do motor
  const zonaCampo = (p: number, location: number, sequence: number, classe: string, c: CartaSim | null) => {
    const livre = livres.find((z) => z.player === p && z.location === location && z.sequence === sequence);
    const marcada = zonas.some((z) => z.player === p && z.location === location && z.sequence === sequence);
    const k = chave(p, location, sequence);
    return (
      <div
        key={`z-${k}`}
        className={`tj-zona ${classe} ${p === op ? "tj-zona-op" : ""} ${livre ? "sim-zona-livre" : ""} ${marcada ? "sim-zona-marcada" : ""}`}
        onClick={() => livre && !marcada && escolherZona(livre)}
        data-zona={k}
      >
        {c && carta(c, k, p === op && virada(c.pos), location === L.MZONE)}
      </div>
    );
  };

  // pilhas: Deck, Extra Deck, Cemitério, banidas (clique abre a lista)
  const pilha = (p: number, tipo: "deck" | "extra" | "cemiterio" | "banido") => {
    const l = est.lados[p];
    const location = tipo === "deck" ? L.DECK : tipo === "extra" ? L.EXTRA : tipo === "cemiterio" ? L.GRAVE : L.REMOVED;
    const cartas = tipo === "deck" ? [] : tipo === "extra" ? l.extra : tipo === "cemiterio" ? l.cemiterio : l.banidas;
    const n = tipo === "deck" ? l.deck : cartas.length;
    const temAcao = cartas.some((_, i) => acoes.has(chave(p, location, i)));
    const titulo = `${p === op ? t("Oponente — ") : ""}${tipo === "deck" ? t("Deck") : tipo === "extra" ? t("Extra Deck") : tipo === "cemiterio" ? t("Cemitério") : t("Banidas")}`;
    // Extra Deck do oponente: só as cartas com a face para cima (Pêndulos) ficam visíveis
    const oculta = (c: CartaSim) => tipo === "extra" && p === op && !(c.pos & 1);
    const topo = tipo === "extra" ? null : cartas[cartas.length - 1];
    return (
      <div
        key={`p-${p}-${tipo}`}
        className={`tj-zona tj-${tipo} ${p === op ? "tj-zona-op" : ""} ${temAcao ? "sim-acao" : ""}`}
        onClick={() => cartas.length && setLista({ titulo, cartas: cartas.map((c, i) => ({ c, k: chave(p, location, i), oculta: oculta(c) })) })}
        title={titulo}
      >
        {tipo === "deck" || tipo === "extra" ? n > 0 && <div className="tj-verso" /> : topo && carta(topo, chave(p, location, cartas.length - 1), false)}
        <span className="tj-contagem">{n}</span>
        {!n && <span className="tj-rotulo">{tipo === "cemiterio" ? t("Cemitério") : tipo === "banido" ? t("Banidas") : tipo === "extra" ? t("Extra") : t("Deck")}</span>}
      </div>
    );
  };

  // Zonas de Monstros Extra são compartilhadas: a esquerda de um jogador é a direita do outro
  const emz = (lado: 0 | 1) => {
    const minha = meuLado.monstros[5 + lado];
    const dele = lado2.monstros[6 - lado];
    if (dele) return zonaCampo(op, L.MZONE, 6 - lado, "tj-em", dele);
    return zonaCampo(eu, L.MZONE, 5 + lado, "tj-em", minha);
  };

  const preCard = preview !== null ? byId.get(preview) : undefined;
  const fimTexto = quadro.fim ? (quadro.fim.vencedor === eu ? t("Você venceu!") : quadro.fim.vencedor === op ? t("A IA venceu.") : t("Empate.")) : null;

  return (
    <ScreenShell title={t("Simulador")} accent="magenta" onBack={() => (quadro.fim ? onBack() : setSair(true))} plain>
      <div className="teste-jogo sim">
        <Lateral className="tj-esq" titulo={t("Carta")}>
          {preview !== null ? (
            <>
              <img src={cardImage(preview, "full")} alt={nomeDe(preview)} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              <strong>{nomeDe(preview)}</strong>
              {preCard && <small>{kindLabel(preCard)}</small>}
              {preCard && <p>{preCard.descPt ?? preCard.desc}</p>}
            </>
          ) : (
            <p className="tags-note">{t("Passe o mouse sobre uma carta para ver os detalhes. Cartas com contorno brilhante têm ações: clique nelas.")}</p>
          )}
        </Lateral>

        <section className="tj-mesa tj-mesa-avancada" onClick={() => setMenu(null)}>
          <div className="tj-mao tj-mao-op" aria-label={t("Mão do oponente")}>
            {lado2.mao.map((c, i) => (
              <div key={i} className="tj-mao-carta">
                {carta(c, chave(op, L.HAND, i), true)}
              </div>
            ))}
          </div>
          <div className="tj-campo">
            <div className="tj-l3 tj-linha-op">
              {pilha(op, "deck")}
              {[4, 3, 2, 1, 0].map((i) => zonaCampo(op, L.SZONE, i, "tj-st", lado2.magias[i]))}
              {pilha(op, "extra")}
            </div>
            <div className="tj-l2 tj-linha-op">
              {pilha(op, "cemiterio")}
              {[4, 3, 2, 1, 0].map((i) => zonaCampo(op, L.MZONE, i, "tj-m", lado2.monstros[i]))}
              {zonaCampo(op, L.SZONE, 5, "tj-campo-magia", lado2.magias[5])}
            </div>
            <div className="tj-l1">
              {pilha(op, "banido")}
              <span />
              {emz(0)}
              <span className="sim-centro">
                <strong>{siglaFase(est.fase)}</strong>
                <small>{t("Turno {0}", [est.turno])}</small>
              </span>
              {emz(1)}
              <span />
              {pilha(eu, "banido")}
            </div>
            <div className="tj-l2">
              {zonaCampo(eu, L.SZONE, 5, "tj-campo-magia", meuLado.magias[5])}
              {[0, 1, 2, 3, 4].map((i) => zonaCampo(eu, L.MZONE, i, "tj-m", meuLado.monstros[i]))}
              {pilha(eu, "cemiterio")}
            </div>
            <div className="tj-l3">
              {pilha(eu, "extra")}
              {[0, 1, 2, 3, 4].map((i) => zonaCampo(eu, L.SZONE, i, "tj-st", meuLado.magias[i]))}
              {pilha(eu, "deck")}
            </div>
          </div>
          <div className="tj-mao" aria-label={t("Sua mão")}>
            {meuLado.mao.map((c, i) => (
              <div key={i} className="tj-mao-carta">
                {carta(c, chave(eu, L.HAND, i), false)}
              </div>
            ))}
          </div>
        </section>

        <Lateral lado="dir" className="tj-dir sim-dir" titulo={t("Duelo")} abrirCom={pedido && pedido.msg.type !== T.SELECT_IDLECMD && pedido.msg.type !== T.SELECT_BATTLECMD ? pedido : undefined}>
          <div className="sim-pv">
            <Pv rotulo={t("IA")} lp={lado2.lp} vez={!minhaVez} />
            <Pv rotulo={t("Você")} lp={meuLado.lp} vez={minhaVez} />
          </div>
          {fimTexto ? (
            <div className="sim-fim" role="status">
              <strong>{fimTexto}</strong>
              <button className="ghost-btn" onClick={() => setEtapa("config")}>
                {t("Nova partida")}
              </button>
            </div>
          ) : pensando || !pedido ? (
            <p className="sim-pensando" role="status">
              {t("A IA está pensando…")}
            </p>
          ) : (
            <Escolha pedido={pedido} nomeDe={nomeDe} responder={responder} eu={eu} setPreview={setPreview} />
          )}
          <label className="sim-janelas" title={t("Desligado: o simulador só pergunta se você quer encadear logo depois de uma jogada da IA.")}>
            <input
              type="checkbox"
              checked={!!cfg.todasJanelas}
              onChange={(e) => {
                const novo = { ...cfg, todasJanelas: e.target.checked };
                setCfg(novo);
                gravarConfig({ ...novo, meu: meu?.valor ?? novo.meu, ia: doIA?.valor ?? novo.ia });
                cliente.current?.janelas(e.target.checked ? "todas" : "acao");
              }}
            />
            {t("Pausar em todas as janelas de resposta")}
          </label>
          {aviso && <p className="tags-note">{aviso}</p>}
          {erro && (
            <p className="conta-erro" role="alert">
              {t("O motor parou: {0}", [erro])}
            </p>
          )}
          <h3>{t("Registro")}</h3>
          <ol className="tj-log sim-log" aria-label={t("Registro do duelo")}>
            {[...registro].reverse().map((e, i) => (
              <li key={registro.length - i}>{textoEvento(e, eu, nomeDe)}</li>
            ))}
          </ol>
        </Lateral>

        {menu && (
          <div className="tj-menu-fundo" onClick={() => setMenu(null)}>
            <ul className="tj-menu" style={{ left: Math.min(menu.x, window.innerWidth - 260), top: Math.min(menu.y, window.innerHeight - 40 * menu.acoes.length - 20) }} role="menu">
              {menu.acoes.map((a, i) => (
                <li key={i}>
                  <button role="menuitem" onClick={() => responder(a.resp)}>
                    {a.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lista && (
          <div className="tj-menu-fundo" onClick={() => setLista(null)}>
            <div className="tj-lista" role="dialog" aria-label={lista.titulo} onClick={(e) => e.stopPropagation()}>
              <h4>{lista.titulo}</h4>
              <div className="tj-lista-cartas">{lista.cartas.map(({ c, k, oculta }) => carta(c, k, oculta))}</div>
              <button className="ghost-btn" onClick={() => setLista(null)}>
                {t("Fechar")}
              </button>
            </div>
          </div>
        )}

        {sair && (
          <div className="tj-menu-fundo" onClick={() => setSair(false)}>
            <div className="tj-lista sim-sair" role="dialog" aria-label={t("Sair do duelo")} onClick={(e) => e.stopPropagation()}>
              <h4>{t("Sair do duelo?")}</h4>
              <p>{t("O duelo em andamento será perdido.")}</p>
              <div className="sim-niveis">
                <button className="danger-btn" onClick={onBack} autoFocus>
                  {t("Sair")}
                </button>
                <button className="ghost-btn" onClick={() => setSair(false)}>
                  {t("Continuar duelando")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

function Pv({ rotulo, lp, vez }: { rotulo: string; lp: number; vez: boolean }) {
  return (
    <div className={`sim-pv-lado ${vez ? "sim-vez" : ""}`}>
      <small>
        {rotulo}
        {vez ? ` · ${t("vez")}` : ""}
      </small>
      <strong>{lp}</strong>
    </div>
  );
}

/** Painel da decisão em aberto (tudo menos as ações de Main/Battle Phase, que ficam nas cartas) */
function Escolha({ pedido, nomeDe, responder, eu, setPreview }: { pedido: PedidoSim; nomeDe: (c: number) => string; responder: (r: OcgResponse) => void; eu: number; setPreview: (c: number) => void }) {
  const d = pedido.msg;
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [busca, setBusca] = useState("");
  const [contadores, setContadores] = useState<number[]>([]);
  useEffect(() => {
    setMarcadas([]);
    setBusca("");
    setContadores(d.type === T.SELECT_COUNTER ? d.cards.map(() => 0) : []);
  }, [d]);

  const dica = pedido.dica?.replace(/^HINTMSG_/, "");
  const titulo = pedido.dicaTexto ?? (dica && DICAS[dica]) ?? t("Escolha");
  const texto = (desc: bigint | number) => pedido.textos[String(desc)];
  const aviso = pedido.repetir ? <p className="conta-erro">{t("Essa escolha não vale aqui. Escolha de novo.")}</p> : null;
  const lugar = (c: { controller: number; location: number }) =>
    `${c.controller === eu ? "" : t("do oponente, ")}${c.location & L.HAND ? t("mão") : c.location & L.DECK ? t("Deck") : c.location & L.GRAVE ? t("Cemitério") : c.location & L.REMOVED ? t("banida") : c.location & L.EXTRA ? t("Extra Deck") : c.location & L.OVERLAY ? t("matéria") : t("campo")}`;
  const cartaBotao = (c: { code: number; controller: number; location: number }, i: number, ativo: boolean, onClick: () => void, sufixo?: ReactNode) => (
    <button key={i} className={`sim-opcao-carta ${ativo ? "sim-ativo" : ""}`} onClick={onClick} onMouseEnter={() => c.code && setPreview(c.code)} aria-pressed={ativo}>
      {c.code ? <img src={cardImage(c.code, "small")} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} /> : <div className="tj-verso" />}
      <span>
        <strong>{c.code ? nomeDe(c.code) : t("Carta virada para baixo")}</strong>
        <small>{lugar(c)}</small>
        {sufixo}
      </span>
    </button>
  );

  // Main Phase / Battle Phase: as ações ficam nas cartas; aqui, as fases
  if (d.type === T.SELECT_IDLECMD || d.type === T.SELECT_BATTLECMD) {
    return (
      <div className="sim-escolha">
        {aviso}
        <p className="tags-note">{t("Sua vez: clique numa carta com contorno para agir.")}</p>
        <div className="sim-niveis">
          {d.type === T.SELECT_IDLECMD && d.to_bp && (
            <button className="ghost-btn" onClick={() => responder({ type: R.SELECT_IDLECMD, action: 6, index: null })}>
              {t("Battle Phase")}
            </button>
          )}
          {d.type === T.SELECT_BATTLECMD && d.to_m2 && (
            <button className="ghost-btn" onClick={() => responder({ type: R.SELECT_BATTLECMD, action: 2, index: null })}>
              {t("Main Phase 2")}
            </button>
          )}
          {d.to_ep && (
            <button className="ghost-btn" onClick={() => responder(d.type === T.SELECT_IDLECMD ? { type: R.SELECT_IDLECMD, action: 7, index: null } : { type: R.SELECT_BATTLECMD, action: 3, index: null })}>
              {t("Encerrar o turno")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const corpo = (): ReactNode => {
    switch (d.type) {
      case T.SELECT_CHAIN:
        return (
          <>
            <h4>{d.forced ? t("Ative um efeito obrigatório") : t("Encadear um efeito?")}</h4>
            {d.selects.map((c, i) => cartaBotao(c, i, false, () => responder({ type: R.SELECT_CHAIN, index: i }), texto(c.description) && <em>{texto(c.description)}</em>))}
            {!d.forced && (
              <button className="ghost-btn" onClick={() => responder({ type: R.SELECT_CHAIN, index: null })} autoFocus>
                {t("Não encadear")}
              </button>
            )}
          </>
        );
      case T.SELECT_EFFECTYN:
      case T.SELECT_YESNO:
        return (
          <>
            <h4>{d.type === T.SELECT_EFFECTYN ? t("Ativar o efeito de {0}?", [nomeDe(d.code)]) : t("Confirmar?")}</h4>
            {texto(d.description) && <p>{texto(d.description)}</p>}
            <div className="sim-niveis">
              <button className="ghost-btn" onClick={() => responder(d.type === T.SELECT_EFFECTYN ? { type: R.SELECT_EFFECTYN, yes: true } : { type: R.SELECT_YESNO, yes: true })} autoFocus>
                {t("Sim")}
              </button>
              <button className="ghost-btn" onClick={() => responder(d.type === T.SELECT_EFFECTYN ? { type: R.SELECT_EFFECTYN, yes: false } : { type: R.SELECT_YESNO, yes: false })}>
                {t("Não")}
              </button>
            </div>
          </>
        );
      case T.SELECT_OPTION:
        return (
          <>
            <h4>{titulo}</h4>
            {d.options.map((o, i) => (
              <button key={i} className="ghost-btn sim-opcao" onClick={() => responder({ type: R.SELECT_OPTION, index: i })}>
                {texto(o) ?? t("Opção {0}", [i + 1])}
              </button>
            ))}
          </>
        );
      case T.SELECT_CARD:
      case T.SELECT_TRIBUTE: {
        const ok = marcadas.length >= d.min && marcadas.length <= d.max;
        return (
          <>
            <h4>{titulo}</h4>
            <small className="tags-note">{d.min === d.max ? t("Escolha {0}.", [d.min]) : t("Escolha de {0} a {1}.", [d.min, d.max])}</small>
            {d.selects.map((c, i) =>
              cartaBotao(c, i, marcadas.includes(i), () => {
                // uma carta só: responde no clique
                if (d.max === 1 && d.min === 1) return responder(d.type === T.SELECT_CARD ? { type: R.SELECT_CARD, indicies: [i] } : { type: R.SELECT_TRIBUTE, indicies: [i] });
                setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : m.length < d.max ? [...m, i] : m));
              }),
            )}
            <div className="sim-niveis">
              {!(d.max === 1 && d.min === 1) && (
                <button className="ghost-btn" disabled={!ok} onClick={() => responder(d.type === T.SELECT_CARD ? { type: R.SELECT_CARD, indicies: marcadas } : { type: R.SELECT_TRIBUTE, indicies: marcadas })}>
                  {t("Confirmar")}
                </button>
              )}
              {d.can_cancel && (
                <button className="ghost-btn" onClick={() => responder(d.type === T.SELECT_CARD ? { type: R.SELECT_CARD, indicies: null } : { type: R.SELECT_TRIBUTE, indicies: null })}>
                  {t("Cancelar")}
                </button>
              )}
            </div>
          </>
        );
      }
      case T.SELECT_UNSELECT_CARD:
        return (
          <>
            <h4>{titulo}</h4>
            {/* as já escolhidas vêm depois das disponíveis na resposta */}
            {d.select_cards.map((c, i) => cartaBotao(c, i, false, () => responder({ type: R.SELECT_UNSELECT_CARD, index: i })))}
            {d.unselect_cards.map((c, i) => cartaBotao(c, d.select_cards.length + i, true, () => responder({ type: R.SELECT_UNSELECT_CARD, index: d.select_cards.length + i })))}
            {(d.can_finish || d.can_cancel) && (
              <button className="ghost-btn" onClick={() => responder({ type: R.SELECT_UNSELECT_CARD, index: null })}>
                {d.can_finish ? t("Concluir") : t("Cancelar")}
              </button>
            )}
          </>
        );
      case T.SELECT_SUM: {
        const valor = (a: number) => a & 0xffff;
        const soma = [...d.selects_must.map((c) => valor(c.amount)), ...marcadas.map((i) => valor(d.selects[i].amount))].reduce((a, b) => a + b, 0);
        return (
          <>
            <h4>{titulo}</h4>
            <small className="tags-note">{t("Some {0} (agora: {1}).", [d.amount, soma])}</small>
            {d.selects_must.map((c, i) => cartaBotao(c, 1000 + i, true, () => {}, <small>{t("obrigatória")}</small>))}
            {d.selects.map((c, i) => cartaBotao(c, i, marcadas.includes(i), () => setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i])), <small>{valor(c.amount)}</small>))}
            <button className="ghost-btn" disabled={!marcadas.length && !d.selects_must.length} onClick={() => responder({ type: R.SELECT_SUM, indicies: marcadas })}>
              {t("Confirmar")}
            </button>
          </>
        );
      }
      case T.SELECT_PLACE:
      case T.SELECT_DISFIELD:
        return (
          <>
            <h4>{titulo === t("Escolha") ? t("Escolha a zona no campo") : titulo}</h4>
            <p className="tags-note">{t("Clique numa zona destacada no campo.")}</p>
            <button
              className="ghost-btn"
              onClick={() => {
                const z = zonasLivres(d);
                const places = [...z.filter((x) => x.player === d.player), ...z.filter((x) => x.player !== d.player)].slice(0, Math.max(1, d.count));
                responder(d.type === T.SELECT_PLACE ? { type: R.SELECT_PLACE, places } : { type: R.SELECT_DISFIELD, places });
              }}
            >
              {t("Escolher automaticamente")}
            </button>
          </>
        );
      case T.SELECT_POSITION:
        return (
          <>
            <h4>{t("Posição de {0}", [nomeDe(d.code)])}</h4>
            {POSICOES.filter(([p]) => d.positions & p).map(([p, label]) => (
              <button key={p} className="ghost-btn sim-opcao" onClick={() => responder({ type: R.SELECT_POSITION, position: p as 1 })}>
                {label}
              </button>
            ))}
          </>
        );
      case T.SORT_CARD:
      case T.SORT_CHAIN:
        return (
          <>
            <h4>{d.type === T.SORT_CHAIN ? t("Ordem dos efeitos na cadeia") : t("Ordem das cartas")}</h4>
            {d.cards.map((c, i) => cartaBotao(c, i, false, () => {}))}
            <button className="ghost-btn" onClick={() => responder({ type: R.SORT_CARD, order: null })} autoFocus>
              {t("Usar esta ordem")}
            </button>
          </>
        );
      case T.ANNOUNCE_NUMBER:
        return (
          <>
            <h4>{titulo}</h4>
            <div className="sim-niveis">
              {d.options.map((n, i) => (
                <button key={i} className="ghost-btn" onClick={() => responder({ type: R.ANNOUNCE_NUMBER, value: i })}>
                  {String(n)}
                </button>
              ))}
            </div>
          </>
        );
      case T.ANNOUNCE_ATTRIB:
      case T.ANNOUNCE_RACE: {
        const disp = Number(d.available);
        const itens = d.type === T.ANNOUNCE_ATTRIB ? ATRIBUTOS.filter(([b]) => disp & b) : TIPOS_MONSTRO.map((n, i) => [1 << i, n] as [number, string]).filter(([b]) => disp & b);
        return (
          <>
            <h4>{d.type === T.ANNOUNCE_ATTRIB ? t("Declare {0} Atributo(s)", [d.count]) : t("Declare {0} Tipo(s)", [d.count])}</h4>
            <div className="sim-niveis">
              {itens.map(([b, label]) => (
                <button key={b} className={`ghost-btn ${marcadas.includes(b) ? "sim-ativo" : ""}`} onClick={() => setMarcadas((m) => (m.includes(b) ? m.filter((x) => x !== b) : m.length < d.count ? [...m, b] : m))}>
                  {label}
                </button>
              ))}
            </div>
            <button
              className="ghost-btn"
              disabled={marcadas.length !== d.count}
              onClick={() => responder(d.type === T.ANNOUNCE_ATTRIB ? { type: R.ANNOUNCE_ATTRIB, attributes: marcadas as never } : { type: R.ANNOUNCE_RACE, races: marcadas.map((b) => BigInt(b)) as never })}
            >
              {t("Confirmar")}
            </button>
          </>
        );
      }
      case T.ANNOUNCE_CARD: {
        const termo = busca.trim().toLowerCase();
        const achadas = termo.length < 2 ? [] : (pedido.candidatos ?? []).filter(([code, nome]) => nome.toLowerCase().includes(termo) || nomeDe(code).toLowerCase().includes(termo)).slice(0, 30);
        return (
          <>
            <h4>{t("Declare o nome de uma carta")}</h4>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("Digite o nome (português ou inglês)")} autoFocus />
            {achadas.map(([code], i) => cartaBotao({ code, controller: eu, location: L.DECK }, i, false, () => responder({ type: R.ANNOUNCE_CARD, card: code })))}
          </>
        );
      }
      case T.SELECT_COUNTER: {
        const total = contadores.reduce((a, b) => a + b, 0);
        return (
          <>
            <h4>{t("Remova {0} marcador(es)", [d.count])}</h4>
            {d.cards.map((c, i) => (
              <label key={i} className="sim-contador">
                {nomeDe(c.code)} ({c.count})
                <input type="number" min={0} max={c.count} value={contadores[i] ?? 0} onChange={(e) => setContadores((v) => v.map((x, j) => (j === i ? Math.max(0, Math.min(c.count, Number(e.target.value) || 0)) : x)))} />
              </label>
            ))}
            <button className="ghost-btn" disabled={total !== d.count} onClick={() => responder({ type: R.SELECT_COUNTER, counters: contadores })}>
              {t("Confirmar")}
            </button>
          </>
        );
      }
      case T.ROCK_PAPER_SCISSORS:
        return (
          <>
            <h4>{t("Pedra, papel ou tesoura?")}</h4>
            <div className="sim-niveis">
              {(
                [
                  [2, t("Pedra")],
                  [3, t("Papel")],
                  [1, t("Tesoura")],
                ] as const
              ).map(([v, label]) => (
                <button key={v} className="ghost-btn" onClick={() => responder({ type: R.ROCK_PAPER_SCISSORS, value: v })}>
                  {label}
                </button>
              ))}
            </div>
          </>
        );
      default:
        return <p className="tags-note">{t("Escolha não suportada ({0}).", [d.type])}</p>;
    }
  };

  return (
    <div className="sim-escolha" role="group" aria-label={titulo}>
      {aviso}
      {corpo()}
    </div>
  );
}

/** Linha do registro do duelo */
function textoEvento(e: EventoSim, eu: number, nomeDe: (c: number) => string): string {
  const quem = (p: number) => (p === eu ? t("Você") : t("IA"));
  switch (e.t) {
    case "turno":
      return t("— Turno {0}: {1} —", [e.n, quem(e.p)]);
    case "fase":
      return t("Fase: {0}", [siglaFase(e.fase)]);
    case "compra":
      return e.p === eu ? t("Você comprou {0}", [e.codes.map(nomeDe).join(", ")]) : t("IA comprou {0} carta(s)", [e.codes.length]);
    case "invoca":
      return e.como === "normal"
        ? t("{0} Invocou por Invocação-Normal {1}", [quem(e.p), nomeDe(e.code)])
        : e.como === "virar"
          ? t("{0} Invocou por Invocação-Virar {1}", [quem(e.p), nomeDe(e.code)])
          : t("{0} Invocou por Invocação-Especial {1}", [quem(e.p), nomeDe(e.code)]);
    case "baixa":
      return t("{0} baixou uma carta", [quem(e.p)]);
    case "ativa":
      return t("{0} ativou {1}", [quem(e.p), nomeDe(e.code)]) + (e.texto ? ` — ${e.texto}` : "");
    case "nega":
      return t("Ativação ou efeito negado");
    case "move": {
      const para = e.para & L.GRAVE ? t("Cemitério") : e.para & L.REMOVED ? t("banidas") : e.para & L.HAND ? t("mão") : e.para & L.EXTRA ? t("Extra Deck") : e.para & L.DECK ? t("Deck") : t("campo");
      return t("{0} foi para: {1}", [nomeDe(e.code), para]);
    }
    case "ataque":
      return e.alvo ? t("{0} atacou {1}", [nomeDe(e.code), nomeDe(e.alvo)]) : t("{0} atacou diretamente", [nomeDe(e.code)]);
    case "dano":
      return t("{0} sofreu {1} de dano", [quem(e.p), e.v]);
    case "cura":
      return t("{0} ganhou {1} PV", [quem(e.p), e.v]);
    case "custo":
      return t("{0} pagou {1} PV", [quem(e.p), e.v]);
    case "fim":
      return e.vencedor === eu ? t("Você venceu o duelo") : t("A IA venceu o duelo");
  }
}
