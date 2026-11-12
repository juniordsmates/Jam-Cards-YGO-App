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
  /** mão inicial fixa de cada jogador (teste de combo): essas cartas vão para o topo do Deck depois de embaralhar */
  maos?: [number[], number[]];
}

/** Um elo da cadeia: quem ativou, se nega e se tira cartas, a carta que ativou e os alvos */
export interface EloCadeia {
  p: number;
  nega: boolean;
  tira: boolean;
  dono: { controller: number; location: number; sequence: number };
  alvos: { controller: number; location: number; sequence: number }[];
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
  /**
   * Interrupção de mão ("hand trap"): monstro do Main Deck com Efeito Rápido ativado da mão (Ash
   * Blossom, Maxx "C", Droll & Lock Bird...), conforme o script da carta (ou o da carta original)
   */
  interrompeDaMao(code: number): boolean;
  /**
   * Valor do que a carta faz enquanto está em campo, lido do script: interrupção (Efeito Rápido que
   * nega, bane, destrói ou devolve), remoção que ela ativa e proteção (imune, não pode ser destruída
   * ou ser alvo). 0 para quem só é corpo.
   */
  valorEmCampo(code: number): number;
  /**
   * Valor de uma Magia/Armadilha baixada ao ser ativada, na mesma escala de valorEmCampo: 2 se o efeito
   * de ativação nega ou tira cartas (interrupção, ex.: Toon Terror, Infinite Impermanence), senão 0.
   */
  valorAoAtivar(code: number): number;
  /**
   * O efeito (descrição do EDOPro) só tira cartas do campo (bane, destrói, devolve, toma o controle),
   * sem Invocar, buscar nem comprar: com o campo do oponente vazio, ativá-lo tiraria uma carta própria
   */
  soRemove(desc: bigint | number): boolean;
  /**
   * O efeito (carta e descrição do EDOPro) responde a uma jogada: ativado quando um efeito é ativado
   * ou um monstro é Invocado, e nega ou tira a carta (Ash Blossom, Ghost Ogre, Toon Terror, Solemn).
   * Usado contra a própria jogada, só desperdiça a carta.
   */
  respondeJogada(code: number, desc: bigint | number): boolean;
  /** O efeito só nega (Ash Blossom): a carta que ativou fica onde está */
  soNega(code: number, desc: bigint | number): boolean;
  /**
   * O efeito pode ser usado de novo no mesmo turno (limite de 2 ou mais vezes, ou sem limite, numa carta
   * que fica em campo): negar uma das vezes só atrasa o oponente, não é o ponto que trava o combo
   */
  repetivel(code: number, desc: bigint | number): boolean;
  /**
   * O efeito só devolve ao Deck ou bane cartas do Cemitério (ex.: Evil Box), sem Invocar, buscar nem
   * tocar no campo: só vale se houver no Cemitério do oponente uma carta com efeito lá
   */
  soNoCemiterio(code: number, desc: bigint | number): boolean;
  /**
   * A carta tem efeito contínuo que age antes de cada elo resolver (ex.: Toon World the Perfect World
   * bane um monstro Toon até o elo resolver, para ele escapar do efeito)
   */
  aoResolver(code: number): boolean;
  /** Elos da cadeia em aberto (o último é o que resolve agora, na resolução), lidos no duelo */
  cadeia(duel: OcgDuelHandle): EloCadeia[];
  /**
   * Sequências das Magias/Armadilhas baixadas do jogador cuja condição de ativação o campo atende agora
   * (ex.: Toon Terror sem monstro Toon fica de fora). Lido executando a condição do script no duelo.
   */
  baixadasVivas(duel: OcgDuelHandle, p: number): Set<number>;
  /**
   * A carta faz algo quando vai ou está no Cemitério (efeito ativado no Cemitério, ou gatilho de ser
   * mandada para lá), conforme o script: mandá-la ao Cemitério é ganho, não perda
   */
  noCemiterio(code: number): boolean;
  /**
   * Proteção que a carta dá a si mesma, lida do script: não pode ser destruída por efeito, ou fica
   * imune a efeitos. Aproximada: as condições da proteção (ex.: "enquanto você controlar...") não são lidas.
   */
  protecao(code: number): { destruir: boolean; imune: boolean };
  /** acrescenta uma carta inventada (Ficha criada pelo jogador) */
  registrar(code: number, dados: DadosCarta, nome: string): void;
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

  const daMao = new Map<number, boolean>();
  function interrompeDaMao(code: number): boolean {
    if (daMao.has(code)) return daMao.get(code)!;
    const d = dados(code);
    let sim = false;
    if (d && d.type & TIPO.MONSTRO && !(d.type & TIPOS_EXTRA)) {
      const script = pacote.arquivos[`c${code}.lua`] ?? (d.alias ? pacote.arquivos[`c${d.alias}.lua`] : undefined) ?? "";
      // cada efeito começa em Effect.CreateEffect: algum deles é Rápido (QUICK_O) e ativado da mão
      sim = script.split(/(?=\bEffect\.CreateEffect\()/).some((e) => e.includes("EFFECT_TYPE_QUICK_O") && /SetRange\([^)]*LOCATION_HAND/.test(e));
    }
    daMao.set(code, sim);
    return sim;
  }

  const valores = new Map<number, number>();
  function valorEmCampo(code: number): number {
    if (valores.has(code)) return valores.get(code)!;
    const d = dados(code);
    const script = (d && (pacote.arquivos[`c${code}.lua`] ?? (d.alias ? pacote.arquivos[`c${d.alias}.lua`] : undefined))) ?? "";
    let interrompe = false;
    let remove = false;
    let protege = false;
    // a zona onde a carta fica: monstro na Zona de Monstros; Magia/Armadilha na de Magias (ou de Campo)
    const zona = d && d.type & TIPO.MONSTRO ? /LOCATION_(MZONE|ONFIELD)/ : /LOCATION_(SZONE|FZONE|ONFIELD)/;
    for (const bloco of script.split(/(?=\bEffect\.CreateEffect\()/)) {
      // só as linhas que montam o efeito (as funções do script, depois, citam outras categorias)
      const e = bloco.split("\n").filter((l) => /:Set(Category|Type|Range|Code)\(/.test(l)).join("\n");
      // efeito que vale com a carta em campo: na zona dela, ou contínuo dela mesma
      const emCampo = new RegExp(`SetRange\\([^)]*${zona.source}`).test(e) || (/EFFECT_TYPE_SINGLE/.test(e) && !/EFFECT_TYPE_TRIGGER|SetRange/.test(e));
      if (!emCampo) continue;
      // RELEASE: Tributar um monstro do oponente (ex.: Comic Cat) também o tira do campo
      const tira = /CATEGORY_(NEGATE|DISABLE|REMOVE|DESTROY|TODECK|CONTROL|RELEASE)|CATEGORY_TOHAND(?![^)]*SEARCH)/.test(e);
      if (tira && /EFFECT_TYPE_QUICK_[OF]/.test(e)) interrompe = true;
      else if (tira) remove = true;
      if (/EFFECT_INDESTRUCTABLE|EFFECT_IMMUNE_EFFECT|EFFECT_CANNOT_BE_EFFECT_TARGET|EFFECT_CANNOT_BE_BATTLE_TARGET/.test(e)) protege = true;
    }
    const v = (interrompe ? 2 : 0) + (remove ? 1 : 0) + (protege ? 1 : 0);
    valores.set(code, v);
    return v;
  }

  const scriptDe = (code: number) => {
    const d = dados(code);
    return (d && (pacote.arquivos[`c${code}.lua`] ?? (d.alias ? pacote.arquivos[`c${d.alias}.lua`] : undefined))) ?? "";
  };
  /** linhas que montam cada efeito do script (as funções, depois, citam outras constantes) */
  const blocos = (code: number) =>
    scriptDe(code)
      .split(/(?=\bEffect\.CreateEffect\()/)
      .map((b) => b.split("\n").filter((l) => /:Set(Category|Type|Range|Code|Property)\(/.test(l)).join("\n"));

  const aoAtivar = new Map<number, number>();
  function valorAoAtivar(code: number): number {
    if (!aoAtivar.has(code)) {
      const interrompe = blocos(code).some(
        (e) => /EFFECT_TYPE_ACTIVATE/.test(e) && /CATEGORY_(NEGATE|DISABLE|REMOVE|DESTROY|TODECK|CONTROL|RELEASE)|CATEGORY_TOHAND(?![^)]*SEARCH)/.test(e),
      );
      aoAtivar.set(code, interrompe ? 2 : 0);
    }
    return aoAtivar.get(code)!;
  }

  const cemiterio = new Map<number, boolean>();
  function noCemiterio(code: number): boolean {
    if (!cemiterio.has(code)) cemiterio.set(code, blocos(code).some((e) => /SetRange\([^)]*LOCATION_GRAVE/.test(e) || /SetCode\(EVENT_TO_GRAVE\b/.test(e)));
    return cemiterio.get(code)!;
  }

  const protecoes = new Map<number, { destruir: boolean; imune: boolean }>();
  function protecao(code: number) {
    if (!protecoes.has(code)) {
      // só proteção da própria carta (efeito SINGLE); a que ela dá a outras cartas fica de fora
      const proprios = blocos(code).filter((e) => /EFFECT_TYPE_SINGLE/.test(e));
      protecoes.set(code, {
        destruir: proprios.some((e) => /EFFECT_INDESTRUCTABLE_EFFECT\b/.test(e)),
        imune: proprios.some((e) => /EFFECT_IMMUNE_EFFECT\b/.test(e)),
      });
    }
    return protecoes.get(code)!;
  }

  function soRemove(desc: bigint | number): boolean {
    const d = BigInt(desc);
    const code = Number(d >> 20n);
    const n = Number(d & 0xfffffn);
    const c = dados(code);
    const script = (c && (pacote.arquivos[`c${code}.lua`] ?? (c.alias ? pacote.arquivos[`c${c.alias}.lua`] : undefined))) ?? "";
    // o bloco do efeito é o que usa esta descrição (aux.Stringid(id, n))
    const bloco = script.split(/(?=\bEffect\.CreateEffect\()/).find((b) => new RegExp(`SetDescription\\(aux\\.Stringid\\(id,\\s*${n}\\)`).test(b));
    const cat = (bloco ?? "").split("\n").filter((l) => /:SetCategory\(/.test(l)).join(" ");
    return /CATEGORY_(REMOVE|DESTROY|TODECK|CONTROL)/.test(cat) && !/CATEGORY_(SPECIAL_SUMMON|SEARCH|DRAW|RECOVER|TOGRAVE|DECKDES)/.test(cat);
  }

  /**
   * Blocos brutos do script que montam o efeito da descrição (aux.Stringid(id, n)); efeito sem descrição
   * (ex.: Ghost Ogre) ou descrição de outra carta: os blocos sem SetDescription
   */
  function blocosDoEfeito(code: number, desc: bigint | number): string[] {
    const d = BigInt(desc);
    const brutos = scriptDe(code).split(/(?=\bEffect\.CreateEffect\()/);
    const n = Number(d & 0xfffffn);
    const daDescricao = d >> 20n ? brutos.filter((b) => new RegExp(`SetDescription\\(aux\\.Stringid\\(id,\\s*${n}\\)`).test(b)) : [];
    return daDescricao.length ? daDescricao : brutos.filter((b) => !/SetDescription\(/.test(b));
  }
  /** linhas de montagem (categoria, tipo, código, alcance) de um bloco bruto */
  const montagem = (b: string) => b.split("\n").filter((l) => /:Set(Category|Type|Range|Code|Property|CountLimit)\(/.test(l)).join("\n");

  const porEfeito = new Map<string, boolean>();
  /** memoriza uma leitura de script por carta, descrição e pergunta */
  const lembrar = (chave: string, f: () => boolean) => {
    if (!porEfeito.has(chave)) porEfeito.set(chave, f());
    return porEfeito.get(chave)!;
  };

  function respondeJogada(code: number, desc: bigint | number): boolean {
    return lembrar(`responde:${code}:${BigInt(desc)}`, () =>
      blocosDoEfeito(code, desc).some((b) => {
        const e = montagem(b);
        return /SetCode\(EVENT_(CHAINING|SUMMON|SPSUMMON|FLIP_SUMMON)\)/.test(e) && /CATEGORY_(NEGATE|DISABLE|DESTROY|REMOVE|TODECK|CONTROL)/.test(e);
      }),
    );
  }

  function soNega(code: number, desc: bigint | number): boolean {
    return lembrar(`nega:${code}:${BigInt(desc)}`, () =>
      blocosDoEfeito(code, desc).some((b) => {
        const e = montagem(b);
        return /CATEGORY_(NEGATE|DISABLE)/.test(e) && !/CATEGORY_(DESTROY|REMOVE|TODECK|CONTROL|RELEASE|TOGRAVE|TOHAND)/.test(e);
      }),
    );
  }

  function repetivel(code: number, desc: bigint | number): boolean {
    return lembrar(`repete:${code}:${BigInt(desc)}`, () =>
      blocosDoEfeito(code, desc).some((b) => {
        const e = montagem(b);
        // ativar a Magia/Armadilha gasta a carta; gatilho depende do evento
        if (/EFFECT_TYPE_ACTIVATE|EFFECT_TYPE_TRIGGER/.test(e)) return false;
        const limite = /SetCountLimit\((\d+)/.exec(e);
        return limite ? Number(limite[1]) >= 2 : /EFFECT_TYPE_(IGNITION|QUICK_O)/.test(e);
      }),
    );
  }

  function soNoCemiterio(code: number, desc: bigint | number): boolean {
    return lembrar(`cemiterio:${code}:${BigInt(desc)}`, () => {
      const script = scriptDe(code);
      return blocosDoEfeito(code, desc).some((b) => {
        const e = montagem(b);
        if (!/CATEGORY_(TODECK|REMOVE)/.test(e) || /CATEGORY_(SPECIAL_SUMMON|TOHAND|SEARCH|DRAW|DESTROY|CONTROL|NEGATE|DISABLE|RELEASE)/.test(e)) return false;
        // a função de alvo só procura no Cemitério
        const alvo = /SetTarget\(([\w.]+)\)/.exec(b)?.[1];
        if (!alvo) return false;
        const inicio = script.indexOf(`function ${alvo}(`);
        if (inicio < 0) return false;
        const fim = script.indexOf("\nfunction ", inicio + 1);
        const corpo = script.slice(inicio, fim < 0 ? undefined : fim);
        return /LOCATION_GRAVE/.test(corpo) && !/LOCATION_(ONFIELD|MZONE|SZONE|FZONE|HAND|DECK|EXTRA|REMOVED)/.test(corpo);
      });
    });
  }

  const resolucao = new Map<number, boolean>();
  function aoResolver(code: number): boolean {
    if (!resolucao.has(code)) resolucao.set(code, blocos(code).some((e) => /SetCode\(EVENT_CHAIN_SOLVING\)/.test(e) && /EFFECT_TYPE_CONTINUOUS/.test(e)));
    return resolucao.get(code)!;
  }

  // saída do Debug.Message das sondas (o errorHandler do duelo só guarda enquanto uma sonda roda)
  let saidaLua: string[] | null = null;
  let sondas = 0;
  function baixadasVivas(duel: OcgDuelHandle, p: number): Set<number> {
    // condição que dá true, ou que dá erro (chegou na parte que depende da cadeia, então a do campo passou): viva
    const sonda = `
local tp=${p}
local re=setmetatable({},{__index=function() return function() return true end end})
local out={}
for c in Duel.GetMatchingGroup(Card.IsFacedown,tp,LOCATION_SZONE,0,nil):Iter() do
  local viva=false
  for _,e in ipairs({c:GetActivateEffect()}) do
    local cond=e:GetCondition()
    if not cond then viva=true break end
    local ok,res=pcall(cond,e,tp,Group.CreateGroup(),1-tp,nil,re,0,1-tp)
    if not ok or res then viva=true break end
  end
  if viva then out[#out+1]=c:GetSequence() end
end
Debug.Message("vivas:"..table.concat(out,","))`;
    return new Set((sondar(duel, "vivas", sonda) ?? "").split(",").filter(Boolean).map(Number));
  }

  /** roda um script Lua no duelo e devolve o que ele mandou em Debug.Message("<prefixo>:...") */
  function sondar(duel: OcgDuelHandle, prefixo: string, sonda: string): string | undefined {
    const saida: string[] = [];
    saidaLua = saida;
    try {
      core.loadScript(duel, `sonda_${prefixo}_${sondas++}.lua`, sonda);
    } finally {
      saidaLua = null;
    }
    return saida.find((t) => t.startsWith(`${prefixo}:`))?.slice(prefixo.length + 1);
  }

  function cadeia(duel: OcgDuelHandle): EloCadeia[] {
    const sonda = `
local out={}
local function ref(c) return c:GetControler()..","..c:GetLocation()..","..c:GetSequence() end
for i=1,Duel.GetCurrentChain() do
  local te,p,tg=Duel.GetChainInfo(i,CHAININFO_TRIGGERING_EFFECT,CHAININFO_TRIGGERING_PLAYER,CHAININFO_TARGET_CARDS)
  local nega=te:IsHasCategory(CATEGORY_NEGATE+CATEGORY_DISABLE) and 1 or 0
  local tira=te:IsHasCategory(CATEGORY_DESTROY+CATEGORY_REMOVE+CATEGORY_RELEASE+CATEGORY_TODECK+CATEGORY_TOHAND+CATEGORY_CONTROL+CATEGORY_TOGRAVE) and 1 or 0
  local s=p..";"..nega..";"..tira..";"..ref(te:GetHandler())..";"
  if tg then for c in tg:Iter() do s=s..ref(c).."|" end end
  out[#out+1]=s
end
Debug.Message("cadeia:"..table.concat(out,"/"))`;
    const ref = (t: string) => {
      const [controller, location, sequence] = t.split(",").map(Number);
      return { controller, location, sequence };
    };
    return (sondar(duel, "cadeia", sonda) ?? "")
      .split("/")
      .filter(Boolean)
      .map((elo) => {
        const [p, nega, tira, dono, alvos] = elo.split(";");
        return { p: Number(p), nega: nega === "1", tira: tira === "1", dono: ref(dono), alvos: (alvos ?? "").split("|").filter(Boolean).map(ref) };
      });
  }

  const constantes = new Map<string, string>();
  for (const m of (pacote.arquivos["constant.lua"] ?? "").matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(0x[0-9a-fA-F]+|\d+)\b/gm)) {
    const chave = `${m[1].split("_")[0]}_:${Number(m[2])}`;
    if (!constantes.has(chave)) constantes.set(chave, m[1]);
  }

  function novoDuelo({ decks, semente, maos }: Partida): OcgDuelHandle {
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
      errorHandler: (_, texto) => saidaLua?.push(texto),
    });
    if (!duel) throw new Error("motor: não criou o duelo");
    for (const f of ["constant.lua", "utility.lua"]) core.loadScript(duel, f, scriptReader(f) ?? "");
    decks.forEach((deck, team) => {
      const add = (code: number, location: L) =>
        core.duelNewCard(duel, { team: team as 0 | 1, duelist: 0, code, controller: team as 0 | 1, location, sequence: 0, position: OcgPosition.FACEDOWN_DEFENSE });
      const main = embaralhar(deck.main.filter((c) => pacote.cartas[c]), `${semente.join(":")}:${team}`);
      comMaoNoTopo(main, maos?.[team] ?? []).forEach((c) => add(c, L.DECK));
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
    interrompeDaMao,
    valorEmCampo,
    valorAoAtivar,
    soRemove,
    respondeJogada,
    soNega,
    repetivel,
    soNoCemiterio,
    aoResolver,
    cadeia,
    baixadasVivas,
    noCemiterio,
    protecao,
    registrar(code, d, nome) {
      pacote.cartas[code] = d;
      pacote.nomes[code] = nome;
      cache.delete(code);
    },
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

/**
 * Deck (já embaralhado) com as cartas da mão no fim da lista: cada carta adicionada ao Deck vai para
 * o topo, então as últimas são as compradas na mão inicial. Carta da mão que não está no Deck fica de fora.
 */
export function comMaoNoTopo(deck: number[], mao: number[]): number[] {
  const resto = [...deck];
  const topo: number[] = [];
  for (const c of mao) {
    const i = resto.indexOf(c);
    if (i < 0) continue;
    resto.splice(i, 1);
    topo.push(c);
  }
  return [...resto, ...topo];
}

/** Ficha criada pelo jogador (botão "Criar Token"): um monstro Ficha Normal com os dados escolhidos */
export interface ComandoFicha {
  type: "ficha";
  /** código da carta inventada para esta Ficha (único na partida) */
  code: number;
  jogador: number;
  /** Zona de Monstros (0 a 4) */
  sequencia: number;
  /** posição de batalha: 1 Ataque, 4 Defesa (Fichas ficam sempre com a face para cima) */
  posicao: 1 | 4;
  nome: string;
  nivel: number;
  /** OcgAttribute e OcgRace (bits) */
  atributo: number;
  raca: number;
  atk: number;
  def: number;
}

/** Item do histórico: resposta a uma decisão do motor ou comando do jogador (não consome decisão) */
export type Jogada = OcgResponse | ComandoFicha;
export const ehComando = (j: Jogada): j is ComandoFicha => (j as ComandoFicha).type === "ficha";

/** As mesmas jogadas na mesma partida refazem o mesmo duelo (o motor é determinístico) */
export type Historico = Jogada[];

/** Executa um comando do jogador no duelo (Ficha: registra a carta e a põe na zona) */
export function executarComando(motor: Motor, duel: OcgDuelHandle, c: ComandoFicha) {
  motor.registrar(c.code, [0, [], TIPO.MONSTRO | TIPO.NORMAL | TIPO.FICHA, c.nivel, c.atributo, c.raca, c.atk, c.def], c.nome);
  motor.core.loadScript(duel, `ficha_${c.code}.lua`, `Debug.AddCard(${c.code},${c.jogador},${c.jogador},LOCATION_MZONE,${c.sequencia},${c.posicao === 4 ? "POS_FACEUP_DEFENSE" : "POS_FACEUP_ATTACK"})`);
}

/** Recria o duelo e reaplica as jogadas dadas até aqui (o motor não copia estado) */
export function reproduzir(motor: Motor, partida: Partida, historico: Historico) {
  const duel = motor.novoDuelo(partida);
  let r = motor.ate(duel);
  for (const j of historico) {
    if (!r.decisao) break;
    // comando não consome a decisão: o motor continua esperando a resposta seguinte
    if (ehComando(j)) {
      executarComando(motor, duel, j);
      continue;
    }
    motor.core.duelSetResponse(duel, j);
    r = motor.ate(duel);
  }
  return { duel, decisao: r.decisao };
}
