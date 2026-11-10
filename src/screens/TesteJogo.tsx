import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ehExtra } from "../db/decks";
import { cardImage } from "../db/images";
import { kindLabel, levelLabel } from "../db/labels";
import {
  acharCarta,
  adicionarCarta,
  aleatorio,
  removerCarta,
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
  executarPasso,
  maoDoCombo,
  MAGIAS,
  MONSTROS,
  MONSTROS_EXTRA,
  mover,
  NOMES_ZONA,
  tabuleiroInicial,
  testeDeMao,
  ZONAS_UNICAS,
  type CartaJogo,
  type PassoAplicado,
  type Tabuleiro,
  type TipoCarta,
  type ZonaId,
} from "../db/testeJogo";
import { bilingualName, categoryOf, displayName, type Card } from "../db/types";
import { CARTA_QUALQUER, passoEmTexto, semCartaDoCalculo, type CampoFinal, type Passo } from "../db/motor";
import { groupSteps } from "../components/VerifiedCombos";
import CardSelos, { PapeisDaCarta } from "../components/CardSelos";
import { contarPapeis } from "../db/classificacao";
import { FontesButton } from "../components/Fontes";
import { isContaOpen, openConta } from "../components/Conta";
import { arquetiposDe, arquetiposSemCartas, avisoSemCartas, criarComboDoTeste, ordemParaGravar, validadeNoFormato } from "../db/baseCombos";
import VincularArquetipos from "../components/VincularArquetipos";
import PassosOrdenaveis from "../components/PassosOrdenaveis";
import { temRecursosAvancados, useConta } from "../db/conta";
import { salvarComboLocal } from "../db/combosLocais";
import { FORMATS, legalIn, type GameFormat } from "../db/legality";
import { useCardDb } from "../db/cardStore";
import { indiceDeRespostas } from "../db/respostas";
import { outroLado, type Evento, type Lado, type LadoCampo, type Situacao } from "../db/indicacoes";
import { indicar, type CartaDoLado } from "../db/indicar";
import IndicacoesResposta, { type EntradaIndicacao } from "../components/IndicacoesResposta";
import AdicionarCarta, { type Destino } from "../components/AdicionarCarta";
import "./teste-jogo.css";
import { t as tr, LOCALE } from "../i18n";
import Lateral from "../components/Lateral";

// Teste de Jogo (Solo Mode): sem regras de jogo; o jogador move as cartas à vontade.
// Teste Avançado (Usuário Avançado ou Mentor): o mesmo teste embaixo e o campo do oponente espelhado
// em cima, com cartas adicionadas à mão (não saem de deck nenhum), e as Indicações de resposta a cada
// ação. É um facilitador: as indicações vêm de regras escritas pelo texto das cartas, do motor de
// combos e do uso em torneios, sem simular a corrente.

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
  /** campo final: a mão que sobra no fim entra na mão inicial do teste contra a IA */
  campo?: CampoFinal;
  /** cartas quaisquer da mão (para descarte), que o deck temporário não traz */
  qualquer?: number;
  /** "Editar e Importar" (combo lido de vídeo): título e fontes vão para o Criar combo */
  titulo?: string;
  fontes?: { nome: string; url: string }[];
  /** abre já em "Executar combo" (mão do combo e caixa de passos) */
  iniciar?: boolean;
}

export default function TesteJogo({
  nome,
  main,
  extra,
  byId,
  formato = "TCG",
  onFechar,
  onImportar,
  combo,
  avancado = false,
  onModo,
}: {
  nome: string;
  main: number[];
  extra: number[];
  byId: Map<number, Card>;
  /** formato do editor: banlist dos selos nas cartas */
  formato?: GameFormat;
  onFechar: () => void;
  /** deck temporário de um combo: "Importar Deck" leva o deck a Meus decks (devolve o nome usado) */
  onImportar?: () => string;
  /** aberto pela tela de Combos: habilita o "Executar combo" */
  combo?: ComboTeste;
  /** Teste Avançado: campo do oponente e Indicações de resposta */
  avancado?: boolean;
  /** troca entre o Teste de Jogo e o Teste Avançado (só para Avançado e Mentor) */
  onModo?: (avancado: boolean) => void;
}) {
  // passo atual do "Executar combo" (null: caixa de passos fechada)
  const [passo, setPasso] = useState<number | null>(null);
  // passos já aplicados pelo "Executar" (não se aplica o mesmo passo duas vezes)
  const [executados, setExecutados] = useState<Set<number>>(new Set());
  // "Retornar": como tudo estava antes de cada Executar (o último no fim), para desfazer passo a passo
  const [historico, setHistorico] = useState<
    { passo: number; t: Tabuleiro; anotados: Passo[]; criados: Passo[]; usadas: Map<string, number>; indicacoes: EntradaIndicacao[] }[]
  >([]);
  // efeito ativado pelo "Executar": as cartas aparecem em destaque no centro por um instante
  const [anuncio, setAnuncio] = useState<{ ids: number[]; n: number } | null>(null);
  useEffect(() => {
    if (!anuncio) return;
    const id = setTimeout(() => setAnuncio(null), 1800);
    return () => clearTimeout(id);
  }, [anuncio]);
  const grupos = combo ? groupSteps(semCartaDoCalculo({ qualquer: combo.qualquer, passos: combo.passos }).passos) : [];
  const textoPasso = (p: Passo) => {
    const t = passoEmTexto(p, (id) => (id === TOKEN_GENERICO ? tr("Token") : id === CARTA_QUALQUER ? tr("carta qualquer") : byId.get(id) ? displayName(byId.get(id)!) : `#${id}`));
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
    registrar(tr("Embaralhou o Deck."));
  };
  /**
   * Fecha a visualização; ao fechar a do Deck, só as cartas que ficaram no Deck são embaralhadas
   * (mão, campo, Cemitério e banidas continuam como estão), como no Duelingbook
   */
  const fecharLista = () => {
    if (lista === "deck" && listaLado === "eu") embaralhar();
    setLista(null);
  };
  const [lista, setLista] = useState<ZonaId | null>(null);
  const [listaLado, setListaLado] = useState<Lado>("eu");
  const abrirLista = (z: ZonaId, lado: Lado = "eu") => {
    setListaLado(lado);
    setLista(z);
  };
  const [log, setLog] = useState<string[]>([tr("Teste de Mão: Deck embaralhado, 5 cartas compradas.")]);
  const arrastando = useRef<string | null>(null);

  // Criar combo: cada ação vira um passo (como nas linhas da tela de Combos), a partir da mão inicial
  const conta = useConta();
  const [anotados, setAnotados] = useState<Passo[]>([]);
  // os mesmos passos na ordem em que foram feitos (Voltar para a ordem original no Criar combo)
  const [criados, setCriados] = useState<Passo[]>([]);
  const [maoInicial, setMaoInicial] = useState<CartaJogo[]>(t.mao);
  // cópias usadas no combo: cada carta (uid) que saiu do Deck/Extra Deck ou começou na mão
  const usadas = useRef(new Map<string, number>());
  const [criando, setCriando] = useState<{ titulo: string; obs: string; compartilhar: boolean; arquetipos: string[] } | null>(null);
  const [gravacao, setGravacao] = useState<{ tipo: "ok" | "erro" | "gravando"; texto: string } | null>(null);
  const recomecarAnotacao = (novo: Tabuleiro) => {
    setAnotados([]);
    setCriados([]);
    setMaoInicial(novo.mao);
    usadas.current = new Map();
    setGravacao(null);
  };
  /** `virada`: Magia/Armadilha baixada que acabou de ser virada (ativação da carta) */
  const anotar = (p: Passo | null, c?: CartaJogo, opts: { virada?: boolean } = {}) => {
    if (!p) return;
    setAnotados((ps) => anotarPasso(ps, p));
    setCriados((ps) => anotarPasso(ps, p));
    // tokens não contam como cópias de cartas do deck
    if (c && !c.ficha) usadas.current.set(c.uid, c.id);
    avaliar(p, "eu", opts);
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
  /** arquétipos das cartas usadas no combo (sugeridos e marcados de início ao vincular) */
  const arquetiposDoCombo = () => arquetiposDe([...copiasUsadas().keys()].map((id) => byId.get(id)).filter((c): c is Card => !!c));
  const gravarCombo = async () => {
    if (!criando || !conta) return;
    const copias = copiasUsadas();
    // compartilhar com um arquétipo que o combo não usa: avisa, não grava e mantém o formulário aberto
    const faltam = criando.compartilhar && temRecursosAvancados(conta) ? arquetiposSemCartas(criando.arquetipos, copias.keys(), byId) : [];
    if (faltam.length) return setGravacao({ tipo: "erro", texto: avisoSemCartas(faltam) });
    setGravacao({ tipo: "gravando", texto: tr("Criando o combo…") });
    const autorNome = conta.usuario || conta.email.split("@")[0];
    const dadosCombo = {
      iniciais: maoInicial.map((c) => c.id),
      arquetipos: criando.arquetipos,
      dados: { passos: anotados, passosOriginais: ordemParaGravar(anotados, criados), campo: campoDoTabuleiro(t), copias: Object.fromEntries(copias), teste: true, ...(combo?.fontes?.length ? { fontes: combo.fontes } : {}) },
    };
    // Usuário Padrão: o combo fica só neste aparelho (aba Combos → Meus combos neste aparelho)
    if (!temRecursosAvancados(conta)) {
      salvarComboLocal({ autorId: conta.id, autorNome, titulo: criando.titulo, observacoes: criando.obs }, dadosCombo);
      setGravacao({ tipo: "ok", texto: tr("Combo criado neste aparelho (Usuário Padrão): está na aba Combos, em Meus combos neste aparelho, de onde pode ser exportado depois.") });
      setCriando(null);
      return;
    }
    try {
      await criarComboDoTeste({ autorNome, titulo: criando.titulo, observacoes: criando.obs, compartilhar: criando.compartilhar }, dadosCombo);
      setGravacao({
        tipo: "ok",
        texto: criando.compartilhar ? tr("Combo criado e compartilhado: aparece para todos na aba Combos, com o seu nome e a data.") : tr("Combo criado. Só você vê (aba Combos)."),
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
    registrar(tr("{0} é do Extra Deck: só pode ser invocado, ir para o Cemitério ou ser banido.", [displayName(card)]));
    return true;
  };

  const nomeDe = (c: CartaJogo) => {
    const card = byId.get(c.id);
    return card ? displayName(card) : c.id === TOKEN_GENERICO ? "Token" : `#${c.id}`;
  };
  const registrar = (msg: string) => setLog((l) => [msg, ...l].slice(0, 60));

  // ---------------------------------------------------------------- Teste Avançado

  // campo do oponente: cartas adicionadas pelo jogador (sem Deck nem Extra Deck)
  const [op, setOp] = useState<Tabuleiro>(() => tabuleiroInicial([], []));
  const [lpOp, setLpOp] = useState(8000);
  const [lpOpAjuste, setLpOpAjuste] = useState("");
  const [turno, setTurno] = useState<Lado>("eu");
  const [adicionando, setAdicionando] = useState(false);
  const [indicacoes, setIndicacoes] = useState<EntradaIndicacao[]>([]);
  const [painelInd, setPainelInd] = useState(true);
  // por lado, neste turno: Invocações, Invocações-Especiais e efeito de monstro ativado na mão/Cemitério
  const novoTurno = () => ({ eu: { inv: 0, esp: 0, maoGY: false }, op: { inv: 0, esp: 0, maoGY: false } });
  const [contagens, setContagens] = useState(novoTurno);
  const contagensRef = useRef(contagens);
  const zerarTurno = () => {
    contagensRef.current = novoTurno();
    setContagens(contagensRef.current);
  };
  const tabuleiro = (l: Lado) => (l === "eu" ? t : op);
  /** de que lado é a carta (as duas mesas têm uids diferentes) */
  const ladoDe = (uid: string): Lado | null => (acharCarta(t, uid) ? "eu" : acharCarta(op, uid) ? "op" : null);

  const extrasDb = useCardDb().extras;
  const indice = useMemo(() => (avancado && extrasDb?.combos ? indiceDeRespostas(extrasDb.combos) : null), [avancado, extrasDb?.combos]);
  const todas = useMemo(() => (avancado ? [...byId.values()] : []), [avancado, byId]);
  const byName = useMemo(() => new Map(todas.map((c) => [c.name, c])), [todas]);

  const ZONAS_CAMPO: ZonaId[] = [...MONSTROS, ...MONSTROS_EXTRA, ...MAGIAS, "campo-magia"];
  const campoDe = (b: Tabuleiro): LadoCampo => {
    const monstros = [...MONSTROS, ...MONSTROS_EXTRA].flatMap((z) => b[z]);
    const magias = (["campo-magia", ...MAGIAS] as ZonaId[]).flatMap((z) => b[z]);
    return {
      cartas: monstros.length + magias.length,
      monstros: monstros.length,
      magias: magias.length,
      monstrosEfeito: monstros.filter((c) => !c.baixada && !c.ficha && byId.get(c.id)?.frame !== "normal").length,
    };
  };
  /** cartas com que um lado pode responder: mão e campo (monstros baixados não respondem) */
  const cartasDoLado = (b: Tabuleiro): CartaDoLado[] => [
    ...b.mao.map((c): CartaDoLado => ({ id: c.id, card: byId.get(c.id), onde: "mao" })),
    ...ZONAS_CAMPO.flatMap((z) => b[z])
      .filter((c) => !c.ficha)
      .flatMap((c): CartaDoLado[] => {
        const card = byId.get(c.id);
        if (!c.baixada) return [{ id: c.id, card, onde: "campo" }];
        return card && categoryOf(card) !== "monster" ? [{ id: c.id, card, onde: "baixada" }] : [];
      }),
  ];

  /** Indicações de resposta: o que o outro lado pode fazer depois desta ação */
  const avaliar = (p: Passo, lado: Lado, opts: { virada?: boolean } = {}) => {
    if (!avancado || p.t === "texto") return;
    const id = p.t === "compra" ? p.c[0] : p.c;
    const card = byId.get(id);
    const monstro = !!card && categoryOf(card) === "monster";
    const de = p.t === "compra" ? "deck" : p.t === "normal" || p.t === "baixa" ? "mao" : p.de;
    const ev: Evento = {
      lado,
      tipo: p.t,
      id,
      card,
      de,
      para: p.t === "move" ? p.para : undefined,
      metodo: p.t === "invoca" ? p.m : undefined,
      cartaAtivada: p.t === "ativa" && !monstro && (p.de === "mao" || !!opts.virada),
    };
    // contagens do turno, já com esta ação
    const k = { ...contagensRef.current[lado] };
    if (p.t === "normal" || p.t === "invoca") k.inv++;
    if (p.t === "invoca") k.esp++;
    if (p.t === "ativa" && monstro && (p.de === "mao" || p.de === "cemiterio")) k.maoGY = true;
    contagensRef.current = { ...contagensRef.current, [lado]: k };
    setContagens(contagensRef.current);
    // o tabuleiro ainda não tem a carta que acabou de entrar no campo
    const agente = campoDe(tabuleiro(lado));
    if (p.t === "normal" || p.t === "invoca") {
      agente.cartas++;
      agente.monstros++;
      if (card?.frame !== "normal") agente.monstrosEfeito++;
    } else if (ev.cartaAtivada && p.t === "ativa" && p.de === "mao") {
      agente.cartas++;
      agente.magias++;
    }
    const outro = outroLado(lado);
    const resp = tabuleiro(outro);
    const fadas = resp.mao.filter((c) => byId.get(c.id)?.race === "Fairy").length;
    const herald = resp.mao.some((c) => byId.get(c.id)?.name === "Herald of Orange Light");
    const s: Situacao = {
      fase,
      turno,
      invocacoes: k.inv,
      especiais: k.esp,
      ativouMaoOuGY: k.maoGY,
      agente,
      respondente: {
        ...campoDe(resp),
        cemiterio: resp.cemiterio.length,
        // o Main Deck de quem responde só é conhecido do seu lado (Crossout Designator)
        deck: outro === "eu" ? main : undefined,
        fadasNaMao: fadas - (herald ? 1 : 0),
      },
    };
    const r = indicar(ev, s, cartasDoLado(resp), {
      byName,
      byId,
      uso: extrasDb?.uso,
      respondedores: extrasDb?.respondedores,
      indice,
      legal: (c) => legalIn(c, formato),
    });
    setIndicacoes((l) => [{ r, passo: p, lado }, ...l].slice(0, 30));
  };

  // Esc fecha o menu ou a lista; sem eles, volta ao editor (sem ir ao menu principal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // com a tela de conta aberta por cima (Entrar para criar), o Esc é dela
      if (e.key !== "Escape" || isContaOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      if (menu) setMenu(null);
      else if (adicionando) setAdicionando(false);
      else if (criando) setCriando(null);
      else if (selecionada) setSelecionada(null);
      else if (lista) fecharLista();
      else if (passo !== null) setPasso(null);
      else onFechar();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [menu, adicionando, criando, selecionada, lista, passo, onFechar]);

  const executarCombo = () => {
    if (!combo) return;
    const novo = maoDoCombo(main, extra, combo.mao);
    setT(novo);
    recomecarAnotacao(novo);
    setLp(8000);
    setFase("M1");
    setPasso(0);
    setExecutados(new Set());
    setHistorico([]);
    setIndicacoes([]);
    zerarTurno();
    setLog([tr("Executar combo: mão inicial ({0}).", [combo.mao.map((id) => (byId.get(id) ? displayName(byId.get(id)!) : id)).join(" + ")])]);
  };
  // "Editar e Importar": começa direto no combo, para o usuário refazer os passos
  useEffect(() => {
    if (combo?.iniciar) executarCombo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  /** zona do outro lado que ocupa a mesma Zona de Monstros Extra (compartilhada no Teste Avançado) */
  const espelhoEMZ = (z: ZonaId): ZonaId => (z === "em0" ? "em1" : "em0");
  const emzOcupada = (z: ZonaId, lado: Lado) => avancado && MONSTROS_EXTRA.includes(z) && tabuleiro(outroLado(lado))[espelhoEMZ(z)].length > 0;
  const livreNo = (lado: Lado, zonas: ZonaId[]) => zonas.find((z) => !tabuleiro(lado)[z].length && !emzOcupada(z, lado));
  const livre = (zonas: ZonaId[]) => livreNo("eu", zonas);

  // ---------------------------------------------------------------- Executar (passo do combo)

  const tipoCarta = (id: number): TipoCarta => {
    const c = byId.get(id);
    if (!c) return { monstro: true, extra: false, xyz: false, campo: false, permanece: false };
    const monstro = categoryOf(c) === "monster" || c.frame === "token";
    return {
      monstro,
      extra: ehExtra(c),
      xyz: c.frame.startsWith("xyz"),
      campo: c.frame === "spell" && c.race === "Field",
      permanece: !monstro && ["Continuous", "Field", "Equip"].includes(c.race),
    };
  };
  /** Aplica no tabuleiro o passo atual (e as consequências dele), como se o usuário tivesse feito à mão */
  const executarPassoAtual = () => {
    const g = passo !== null ? grupos[passo] : undefined;
    if (passo === null || !g) return;
    const antes = { passo, t, anotados, criados, usadas: new Map(usadas.current), indicacoes };
    let tab = t;
    const aplicados: PassoAplicado[] = [];
    const falhas: Passo[] = [];
    for (const p of [g.step, ...g.subs]) {
      const r = executarPasso(tab, p, tipoCarta, (z) => !emzOcupada(z, "eu"));
      tab = r.t;
      aplicados.push(...r.aplicados);
      falhas.push(...r.falhas);
    }
    setT(tab);
    // histórico, Criar combo e Indicações: um registro por passo; as outras cartas (matérias, compras) contam como usadas
    const vistos = new Set<Passo>();
    for (const a of aplicados) {
      if (vistos.has(a.p)) {
        if (!a.carta.ficha) usadas.current.set(a.carta.uid, a.carta.id);
        continue;
      }
      vistos.add(a.p);
      // sem as respostas calculadas pelo pipeline (o Criar combo grava só o passo)
      const limpo: Passo = { ...a.p };
      delete limpo.resp;
      anotar(limpo, a.carta);
    }
    for (const f of falhas) registrar(tr("Não deu para executar: {0} (a carta não está onde o passo indica ou não há zona livre).", [textoPasso(f)]));
    if (!aplicados.length) return;
    registrar(tr("Executou o passo {0}: {1}", [passo + 1, textoPasso(g.step)]));
    const ativadas = aplicados.filter((a) => a.ativou);
    if (ativadas.length) {
      setAnuncio({ ids: ativadas.map((a) => a.carta.id), n: Date.now() });
      const uid = ativadas[0].carta.uid;
      setAtivada(uid);
      setTimeout(() => setAtivada((a) => (a === uid ? null : a)), 1800);
    }
    setHistorico((h) => [...h, antes]);
    setExecutados((e) => new Set(e).add(passo));
    if (passo < grupos.length - 1) setPasso(passo + 1);
  };
  /** Retornar: desfaz o último passo executado (tabuleiro, passos anotados e indicações) e volta para ele */
  const retornarExecucao = () => {
    const antes = historico[historico.length - 1];
    if (!antes) return;
    setHistorico((h) => h.slice(0, -1));
    setT(antes.t);
    setAnotados(antes.anotados);
    setCriados(antes.criados);
    usadas.current = antes.usadas;
    setIndicacoes(antes.indicacoes);
    setExecutados((e) => {
      const novo = new Set(e);
      novo.delete(antes.passo);
      return novo;
    });
    setPasso(antes.passo);
    setAnuncio(null);
    registrar(tr("Retornou ao passo {0}.", [antes.passo + 1]));
  };

  // ---------------------------------------------------------------- oponente (Teste Avançado)

  /** Move uma carta do oponente; a ação gera as indicações do que você pode responder */
  const moverOp = (uid: string, para: ZonaId, opts: Parameters<typeof mover>[3] & { normal?: boolean } = {}, texto?: string) => {
    const achada = acharCarta(op, uid);
    setMenu(null);
    if (!achada) return;
    if (bloqueadoNoExtra(achada.carta, para)) return;
    const p: Passo | null = achada.dono ? { t: "move", c: achada.carta.id, de: "material", para: zonaDoPasso(para) } : passoDoMovimento(achada.carta, achada.zona, para, opts);
    setOp((a) => mover(a, uid, para, opts));
    if (p) avaliar(p, "op");
    if (texto) registrar(tr("Oponente: {0}", [texto]));
  };

  const ativarOp = (c: CartaJogo, z: ZonaId) => {
    // carta virada para baixo no campo: ativar vira para cima
    const virada = ZONAS_UNICAS.has(z) && c.baixada;
    if (virada) setOp((a) => alternar(a, c.uid, "baixada"));
    registrar(tr("Oponente ativou o efeito de {0}.", [nomeDe(c)]));
    avaliar({ t: "ativa", c: c.id, de: zonaDoPasso(z) }, "op", { virada });
    setAtivada(c.uid);
    setTimeout(() => setAtivada((a) => (a === c.uid ? null : a)), 1200);
    setMenu(null);
  };

  const acoesOp = (uid: string): { label: string; fazer: () => void }[] => {
    const achada = acharCarta(op, uid);
    if (!achada || achada.dono) return [];
    const { zona: z, carta: c } = achada;
    const card = byId.get(c.id);
    const n = nomeDe(c);
    const monstro = !!card && categoryOf(card) === "monster";
    const doExtra = !!card && ehExtra(card);
    const noCampo = ZONAS_UNICAS.has(z);
    const out: { label: string; fazer: () => void }[] = [{ label: tr("Ativar efeito"), fazer: () => ativarOp(c, z) }];
    if (!noCampo && monstro) {
      const zonaM = livreNo("op", doExtra ? [...MONSTROS_EXTRA, ...MONSTROS] : MONSTROS);
      if (zonaM) {
        if (z === "mao" && !doExtra) out.push({ label: tr("Invocação-Normal"), fazer: () => moverOp(uid, zonaM, { baixada: false, defesa: false, normal: true }, tr("Invocou-Normal {0}.", [n])) });
        out.push({ label: tr("Invocar em ataque"), fazer: () => moverOp(uid, zonaM, { baixada: false, defesa: false }, tr("Invocou {0}.", [n])) });
        out.push({ label: tr("Invocar em defesa"), fazer: () => moverOp(uid, zonaM, { baixada: false, defesa: true }, tr("Invocou {0} em defesa.", [n])) });
        if (!doExtra) out.push({ label: tr("Baixar (virado para baixo)"), fazer: () => moverOp(uid, zonaM, { baixada: true, defesa: true }, tr("Baixou um monstro.")) });
      }
    }
    if (!noCampo && card && !monstro) {
      const zonaS = card.race === "Field" ? (op["campo-magia"].length ? undefined : "campo-magia") : livreNo("op", MAGIAS);
      if (zonaS) {
        out.push({ label: tr("Ativar"), fazer: () => moverOp(uid, zonaS, { baixada: false }, tr("Ativou {0}.", [n])) });
        out.push({ label: tr("Baixar"), fazer: () => moverOp(uid, zonaS, { baixada: true }, tr("Baixou uma carta.")) });
      }
    }
    if (noCampo) {
      out.push({
        label: c.baixada ? tr("Virar para cima") : tr("Virar para baixo"),
        fazer: () => {
          setOp((a) => alternar(a, uid, "baixada"));
          registrar(tr("Oponente {0} {1}.", [c.baixada ? tr("virou para cima") : tr("virou para baixo"), n]));
          if (c.baixada && !monstro) avaliar({ t: "ativa", c: c.id, de: "magia" }, "op", { virada: true });
          setMenu(null);
        },
      });
      if (monstro) out.push({ label: c.defesa ? tr("Posição de ataque") : tr("Posição de defesa"), fazer: () => { setOp((a) => alternar(a, uid, "defesa")); registrar(tr("Oponente mudou a posição de {0}.", [n])); setMenu(null); } });
      if (c.materiais.length) out.push({ label: tr("Desanexar matéria ({0})", [c.materiais.length]), fazer: () => moverOp(c.materiais[0].uid, "cemiterio", {}, tr("Desanexou {0}.", [nomeDe(c.materiais[0])])) });
    }
    out.push({ label: tr("Mover (clique na zona)"), fazer: () => { setSelecionada(uid); setMenu(null); } });
    if (z !== "mao" && !doExtra) out.push({ label: tr("Para a mão"), fazer: () => moverOp(uid, "mao", {}, tr("{0} voltou para a mão.", [n])) });
    if (z !== "cemiterio") out.push({ label: tr("Para o Cemitério"), fazer: () => moverOp(uid, "cemiterio", {}, tr("{0} foi para o Cemitério.", [n])) });
    if (z !== "banido") out.push({ label: tr("Banir"), fazer: () => moverOp(uid, "banido", {}, tr("Baniu {0}.", [n])) });
    out.push({ label: tr("Tirar do teste"), fazer: () => { setOp((a) => removerCarta(a, uid)); registrar(tr("Oponente: {0} saiu do teste.", [n])); setMenu(null); } });
    return out;
  };

  /** "+ Carta do oponente": coloca a carta (cenário) ou a joga como ação do oponente */
  const adicionarAoOponente = (card: Card, destino: Destino, comoAcao: boolean) => {
    const monstro = categoryOf(card) === "monster";
    const doExtra = ehExtra(card);
    const zona: ZonaId | undefined =
      destino === "mao" || destino === "cemiterio" || destino === "banido"
        ? destino
        : destino.startsWith("monstro")
          ? livreNo("op", doExtra ? [...MONSTROS_EXTRA, ...MONSTROS] : MONSTROS)
          : card.race === "Field"
            ? op["campo-magia"].length
              ? undefined
              : "campo-magia"
            : livreNo("op", MAGIAS);
    if (!zona) return registrar(tr("Oponente: sem zona livre para {0}.", [displayName(card)]));
    const opts = { baixada: destino === "monstro-baixado" || destino === "magia-baixada", defesa: destino === "monstro-defesa" || destino === "monstro-baixado" };
    setOp((a) => adicionarCarta(a, card.id, zona, opts).t);
    registrar(tr("Oponente: {0} → {1}{2}.", [displayName(card), NOMES_ZONA[zona], comoAcao ? "" : tr(" (cenário)")]));
    if (comoAcao)
      avaliar(monstro ? { t: "invoca", c: card.id, de: doExtra ? "extra" : "mao", m: doExtra ? metodoDoExtra(card.frame) : undefined } : { t: "ativa", c: card.id, de: "mao" }, "op");
    setAdicionando(false);
  };

  /** Coloca uma carta do oponente na zona dele (em zona ocupada, vira matéria Xyz) */
  const colocarOp = (uid: string, para: ZonaId) => {
    const achada = acharCarta(op, uid);
    if (!achada || achada.zona === para) return;
    const n = nomeDe(achada.carta);
    if (ZONAS_UNICAS.has(para) && op[para].length) {
      if (bloqueadoNoExtra(achada.carta, para)) return;
      const p = passoDoMovimento(achada.carta, achada.zona, "material");
      setOp((a) => mover(a, uid, para));
      if (p) avaliar(p, "op");
      return registrar(tr("Oponente: {0} foi anexada como matéria.", [n]));
    }
    moverOp(uid, para, {}, `${n} → ${NOMES_ZONA[para]}.`);
  };

  const acoes = (uid: string): { label: string; fazer: () => void }[] => {
    if (uid === MENU_DECK)
      return [
        { label: tr("Abrir deck"), fazer: () => { abrirLista("deck"); setMenu(null); } },
        { label: tr("Comprar uma carta"), fazer: () => { comprarUma(); setMenu(null); } },
      ];
    if (uid === MENU_EXTRA) return [{ label: tr("Abrir Extra Deck"), fazer: () => { abrirLista("extra"); setMenu(null); } }];
    if (uid === MENU_TOKEN) {
      const zona = menu?.zona ?? livre(MONSTROS);
      if (!zona) return [{ label: tr("Sem Zona de Monstros livre"), fazer: () => setMenu(null) }];
      // carta Token: nome "Token", Nível ?, ATK ?, DEF ?, tipo ? e sem atributo
      const criar = (defesa: boolean) => {
        setT((a) => criarToken(a, TOKEN_GENERICO, zona, defesa));
        registrar(tr("Criou um Token{0} ({1}).", [defesa ? tr(" em defesa") : "", NOMES_ZONA[zona]]));
        anotar({ t: "invoca", c: TOKEN_GENERICO, de: "fora" });
        setMenu(null);
      };
      return [
        { label: tr("Criar token em ataque"), fazer: () => criar(false) },
        { label: tr("Criar token em defesa"), fazer: () => criar(true) },
      ];
    }
    if (ladoDe(uid) === "op") return acoesOp(uid);
    const achada = (Object.keys(t) as ZonaId[]).map((z) => ({ z, c: t[z].find((c) => c.uid === uid) })).find((x) => x.c);
    if (!achada?.c) return [];
    const { z, c } = achada;
    const card = byId.get(c.id);
    const n = nomeDe(c);
    const out: { label: string; fazer: () => void }[] = [];
    // token: só fica nas Zonas de Monstros; ao sair do campo, deixa de existir
    if (c.ficha)
      return [
        { label: c.defesa ? tr("Posição de ataque") : tr("Posição de defesa"), fazer: () => { setT((a) => alternar(a, uid, "defesa")); registrar(tr("Mudou a posição de {0}.", [n])); setMenu(null); } },
        { label: tr("Mover (clique na zona)"), fazer: () => { setSelecionada(uid); setMenu(null); } },
        { label: tr("Tirar do campo"), fazer: () => moverPara(uid, "cemiterio", {}, tr("{0} saiu do campo e deixou de existir.", [n])) },
      ];
    const noCampo = ZONAS_UNICAS.has(z);
    // ativar um efeito: em qualquer zona e posição, só registra (sem regras)
    out.push({
      label: tr("Ativar efeito"),
      fazer: () => {
        const onde = z === "mao" ? tr("da mão") : z === "cemiterio" ? tr("no Cemitério") : z === "banido" ? "banida" : z === "deck" ? tr("no Deck") : z === "extra" ? tr("no Extra Deck") : `em ${NOMES_ZONA[z]}`;
        // carta virada para baixo no campo: ativar vira para cima
        const virada = noCampo && c.baixada;
        if (virada) setT((a) => alternar(a, uid, "baixada"));
        registrar(tr("Ativou o efeito de {0} ({1}{2}).", [n, onde, virada ? tr(", virando para cima") : c.defesa ? tr(", em defesa") : ""]));
        anotar({ t: "ativa", c: c.id, de: zonaDoPasso(z) }, c, { virada });
        setAtivada(uid);
        setTimeout(() => setAtivada((a) => (a === uid ? null : a)), 1200);
        setMenu(null);
      },
    });
    const monstro = card && categoryOf(card) === "monster";
    if (!noCampo && monstro) {
      const zonaM = card && ehExtra(card) ? livre([...MONSTROS_EXTRA, ...MONSTROS]) : livre(MONSTROS);
      if (zonaM) {
        if (z === "mao" && card && !ehExtra(card)) out.push({ label: tr("Invocação-Normal"), fazer: () => moverPara(uid, zonaM, { baixada: false, defesa: false, normal: true }, tr("Invocou-Normal {0}.", [n])) });
        out.push({ label: tr("Invocar em ataque"), fazer: () => moverPara(uid, zonaM, { baixada: false, defesa: false }, tr("Invocou {0}.", [n])) });
        out.push({ label: tr("Invocar em defesa"), fazer: () => moverPara(uid, zonaM, { baixada: false, defesa: true }, tr("Invocou {0} em defesa.", [n])) });
        if (!card || !ehExtra(card)) out.push({ label: tr("Baixar (virado para baixo)"), fazer: () => moverPara(uid, zonaM, { baixada: true, defesa: true }, tr("Baixou um monstro.")) });
      }
    }
    if (!noCampo && card && !monstro) {
      const campo = card.race === "Field";
      const zonaS = campo ? (t["campo-magia"].length ? undefined : "campo-magia") : livre(MAGIAS);
      if (zonaS) {
        out.push({ label: tr("Ativar"), fazer: () => moverPara(uid, zonaS, { baixada: false }, tr("Ativou {0}.", [n])) });
        out.push({ label: tr("Baixar"), fazer: () => moverPara(uid, zonaS, { baixada: true }, tr("Baixou uma carta.")) });
      }
    }
    if (noCampo) {
      out.push({
        label: c.baixada ? tr("Virar para cima") : tr("Virar para baixo"),
        fazer: () => {
          setT((a) => alternar(a, uid, "baixada"));
          registrar(`${c.baixada ? tr("Virou para cima") : tr("Virou para baixo")} ${n}.`);
          // Magia/Armadilha baixada que vira para cima: ativação
          if (c.baixada && !monstro) anotar({ t: "ativa", c: c.id, de: "magia" }, c, { virada: true });
          setMenu(null);
        },
      });
      if (monstro) out.push({ label: c.defesa ? tr("Posição de ataque") : tr("Posição de defesa"), fazer: () => { setT((a) => alternar(a, uid, "defesa")); registrar(tr("Mudou a posição de {0}.", [n])); setMenu(null); } });
      if (c.materiais.length) out.push({ label: tr("Desanexar matéria ({0})", [c.materiais.length]), fazer: () => moverPara(c.materiais[0].uid, "cemiterio", {}, tr("Desanexou {0}.", [nomeDe(c.materiais[0])])) });
    }
    out.push({ label: tr("Mover (clique na zona)"), fazer: () => { setSelecionada(uid); setMenu(null); } });
    const doExtra = !!card && ehExtra(card);
    if (z !== "mao" && !doExtra) out.push({ label: z === "deck" ? tr("Adicionar à mão") : tr("Para a mão"), fazer: () => moverPara(uid, "mao", {}, tr("{0} foi para a mão{1}.", [n, z === "deck" ? tr(" (do Deck)") : ""])) });
    if (z !== "cemiterio") out.push({ label: tr("Para o Cemitério"), fazer: () => moverPara(uid, "cemiterio", {}, tr("{0} foi para o Cemitério.", [n])) });
    if (z !== "banido") out.push({ label: tr("Banir"), fazer: () => moverPara(uid, "banido", {}, tr("Baniu {0}.", [n])) });
    if (card && ehExtra(card)) {
      if (z !== "extra") out.push({ label: tr("Para o Extra Deck"), fazer: () => moverPara(uid, "extra", {}, tr("{0} voltou para o Extra Deck.", [n])) });
    } else {
      out.push({ label: tr("Para o topo do Deck"), fazer: () => moverPara(uid, "deck", { posicao: "topo" }, tr("{0} foi para o topo do Deck.", [n])) });
      out.push({ label: tr("Para o fundo do Deck"), fazer: () => moverPara(uid, "deck", { posicao: "fundo" }, tr("{0} foi para o fundo do Deck.", [n])) });
    }
    return out;
  };

  const comprarUma = () => {
    if (!t.deck.length) return registrar(tr("O Deck acabou."));
    registrar(tr("Comprou {0}.", [nomeDe(t.deck[0])]));
    anotar({ t: "compra", c: [t.deck[0].id] }, t.deck[0]);
    setT((a) => comprar(a));
  };

  // ---------------------------------------------------------------- arrastar

  const arrastar = (uid: string) => (e: DragEvent) => {
    arrastando.current = uid;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", uid);
  };
  const soltar = (para: ZonaId, lado: Lado = "eu") => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const uid = arrastando.current;
    arrastando.current = null;
    if (uid) colocar(uid, para, lado);
  };

  /** Coloca a carta na zona (arrastando ou clicando); em zona ocupada, vira matéria Xyz */
  const colocar = (uid: string, para: ZonaId, ladoAlvo: Lado = "eu") => {
    setSelecionada(null);
    const ladoCarta = ladoDe(uid);
    if (ladoCarta && ladoCarta !== ladoAlvo) return registrar(tr("Cada carta fica do lado do dono: as do oponente no campo dele, as suas no seu."));
    if (emzOcupada(para, ladoAlvo)) return registrar(tr("Essa Zona de Monstros Extra está ocupada pelo outro jogador."));
    if (ladoCarta === "op") return colocarOp(uid, para);
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
      return registrar(tr("{0} foi anexada como matéria.", [n]));
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
        className={`tj-carta ${c.defesa ? "tj-defesa" : ""} ${pequena ? "tj-pequena" : ""} ${selecionada === c.uid ? "tj-sel" : ""} ${ativada === c.uid ? "tj-ativa" : ""} ${avancado && ladoDe(c.uid) === "op" ? "tj-carta-op" : ""}`}
        draggable
        onDragStart={arrastar(c.uid)}
        onMouseEnter={() => (c.id === TOKEN_GENERICO ? setPreview("token") : card && setPreview(card))}
        onClick={(e) => {
          e.stopPropagation();
          const ladoDela = ladoDe(c.uid) ?? "eu";
          const b = tabuleiro(ladoDela);
          const zonaDela = (Object.keys(b) as ZonaId[]).find((z) => b[z].some((x) => x.uid === c.uid));
          // com outra carta selecionada, clicar nesta coloca a selecionada na zona dela
          if (selecionada && selecionada !== c.uid && zonaDela) return colocar(selecionada, zonaDela, ladoDela);
          if (!selecionada && zonaDela && PILHAS.includes(zonaDela) && !pequena) return abrirLista(zonaDela, ladoDela);
          if (pequena && !selecionada) return setMenu({ uid: c.uid, x: e.clientX, y: e.clientY });
          setSelecionada(selecionada === c.uid ? null : c.uid);
        }}
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault();
          setMenu({ uid: c.uid, x: e.clientX, y: e.clientY });
        }}
        title={card ? tr("{0} — clique para selecionar e depois clique numa zona; botão direito para ações", [bilingualName(card)]) : undefined}
        data-card-id={c.id}
      >
        {verso ? (
          <div className="tj-verso" />
        ) : c.id === TOKEN_GENERICO ? (
          <div className="tj-token">
            <strong>{tr("Token")}</strong>
            <span>{tr("Nível ?")}</span>
            <span>? / ?</span>
          </div>
        ) : (
          <img src={cardImage(c.id, "small")} alt={card ? displayName(card) : ""} draggable={false} />
        )}
        {!verso && card && <CardSelos card={card} formato={formato} />}
        {c.materiais.length > 0 && <span className="tj-materiais" title={tr("Matérias Xyz")}>{c.materiais.length}</span>}
      </div>
    );
  };

  const zona = (id: ZonaId, lado: Lado = "eu") => {
    const cartas = tabuleiro(lado)[id];
    const pilha = PILHAS.includes(id);
    // Teste Avançado: as Zonas de Monstros Extra são compartilhadas (a esquerda de um é a direita do outro)
    const compartilhada = avancado && lado === "eu" && MONSTROS_EXTRA.includes(id);
    const doOponente = compartilhada ? op[espelhoEMZ(id)] : [];
    const mostrada = cartas[0] ?? doOponente[0];
    const alvo = (uid: string): [ZonaId, Lado] => (compartilhada && ladoDe(uid) === "op" ? [espelhoEMZ(id), "op"] : [id, lado]);
    return (
      <div
        key={`${lado}-${id}`}
        className={`tj-zona tj-${id.replace(/\d/, "")} ${selecionada ? "tj-alvo" : ""} ${lado === "op" ? "tj-zona-op" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const uid = arrastando.current;
          arrastando.current = null;
          if (uid) colocar(uid, ...alvo(uid));
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (lado === "op") return;
          if (id === "deck") setMenu({ uid: MENU_DECK, x: e.clientX, y: e.clientY });
          if (id === "extra") setMenu({ uid: MENU_EXTRA, x: e.clientX, y: e.clientY });
          if ((MONSTROS.includes(id) || MONSTROS_EXTRA.includes(id)) && !mostrada) setMenu({ uid: MENU_TOKEN, x: e.clientX, y: e.clientY, zona: id });
        }}
        onClick={() => {
          if (selecionada) return colocar(selecionada, ...alvo(selecionada));
          // Deck e Extra Deck só respondem ao botão direito (Abrir / Comprar uma carta)
          if (id === "deck" || id === "extra") return;
          if (pilha && cartas.length) abrirLista(id, lado);
        }}
        title={`${lado === "op" ? tr("Oponente — ") : ""}${id === "deck" ? tr("Botão direito: Abrir deck ou Comprar uma carta") : id === "extra" ? tr("Botão direito: Abrir Extra Deck") : pilha ? tr("{0} — clique para ver", [NOMES_ZONA[id]]) : NOMES_ZONA[id]}`}
        data-zona={lado === "op" ? `op-${id}` : id}
      >
        {mostrada && (id === "deck" ? <div className="tj-verso" /> : carta(mostrada))}
        {id === "deck" && embaralhando && (
          <span className="tj-embaralhando" aria-label={tr("Embaralhando")}>
            ⟳
          </span>
        )}
        {pilha && <span className="tj-contagem">{cartas.length}</span>}
        {!mostrada && <span className="tj-rotulo">{id === "campo-magia" ? tr("Campo") : id === "cemiterio" ? tr("Cemitério") : id === "banido" ? tr("Banidas") : id === "extra" ? tr("Extra") : ""}</span>}
      </div>
    );
  };

  return (
    <div className="teste-jogo" onContextMenu={(e) => e.preventDefault()}>
      <Lateral className="tj-esq" titulo={tr("Carta")}>
        {preview === "token" ? (
          <>
            <div className="tj-token tj-token-grande">
              <strong>{tr("Token")}</strong>
              <span>{tr("Nível ?")}</span>
              <span>{tr("ATK ? / DEF ?")}</span>
            </div>
            <strong>{tr("Token")}</strong>
            <small>{tr("Monstro Token · Nível ? · Tipo ? · Sem atributo")}</small>
            <small>{tr("ATK ? / DEF ?")}</small>
            <p className="tags-note">{tr("Criado no teste: fica só nas Zonas de Monstros e, ao sair do campo, deixa de existir.")}</p>
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
          <p className="tags-note">{tr("Passe o mouse sobre uma carta para ver os detalhes.")}</p>
        )}
      </Lateral>

      <section className={`tj-mesa ${avancado ? "tj-mesa-avancada" : ""}`}>
        {avancado && (
          <div
            className="tj-mao tj-mao-op"
            onDragOver={(e) => e.preventDefault()}
            onDrop={soltar("mao", "op")}
            onClick={() => selecionada && colocar(selecionada, "mao", "op")}
            data-zona="op-mao"
            aria-label={tr("Mão do oponente")}
          >
            {op.mao.map((c) => (
              <div key={c.uid} className="tj-mao-carta">
                {carta(c)}
              </div>
            ))}
            {!op.mao.length && <span className="tags-note">{tr("Mão do oponente vazia: use “+ Carta do oponente” para adicionar o que ele pode ter.")}</span>}
          </div>
        )}
        <div className="tj-campo">
          {avancado && (
            <>
              {/* campo do oponente espelhado: Magias/Armadilhas em cima, monstros embaixo */}
              <div className="tj-l3 tj-linha-op">
                <button className="tj-op-add" onClick={() => setAdicionando(true)} title={tr("Adiciona uma carta à mão, ao campo, ao Cemitério ou às banidas do oponente")}>
                  {tr("+ Carta do oponente")}</button>
                {[...MAGIAS].reverse().map((z) => zona(z, "op"))}
                <span className="tj-op-lp" title={tr("Pontos de Vida do oponente")}>
                  <small>{tr("Oponente")}</small>
                  <strong>{lpOp}</strong>
                </span>
              </div>
              <div className="tj-l2 tj-linha-op">
                {zona("cemiterio", "op")}
                {[...MONSTROS].reverse().map((z) => zona(z, "op"))}
                {zona("campo-magia", "op")}
              </div>
            </>
          )}
          <div className="tj-l1">
            {avancado ? zona("banido", "op") : <span />}
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
                    title={tr("Chance de abrir ao menos 1 cópia numa mão de 5: {0} {1} num Deck de {2} (distribuição hipergeométrica, como nos calculadores de probabilidade).", [copias, copias === 1 ? tr("cópia") : tr("cópias"), main.length])}
                  >
                    {(chance * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%
                  </span>
                )}
              </div>
            );
          })}
          {!t.mao.length && <span className="tags-note">{tr("Mão vazia")}</span>}
        </div>
        {t.mao.length > 0 && (() => {
          const ids = t.mao.map((c) => c.id);
          // mão exata: estas cartas, em qualquer ordem; geral: qualquer mão com o mesmo perfil
          const p = probabilidadeDaMao(main, ids);
          const geral = probabilidadeGeral(main, ids);
          const pct = (x: number) => `${(x * 100).toLocaleString(LOCALE, { maximumSignificantDigits: 3 })}%`;
          // classificação das cartas da mão (hand trap, starter, floodgate, staple…)
          const papeis = contarPapeis(t.mao.map((c) => byId.get(c.id)).filter((c): c is Card => !!c));
          return (
            <>
            <div className="tj-prob-mao">
              <span title={tr("Chance de abrir exatamente estas {0} cartas, em qualquer ordem, com este Deck de {1} (hipergeométrica multivariada).", [ids.length, main.length])}>
                <span className="field-label">{tr("Esta mão")}</span> <strong>{p > 0 ? pct(p) : "—"}</strong>
                {/* exemplo em 100 mãos: em quantas delas esta mão viria */}
                {p > 0 && <small> {" "}{tr("{0} em 100 mãos", [(p * 100).toLocaleString(LOCALE, { maximumSignificantDigits: 2 })])}</small>}
              </span>
              {geral.p > 0 && (
                <span className="tj-prob-geral" title={tr("Chance de abrir qualquer mão com o mesmo perfil: {0}.", [geral.perfil])}>
                  <span className="field-label">{tr("Geral")}</span> <strong>{pct(geral.p)}</strong> <small>{geral.perfil}</small>
                </span>
              )}
            </div>
            <div className="tj-papeis-mao" aria-label={tr("Classificação das cartas da mão")}>
              <span className="field-label">{tr("Nesta mão")}</span>
              {papeis.porPapel.map(({ papel, n }) => (
                <span key={papel.id} className="tj-papel" title={tr("{0} {1} {2} na mão", [n, n === 1 ? tr("carta") : tr("cartas"), papel.label])}>
                  <span className="selo-papel" style={{ background: papel.cor }}>
                    {papel.sigla}
                  </span>{" "}
                  {papel.label} <strong>{n}</strong>
                </span>
              ))}
              {papeis.semPapel > 0 && (
                <span className="tj-papel">
                  {tr("Sem classificação")}{" "}<strong>{papeis.semPapel}</strong>
                </span>
              )}
            </div>
            </>
          );
        })()}
        </div>
      </section>

      <Lateral lado="dir" className="tj-dir" titulo={nome}>
        <h3>{nome}</h3>
        {onModo && (
          <div className="left-tabs tj-modo" role="tablist" aria-label={tr("Modo do teste")}>
            <button className={!avancado ? "active" : ""} onClick={() => onModo(false)}>
              {tr("Teste de Combo Manual")}</button>
            <button
              className={avancado ? "active" : ""}
              disabled={!temRecursosAvancados(conta)}
              onClick={() => onModo(true)}
              title={temRecursosAvancados(conta) ? tr("Campo do oponente e Indicações de resposta") : tr("Teste Avançado: disponível para Usuário Avançado ou Mentor")}
            >
              {tr("Teste Avançado")}</button>
          </div>
        )}
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
            aria-label={tr("Ajuste de LP (ex.: -1000)")}
          />
        </div>
        {avancado && (
          <div className="tj-lp tj-lp-op">
            <strong title={tr("Pontos de Vida do oponente")}>{lpOp}</strong>
            <input
              inputMode="numeric"
              placeholder={tr("± op")}
              value={lpOpAjuste}
              onChange={(e) => setLpOpAjuste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = Number(lpOpAjuste);
                if (!Number.isNaN(v) && v) {
                  setLpOp((x) => Math.max(0, x + v));
                  registrar(`LP do oponente ${v > 0 ? "+" : ""}${v}.`);
                }
                setLpOpAjuste("");
              }}
              aria-label={tr("Ajuste de LP do oponente (ex.: -1000)")}
            />
          </div>
        )}
        {/* teste de combo: o combo acontece na Main Phase, sem a barra de fases */}
        {!combo && (
        <div className="tj-fases">
          {FASES.map((f) => (
            <button
              key={f}
              className={fase === f ? "active" : ""}
              onClick={() => {
                setFase(f);
                // Draw Phase: começa um turno novo (zera as Invocações do turno)
                if (f === "DP" && avancado) zerarTurno();
              }}
            >
              {f}
            </button>
          ))}
        </div>
        )}
        {avancado && (
          <div className="left-tabs tj-turno" role="tablist" aria-label={tr("De quem é o turno")}>
            <span className="field-label">{tr("Turno")}</span>
            {(["eu", "op"] as Lado[]).map((l) => (
              <button
                key={l}
                className={turno === l ? "active" : ""}
                onClick={() => {
                  if (turno === l) return;
                  setTurno(l);
                  zerarTurno();
                  registrar(`Turno ${l === "eu" ? "seu" : "do oponente"}.`);
                }}
              >
                {l === "eu" ? tr("Você") : tr("Oponente")}
              </button>
            ))}
          </div>
        )}
        {avancado && painelInd && (
          <IndicacoesResposta
            entradas={indicacoes}
            byId={byId}
            invocacoes={{ eu: contagens.eu.inv, op: contagens.op.inv }}
            onHover={(c) => setPreview(c)}
          />
        )}
        <div className="tj-botoes">
          {combo && (
            <button className="ghost-btn tj-executar" onClick={executarCombo}>
              {tr("Executar combo")}</button>
          )}
          <button
            className="ghost-btn tj-teste-mao"
            title={tr("Recolhe todas as cartas para o Deck e o Extra Deck, embaralha e compra 5 (Teste de Mão)")}
            onClick={() => {
              const novo = testeDeMao(main, extra);
              setT(novo);
              recomecarAnotacao(novo);
              animarEmbaralhar();
              setLp(8000);
              setFase("M1");
              setSelecionada(null);
              setPasso(null);
              setExecutados(new Set());
              setHistorico([]);
              setIndicacoes([]);
              zerarTurno();
              setLog(["Reiniciado: cartas recolhidas, Deck embaralhado, 5 cartas compradas."]);
            }}
          >
            {tr("Reiniciar (Teste de Mão)")}</button>
          {avancado && (
            <>
              <button className="ghost-btn tj-op-add-btn" onClick={() => setAdicionando(true)}>
                {tr("+ Carta do oponente")}</button>
              <button
                className="ghost-btn"
                onClick={() => {
                  setOp(tabuleiroInicial([], []));
                  setLpOp(8000);
                  registrar("Campo e mão do oponente limpos.");
                }}
              >
                {tr("Limpar oponente")}</button>
              <button className="ghost-btn" onClick={() => setPainelInd(!painelInd)} aria-pressed={painelInd}>
                {tr("Indicações: {0}", [painelInd ? tr("ligadas") : tr("desligadas")])}
              </button>
            </>
          )}
          <button className="ghost-btn" onClick={comprarUma}>{tr("Comprar")}</button>
          <button className="ghost-btn" onClick={embaralhar}>{tr("Embaralhar")}</button>
          <button className="ghost-btn tj-visualizar" onClick={() => abrirLista("deck")}>{tr("Visualizar Deck")}</button>
          <button className="ghost-btn tj-criar-token" onClick={(e) => setMenu({ uid: MENU_TOKEN, x: e.clientX, y: e.clientY })} title={tr("Cria um token numa Zona de Monstros livre (ou clique com o botão direito numa zona vazia)")}>
            {tr("Criar token")}</button>
          <button className="ghost-btn" onClick={() => registrar(`Dado: ${aleatorio(6) + 1}.`)}>{tr("Dado")}</button>
          <button className="ghost-btn" onClick={() => registrar(`Moeda: ${aleatorio(2) ? "cara" : "coroa"}.`)}>{tr("Moeda")}</button>
          <button className="ghost-btn" onClick={onFechar}>{tr("Voltar ao editor")}</button>
          <button
            className="ghost-btn tj-criar-combo"
            onClick={() => {
              setGravacao(null);
              setGravacao(null);
              setCriando({ titulo: combo?.titulo?.slice(0, 120) || tituloSugerido(), obs: "", compartilhar: true, arquetipos: arquetiposDoCombo() });
            }}
            title={tr("Cria um combo com os passos feitos neste teste (desde a mão inicial)")}
          >
            {tr("Criar combo")}</button>
          {onImportar && (
            <button
              className="ghost-btn tj-importar"
              onClick={() => {
                const nome = onImportar();
                if (nome) registrar(tr("Deck importado em Meus decks como \"{0}\".", [nome]));
              }}
              title={tr("Salva o deck deste teste em Meus decks (Editor de Deck); sem isso, ele não fica salvo")}
            >
              {tr("Importar Deck")}</button>
          )}
        </div>
        <ol className="tj-log" aria-label={tr("Histórico")}>
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
        <p className="tags-note">
          {tr("Abaixo de cada carta da mão: a chance de abrir ao menos 1 cópia dela numa mão de 5 com este Deck.")}{" "}
          <FontesButton sites={["otterlord", "deck-probability", "deckcal"]} />
        </p>
        <p className="tags-note">
          {tr("Sem regras: arraste uma carta até a zona, ou clique nela e depois na zona; botão direito para ações. O embaralhamento usa o gerador aleatório criptográfico do sistema.")}</p>
      </Lateral>

      {anuncio && (
        <div key={anuncio.n} className="tj-anuncio" role="status" aria-live="assertive" onClick={() => setAnuncio(null)}>
          <div className="tj-anuncio-cartas">
            {anuncio.ids.map((id, i) => (
              <figure key={i}>
                {id !== TOKEN_GENERICO && <img src={cardImage(id, "small")} alt="" draggable={false} />}
                <figcaption>{nomeId(id)}</figcaption>
              </figure>
            ))}
          </div>
          <strong>⚡ {tr("Efeito ativado")}</strong>
        </div>
      )}

      {combo && passo !== null && grupos[passo] && (
        <div className="tj-passo" role="status" aria-live="polite">
          <div className="tj-passo-cab">
            <strong>
              {tr("Passo {0} de {1}", [passo + 1, grupos.length])}
            </strong>
            <button className="link-btn" onClick={() => setPasso(null)} aria-label={tr("Fechar passos")}>
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
              {tr("‹ Anterior")}</button>
            {historico.length > 0 && (
              <button
                className="ghost-btn tj-retornar"
                onClick={retornarExecucao}
                title={tr("Desfaz o último passo executado (passo {0}) e volta para ele", [historico[historico.length - 1].passo + 1])}
              >
                ↶ {tr("Retornar")}</button>
            )}
            {executados.has(passo) ? (
              <span className="tj-executado">✓ {tr("Executado")}</span>
            ) : (
              <button
                className="ghost-btn tj-play"
                disabled={grupos[passo].step.t === "texto"}
                onClick={executarPassoAtual}
                title={grupos[passo].step.t === "texto" ? tr("Passo descrito em texto: faça no tabuleiro") : tr("Aplica o passo no tabuleiro e vai para o próximo")}
              >
                ▶ {tr("Executar")}</button>
            )}
            <button className="ghost-btn" disabled={passo >= grupos.length - 1} onClick={() => setPasso(passo + 1)}>
              {tr("Próximo ›")}</button>
          </div>
        </div>
      )}

      {criando && (() => {
        const grupos = groupSteps(anotados);
        const campo = campoDoTabuleiro(t);
        const copias = copiasUsadas();
        return (
          <div className="tj-criar-fundo" onClick={() => setCriando(null)}>
            <div className="tj-criar" role="dialog" aria-label={tr("Criar combo")} onClick={(e) => e.stopPropagation()}>
              <div className="fontes-head">
                <h4>{tr("Criar combo")}</h4>
                <button className="ghost-btn" onClick={() => setCriando(null)} aria-label={tr("Fechar")}>✕</button>
              </div>
              <p className="tj-criar-mao">
                <span className="field-label">{tr("Mão inicial")}</span> {maoInicial.map((c) => nomeId(c.id)).join(" + ") || "—"}
              </p>
              {anotados.length ? (
                <PassosOrdenaveis className="tj-criar-passos" passos={anotados} originais={criados} onChange={setAnotados} render={textoPasso} />
              ) : (
                <p className="db-warning">{tr("Nenhum passo ainda: jogue a partir da mão inicial (invocar, ativar, mover…) e volte aqui.")}</p>
              )}
              {grupos.length > 0 && (campo.monstros.length > 0 || campo.magias.length > 0) && (
                <p className="tj-criar-campo">
                  <span className="field-label">{tr("Campo final")}</span> {[...campo.monstros, ...campo.magias.map(([id]) => id)].map(nomeId).join(", ")}
                </p>
              )}
              <div className="tj-criar-validade">
                {FORMATS.map((f) => {
                  const v = validadeNoFormato(copias, byId, f);
                  return (
                    <span key={f} className={`vc-badge combo-validade ${v.valido ? "valido" : "invalido"}`} title={v.valido ? tr("Cartas e cópias permitidas na banlist atual do {0}.", [f]) : v.problemas.join("\n")}>
                      {v.valido ? tr("Válido no {0}", [f]) : tr("Fora da banlist do {0}: {1}", [f, v.problemas.join("; ")])}
                    </span>
                  );
                })}
              </div>
              <label className="field">
                <span className="field-label">{tr("Título")}</span>
                <input value={criando.titulo} maxLength={120} onChange={(e) => setCriando({ ...criando, titulo: e.target.value })} aria-label={tr("Título do combo")} />
              </label>
              <label className="field">
                <span className="field-label">{tr("Observações")}</span>
                <textarea rows={2} maxLength={2000} value={criando.obs} onChange={(e) => setCriando({ ...criando, obs: e.target.value })} />
              </label>
              <VincularArquetipos
                valor={criando.arquetipos}
                aoMudar={(arquetipos) => setCriando({ ...criando, arquetipos })}
                sugeridos={arquetiposDoCombo()}
                semCartas={arquetiposSemCartas(criando.arquetipos, copias.keys(), byId)}
              />
              {conta && !temRecursosAvancados(conta) ? (
                <p className="tags-note tj-criar-local">
                  {tr("Usuário Padrão: o combo fica só neste aparelho (aba Combos → Meus combos neste aparelho). Para enviá-lo à base, use Exportar quando a conta for Avançado ou Mentor.")}</p>
              ) : (
                <label className="tj-criar-compartilhar">
                  <input type="checkbox" checked={criando.compartilhar} onChange={(e) => setCriando({ ...criando, compartilhar: e.target.checked })} />
                  {tr("Compartilhar: divulgar para todos na aba Combos, com o seu nome de usuário e a data de criação")}</label>
              )}
              {gravacao && <p className={gravacao.tipo === "erro" ? "db-warning" : "conta-ok"}>{gravacao.texto}</p>}
              <div className="dialog-actions">
                <button className="ghost-btn" onClick={() => setCriando(null)}>
                  {tr("Cancelar")}</button>
                {conta ? (
                  <button className="ghost-btn tj-criar-ok" disabled={!anotados.length || !criando.titulo.trim() || gravacao?.tipo === "gravando"} onClick={() => void gravarCombo()}>
                    {tr("Criar combo")}</button>
                ) : (
                  <button className="ghost-btn tj-criar-entrar" onClick={() => openConta()}>
                    {tr("Entrar para criar")}</button>
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

      {adicionando && <AdicionarCarta cards={todas} formato={formato} onAdicionar={adicionarAoOponente} onFechar={() => setAdicionando(false)} />}

      {lista && (
        <div className="tj-lista" role="dialog" aria-label={NOMES_ZONA[lista]}>
          <div className="fontes-head">
            <h4>
              {listaLado === "op" ? tr("Oponente: ") : ""}
              {NOMES_ZONA[lista]} ({tabuleiro(listaLado)[lista].length})
            </h4>
            {/* com o Deck aberto, as opções do Deck continuam à mão */}
            {lista === "deck" && listaLado === "eu" && (
              <button className="ghost-btn tj-lista-comprar" onClick={comprarUma} disabled={!t.deck.length}>
                {tr("Comprar uma carta")}</button>
            )}
            <button className="ghost-btn" onClick={fecharLista} aria-label={tr("Fechar")}>✕</button>
          </div>
          <div className="tj-lista-cartas">
            {tabuleiro(listaLado)[lista].map((c) => carta({ ...c, baixada: false }, true))}
          </div>
          <p className="tags-note">
            {tr("Clique numa carta para ver as opções (mão, Cemitério, banir, Invocar, Ativar…) ou arraste-a para o campo.")}{lista === "deck" && tr(" Ao fechar, o Deck é embaralhado.")}
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
