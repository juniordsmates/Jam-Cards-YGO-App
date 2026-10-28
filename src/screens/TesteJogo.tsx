import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ehExtra } from "../db/decks";
import { cardImage } from "../db/images";
import { kindLabel, levelLabel } from "../db/labels";
import {
  aleatorio,
  alternar,
  anotarPasso,
  campoDoTabuleiro,
  criarToken,
  TOKEN_GENERICO,
  metodoDoExtra,
  zonaDoPasso,
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
import { bilingualName, categoryOf, displayName, type Card } from "../db/types";
import { CARTA_QUALQUER, passoEmTexto, semCartaDoCalculo, type Passo } from "../db/motor";
import { groupSteps } from "../components/VerifiedCombos";
import CardSelos, { PapeisDaCarta } from "../components/CardSelos";
import { contarPapeis } from "../db/classificacao";
import { FontesButton } from "../components/Fontes";
import { isContaOpen, openConta } from "../components/Conta";
import { arquetiposDe, criarComboDoTeste, validadeNoFormato } from "../db/baseCombos";
import { useConta } from "../db/conta";
import { FORMATS, type GameFormat } from "../db/legality";
import "./teste-jogo.css";

// Teste de Jogo (Solo Mode): sem regras de jogo; o jogador move as cartas à vontade.

const FASES = ["DP", "SP", "M1", "BP", "M2", "EP"] as const;
const PILHAS: ZonaId[] = ["deck", "extra", "cemiterio", "banido"];

/** `zona`: no menu de token, a zona vazia onde ele será criado */
type Menu = { uid: string; x: number; y: number; zona?: ZonaId } | null;
/** menus das pilhas (botão direito no Deck ou no Extra Deck), no lugar do uid de uma carta */
const MENU_DECK = "deck";
const MENU_EXTRA = "extra";
/** menu "Criar token" (botão ou botão direito numa Zona de Monstros vazia) */
const MENU_TOKEN = "token";

/** Linha de combo para o "Executar combo": mão inicial e passos */
export interface ComboTeste {
  mao: number[];
  passos: Passo[];
  /** cartas quaisquer da mão (para descarte), que o deck temporário não traz */
  qualquer?: number;
}

export default function TesteJogo({
  nome,
  main,
  extra,
  byId,
  formato = "TCG",
  onFechar,
  combo,
}: {
  nome: string;
  main: number[];
  extra: number[];
  byId: Map<number, Card>;
  /** formato do editor: banlist dos selos nas cartas */
  formato?: GameFormat;
  onFechar: () => void;
  /** aberto pela tela de Combos: habilita o "Executar combo" */
  combo?: ComboTeste;
}) {
  // passo atual do "Executar combo" (null: caixa de passos fechada)
  const [passo, setPasso] = useState<number | null>(null);
  const grupos = combo ? groupSteps(semCartaDoCalculo({ qualquer: combo.qualquer, passos: combo.passos }).passos) : [];
  const textoPasso = (p: Passo) => {
    const t = passoEmTexto(p, (id) => (id === TOKEN_GENERICO ? "Token" : id === CARTA_QUALQUER ? "carta qualquer" : byId.get(id) ? displayName(byId.get(id)!) : `#${id}`));
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const [t, setT] = useState<Tabuleiro>(() => testeDeMao(main, extra));
  const [lp, setLp] = useState(8000);
  const [lpAjuste, setLpAjuste] = useState("");
  const [fase, setFase] = useState<(typeof FASES)[number]>("M1");
  // carta em foco no painel da esquerda ("token": a carta Token, que não existe na base)
  const [preview, setPreview] = useState<Card | "token" | null>(null);
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

  // Criar combo: cada ação vira um passo (como nas linhas da tela de Combos), a partir da mão inicial
  const conta = useConta();
  const [anotados, setAnotados] = useState<Passo[]>([]);
  const [maoInicial, setMaoInicial] = useState<CartaJogo[]>(t.mao);
  // cópias usadas no combo: cada carta (uid) que saiu do Deck/Extra Deck ou começou na mão
  const usadas = useRef(new Map<string, number>());
  const [criando, setCriando] = useState<{ titulo: string; obs: string; compartilhar: boolean } | null>(null);
  const [gravacao, setGravacao] = useState<{ tipo: "ok" | "erro" | "gravando"; texto: string } | null>(null);
  const recomecarAnotacao = (novo: Tabuleiro) => {
    setAnotados([]);
    setMaoInicial(novo.mao);
    usadas.current = new Map();
    setGravacao(null);
  };
  const anotar = (p: Passo | null, c?: CartaJogo) => {
    if (!p) return;
    setAnotados((ps) => anotarPasso(ps, p));
    // tokens não contam como cópias de cartas do deck
    if (c && !c.ficha) usadas.current.set(c.uid, c.id);
  };
  /** Passo de combo de um movimento (null: sem passo, como trocar de zona no próprio campo) */
  const passoDoMovimento = (c: CartaJogo, de: ZonaId, para: ZonaId | "material", opts: { baixada?: boolean; normal?: boolean } = {}): Passo | null => {
    const card = byId.get(c.id);
    const [dz, pz] = [zonaDoPasso(de), zonaDoPasso(para)];
    if (dz === pz) return null;
    if (pz === "campo") {
      if (de === "extra") return { t: "invoca", c: c.id, de: "extra", m: card ? metodoDoExtra(card.frame) : undefined };
      if (opts.baixada) return { t: "baixa", c: c.id };
      if (opts.normal && de === "mao") return { t: "normal", c: c.id };
      return { t: "invoca", c: c.id, de: dz };
    }
    if (pz === "magia" || pz === "campo-magia") {
      if (opts.baixada) return { t: "baixa", c: c.id };
      if (de === "mao") return { t: "ativa", c: c.id, de: "mao" };
    }
    return { t: "move", c: c.id, de: dz, para: pz };
  };
  const nomeId = (id: number) => (byId.get(id) ? displayName(byId.get(id)!) : id === TOKEN_GENERICO ? "Token" : `#${id}`);
  const tituloSugerido = () => {
    const arq = arquetiposDe(maoInicial.map((c) => byId.get(c.id)).filter((c): c is Card => !!c))[0];
    return `${arq ? `${arq}: ` : ""}${maoInicial.map((c) => nomeId(c.id)).join(" + ")}`.slice(0, 120);
  };
  /** Cópias de cada carta usadas no combo: a mão inicial e toda carta que entrou num passo */
  const copiasUsadas = () => {
    const porUid = new Map(usadas.current);
    for (const c of maoInicial) porUid.set(c.uid, c.id);
    const m = new Map<number, number>();
    for (const id of porUid.values()) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const gravarCombo = async () => {
    if (!criando || !conta) return;
    const copias = copiasUsadas();
    setGravacao({ tipo: "gravando", texto: "Criando o combo…" });
    try {
      await criarComboDoTeste(
        { autorNome: conta.usuario || conta.email.split("@")[0], titulo: criando.titulo, observacoes: criando.obs, compartilhar: criando.compartilhar },
        {
          iniciais: maoInicial.map((c) => c.id),
          arquetipos: arquetiposDe([...copias.keys()].map((id) => byId.get(id)).filter((c): c is Card => !!c)),
          dados: { passos: anotados, campo: campoDoTabuleiro(t), copias: Object.fromEntries(copias) },
        },
      );
      setGravacao({
        tipo: "ok",
        texto: criando.compartilhar ? "Combo criado e compartilhado: aparece para todos na aba Combos, com o seu nome e a data." : "Combo criado. Só você vê (aba Combos).",
      });
      setCriando(null);
    } catch (e) {
      setGravacao({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  };

  /** Monstros do Extra Deck não vão para a mão nem para o Deck */
  const bloqueadoNoExtra = (c: CartaJogo, para: ZonaId) => {
    const card = byId.get(c.id);
    if (!card || !ehExtra(card) || (para !== "mao" && para !== "deck")) return false;
    registrar(`${displayName(card)} é do Extra Deck: só pode ser invocado, ir para o Cemitério ou ser banido.`);
    return true;
  };

  const nomeDe = (c: CartaJogo) => {
    const card = byId.get(c.id);
    return card ? displayName(card) : c.id === TOKEN_GENERICO ? "Token" : `#${c.id}`;
  };
  const registrar = (msg: string) => setLog((l) => [msg, ...l].slice(0, 60));

  // Esc fecha o menu ou a lista; sem eles, volta ao editor (sem ir ao menu principal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // com a tela de conta aberta por cima (Entrar para criar), o Esc é dela
      if (e.key !== "Escape" || isContaOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      if (menu) setMenu(null);
      else if (criando) setCriando(null);
      else if (selecionada) setSelecionada(null);
      else if (lista) fecharLista();
      else if (passo !== null) setPasso(null);
      else onFechar();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [menu, criando, selecionada, lista, passo, onFechar]);

  const executarCombo = () => {
    if (!combo) return;
    const novo = maoDoCombo(main, extra, combo.mao);
    setT(novo);
    recomecarAnotacao(novo);
    setLp(8000);
    setFase("M1");
    setPasso(0);
    setLog([`Executar combo: mão inicial (${combo.mao.map((id) => (byId.get(id) ? displayName(byId.get(id)!) : id)).join(" + ")}).`]);
  };

  // ---------------------------------------------------------------- ações

  const moverPara = (uid: string, para: ZonaId, opts: Parameters<typeof mover>[3] & { normal?: boolean } = {}, texto?: string) => {
    const achada = (Object.keys(t) as ZonaId[]).map((z) => ({ z, c: t[z].find((c) => c.uid === uid) })).find((x) => x.c);
    if (achada?.c) {
      if (bloqueadoNoExtra(achada.c, para)) return setMenu(null);
      anotar(passoDoMovimento(achada.c, achada.z, para, opts), achada.c);
    } else {
      // matéria Xyz desanexada
      const dono = (Object.values(t) as CartaJogo[][]).flat().find((c) => c.materiais.some((m) => m.uid === uid));
      const m = dono?.materiais.find((x) => x.uid === uid);
      if (m) anotar({ t: "move", c: m.id, de: "material", para: zonaDoPasso(para) }, m);
    }
    setT((atual) => {
      const novo = mover(atual, uid, para, opts);
      return novo;
    });
    if (texto) registrar(texto);
    setMenu(null);
  };

  const livre = (zonas: ZonaId[]) => zonas.find((z) => !t[z].length);

  const acoes = (uid: string): { label: string; fazer: () => void }[] => {
    if (uid === MENU_DECK)
      return [
        { label: "Abrir deck", fazer: () => { setLista("deck"); setMenu(null); } },
        { label: "Comprar uma carta", fazer: () => { comprarUma(); setMenu(null); } },
      ];
    if (uid === MENU_EXTRA) return [{ label: "Abrir Extra Deck", fazer: () => { setLista("extra"); setMenu(null); } }];
    if (uid === MENU_TOKEN) {
      const zona = menu?.zona ?? livre(MONSTROS);
      if (!zona) return [{ label: "Sem Zona de Monstros livre", fazer: () => setMenu(null) }];
      // carta Token: nome "Token", Nível ?, ATK ?, DEF ?, tipo ? e sem atributo
      const criar = (defesa: boolean) => {
        setT((a) => criarToken(a, TOKEN_GENERICO, zona, defesa));
        registrar(`Criou um Token${defesa ? " em defesa" : ""} (${NOMES_ZONA[zona]}).`);
        anotar({ t: "invoca", c: TOKEN_GENERICO, de: "fora" });
        setMenu(null);
      };
      return [
        { label: "Criar token em ataque", fazer: () => criar(false) },
        { label: "Criar token em defesa", fazer: () => criar(true) },
      ];
    }
    const achada = (Object.keys(t) as ZonaId[]).map((z) => ({ z, c: t[z].find((c) => c.uid === uid) })).find((x) => x.c);
    if (!achada?.c) return [];
    const { z, c } = achada;
    const card = byId.get(c.id);
    const n = nomeDe(c);
    const out: { label: string; fazer: () => void }[] = [];
    // token: só fica nas Zonas de Monstros; ao sair do campo, deixa de existir
    if (c.ficha)
      return [
        { label: c.defesa ? "Posição de ataque" : "Posição de defesa", fazer: () => { setT((a) => alternar(a, uid, "defesa")); registrar(`Mudou a posição de ${n}.`); setMenu(null); } },
        { label: "Mover (clique na zona)", fazer: () => { setSelecionada(uid); setMenu(null); } },
        { label: "Tirar do campo", fazer: () => moverPara(uid, "cemiterio", {}, `${n} saiu do campo e deixou de existir.`) },
      ];
    const noCampo = ZONAS_UNICAS.has(z);
    // ativar um efeito: em qualquer zona e posição, só registra (sem regras)
    out.push({
      label: "Ativar efeito",
      fazer: () => {
        const onde = z === "mao" ? "da mão" : z === "cemiterio" ? "no Cemitério" : z === "banido" ? "banida" : z === "deck" ? "no Deck" : z === "extra" ? "no Extra Deck" : `em ${NOMES_ZONA[z]}`;
        registrar(`Ativou o efeito de ${n} (${onde}${c.baixada ? ", virada para baixo" : c.defesa ? ", em defesa" : ""}).`);
        anotar({ t: "ativa", c: c.id, de: zonaDoPasso(z) }, c);
        setAtivada(uid);
        setTimeout(() => setAtivada((a) => (a === uid ? null : a)), 1200);
        setMenu(null);
      },
    });
    const monstro = card && categoryOf(card) === "monster";
    if (!noCampo && monstro) {
      const zonaM = card && ehExtra(card) ? livre([...MONSTROS_EXTRA, ...MONSTROS]) : livre(MONSTROS);
      if (zonaM) {
        if (z === "mao" && card && !ehExtra(card)) out.push({ label: "Invocação-Normal", fazer: () => moverPara(uid, zonaM, { baixada: false, defesa: false, normal: true }, `Invocou-Normal ${n}.`) });
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
      out.push({
        label: c.baixada ? "Virar para cima" : "Virar para baixo",
        fazer: () => {
          setT((a) => alternar(a, uid, "baixada"));
          registrar(`${c.baixada ? "Virou para cima" : "Virou para baixo"} ${n}.`);
          // Magia/Armadilha baixada que vira para cima: ativação
          if (c.baixada && !monstro) anotar({ t: "ativa", c: c.id, de: "magia" }, c);
          setMenu(null);
        },
      });
      if (monstro) out.push({ label: c.defesa ? "Posição de ataque" : "Posição de defesa", fazer: () => { setT((a) => alternar(a, uid, "defesa")); registrar(`Mudou a posição de ${n}.`); setMenu(null); } });
      if (c.materiais.length) out.push({ label: `Desanexar matéria (${c.materiais.length})`, fazer: () => moverPara(c.materiais[0].uid, "cemiterio", {}, `Desanexou ${nomeDe(c.materiais[0])}.`) });
    }
    out.push({ label: "Mover (clique na zona)", fazer: () => { setSelecionada(uid); setMenu(null); } });
    const doExtra = !!card && ehExtra(card);
    if (z !== "mao" && !doExtra) out.push({ label: z === "deck" ? "Adicionar à mão" : "Para a mão", fazer: () => moverPara(uid, "mao", {}, `${n} foi para a mão${z === "deck" ? " (do Deck)" : ""}.`) });
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
    anotar({ t: "compra", c: [t.deck[0].id] }, t.deck[0]);
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
    if (c && atual && ocupada) {
      // matéria Xyz: o passo é "vira matéria", e a carta não passa pelo moverPara (que anotaria a zona)
      if (bloqueadoNoExtra(c, para)) return;
      anotar(passoDoMovimento(c, atual, "material"), c);
      setT((a) => mover(a, uid, para));
      return registrar(`${n} foi anexada como matéria.`);
    }
    // arrastar um monstro da mão para o campo: a primeira vez no teste é a Invocação-Normal
    const card = c && byId.get(c.id);
    const normal = atual === "mao" && !!card && categoryOf(card) === "monster" && !anotados.some((p) => p.t === "normal" || (p.t === "baixa" && categoryOf(byId.get(p.c)!) === "monster"));
    // da mão para uma zona de Magia/Armadilha: entra virada para cima (ativar); botão direito tem "Baixar"
    moverPara(uid, para, { normal }, `${n} → ${NOMES_ZONA[para]}.`);
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
        onMouseEnter={() => (c.id === TOKEN_GENERICO ? setPreview("token") : card && setPreview(card))}
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
        title={card ? `${bilingualName(card)} — clique para selecionar e depois clique numa zona; botão direito para ações` : undefined}
        data-card-id={c.id}
      >
        {verso ? (
          <div className="tj-verso" />
        ) : c.id === TOKEN_GENERICO ? (
          <div className="tj-token">
            <strong>Token</strong>
            <span>Nível ?</span>
            <span>? / ?</span>
          </div>
        ) : (
          <img src={cardImage(c.id, "small")} alt={card ? displayName(card) : ""} draggable={false} />
        )}
        {!verso && card && <CardSelos card={card} formato={formato} />}
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
          e.stopPropagation();
          if (id === "deck") setMenu({ uid: MENU_DECK, x: e.clientX, y: e.clientY });
          if (id === "extra") setMenu({ uid: MENU_EXTRA, x: e.clientX, y: e.clientY });
          if ((MONSTROS.includes(id) || MONSTROS_EXTRA.includes(id)) && !cartas.length) setMenu({ uid: MENU_TOKEN, x: e.clientX, y: e.clientY, zona: id });
        }}
        onClick={() => {
          if (selecionada) return colocar(selecionada, id);
          // Deck e Extra Deck só respondem ao botão direito (Abrir / Comprar uma carta)
          if (id === "deck" || id === "extra") return;
          if (pilha && cartas.length) setLista(id);
        }}
        title={id === "deck" ? "Botão direito: Abrir deck ou Comprar uma carta" : id === "extra" ? "Botão direito: Abrir Extra Deck" : pilha ? `${NOMES_ZONA[id]} — clique para ver` : NOMES_ZONA[id]}
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
        {preview === "token" ? (
          <>
            <div className="tj-token tj-token-grande">
              <strong>Token</strong>
              <span>Nível ?</span>
              <span>ATK ? / DEF ?</span>
            </div>
            <strong>Token</strong>
            <small>Monstro Token · Nível ? · Tipo ? · Sem atributo</small>
            <small>ATK ? / DEF ?</small>
            <p className="tags-note">Criado no teste: fica só nas Zonas de Monstros e, ao sair do campo, deixa de existir.</p>
          </>
        ) : preview ? (
          <>
            <img src={cardImage(preview.id, "full")} alt={displayName(preview)} />
            <strong>{displayName(preview)}</strong>
            <small>
              {kindLabel(preview)}
              {categoryOf(preview) === "monster" && levelLabel(preview) && ` · ${levelLabel(preview)}`}
            </small>
            <PapeisDaCarta card={preview} />
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
          // classificação das cartas da mão (hand trap, starter, floodgate, staple…)
          const papeis = contarPapeis(t.mao.map((c) => byId.get(c.id)).filter((c): c is Card => !!c));
          return (
            <>
            <div className="tj-prob-mao">
              <span title={`Chance de abrir exatamente estas ${ids.length} cartas, em qualquer ordem, com este Deck de ${main.length} (hipergeométrica multivariada).`}>
                <span className="field-label">Esta mão</span> <strong>{p > 0 ? pct(p) : "—"}</strong>
                {/* exemplo em 100 mãos: em quantas delas esta mão viria */}
                {p > 0 && <small> {(p * 100).toLocaleString("pt-BR", { maximumSignificantDigits: 2 })} em 100 mãos</small>}
              </span>
              {geral.p > 0 && (
                <span className="tj-prob-geral" title={`Chance de abrir qualquer mão com o mesmo perfil: ${geral.perfil}.`}>
                  <span className="field-label">Geral</span> <strong>{pct(geral.p)}</strong> <small>{geral.perfil}</small>
                </span>
              )}
            </div>
            <div className="tj-papeis-mao" aria-label="Classificação das cartas da mão">
              <span className="field-label">Nesta mão</span>
              {papeis.porPapel.map(({ papel, n }) => (
                <span key={papel.id} className="tj-papel" title={`${n} ${n === 1 ? "carta" : "cartas"} ${papel.label} na mão`}>
                  <span className="selo-papel" style={{ background: papel.cor }}>
                    {papel.sigla}
                  </span>{" "}
                  {papel.label} <strong>{n}</strong>
                </span>
              ))}
              {papeis.semPapel > 0 && (
                <span className="tj-papel">
                  Sem classificação <strong>{papeis.semPapel}</strong>
                </span>
              )}
            </div>
            </>
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
              const novo = testeDeMao(main, extra);
              setT(novo);
              recomecarAnotacao(novo);
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
          <button className="ghost-btn tj-criar-token" onClick={(e) => setMenu({ uid: MENU_TOKEN, x: e.clientX, y: e.clientY })} title="Cria um token numa Zona de Monstros livre (ou clique com o botão direito numa zona vazia)">
            Criar token
          </button>
          <button className="ghost-btn" onClick={() => registrar(`Dado: ${aleatorio(6) + 1}.`)}>Dado</button>
          <button className="ghost-btn" onClick={() => registrar(`Moeda: ${aleatorio(2) ? "cara" : "coroa"}.`)}>Moeda</button>
          <button className="ghost-btn" onClick={onFechar}>Voltar ao editor</button>
          <button
            className="ghost-btn tj-criar-combo"
            onClick={() => {
              setGravacao(null);
              setCriando({ titulo: tituloSugerido(), obs: "", compartilhar: false });
            }}
            title="Cria um combo com os passos feitos neste teste (desde a mão inicial)"
          >
            Criar combo
          </button>
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

      {criando && (() => {
        const grupos = groupSteps(anotados);
        const campo = campoDoTabuleiro(t);
        const copias = copiasUsadas();
        return (
          <div className="tj-criar-fundo" onClick={() => setCriando(null)}>
            <div className="tj-criar" role="dialog" aria-label="Criar combo" onClick={(e) => e.stopPropagation()}>
              <div className="fontes-head">
                <h4>Criar combo</h4>
                <button className="ghost-btn" onClick={() => setCriando(null)} aria-label="Fechar">✕</button>
              </div>
              <p className="tj-criar-mao">
                <span className="field-label">Mão inicial</span> {maoInicial.map((c) => nomeId(c.id)).join(" + ") || "—"}
              </p>
              {anotados.length ? (
                <ol className="tj-criar-passos">
                  {anotados.map((p, i) => (
                    <li key={i}>
                      {textoPasso(p)}
                      <button className="link-btn" onClick={() => setAnotados((ps) => ps.filter((_, j) => j !== i))} aria-label={`Tirar o passo ${i + 1}`} title="Tirar este passo">
                        ✕
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="db-warning">Nenhum passo ainda: jogue a partir da mão inicial (invocar, ativar, mover…) e volte aqui.</p>
              )}
              {grupos.length > 0 && (campo.monstros.length > 0 || campo.magias.length > 0) && (
                <p className="tj-criar-campo">
                  <span className="field-label">Campo final</span> {[...campo.monstros, ...campo.magias.map(([id]) => id)].map(nomeId).join(", ")}
                </p>
              )}
              <div className="tj-criar-validade">
                {FORMATS.map((f) => {
                  const v = validadeNoFormato(copias, byId, f);
                  return (
                    <span key={f} className={`vc-badge combo-validade ${v.valido ? "valido" : "invalido"}`} title={v.valido ? `Cartas e cópias permitidas na banlist atual do ${f}.` : v.problemas.join("\n")}>
                      {v.valido ? `Válido no ${f}` : `Fora da banlist do ${f}: ${v.problemas.join("; ")}`}
                    </span>
                  );
                })}
              </div>
              <label className="field">
                <span className="field-label">Título</span>
                <input value={criando.titulo} maxLength={120} onChange={(e) => setCriando({ ...criando, titulo: e.target.value })} aria-label="Título do combo" />
              </label>
              <label className="field">
                <span className="field-label">Observações</span>
                <textarea rows={2} maxLength={2000} value={criando.obs} onChange={(e) => setCriando({ ...criando, obs: e.target.value })} />
              </label>
              <label className="tj-criar-compartilhar">
                <input type="checkbox" checked={criando.compartilhar} onChange={(e) => setCriando({ ...criando, compartilhar: e.target.checked })} />
                Compartilhar: divulgar para todos na aba Combos, com o seu nome de usuário e a data de criação
              </label>
              {gravacao && <p className={gravacao.tipo === "erro" ? "db-warning" : "conta-ok"}>{gravacao.texto}</p>}
              <div className="dialog-actions">
                <button className="ghost-btn" onClick={() => setCriando(null)}>
                  Cancelar
                </button>
                {conta ? (
                  <button className="ghost-btn tj-criar-ok" disabled={!anotados.length || !criando.titulo.trim() || gravacao?.tipo === "gravando"} onClick={() => void gravarCombo()}>
                    Criar combo
                  </button>
                ) : (
                  <button className="ghost-btn tj-criar-entrar" onClick={() => openConta()}>
                    Entrar para criar
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {!criando && gravacao?.tipo === "ok" && (
        <p className="tj-criado conta-ok" role="status">
          {gravacao.texto}
        </p>
      )}

      {lista && (
        <div className="tj-lista" role="dialog" aria-label={NOMES_ZONA[lista]}>
          <div className="fontes-head">
            <h4>
              {NOMES_ZONA[lista]} ({t[lista].length})
            </h4>
            {/* com o Deck aberto, as opções do Deck continuam à mão */}
            {lista === "deck" && (
              <button className="ghost-btn tj-lista-comprar" onClick={comprarUma} disabled={!t.deck.length}>
                Comprar uma carta
              </button>
            )}
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
