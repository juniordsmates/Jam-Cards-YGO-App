// Tradução do app: envolve os textos de tela (em português) em t() e lista as chaves.
// Uso: node scripts/i18n-extrair.mjs            → altera os arquivos de src/ e grava scripts/i18n-chaves.json
//      node scripts/i18n-extrair.mjs --conferir → só lista as chaves sem tradução em src/i18n/en.ts e es.ts
//
// Usa o verificador de tipos do TypeScript para separar texto de tela de valores internos: um texto
// cujo tipo esperado é uma lista fechada de valores ("mao" | "campo"…) não é traduzido; nos
// atributos JSX só title, placeholder, aria-label, alt e label. Rodar de novo não duplica (o que já
// está em t() fica como está). Revise o diff depois.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(RAIZ, "src");
const conferir = process.argv.includes("--conferir");

// arquivos sem textos de tela (ou com tradução própria)
const IGNORAR = [/\/i18n(\/|\.ts)/, /\/data\/guias(Passos)?\.ts$/, /\/db\/ygoprodeck\.ts$/, /\/db\/supabase\.ts$/, /\/db\/idb\.ts$/, /\/version\.ts$/, /\/main\.tsx$/, /\/platform\.ts$/, /\.d\.ts$/, /\/sim\/(regras|sessao|ia|opcoes|worker)\.ts$/];
// declarações (por arquivo) que não são texto de tela: prompts de IA, dicionários próprios, valores gravados
const DECL_IGNORADAS = {
  "db/ia.ts": ["systemPrompt", "pedido", "infoCarta", "executar", "PEDIDO_VIDEO", "validarRegistro", "converter", "FERRAMENTAS", "TOOLS", "IDIOMA_RESPOSTA", "sistemaChat"],
  "screens/GuiaDeck.tsx": ["T", "IDIOMAS", "TIPOS_RESPOSTA"],
  "db/colecao.ts": ["IDIOMAS", "lerListaMYP"],
  "db/effects.ts": ["units", "classify", "splitPsct", "sentences", "cleanCondition", "applyHardOpt"],
  "db/relations.ts": ["parseQuery", "buildRelations", "targetFollowUp", "descriptorAround", "relationType", "summonMethod", "archetypeNamesPt", "RACES", "ATTRIBUTES", "MONSTER_TYPES"],
  "db/tags.ts": ["applyTags"],
  "db/metaCall.ts": ["DO_MOTOR"],
  "sim/cliente.ts": ["VERSAO_LOCAL"],
  "db/duelos.ts": ["COLUNAS", "meusDuelos", "partidasAtivas", "obterDueloPorCodigo", "criarDuelo", "obterDuelo", "enviarResposta", "respostasDoDuelo", "nomesDeUsuarios", "assinarDuelo"],
  "screens/Simulador.tsx": ["opcoes", "contextoDuelo"],
  "db/indicar.ts": ["CONTRA_MONSTRO", "CONTRA_MAGIA_ARMADILHA"],
  "db/search.ts": ["normalize", "descKey", "relatedKey", "archetypeKey", "searchCards"],
  "db/guiaDeck.ts": ["METODO", "ORIGEM", "movimento", "passoNoIdioma"],
};
// atributos de texto (HTML e dos componentes do app)
const ATRIBUTOS = new Set(["title", "placeholder", "aria-label", "alt", "label", "aria-description", "titulo", "rotulo", "texto", "legenda", "hint", "dica", "rotuloTestar", "placeholderMore", "bloqueado", "aviso"]);
const PROPS_IGNORADAS = new Set(["className", "key", "id", "tipo", "t", "de", "para", "m", "origem", "categoria", "url", "href", "src", "cor", "sigla", "provedor", "modelo", "status", "fonte", "onde", "zona", "race", "frame", "attribute", "path", "method", "headers", "role", "type", "model", "mode", "nome", "name", "busca", "arquivo", "evento", "idioma", "chave", "endpoint", "Authorization", "Content-Type", "arquetipo", "setCode", "raridade", "estado", "edicao", "periodo", "inicio", "fim", "card", "mao", "resultado", "campoFinal", "cartas", "mat", "grupo", "value"]);
const PROPS_DE_TELA = new Set(["label", "hint", "titulo", "title", "texto", "motivo", "legenda", "resumo", "papel", "descricao", "placeholder", "msg", "aviso", "condicao", "impedida", "rotulo", "proposito", "custo", "dica", "step", "erro", "progresso"]);
const METODOS_IGNORADOS = new Set(["getItem", "setItem", "removeItem", "querySelector", "querySelectorAll", "closest", "matches", "includes", "startsWith", "endsWith", "indexOf", "lastIndexOf", "split", "replace", "replaceAll", "match", "matchAll", "test", "search", "get", "set", "has", "delete", "from", "select", "eq", "neq", "order", "rpc", "contains", "in", "ilike", "like", "upsert", "addEventListener", "removeEventListener", "setAttribute", "getAttribute", "localeCompare", "padStart", "padEnd", "invoke", "postMessage", "emit", "on", "toLocaleString", "toLocaleDateString", "toLocaleTimeString", "waitForSelector", "click", "fill", "createElement", "error", "warn", "log", "info", "debug", "getElementById"]);
const FUNCOES_IGNORADAS = new Set(["parse", "fetch", "require", "RegExp", "Symbol", "normalize", "invoke", "URL", "Date", "t", "useState", "atob", "btoa", "encodeURIComponent", "decodeURIComponent", "matchMedia"]);
const FUNCOES_DE_TELA = new Set(["registrar", "setMsg", "Error", "alert", "confirm"]);

const config = ts.parseJsonConfigFileContent(ts.readConfigFile(resolve(RAIZ, "tsconfig.json"), ts.sys.readFile).config, ts.sys, RAIZ);
const programa = ts.createProgram(config.fileNames, config.options);
const tipos = programa.getTypeChecker();

const letra = /[A-Za-zÀ-ÿ]/;
const humano = (s) => s !== "null" && letra.test(s) && (/\s/.test(s.trim()) || /[À-ÿ…?!]/.test(s) || /[.:]$/.test(s.trim()));
const tecnico = (s) =>
  /:\/\//.test(s) ||
  /^(\/|#|\.[a-z]|mailto:|data:|ydke:)/.test(s) ||
  /(calc\(|\d(px|vh|vw|rem|em)\b|rgb\(|hsl\(|var\(--|url\()/.test(s) ||
  /^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/i.test(s) ||
  /^[\w-]+(\s*,\s*[\w-]+)+$/.test(s) || // listas de colunas
  /\\[dswb]/.test(s) ||
  /\.(jpe?g|png|webp|svg|json|txt|ydk)$/i.test(s); // caminhos de arquivo

function declIgnorada(no, arq) {
  const nomes = DECL_IGNORADAS[arq];
  if (!nomes) return false;
  for (let p = no; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p)) && p.name && ts.isIdentifier(p.name) && nomes.includes(p.name.text)) return true;
  }
  return false;
}

/** tipo esperado é uma lista fechada de textos (dados), não string livre */
function tipoFechado(no) {
  const ctx = tipos.getContextualType(no);
  if (!ctx) return false;
  const membros = ctx.isUnion() ? ctx.types : [ctx];
  // objetos e funções (ex.: SetStateAction<"a" | "b">) não abrem a lista: só string, any ou ReactNode
  const ehNo = (m) => m.flags & ts.TypeFlags.Object && /ReactElement|ReactPortal|Iterable|ReactNode/.test(tipos.typeToString(m));
  const livre = membros.some((m) => m.flags & (ts.TypeFlags.String | ts.TypeFlags.Any | ts.TypeFlags.Unknown) || ehNo(m));
  const literais = membros.some((m) => m.flags & ts.TypeFlags.StringLiteral);
  return literais && !livre;
}
const temContexto = (no) => !!tipos.getContextualType(no);

function atributoJsx(no) {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return p.name.getText();
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxFragment(p) || ts.isJsxExpression(p) && ts.isJsxElement(p.parent)) return null;
  }
  return null;
}

/** contexto que aceita texto de uma palavra só (ramos de ?:, ||, ??, partes de template, props de tela…) */
function contextoDeTela(no) {
  const p = no.parent;
  if (ts.isConditionalExpression(p) && p.condition !== no) return (no.text ?? "...").length > 2 && (contextoDeTela(p) || temContexto(no));
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(p.operatorToken.kind)) return true;
  if (ts.isTemplateSpan(p) || ts.isJsxExpression(p)) return true;
  if (ts.isPropertyAssignment(p) && p.initializer === no) return PROPS_DE_TELA.has(p.name.getText().replace(/["']/g, ""));
  if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.arguments?.includes(no)) {
    const nome = ts.isIdentifier(p.expression) ? p.expression.text : ts.isPropertyAccessExpression(p.expression) ? p.expression.name.text : "";
    return FUNCOES_DE_TELA.has(nome);
  }
  if (ts.isReturnStatement(p) || (ts.isArrowFunction(p) && p.body === no)) return temContexto(no);
  return false;
}

function posicaoIgnorada(no, arq) {
  const p = no.parent;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === no) return true;
  // valor (direto ou dentro de lista) de uma propriedade de dados
  let q = p;
  while (q && (ts.isArrayLiteralExpression(q) || ts.isParenthesizedExpression(q))) q = q.parent;
  if (q && ts.isPropertyAssignment(q) && PROPS_IGNORADAS.has(q.name.getText().replace(/["']/g, ""))) return true;
  if (ts.isElementAccessExpression(p) || ts.isCaseClause(p) || ts.isTaggedTemplateExpression(p)) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return true;
  if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.arguments?.includes(no)) {
    const callee = p.expression;
    if (ts.isIdentifier(callee) && FUNCOES_IGNORADAS.has(callee.text)) return true;
    if (ts.isPropertyAccessExpression(callee) && METODOS_IGNORADOS.has(callee.name.text)) return true;
  }
  if (ts.isVariableDeclaration(p) && /(URL|KEY|STORAGE|SALVO|PREFIXO|COLS|SELETOR)$/.test(p.name.getText())) return true;
  const attr = atributoJsx(no);
  if (attr !== null && !ATRIBUTOS.has(attr)) return true;
  if (declIgnorada(no, arq)) return true;
  // dentro de t(...)
  for (let q = p; q; q = q.parent) if (ts.isCallExpression(q) && ts.isIdentifier(q.expression) && ["t", "tr"].includes(q.expression.text)) return true;
  return false;
}

const esc = (s) => JSON.stringify(s);

/** texto de um JsxText como o React o mostra */
function textoJsx(bruto) {
  const linhas = bruto.split(/\r?\n/);
  if (linhas.length === 1) return bruto;
  return linhas
    .map((l, i) => (i === 0 ? l.trimEnd() : i === linhas.length - 1 ? l.trimStart() : l.trim()))
    .filter((l) => l.length)
    .join(" ");
}

function soTextoOuNumero(expr) {
  const tp = tipos.getTypeAtLocation(expr);
  const ok = (m) => m.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike);
  return tp.isUnion() ? tp.types.every(ok) : !!ok(tp);
}
const temJsx = (n) => {
  let achou = false;
  const v = (x) => {
    if (achou) return;
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) achou = true;
    else ts.forEachChild(x, v);
  };
  v(n);
  return achou;
};

const chaves = new Set();
let arquivosAlterados = 0;

for (const sf of programa.getSourceFiles()) {
  const caminho = sf.fileName;
  if (!caminho.startsWith(SRC) || IGNORAR.some((r) => r.test(caminho))) continue;
  const arq = relative(SRC, caminho);
  const fonte = sf.text;
  /** nó → texto que o substitui (com a mesma faixa node.getStart()..node.end) */
  const trocas = new Map();
  /** filhos JSX removidos (juntados na troca do primeiro do trecho) */
  const removidos = new Set();

  const visitar = (no) => {
    // trechos de texto JSX: texto + expressões de texto/número viram um t() só
    if ((ts.isJsxElement(no) || ts.isJsxFragment(no)) && !declIgnorada(no, arq)) {
      const filhos = [...no.children];
      let trecho = [];
      const fechar = () => {
        if (!trecho.some((f) => ts.isJsxText(f) && letra.test(f.text))) return (trecho = []);
        let chave = "";
        const vars = [];
        for (const f of trecho) {
          if (ts.isJsxText(f)) chave += textoJsx(f.text);
          else if (ts.isStringLiteral(f.expression)) chave += f.expression.text;
          else {
            chave += `{${vars.length}}`;
            vars.push(f.expression);
          }
        }
        const antes = /^\s/.test(chave);
        const depois = /\s$/.test(chave);
        chave = chave.trim().replace(/\s+/g, " ");
        chaves.add(chave);
        trocas.set(trecho[0], { chave, vars, antes, depois, jsx: true });
        trecho.slice(1).forEach((f) => removidos.add(f));
        trecho = [];
      };
      // trechos: sequências de texto e de expressões que dão texto/número (sem JSX)
      for (const f of filhos) {
        const texto = ts.isJsxText(f) && !(/\n/.test(f.text) && !f.text.trim());
        const expr = ts.isJsxExpression(f) && !!f.expression && !temJsx(f.expression) && (ts.isStringLiteral(f.expression) || soTextoOuNumero(f.expression));
        if (texto || expr) trecho.push(f);
        else fechar();
      }
      fechar();
    }
    if (ts.isJsxAttribute(no) && no.initializer && ts.isStringLiteral(no.initializer) && ATRIBUTOS.has(no.name.getText()) && letra.test(no.initializer.text) && !declIgnorada(no, arq)) {
      chaves.add(no.initializer.text);
      trocas.set(no.initializer, { chave: no.initializer.text, vars: [], atributo: true });
    } else if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && !ts.isJsxAttribute(no.parent)) {
      const s = no.text;
      if (s === "pt-BR" && !posicaoIgnoradaLocale(no)) trocas.set(no, { cru: "LOCALE" });
      else if (letra.test(s) && !tecnico(s) && !posicaoIgnorada(no, arq) && !tipoFechado(no) && (humano(s) || contextoDeTela(no))) {
        chaves.add(s);
        trocas.set(no, { chave: s, vars: [] });
      }
    } else if (ts.isTemplateExpression(no)) {
      const partes = [no.head.text, ...no.templateSpans.map((x) => x.literal.text)];
      let chave = no.head.text;
      no.templateSpans.forEach((x, i) => (chave += `{${i}}${x.literal.text}`));
      const fixo = partes.join(" ");
      if (letra.test(fixo) && !tecnico(fixo) && !tecnico(chave) && !posicaoIgnorada(no, arq) && (humano(fixo) || contextoDeTela(no))) {
        chaves.add(chave);
        trocas.set(no, { chave, vars: no.templateSpans.map((x) => x.expression) });
      }
    }
    ts.forEachChild(no, visitar);
    // mapas e listas de rótulos: se um texto do mesmo objeto/lista é de tela, os irmãos também são
    if (ts.isObjectLiteralExpression(no) || ts.isArrayLiteralExpression(no)) {
      const valores = ts.isArrayLiteralExpression(no) ? [...no.elements] : no.properties.filter(ts.isPropertyAssignment).map((p) => p.initializer);
      const ehTexto = (v) => (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) && letra.test(v.text) && !tecnico(v.text);
      const algumTraduzido = valores.some((v) => trocas.has(v) || (ts.isCallExpression(v) && ts.isIdentifier(v.expression) && ["t", "tr"].includes(v.expression.text)));
      if (algumTraduzido)
        for (const v of valores)
          if (ehTexto(v) && !trocas.has(v) && !posicaoIgnorada(v, arq) && !tipoFechado(v)) {
            chaves.add(v.text);
            trocas.set(v, { chave: v.text, vars: [] });
          }
    }
  };
  const posicaoIgnoradaLocale = (no) => declIgnorada(no, arq);
  visitar(sf);
  if (!trocas.size || conferir) continue;

  // reescreve: cada troca usa o texto já reescrito das suas expressões internas
  const emitir = (no) => {
    const troca = trocas.get(no);
    if (troca) {
      const lead = fonte.slice(no.pos, no.getStart(sf));
      if (troca.cru) return lead + troca.cru;
      const vars = troca.vars.length ? `, [${troca.vars.map((v) => emitirFaixa(v)).join(", ")}]` : "";
      const chamada = `t(${esc(troca.chave)}${vars})`;
      if (troca.jsx) return lead + (troca.antes ? '{" "}' : "") + `{${chamada}}` + (troca.depois ? '{" "}' : "");
      if (troca.atributo) return lead + `{${chamada}}`;
      return lead + chamada;
    }
    if (removidos.has(no)) return "";
    let saida = "";
    let cursor = no.pos;
    ts.forEachChild(no, (filho) => {
      saida += fonte.slice(cursor, filho.pos) + emitir(filho);
      cursor = filho.end;
    });
    // JsxText e outros tokens sem filhos
    return saida + fonte.slice(cursor, no.end);
  };
  const emitirFaixa = (no) => emitir(no).trimStart();
  let novo = emitir(sf);
  // arquivo com variável local "t" (tabuleiro, alvo…): a tradução se chama "tr"
  const nomeT = /import \{[^}]*\bt as tr\b/.test(fonte) || /\b(const|let|var)\s+\[?\s*t\b|\(t\)\s*=>|\bt\s*:\s*Tabuleiro/.test(fonte) ? "tr" : "t";
  if (nomeT === "tr") novo = novo.replace(/(?<![\w.])t\((?=["`])/g, "tr(");
  // import de t / LOCALE
  const usados = [...trocas.values()].some((x) => !x.cru) ? [nomeT === "tr" ? "t as tr" : "t"] : [];
  if ([...trocas.values()].some((x) => x.cru === "LOCALE")) usados.push("LOCALE");
  const rel = relative(dirname(caminho), resolve(SRC, "i18n")).replace(/\\/g, "/");
  const de = rel.startsWith(".") ? rel : `./${rel}`;
  const jaImporta = new RegExp(`from "${de.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`).test(novo);
  if (usados.length && !jaImporta) {
    const ultimoImport = [...novo.matchAll(/^import [^;]+;\n/gm)].pop();
    const linha = `import { ${usados.join(", ")} } from "${de}";\n`;
    novo = ultimoImport ? novo.slice(0, ultimoImport.index + ultimoImport[0].length) + linha + novo.slice(ultimoImport.index + ultimoImport[0].length) : linha + novo;
  } else if (usados.length) {
    novo = novo.replace(new RegExp(`import \\{([^}]*)\\} from "${de.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}";`), (m, nomes) => {
      const atuais = nomes.split(",").map((x) => x.trim()).filter(Boolean).filter((x) => !(x === "t" && usados.includes("t as tr")));
      return `import { ${[...new Set([...atuais, ...usados])].join(", ")} } from "${de}";`;
    });
  }
  writeFileSync(caminho, novo);
  arquivosAlterados++;
}

// chaves de todo o código (também as já envolvidas em t() antes)
for (const sf of programa.getSourceFiles()) {
  if (!sf.fileName.startsWith(SRC) || /\/i18n/.test(sf.fileName)) continue;
  const v = (no) => {
    if (ts.isCallExpression(no) && ts.isIdentifier(no.expression) && ["t", "tr"].includes(no.expression.text) && no.arguments[0] && ts.isStringLiteral(no.arguments[0])) chaves.add(no.arguments[0].text);
    ts.forEachChild(no, v);
  };
  v(sf);
}

const lista = [...chaves].sort();
if (conferir) {
  const ler = (f) => readFileSync(resolve(SRC, "i18n", f), "utf8");
  for (const [nome, f] of [["en", "en.ts"], ["es", "es.ts"]]) {
    const texto = ler(f);
    const faltam = lista.filter((k) => !texto.includes(JSON.stringify(k) + ":"));
    console.log(`${nome}: ${faltam.length} sem tradução`);
    faltam.slice(0, 300).forEach((k) => console.log("  ", JSON.stringify(k)));
  }
} else {
  writeFileSync(resolve(RAIZ, "scripts/i18n-chaves.json"), JSON.stringify(lista, null, 1));
  console.log(`${arquivosAlterados} arquivos alterados; ${lista.length} chaves em scripts/i18n-chaves.json`);
}
