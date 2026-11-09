// Simulador: motor de regras do EDOPro (ocgcore, via ocgcore-wasm) com os dados e scripts do Project
// Ignis, que chegam no pacote do motor (gerado pelo pipeline Database-Cards-Ygo, scripts/pacote-motor.ts).
// Este módulo não usa DOM: roda no Worker do simulador (src/sim/worker.ts) e nos testes em Node.
//
// Licença: o ocgcore e os scripts do Project Ignis são AGPL-3.0, e por isso o app inteiro também é.
import createCore, {
  OcgDuelMode,
  OcgLocation as L,
  OcgMessageType as T,
  OcgPosition,
  type OcgCardData,
  type OcgCoreSync,
  type OcgDuelHandle,
  type OcgMessage,
  type OcgResponse,
} from "ocgcore-wasm";

/** [alias, arquétipos (16 bits cada), tipo, nível bruto, atributo, raça, ATK, DEF bruta] */
export type DadosCarta = [number, number[], number, number, number, number, number, number];

/** Pacote do motor (mesmo formato de scripts/pacote-motor.ts do pipeline) */
export interface PacoteMotor {
  formato: 1;
  versao: string;
  geradoEm: string;
  scripts: string;
  cartas: Record<string, DadosCarta>;
  nomes: Record<string, string>;
  textos: Record<string, string[]>;
  arquivos: Record<string, string>;
}

export const TIPO = {
  MONSTRO: 0x1,
  MAGIA: 0x2,
  ARMADILHA: 0x4,
  NORMAL: 0x10,
  EFEITO: 0x20,
  FUSAO: 0x40,
  RITUAL: 0x80,
  SINCRO: 0x2000,
  FICHA: 0x4000,
  RAPIDA: 0x10000,
  CONTINUA: 0x20000,
  EQUIPAMENTO: 0x40000,
  CAMPO: 0x80000,
  PENDULO: 0x1000000,
  XYZ: 0x800000,
  LINK: 0x4000000,
} as const;
export const TIPOS_EXTRA = TIPO.FUSAO | TIPO.SINCRO | TIPO.XYZ | TIPO.LINK;

// mensagens em que o motor espera uma resposta
export const DECISOES = new Set<number>([
  T.SELECT_BATTLECMD,
  T.SELECT_IDLECMD,
  T.SELECT_EFFECTYN,
  T.SELECT_YESNO,
  T.SELECT_OPTION,
  T.SELECT_CARD,
  T.SELECT_CHAIN,
  T.SELECT_PLACE,
  T.SELECT_POSITION,
  T.SELECT_TRIBUTE,
  T.SORT_CHAIN,
  T.SELECT_COUNTER,
  T.SELECT_SUM,
  T.SELECT_DISFIELD,
  T.SORT_CARD,
  T.SELECT_UNSELECT_CARD,
  T.ANNOUNCE_RACE,
  T.ANNOUNCE_ATTRIB,
  T.ANNOUNCE_CARD,
  T.ANNOUNCE_NUMBER,
  T.ROCK_PAPER_SCISSORS,
  T.RETRY,
]);

export interface DeckSim {
  main: number[];
  extra: number[];
}

/** Duelo a criar: o deck do jogador 0 começa (o motor sempre dá o primeiro turno a ele) */
export interface Partida {
  decks: [DeckSim, DeckSim];
  /** semente do embaralhamento: a mesma semente com as mesmas respostas repete o duelo inteiro */
  semente: [string, string, string, string];
}

export interface Motor {
  core: OcgCoreSync;
  pacote: PacoteMotor;
  dados(code: number): OcgCardData | null;
  tipo(code: number): number;
  nome(code: number): string;
  /** texto de um efeito (descrição do EDOPro = id da carta << 20 | número do texto); undefined se não houver */
  texto(desc: bigint | number): string | undefined;
  /** constantes do Lua (ex.: HINTMSG_DESTROY → 502), lidas do constant.lua do pacote */
  constante(valor: number, prefixo: string): string | undefined;
  /** cria o duelo; o motor só tem as cartas que existem no pacote (as outras ficam de fora) */
  novoDuelo(p: Partida): OcgDuelHandle;
  /** processa até a próxima decisão (ou o fim do duelo) */
  ate(duel: OcgDuelHandle): { decisao: OcgMessage | null; log: OcgMessage[] };
}

/** Abre o motor com o pacote. `wasm`: o binário do ocgcore (sem ele, o ocgcore-wasm acha o arquivo sozinho) */
export async function abrirMotor(pacote: PacoteMotor, wasm?: { url?: string; binario?: ArrayBuffer }): Promise<Motor> {
  const core = await createCore({
    sync: true,
    ...(wasm?.binario ? { wasmBinary: wasm.binario } : {}),
    ...(wasm?.url ? { locateFile: () => wasm.url! } : {}),
  });

  const cache = new Map<number, OcgCardData | null>();
  function dados(code: number): OcgCardData | null {
    if (cache.has(code)) return cache.get(code)!;
    const c = pacote.cartas[code];
    let d: OcgCardData | null = null;
    if (c) {
      const [alias, setcodes, type, level, attribute, race, atk, def] = c;
      const link = (type & TIPO.LINK) !== 0;
      d = {
        code,
        alias,
        setcodes,
        type,
        level: level & 0xff,
        lscale: (level >> 24) & 0xff,
        rscale: (level >> 16) & 0xff,
        attribute,
        race: BigInt(race),
        attack: atk,
        // em monstros Link, "def" guarda as setas
        defense: link ? 0 : def,
        link_marker: link ? def : 0,
      };
    }
    cache.set(code, d);
    return d;
  }

  const scriptReader = (nome: string) => pacote.arquivos[nome.replace(/^.*[\\/]/, "")] ?? null;

  const constantes = new Map<string, string>();
  for (const m of (pacote.arquivos["constant.lua"] ?? "").matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(0x[0-9a-fA-F]+|\d+)\b/gm)) {
    const chave = `${m[1].split("_")[0]}_:${Number(m[2])}`;
    if (!constantes.has(chave)) constantes.set(chave, m[1]);
  }

  function novoDuelo({ decks, semente }: Partida): OcgDuelHandle {
    // o motor não embaralha o Deck no início (no EDOPro quem embaralha é o servidor): embaralha aqui,
    // com a semente do duelo, para a mesma partida repetir a mesma ordem (a IA depende disso)
    const time = { startingLP: 8000, startingDrawCount: 5, drawCountPerTurn: 1 };
    const duel = core.createDuel({
      flags: OcgDuelMode.MODE_MR5,
      seed: semente.map((s) => BigInt(s)) as [bigint, bigint, bigint, bigint],
      team1: time,
      team2: time,
      cardReader: dados,
      scriptReader,
      errorHandler: () => {},
    });
    if (!duel) throw new Error("motor: não criou o duelo");
    for (const f of ["constant.lua", "utility.lua"]) core.loadScript(duel, f, scriptReader(f) ?? "");
    decks.forEach((deck, team) => {
      const add = (code: number, location: L) =>
        core.duelNewCard(duel, { team: team as 0 | 1, duelist: 0, code, controller: team as 0 | 1, location, sequence: 0, position: OcgPosition.FACEDOWN_DEFENSE });
      embaralhar(deck.main.filter((c) => pacote.cartas[c]), `${semente.join(":")}:${team}`).forEach((c) => add(c, L.DECK));
      deck.extra.filter((c) => pacote.cartas[c]).forEach((c) => add(c, L.EXTRA));
    });
    core.startDuel(duel);
    return duel;
  }

  function ate(duel: OcgDuelHandle) {
    const log: OcgMessage[] = [];
    for (let guarda = 0; guarda < 100000; guarda++) {
      const status = core.duelProcess(duel);
      let decisao: OcgMessage | null = null;
      for (const m of core.duelGetMessage(duel)) {
        if (DECISOES.has(m.type)) decisao = m;
        else log.push(m);
      }
      if (decisao) return { decisao, log };
      if (status === 0) return { decisao: null, log };
    }
    throw new Error("motor: o duelo não para de processar");
  }

  return {
    core,
    pacote,
    dados,
    tipo: (code) => (dados(code)?.type as number) ?? 0,
    nome: (code) => pacote.nomes[code] ?? String(code),
    texto(desc) {
      const d = BigInt(desc);
      const code = Number(d >> 20n);
      return pacote.textos[code]?.[Number(d & 0xfffffn)] || undefined;
    },
    constante: (valor, prefixo) => constantes.get(`${prefixo}_:${valor}`),
    novoDuelo,
    ate,
  };
}

/** Embaralha (Fisher-Yates) com um gerador determinístico pela semente (mulberry32 sobre o hash da semente) */
export function embaralhar<T>(lista: T[], semente: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 16777619);
  const aleatorio = () => {
    h = (h + 0x6d2b79f5) | 0;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A resposta repetida em outro duelo igual (para a IA testar jogadas) é a mesma: o motor é determinístico */
export type Historico = OcgResponse[];

/** Recria o duelo e reaplica as respostas dadas até aqui (o motor não copia estado) */
export function reproduzir(motor: Motor, partida: Partida, historico: Historico) {
  const duel = motor.novoDuelo(partida);
  let r = motor.ate(duel);
  for (const resp of historico) {
    if (!r.decisao) break;
    motor.core.duelSetResponse(duel, resp);
    r = motor.ate(duel);
  }
  return { duel, decisao: r.decisao };
}
