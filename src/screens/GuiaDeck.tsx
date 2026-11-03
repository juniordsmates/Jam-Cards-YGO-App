import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import ScreenShell from "./ScreenShell";
import CardPreview from "../components/CardPreview";
import CardSelos from "../components/CardSelos";
import { ComboCard } from "../components/ComboSearch";
import { openConta } from "../components/Conta";
import { GUIAS_ESCRITOS, type Idioma } from "../data/guias";
import { apagarArtigo, enviarArtigo, listarArtigos, moderarArtigo, type Artigo, type TipoArtigo } from "../db/artigos";
import { combosDoArquetipo, type ComboBase } from "../db/baseCombos";
import { initCardDb, useCardDb } from "../db/cardStore";
import { useConta } from "../db/conta";
import { copiasPermitidas, deckDoCombo } from "../db/decks";
import { calcularInteracoes, linhasDoArquetipo, passoNoIdioma, startersCalculados } from "../db/guiaDeck";
import { cardImage } from "../db/images";
import { semCartaDoCalculo, CARTA_QUALQUER, type LinhaCombo, type Passo } from "../db/motor";
import type { ArquetipoMeta, CartaNucleo } from "../db/overlay";
import { ordenarRespostas, useContextoRespostas } from "../db/respostas";
import { supabaseReady } from "../db/supabase";
import { displayName, type Card } from "../db/types";
import type { ComboTeste } from "./TesteJogo";
import "./guia-deck.css";
import BotaoLink from "../components/BotaoLink";
import type { Rota } from "../rotas";
import { IDIOMA, t as tr, LOCALE } from "../i18n";

// Guia de Deck: os arquétipos do topo do meta do TCG (6 meses de decklists de torneio), cada um com
// Ideias Iniciais, Ideias Avançadas, Combos, Interações e Artigos de Jogadores, em 3 idiomas.

type Aba = "iniciais" | "avancadas" | "combos" | "interacoes" | "artigos";
const IDIOMAS: { id: Idioma; label: string }[] = [
  { id: "pt", label: "Português" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

// ---------------------------------------------------------------- textos da tela

const T = {
  pt: {
    titulo: "Guia de Deck",
    base: (n: number, data: string) => `${n.toLocaleString("pt-BR")} decklists de torneio do TCG nos últimos 6 meses · atualizado em ${data}`,
    semDados: "O metagame ainda não foi baixado. Ele chega com a camada de dados do app; confira a conexão e abra a tela de novo.",
    abas: { iniciais: "Ideias Iniciais", avancadas: "Ideias Avançadas", combos: "Combos", interacoes: "Interações", artigos: "Artigos de Jogadores" },
    pct6m: "dos decks em 6 meses",
    pct2m: "nos últimos 2 meses",
    vitorias: "1º lugares",
    nomes: "Também chamado de",
    parceiros: "Misturado com",
    semGuia: "Ainda não há texto escrito para este deck. As seções abaixo vêm direto dos decklists de torneio e do motor de regras.",
    revisado: (m: string) => `Texto revisado em ${m}. O núcleo, os combos e as interações se atualizam sozinhos.`,
    proibida: "proibida no TCG",
    proibidaExpl: "Na banlist TCG atual, esta carta está proibida: as jogadas do texto que dependem dela não valem mais no TCG.",
    nucleo: "Núcleo do deck",
    nucleoExpl: "Cartas presentes em boa parte das listas de torneio: % = listas que usam a carta; × = média de cópias nelas.",
    main: "Main Deck",
    extra: "Extra Deck",
    side: "Side Deck",
    listas: "Listas campeãs",
    starters: "Cartas que começam combos sozinhas",
    startersExpl: (n: number) => `Calculado pelo motor de regras com ${n} linhas deste deck: quantas linhas cada carta abre sozinha na mão.`,
    pontosResumo: "Onde o deck costuma ser parado",
    verInteracoes: "Ver todas as interações",
    combosApp: "Linhas calculadas pelo App",
    combosExpl: "Jogadas pelo motor de regras do EDOPro com um decklist de torneio, no primeiro turno e com o oponente passando. Em cada passo, as respostas que o oponente poderia ativar ali.",
    semCombos: "O motor de combos ainda não calculou linhas para este deck. Os 8 primeiros do meta entram no cálculo automático; as linhas aparecem aqui quando ele terminar.",
    mao: "Mão",
    adicionando: "adicionando",
    campoFinal: "Campo final",
    podeResponder: "Pode ser respondido por",
    testar: "▶ Teste de Jogo",
    mais: (n: number) => `Mostrar mais ${n}`,
    comunidade: "Combos da Comunidade",
    semComunidade: "Nenhum Combo da Comunidade deste deck ainda. Crie um no Teste de Jogo (Criar combo) e marque Compartilhar.",
    intExpl:
      "Calculado com as linhas do motor de regras: depois de cada passo, quais cartas da mão do oponente poderiam ser ativadas. Junte isso ao uso em torneio para saber o que esperar e o que guardar.",
    respostasTitulo: "Respostas mais comuns contra o deck",
    linhasPct: (p: number) => `para ${p}% das linhas`,
    uso: (p: number) => `em ${p}% dos decks de torneio`,
    primeiro: (n: number) => `já a partir do passo ${n}`,
    ondeAcerta: "Onde acerta",
    pontosTitulo: "Pontos críticos do combo",
    pontosExpl: "Os passos que mais respostas diferentes podem parar. Planeje a ordem do combo para gastar a resposta do oponente aqui ou contornar.",
    respostasN: (n: number) => `${n} respostas possíveis`,
    proprias: "Interrupções do próprio deck",
    propriasExpl: "Cartas do núcleo com efeito de negação, hand trap ou remoção do campo do oponente.",
    semInteracoes: "Sem linhas calculadas para este deck, ainda não há interações.",
    artigosExpl: "Táticas, jogadas e ideias escritas por jogadores experientes. Todo artigo passa por aprovação antes de aparecer.",
    todosIdiomas: "Mostrar artigos em todos os idiomas",
    semArtigos: "Ainda não há artigos aprovados deste deck neste idioma.",
    enviar: "Enviar um artigo",
    entrarParaEnviar: "Entre na sua conta para enviar um artigo",
    tipo: "Tipo",
    tipos: { tatica: "Tática", jogada: "Jogada", ideia: "Ideia", combo: "Combo", side: "Side deck" },
    idioma: "Idioma",
    tituloArtigo: "Título",
    resumo: "Resumo (opcional)",
    conteudo: "Texto (mínimo 50 caracteres)",
    conteudoDica: "Use **negrito**, linhas com \"- \" para listas e [[Nome da carta em inglês]] para citar cartas.",
    enviarBtn: "Enviar para aprovação",
    enviado: "Artigo enviado! Ele aparece para todos depois da aprovação.",
    pendente: "Aguardando aprovação",
    recusado: "Recusado",
    aprovar: "Aprovar",
    recusar: "Recusar",
    motivo: "Motivo da recusa (o autor vê)",
    apagar: "Apagar",
    ler: "Ler",
    fechar: "Fechar",
    por: "por",
  },
  en: {
    titulo: "Deck Guide",
    base: (n: number, data: string) => `${n.toLocaleString("en-US")} TCG tournament decklists in the last 6 months · updated ${data}`,
    semDados: "The metagame has not been downloaded yet. It comes with the app's data layer; check your connection and reopen this screen.",
    abas: { iniciais: "Basic Ideas", avancadas: "Advanced Ideas", combos: "Combos", interacoes: "Interactions", artigos: "Player Articles" },
    pct6m: "of decks in 6 months",
    pct2m: "in the last 2 months",
    vitorias: "1st places",
    nomes: "Also known as",
    parceiros: "Mixed with",
    semGuia: "There is no written text for this deck yet. The sections below come straight from tournament decklists and the rules engine.",
    revisado: (m: string) => `Text reviewed in ${m}. The core, combos and interactions update on their own.`,
    proibida: "Forbidden in the TCG",
    proibidaExpl: "This card is Forbidden on the current TCG list: the plays in the text that depend on it no longer work in the TCG.",
    nucleo: "Deck core",
    nucleoExpl: "Cards found in most tournament lists: % = lists that play the card; × = average copies in them.",
    main: "Main Deck",
    extra: "Extra Deck",
    side: "Side Deck",
    listas: "Winning lists",
    starters: "Cards that start combos on their own",
    startersExpl: (n: number) => `Calculated by the rules engine from ${n} lines of this deck: how many lines each card opens alone in hand.`,
    pontosResumo: "Where the deck usually gets stopped",
    verInteracoes: "See all interactions",
    combosApp: "Lines calculated by the app",
    combosExpl: "Played by the EDOPro rules engine with a tournament decklist, going first with the opponent passing. On each step, the answers your opponent could activate there.",
    semCombos: "The combo engine has not calculated lines for this deck yet. The top 8 decks of the meta are calculated automatically; the lines show up here when it finishes.",
    mao: "Hand",
    adicionando: "adding",
    campoFinal: "End board",
    podeResponder: "Can be answered by",
    testar: "▶ Test Hand",
    mais: (n: number) => `Show ${n} more`,
    comunidade: "Community Combos",
    semComunidade: "No Community Combos for this deck yet. Create one in the Test Hand screen (Create combo) and tick Share.",
    intExpl:
      "Calculated from the rules engine's lines: after each step, which cards in your opponent's hand could be activated. Combine it with tournament usage to know what to expect and what to play around.",
    respostasTitulo: "Most common answers against the deck",
    linhasPct: (p: number) => `stops ${p}% of the lines`,
    uso: (p: number) => `in ${p}% of tournament decks`,
    primeiro: (n: number) => `from step ${n} on`,
    ondeAcerta: "Where it hits",
    pontosTitulo: "Choke points of the combo",
    pontosExpl: "The steps that the most different answers can stop. Plan your combo order to bait the answer here or play around it.",
    respostasN: (n: number) => `${n} possible answers`,
    proprias: "The deck's own interruptions",
    propriasExpl: "Core cards with negation, hand trap or board-breaking effects.",
    semInteracoes: "No calculated lines for this deck, so there are no interactions yet.",
    artigosExpl: "Tactics, plays and ideas written by experienced players. Every article is reviewed before it shows up.",
    todosIdiomas: "Show articles in every language",
    semArtigos: "No approved articles for this deck in this language yet.",
    enviar: "Submit an article",
    entrarParaEnviar: "Sign in to submit an article",
    tipo: "Type",
    tipos: { tatica: "Tactic", jogada: "Play", ideia: "Idea", combo: "Combo", side: "Side deck" },
    idioma: "Language",
    tituloArtigo: "Title",
    resumo: "Summary (optional)",
    conteudo: "Text (at least 50 characters)",
    conteudoDica: "Use **bold**, lines starting with \"- \" for lists and [[Card name]] to cite cards.",
    enviarBtn: "Submit for review",
    enviado: "Article submitted! It shows up for everyone after review.",
    pendente: "Awaiting review",
    recusado: "Rejected",
    aprovar: "Approve",
    recusar: "Reject",
    motivo: "Reason for rejection (the author sees it)",
    apagar: "Delete",
    ler: "Read",
    fechar: "Close",
    por: "by",
  },
  es: {
    titulo: "Guía de Deck",
    base: (n: number, data: string) => `${n.toLocaleString("es-ES")} decklists de torneo del TCG en los últimos 6 meses · actualizado el ${data}`,
    semDados: "El metajuego aún no se descargó. Llega con la capa de datos de la app; revisa la conexión y vuelve a abrir la pantalla.",
    abas: { iniciais: "Ideas Iniciales", avancadas: "Ideas Avanzadas", combos: "Combos", interacoes: "Interacciones", artigos: "Artículos de Jugadores" },
    pct6m: "de los decks en 6 meses",
    pct2m: "en los últimos 2 meses",
    vitorias: "1.º puestos",
    nomes: "También llamado",
    parceiros: "Mezclado con",
    semGuia: "Todavía no hay texto escrito para este deck. Las secciones de abajo salen directamente de los decklists de torneo y del motor de reglas.",
    revisado: (m: string) => `Texto revisado en ${m}. El núcleo, los combos y las interacciones se actualizan solos.`,
    proibida: "prohibida en el TCG",
    proibidaExpl: "En la banlist TCG actual esta carta está prohibida: las jugadas del texto que dependen de ella ya no valen en el TCG.",
    nucleo: "Núcleo del deck",
    nucleoExpl: "Cartas presentes en la mayoría de las listas de torneo: % = listas que la juegan; × = media de copias en ellas.",
    main: "Main Deck",
    extra: "Deck Extra",
    side: "Side Deck",
    listas: "Listas ganadoras",
    starters: "Cartas que inician combos solas",
    startersExpl: (n: number) => `Calculado por el motor de reglas con ${n} líneas de este deck: cuántas líneas abre cada carta sola en la mano.`,
    pontosResumo: "Dónde suelen parar al deck",
    verInteracoes: "Ver todas las interacciones",
    combosApp: "Líneas calculadas por la app",
    combosExpl: "Jugadas por el motor de reglas de EDOPro con un decklist de torneo, yendo primero y con el rival pasando. En cada paso, las respuestas que el rival podría activar ahí.",
    semCombos: "El motor de combos aún no calculó líneas para este deck. Los 8 primeros del meta se calculan automáticamente; las líneas aparecen aquí al terminar.",
    mao: "Mano",
    adicionando: "añadiendo",
    campoFinal: "Campo final",
    podeResponder: "Puede ser respondido por",
    testar: "▶ Prueba de Juego",
    mais: (n: number) => `Mostrar ${n} más`,
    comunidade: "Combos de la Comunidad",
    semComunidade: "Aún no hay Combos de la Comunidad de este deck. Crea uno en la Prueba de Juego (Crear combo) y marca Compartir.",
    intExpl:
      "Calculado con las líneas del motor de reglas: después de cada paso, qué cartas de la mano del rival podrían activarse. Júntalo con el uso en torneos para saber qué esperar y qué evitar.",
    respostasTitulo: "Respuestas más comunes contra el deck",
    linhasPct: (p: number) => `para el ${p}% de las líneas`,
    uso: (p: number) => `en el ${p}% de los decks de torneo`,
    primeiro: (n: number) => `ya desde el paso ${n}`,
    ondeAcerta: "Dónde golpea",
    pontosTitulo: "Puntos críticos del combo",
    pontosExpl: "Los pasos que más respuestas distintas pueden parar. Planifica el orden del combo para gastar la respuesta del rival aquí o esquivarla.",
    respostasN: (n: number) => `${n} respuestas posibles`,
    proprias: "Interrupciones del propio deck",
    propriasExpl: "Cartas del núcleo con efectos de negación, hand trap o remoción del campo rival.",
    semInteracoes: "Sin líneas calculadas para este deck, todavía no hay interacciones.",
    artigosExpl: "Tácticas, jugadas e ideas escritas por jugadores experimentados. Cada artículo se revisa antes de aparecer.",
    todosIdiomas: "Mostrar artículos en todos los idiomas",
    semArtigos: "Aún no hay artículos aprobados de este deck en este idioma.",
    enviar: "Enviar un artículo",
    entrarParaEnviar: "Inicia sesión para enviar un artículo",
    tipo: "Tipo",
    tipos: { tatica: "Táctica", jogada: "Jugada", ideia: "Idea", combo: "Combo", side: "Side deck" },
    idioma: "Idioma",
    tituloArtigo: "Título",
    resumo: "Resumen (opcional)",
    conteudo: "Texto (mínimo 50 caracteres)",
    conteudoDica: "Usa **negrita**, líneas con \"- \" para listas y [[Nombre de la carta en inglés]] para citar cartas.",
    enviarBtn: "Enviar para revisión",
    enviado: "¡Artículo enviado! Aparece para todos después de la revisión.",
    pendente: "Esperando revisión",
    recusado: "Rechazado",
    aprovar: "Aprobar",
    recusar: "Rechazar",
    motivo: "Motivo del rechazo (el autor lo ve)",
    apagar: "Borrar",
    ler: "Leer",
    fechar: "Cerrar",
    por: "por",
  },
} as const;

/** Tipos de resposta (respondedores) no idioma */
const TIPOS_RESPOSTA: Record<Idioma, Record<string, string>> = {
  pt: { "nega-ativacao": "nega a ativação", "nega-efeito": "nega o efeito", destroi: "destrói", bane: "bane", devolve: "devolve", compra: "compra cartas", envia: "envia ao Cemitério", invoca: "invoca", controle: "toma o controle", outros: "outros" },
  en: { "nega-ativacao": "negates activation", "nega-efeito": "negates effect", destroi: "destroys", bane: "banishes", devolve: "bounces", compra: "draws", envia: "sends to GY", invoca: "summons", controle: "takes control", outros: "other" },
  es: { "nega-ativacao": "niega la activación", "nega-efeito": "niega el efecto", destroi: "destruye", bane: "destierra", devolve: "devuelve", compra: "roba cartas", envia: "envía al Cementerio", invoca: "invoca", controle: "toma el control", outros: "otros" },
};

/** Tags do núcleo que contam como interrupção do próprio deck */
const TAGS_INTERRUPCAO = ["hand-trap", "negacao", "omni-negate", "board-breaker", "nega-ativacao", "nega-efeito", "nega-invocacao"];

const LIMITE_LINHAS = 12;

export default function GuiaDeck({
  onBack,
  onTestar,
  inicial,
  onRota,
}: {
  onBack: () => void;
  onTestar?: (deckId: string, combo: ComboTeste) => void;
  /** link compartilhado: deck e aba (#/guia/<arquétipo>/<aba>) */
  inicial?: { arquetipo?: string; aba?: string };
  /** o endereço acompanha o deck e a aba abertos */
  onRota?: (r: Rota) => void;
}) {
  const db = useCardDb();
  const conta = useConta();
  // começa no idioma do app; o seletor do guia troca só nesta tela (ex.: ler um artigo em outro idioma)
  const [idioma, escolherIdioma] = useState<Idioma>(IDIOMA);
  const t = T[idioma];
  const meta = db.extras?.metaTcg;
  const [escolhido, setEscolhido] = useState<string | null>(inicial?.arquetipo ?? null);
  const deck: ArquetipoMeta | undefined = meta?.arquetipos.find((a) => a.arquetipo.toLowerCase() === escolhido?.toLowerCase()) ?? meta?.arquetipos[0];
  const [aba, setAba] = useState<Aba>(() => (["iniciais", "avancadas", "combos", "interacoes", "artigos"].includes(inicial?.aba ?? "") ? (inicial!.aba as Aba) : "iniciais"));
  // o endereço mostra o deck e a aba (para copiar e para o voltar do navegador)
  useEffect(() => {
    if (deck) onRota?.({ tela: "guia", arquetipo: deck.arquetipo, aba });
  }, [deck?.arquetipo, aba]); // eslint-disable-line react-hooks/exhaustive-deps
  const conteudo = useRef<HTMLDivElement>(null);

  useEffect(() => void initCardDb(), []);
  useEffect(() => conteudo.current?.scrollTo({ top: 0 }), [deck?.arquetipo, aba]);

  const byId = useMemo(() => new Map(db.cards.map((c) => [c.id, c])), [db.cards]);
  const byName = useMemo(() => new Map(db.cards.map((c) => [c.name, c])), [db.cards]);
  const ctxRespostas = useContextoRespostas(byId);
  const nomeCarta = useCallback((c: Card) => (idioma === "pt" ? displayName(c) : c.name), [idioma]);
  const nomeId = useCallback((id: number) => (id === 0 ? tr("Token") : id === CARTA_QUALQUER ? (idioma === "pt" ? tr("carta qualquer") : idioma === "en" ? tr("any card") : tr("carta cualquiera")) : byId.get(id) ? nomeCarta(byId.get(id)!) : `#${id}`), [byId, nomeCarta, idioma]);

  // prévia ao passar o mouse (a mesma das outras telas)
  const [hover, setHover] = useState<{ card: Card; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();
  const onHover = useCallback((card: Card | null, el?: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (!card || !el) return setHover(null);
    hoverTimer.current = window.setTimeout(() => setHover({ card, rect: el.getBoundingClientRect() }), 300);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  /** Nome de carta com prévia */
  const Carta = ({ card }: { card: Card }) => (
    <span className="gd-carta" onPointerEnter={(e) => e.pointerType === "mouse" && onHover(card, e.currentTarget)} onPointerLeave={() => onHover(null)}>
      {nomeCarta(card)}
    </span>
  );
  /** Texto com **negrito** e [[Carta]] */
  const rico = (texto: string): ReactNode[] =>
    texto.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g).map((parte, i) => {
      if (parte.startsWith("[[")) {
        const nome = parte.slice(2, -2);
        const card = byName.get(nome);
        if (!card) return <strong key={i}>{nome}</strong>;
        // a banlist muda toda semana; o texto escrito não: a carta proibida hoje ganha o aviso sozinha
        return copiasPermitidas(card, "TCG") === 0 ? (
          <span key={i} className="gd-proibida">
            <Carta card={card} />{" "}
            <small title={t.proibidaExpl}>({t.proibida})</small>
          </span>
        ) : (
          <Carta key={i} card={card} />
        );
      }
      if (parte.startsWith("**")) return <strong key={i}>{parte.slice(2, -2)}</strong>;
      return parte;
    });

  const linhas = useMemo(() => (deck ? linhasDoArquetipo(db.extras?.combos, deck.arquetipo) : []), [db.extras?.combos, deck]);
  const interacoes = useMemo(() => calcularInteracoes(linhas, ctxRespostas), [linhas, ctxRespostas]);
  const escrito = GUIAS_ESCRITOS.find((g) => g.arquetipo === deck?.arquetipo);
  const texto = escrito?.textos[idioma];

  const nomeArquetipo = (a: string) => {
    const pt = idioma === "pt" ? db.archetypePt.get(a) : undefined;
    return pt && pt.toLowerCase() !== a.toLowerCase() ? `${a} · ${pt}` : a;
  };
  const tendencia = (a: ArquetipoMeta) => (a.pct2m > a.pct6m * 1.15 ? "▲" : a.pct2m < a.pct6m * 0.85 ? "▼" : "•");

  const testar = (l: LinhaCombo) => {
    if (!onTestar) return;
    const linha = semCartaDoCalculo(l);
    const d = deckDoCombo(linha, byId, "TCG");
    onTestar(d.id, { mao: linha.mao, passos: linha.passos, qualquer: linha.qualquer });
  };

  // ---------------------------------------------------------------- partes

  const nucleo = (cartas: CartaNucleo[], titulo: string) =>
    cartas.length > 0 && (
      <div className="gd-nucleo-parte">
        <h5>{titulo}</h5>
        <div className="gd-grade">
          {cartas.map((n) => {
            const c = byId.get(n.id);
            if (!c) return null;
            return (
              <div key={n.id} className="gd-thumb" onPointerEnter={(e) => e.pointerType === "mouse" && onHover(c, e.currentTarget)} onPointerLeave={() => onHover(null)} title={nomeCarta(c)}>
                <div className="gd-arte">
                  <img src={cardImage(c.id, "small")} alt={nomeCarta(c)} loading="lazy" />
                  <CardSelos card={c} formato="TCG" />
                </div>
                <span className="gd-copias">
                  {tr("{0}× · {1}%", [n.copias.toLocaleString(idioma), Math.round(n.pct * 100)])}</span>
              </div>
            );
          })}
        </div>
      </div>
    );

  const blocos = (lista: { titulo: string; itens: string[] }[]) =>
    lista.map((b) => (
      <div key={b.titulo} className="gd-bloco">
        <h4>{b.titulo}</h4>
        <ul>
          {b.itens.map((item) => (
            <li key={item}>{rico(item)}</li>
          ))}
        </ul>
      </div>
    ));

  /**
   * Passos para exibir: movimentos iguais seguidos (ex.: os 10 banimentos do Pot of Desires) viram
   * um passo só, com as cartas juntas; as respostas ficam as do último deles.
   */
  const agrupar = (passos: Passo[]): { p: Passo; cartas: number[] }[] => {
    const out: { p: Passo; cartas: number[] }[] = [];
    for (const p of passos) {
      const ant = out[out.length - 1];
      if (ant && p.t === "move" && ant.p.t === "move" && ant.p.de === p.de && ant.p.para === p.para && !ant.p.resp?.length) {
        ant.cartas.push(p.c);
        ant.p = { ...p, c: ant.p.c };
      } else out.push({ p, cartas: [p.t === "move" ? p.c : 0] });
    }
    return out;
  };
  const passoComRespostas = ({ p, cartas }: { p: Passo; cartas: number[] }, j: number) => {
    const resp = ordenarRespostas(p.resp ?? [], ctxRespostas);
    const nomeDoPasso = cartas.length > 1 ? (id: number) => (p.t === "move" && id === p.c ? cartas.map(nomeId).join(", ") : nomeId(id)) : nomeId;
    return (
      <li key={j}>
        {passoNoIdioma(p, nomeDoPasso, idioma)}
        {resp.length > 0 && (
          <div className="gd-resp">
            ↯ {t.podeResponder}:{" "}
            {resp.slice(0, 5).map((r, k) => (
              <span key={r.id}>
                {k > 0 && ", "}
                {r.card ? <Carta card={r.card} /> : `#${r.id}`}
              </span>
            ))}
            {resp.length > 5 && <small> +{resp.length - 5}</small>}
          </div>
        )}
      </li>
    );
  };

  const [mostrarLinhas, setMostrarLinhas] = useState(LIMITE_LINHAS);
  useEffect(() => setMostrarLinhas(LIMITE_LINHAS), [deck?.arquetipo]);

  // ---------------------------------------------------------------- combos da comunidade e artigos

  const [comunidade, setComunidade] = useState<ComboBase[]>([]);
  useEffect(() => {
    if (aba !== "combos" || !deck || !supabaseReady()) return;
    let vivo = true;
    combosDoArquetipo(deck.arquetipo)
      .then((l) => vivo && setComunidade(l))
      .catch(() => vivo && setComunidade([]));
    return () => {
      vivo = false;
    };
  }, [aba, deck]);

  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [erroArtigos, setErroArtigos] = useState("");
  const [todosIdiomas, setTodosIdiomas] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [form, setForm] = useState<{ tipo: TipoArtigo; idioma: Idioma; titulo: string; resumo: string; conteudo: string } | null>(null);
  const [msgArtigo, setMsgArtigo] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [recusando, setRecusando] = useState<{ id: string; motivo: string } | null>(null);
  const carregarArtigos = useCallback(() => {
    if (!deck || !supabaseReady()) return;
    listarArtigos(deck.arquetipo)
      .then((l) => {
        setArtigos(l);
        setErroArtigos("");
      })
      .catch((e) => setErroArtigos(e instanceof Error ? e.message : String(e)));
  }, [deck]);
  useEffect(() => {
    if (aba === "artigos") carregarArtigos();
  }, [aba, carregarArtigos, conta]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !deck || !conta) return;
    try {
      await enviarArtigo({ ...form, arquetipo: deck.arquetipo, autor_nome: conta.usuario || conta.email.split("@")[0] });
      setForm(null);
      setMsgArtigo({ tipo: "ok", texto: t.enviado });
      carregarArtigos();
    } catch (err) {
      setMsgArtigo({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    }
  };

  /** Texto do artigo: parágrafos, listas com "- ", **negrito** e [[Carta]] */
  const textoArtigo = (s: string) => {
    const out: ReactNode[] = [];
    let lista: ReactNode[] = [];
    const fechar = () => {
      if (lista.length) out.push(<ul key={`l${out.length}`}>{lista}</ul>);
      lista = [];
    };
    s.split("\n").forEach((linha, i) => {
      const l = linha.trim();
      if (l.startsWith("- ")) return void lista.push(<li key={i}>{rico(l.slice(2))}</li>);
      fechar();
      if (l) out.push(<p key={i}>{rico(l)}</p>);
    });
    fechar();
    return out;
  };

  // ---------------------------------------------------------------- tela

  const ready = db.status === "ready";
  const atualizado = meta ? new Date(meta.atualizadoEm).toLocaleDateString(idioma === "pt" ? LOCALE : idioma) : "";

  return (
    <ScreenShell
      title={t.titulo}
      accent="cyan"
      onBack={onBack}
      plain
      actions={
        <div className="format-switch gd-idiomas" role="radiogroup" aria-label={tr("Idioma / Language")}>
          {IDIOMAS.map((x) => (
            <button key={x.id} role="radio" aria-checked={idioma === x.id} className={idioma === x.id ? "active" : ""} onClick={() => escolherIdioma(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      {!ready ? (
        <div className="db-loading">
          <span className="spinner" />
          <p>{db.step ?? "…"}</p>
        </div>
      ) : !meta || !deck ? (
        <div className="combos-empty">
          <p>{t.semDados}</p>
        </div>
      ) : (
        <div className="guia-deck">
          <nav className="gd-lista" aria-label={t.titulo}>
            <p className="tags-note">{t.base(meta.decks, atualizado)}</p>
            {meta.arquetipos.map((a, i) => (
              <button key={a.arquetipo} className={a.arquetipo === deck.arquetipo ? "active" : ""} onClick={() => setEscolhido(a.arquetipo)}>
                <span className="gd-pos">{i + 1}</span>
                <span className="gd-nome">
                  {nomeArquetipo(a.arquetipo)}
                  {GUIAS_ESCRITOS.some((g) => g.arquetipo === a.arquetipo) && <span className="gd-escrito" title={t.abas.iniciais}>✎</span>}
                </span>
                <span className="gd-pct" title={`${a.pct6m}% ${t.pct6m} · ${a.pct2m}% ${t.pct2m}`}>
                  {a.pct6m}% <small className={`gd-tend ${tendencia(a) === "▲" ? "sobe" : tendencia(a) === "▼" ? "desce" : ""}`}>{tendencia(a)}</small>
                </span>
              </button>
            ))}
          </nav>

          <div className="gd-conteudo" ref={conteudo}>
            <header className="gd-topo">
              <h3>{nomeArquetipo(deck.arquetipo)}</h3>
              {deck && <BotaoLink rota={{ tela: "guia", arquetipo: deck.arquetipo, aba }} className="gd-link" />}
              <div className="gd-numeros">
                <span>
                  <strong>{deck.pct6m}%</strong> {t.pct6m}
                </span>
                <span>
                  <strong>{deck.pct2m}%</strong> {t.pct2m}
                </span>
                <span>
                  <strong>{deck.vitorias}</strong> {t.vitorias}
                </span>
              </div>
              {deck.nomes.length > 1 && (
                <p className="tags-note">
                  {t.nomes}: {deck.nomes.slice(1).join(" · ")}
                </p>
              )}
              {deck.parceiros.length > 0 && (
                <p className="tags-note">
                  {t.parceiros}: {deck.parceiros.map(nomeArquetipo).join(" · ")}
                </p>
              )}
              <div className="left-tabs gd-abas" role="tablist">
                {(Object.keys(t.abas) as Aba[]).map((a) => (
                  <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "active" : ""} onClick={() => setAba(a)}>
                    {t.abas[a]}
                  </button>
                ))}
              </div>
            </header>

            {aba === "iniciais" && (
              <section>
                {texto ? (
                  <>
                    <p className="gd-resumo">{rico(texto.resumo)}</p>
                    {blocos(texto.iniciais)}
                    <p className="tags-note">{t.revisado(escrito!.revisado)}</p>
                  </>
                ) : (
                  <p className="db-warning">{t.semGuia}</p>
                )}
                <div className="gd-bloco">
                  <h4>{t.nucleo}</h4>
                  <p className="tags-note">{t.nucleoExpl}</p>
                  {nucleo(deck.nucleo.main, t.main)}
                  {nucleo(deck.nucleo.extra, t.extra)}
                  {nucleo(deck.nucleo.side, t.side)}
                </div>
                {startersCalculados(linhas).length > 0 && (
                  <div className="gd-bloco">
                    <h4>{t.starters}</h4>
                    <p className="tags-note">{t.startersExpl(linhas.length)}</p>
                    <ul className="gd-starters">
                      {startersCalculados(linhas)
                        .slice(0, 10)
                        .map((s) => (
                          <li key={s.id}>
                            {byId.get(s.id) ? <Carta card={byId.get(s.id)!} /> : `#${s.id}`} <small>({s.linhas})</small>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                <div className="gd-bloco">
                  <h4>{t.listas}</h4>
                  <ul>
                    {deck.exemplos.map((x) => (
                      <li key={x.deckNum}>
                        <a href={x.url} target="_blank" rel="noreferrer">
                          {x.nome}
                        </a>{" "}
                        · {x.torneio} · {x.colocacao}
                        {x.jogadores ? ` (${x.jogadores})` : ""} · <small>{x.quando}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {aba === "avancadas" && (
              <section>
                {texto ? blocos(texto.avancadas) : <p className="db-warning">{t.semGuia}</p>}
                {interacoes.pontos.length > 0 && (
                  <div className="gd-bloco">
                    <h4>{t.pontosResumo}</h4>
                    <ol>
                      {interacoes.pontos.slice(0, 4).map((p, i) => (
                        <li key={i}>
                          {passoNoIdioma(p.passo, nomeId, idioma)} — <small>{t.respostasN(p.respostas.length)}</small>
                        </li>
                      ))}
                    </ol>
                    <button className="link-btn" onClick={() => setAba("interacoes")}>
                      {t.verInteracoes} →
                    </button>
                  </div>
                )}
              </section>
            )}

            {aba === "combos" && (
              <section>
                <div className="gd-bloco">
                  <h4>{t.combosApp}</h4>
                  <p className="tags-note">{t.combosExpl}</p>
                  {!linhas.length && <p className="db-warning">{t.semCombos}</p>}
                  {linhas.slice(0, mostrarLinhas).map((l, i) => (
                    <details key={i} className="gd-linha" open={i === 0}>
                      <summary>
                        <span>
                          {t.mao}: {l.mao.map((id) => nomeId(id)).join(" + ")}
                          {l.ramo?.length ? ` · ${t.adicionando} ${l.ramo.map(nomeId).join(", ")}` : ""}
                        </span>
                        {onTestar && (
                          <button
                            className="ghost-btn vc-testar"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              testar(l);
                            }}
                          >
                            {t.testar}
                          </button>
                        )}
                      </summary>
                      <ol>{agrupar(semCartaDoCalculo(l).passos).map(passoComRespostas)}</ol>
                      <p className="gd-campo">
                        <strong>{t.campoFinal}:</strong> {[...l.campo.monstros, ...l.campo.magias.map(([c]) => c)].map(nomeId).join(", ")}
                      </p>
                    </details>
                  ))}
                  {linhas.length > mostrarLinhas && (
                    <button className="ghost-btn" onClick={() => setMostrarLinhas((n) => n + LIMITE_LINHAS)}>
                      {t.mais(Math.min(LIMITE_LINHAS, linhas.length - mostrarLinhas))}
                    </button>
                  )}
                </div>
                {supabaseReady() && (
                  <div className="gd-bloco">
                    <h4>{t.comunidade}</h4>
                    {comunidade.length ? (
                      comunidade.map((c) => <ComboCard key={c.id} combo={c} byId={byId} onHover={onHover} highlight={new Set()} format="TCG" />)
                    ) : (
                      <p className="tags-note">{t.semComunidade}</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {aba === "interacoes" && (
              <section>
                <p className="gd-resumo">{t.intExpl}</p>
                {!linhas.length && <p className="db-warning">{t.semInteracoes}</p>}
                {interacoes.respostas.length > 0 && (
                  <div className="gd-bloco">
                    <h4>{t.respostasTitulo}</h4>
                    <ul className="gd-respostas">
                      {interacoes.respostas.slice(0, 15).map((r) => (
                        <li key={r.id}>
                          {r.card && <img src={cardImage(r.card.id, "small")} alt="" loading="lazy" />}
                          <div>
                            <div className="gd-resp-topo">
                              {r.card ? <Carta card={r.card} /> : `#${r.id}`}
                              {r.tipos.some((x) => x !== "outros") && (
                                <span className="gd-tipos">{r.tipos.filter((x) => x !== "outros").map((x) => TIPOS_RESPOSTA[idioma][x] ?? x).join(" · ")}</span>
                              )}
                            </div>
                            <div className="gd-barra" title={t.linhasPct(Math.round(r.pctLinhas * 100))}>
                              <span style={{ width: `${Math.round(r.pctLinhas * 100)}%` }} />
                            </div>
                            <small>
                              {t.linhasPct(Math.round(r.pctLinhas * 100))}
                              {r.uso > 0 && ` · ${t.uso(Math.round(r.uso * 100))}`} · {t.primeiro(Math.max(1, Math.round(r.primeiroPasso)))}
                            </small>
                            <small className="gd-onde">
                              {t.ondeAcerta}: {r.passos.map((p) => passoNoIdioma(p.passo, nomeId, idioma)).join(" · ")}
                            </small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {interacoes.pontos.length > 0 && (
                  <div className="gd-bloco">
                    <h4>{t.pontosTitulo}</h4>
                    <p className="tags-note">{t.pontosExpl}</p>
                    <ol className="gd-pontos">
                      {interacoes.pontos.map((p, i) => (
                        <li key={i}>
                          <strong>{passoNoIdioma(p.passo, nomeId, idioma)}</strong> <small>· {t.respostasN(p.respostas.length)}</small>
                          <div className="gd-resp">
                            {p.respostas.slice(0, 8).map((r, k) => (
                              <span key={r.id}>
                                {k > 0 && ", "}
                                {r.card ? <Carta card={r.card} /> : `#${r.id}`}
                              </span>
                            ))}
                            {p.respostas.length > 8 && <small> +{p.respostas.length - 8}</small>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {(() => {
                  const proprias = [...deck.nucleo.main, ...deck.nucleo.extra, ...deck.nucleo.side]
                    .map((n) => byId.get(n.id))
                    .filter((c): c is Card => !!c && !!c.tags?.some((tg) => TAGS_INTERRUPCAO.includes(tg)));
                  const unicas = [...new Map(proprias.map((c) => [c.id, c])).values()];
                  return (
                    unicas.length > 0 && (
                      <div className="gd-bloco">
                        <h4>{t.proprias}</h4>
                        <p className="tags-note">{t.propriasExpl}</p>
                        <div className="gd-grade">
                          {unicas.map((c) => (
                            <div key={c.id} className="gd-thumb" onPointerEnter={(e) => e.pointerType === "mouse" && onHover(c, e.currentTarget)} onPointerLeave={() => onHover(null)} title={nomeCarta(c)}>
                              <img src={cardImage(c.id, "small")} alt={nomeCarta(c)} loading="lazy" />
                              <CardSelos card={c} formato="TCG" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  );
                })()}
              </section>
            )}

            {aba === "artigos" && (
              <section>
                <p className="gd-resumo">{t.artigosExpl}</p>
                <label className="respostas-toggle">
                  <input type="checkbox" checked={todosIdiomas} onChange={(e) => setTodosIdiomas(e.target.checked)} /> {t.todosIdiomas}
                </label>
                {erroArtigos && <p className="db-warning">{erroArtigos}</p>}
                {msgArtigo && <p className={msgArtigo.tipo === "erro" ? "db-warning" : "conta-ok"}>{msgArtigo.texto}</p>}
                {(() => {
                  const visiveis = artigos.filter((a) => todosIdiomas || a.idioma === idioma || a.status !== "aprovado");
                  return visiveis.length ? (
                    <ul className="gd-artigos">
                      {visiveis.map((a) => (
                        <li key={a.id} className={`gd-artigo status-${a.status}`}>
                          <div className="gd-artigo-topo">
                            <strong>{a.titulo}</strong>
                            <span className="vc-badge">{t.tipos[a.tipo]}</span>
                            <span className="vc-badge">{a.idioma.toUpperCase()}</span>
                            {a.status === "pendente" && <span className="vc-badge gd-pendente">{t.pendente}</span>}
                            {a.status === "recusado" && <span className="vc-badge gd-recusado">{t.recusado}</span>}
                          </div>
                          <small>
                            {t.por} @{a.autor_nome} · {new Date(a.criado_em).toLocaleDateString(idioma === "pt" ? LOCALE : idioma)}
                          </small>
                          {a.resumo && <p>{rico(a.resumo)}</p>}
                          {a.status === "recusado" && a.motivo && <p className="db-warning">{a.motivo}</p>}
                          {aberto === a.id ? <div className="gd-artigo-texto">{textoArtigo(a.conteudo)}</div> : null}
                          <div className="gd-artigo-acoes">
                            <button className="link-btn" onClick={() => setAberto(aberto === a.id ? null : a.id)}>
                              {aberto === a.id ? t.fechar : t.ler}
                            </button>
                            {conta?.admin && a.status === "pendente" && (
                              <>
                                <button className="link-btn" onClick={() => void moderarArtigo(a.id, "aprovado").then(carregarArtigos)}>
                                  {t.aprovar}
                                </button>
                                {recusando?.id === a.id ? (
                                  <span className="gd-recusar">
                                    <input placeholder={t.motivo} value={recusando.motivo} onChange={(e) => setRecusando({ id: a.id, motivo: e.target.value })} />
                                    <button className="link-btn" onClick={() => void moderarArtigo(a.id, "recusado", recusando.motivo).then(() => { setRecusando(null); carregarArtigos(); })}>
                                      {t.recusar}
                                    </button>
                                  </span>
                                ) : (
                                  <button className="link-btn" onClick={() => setRecusando({ id: a.id, motivo: "" })}>
                                    {t.recusar}
                                  </button>
                                )}
                              </>
                            )}
                            {(conta?.admin || conta?.id === a.autor_id) && (
                              <button className="link-btn" onClick={() => void apagarArtigo(a.id).then(carregarArtigos)}>
                                {t.apagar}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="tags-note">{t.semArtigos}</p>
                  );
                })()}
                {supabaseReady() &&
                  (!conta ? (
                    <button className="ghost-btn" onClick={() => openConta()}>
                      {t.entrarParaEnviar}
                    </button>
                  ) : !form ? (
                    <button className="ghost-btn gd-enviar" onClick={() => { setMsgArtigo(null); setForm({ tipo: "tatica", idioma, titulo: "", resumo: "", conteudo: "" }); }}>
                      {t.enviar}
                    </button>
                  ) : (
                    <form className="comunidade-form gd-form" onSubmit={(e) => void enviar(e)}>
                      <div className="gd-form-linha">
                        <label className="field">
                          <span className="field-label">{t.tipo}</span>
                          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoArtigo })}>
                            {(Object.keys(t.tipos) as TipoArtigo[]).map((x) => (
                              <option key={x} value={x}>
                                {t.tipos[x]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">{t.idioma}</span>
                          <select value={form.idioma} onChange={(e) => setForm({ ...form, idioma: e.target.value as Idioma })}>
                            {IDIOMAS.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="field">
                        <span className="field-label">{t.tituloArtigo}</span>
                        <input required minLength={3} maxLength={140} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                      </label>
                      <label className="field">
                        <span className="field-label">{t.resumo}</span>
                        <input maxLength={400} value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} />
                      </label>
                      <label className="field">
                        <span className="field-label">{t.conteudo}</span>
                        <textarea required minLength={50} maxLength={20000} rows={10} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} />
                      </label>
                      <p className="tags-note">{t.conteudoDica}</p>
                      <div className="dialog-actions">
                        <button className="ghost-btn" type="button" onClick={() => setForm(null)}>
                          {t.fechar}
                        </button>
                        <button className="ghost-btn" type="submit">
                          {t.enviarBtn}
                        </button>
                      </div>
                    </form>
                  ))}
              </section>
            )}
          </div>
        </div>
      )}
      {hover && <CardPreview card={hover.card} anchor={hover.rect} />}
    </ScreenShell>
  );
}
