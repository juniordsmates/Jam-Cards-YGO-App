// Gera as imagens do manual "Como Utilizar" (public/manual/*.jpg) a partir do app rodando.
// Uso: com o servidor de desenvolvimento aberto (npm run dev), rode `node scripts/manual-imagens.mjs`.
// Rode de novo sempre que uma tela mudar, e confira o texto do capítulo em src/data/manual.ts.
// Usa um navegador WebKit só (cerca de 1 GB de memória enquanto roda).
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const URL = process.env.MANUAL_URL ?? "http://localhost:1420";
const SAIDA = fileURLToPath(new globalThis.URL("../public/manual/", import.meta.url));
mkdirSync(SAIDA, { recursive: true });

// deck e coleção de exemplo (Centur-Ion com hand traps)
const MAIN = [42493140, 15005145, 41371602, 14558127, 10045474, 40155014, 97698279, 96030710, 77765207, 97268402];
const DECK = { id: "manual", nome: "Centur-Ion (exemplo)", main: Array.from({ length: 40 }, (_, i) => MAIN[i % MAIN.length]), extra: Array(15).fill(8841431), side: [], atualizadoEm: new Date().toISOString() };
const COLECAO = [
  { cartaId: 14558127, setCode: "", raridade: "", idioma: "Inglês", edicao: "", estado: "NM", quantidade: 2 },
  { cartaId: 97268402, setCode: "", raridade: "", idioma: "", edicao: "", estado: "", quantidade: 3 },
  { cartaId: 42493140, setCode: "", raridade: "", idioma: "Português", edicao: "primeira", estado: "", quantidade: 1 },
].map((i) => ({ ...i, atualizadoEm: new Date().toISOString() }));

const browser = await webkit.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const foto = (nome) => page.screenshot({ path: `${SAIDA}${nome}.jpg`, type: "jpeg", quality: 72 });
const menu = async () => {
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
};

// preparar o armazenamento local (deck padrão e coleção) e esperar a base de cartas
await menu();
await page.waitForTimeout(1500);
await page.evaluate(
  ([deck, colecao]) => {
    localStorage.setItem("cartas-decks", JSON.stringify({ decks: [deck], padrao: deck.id }));
    localStorage.setItem("cartas-colecao", JSON.stringify({ itens: colecao }));
    localStorage.setItem("cartas-editor-estoque", "todas");
    // fotos no modo claro, qualquer que seja o tema do sistema
    localStorage.setItem("cartas-tema", "claro");
    // Teste Avançado sem login (só vale no servidor de desenvolvimento)
    localStorage.setItem("cartas-dev-avancado", "1");
  },
  [DECK, COLECAO],
);

const etapas = {
  menu: async () => {
    await menu();
    // espera a animação de entrada do menu terminar
    await page.waitForTimeout(1500);
    await foto("menu");
  },
  conquistas: async () => {
    // duas conquistas obtidas e uma bloqueada
    await page.evaluate(() =>
      localStorage.setItem("cartas-conquistas", JSON.stringify({ obtidas: { entrando_comunidade: "2026-11-08T12:00:00.000Z", meu_primeiro_deck: "2026-11-08T12:05:00.000Z" } })),
    );
    await page.goto(`${URL}/#/conquistas`);
    // só troca o "#": recarrega para o app ler as conquistas gravadas
    await page.reload();
    await page.waitForSelector(".cq-item");
    await page.waitForTimeout(2500);
    await foto("conquistas");
  },
  busca: async () => {
    await menu();
    await page.click(".menu-btn:has-text('Buscar Carta')");
    await page.waitForSelector(".grid .tile", { timeout: 120_000 });
    await page.fill(".search-input input", "ash blossom");
    await page.waitForTimeout(800);
    await page.click(".grid .tile >> nth=0");
    await page.waitForTimeout(1500);
    await foto("busca");
  },
  combos: async () => {
    await menu();
    await page.click(".menu-btn:has-text('Combos')");
    await page.waitForSelector(".combos-setup");
    await page.fill(".hand-search input", "centur-ion trudea");
    await page.waitForSelector(".suggestions button");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".verified-combos .vc", { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await foto("combos");
  },
  editor: async () => {
    await menu();
    await page.click(".menu-btn:has-text('Editor de Deck')");
    await page.waitForSelector(".de-main .de-thumb", { timeout: 120_000 });
    await page.hover(".de-main .de-thumb[data-card-id='14558127']");
    await page.waitForTimeout(1500);
    await foto("editor");
    await page.click(".de-teste");
    await page.waitForSelector(".teste-jogo");
    await page.waitForTimeout(1500);
    await foto("teste");
  },
  // Teste Avançado: Ash Blossom na mão do oponente, Infinite Impermanence baixada e uma ativação sua
  "teste-avancado": async () => {
    await menu();
    await page.click(".menu-btn:has-text('Editor de Deck')");
    await page.waitForSelector(".de-main .de-thumb", { timeout: 120_000 });
    await page.click(".de-teste-avancado");
    await page.waitForSelector(".tj-mesa-avancada");
    const adicionar = async (busca, destino) => {
      await page.click(".tj-op-add");
      await page.fill(".tj-adicionar input", busca);
      await page.click(".tj-adicionar-sugestoes button >> nth=0");
      await page.click(`.tj-adicionar-destinos button:has-text('${destino}')`);
    };
    await adicionar("ash blossom", "Para a mão");
    await adicionar("effect veiler", "Para a mão");
    await adicionar("infinite impermanence", "Baixar no campo");
    // uma busca no Deck (Centur-Ion Primera) mostra a Ash do oponente; sem ela na mão, a primeira carta
    const primera = page.locator(".tj-mao-linha .tj-mao .tj-carta[data-card-id='15005145']");
    for (let i = 0; i < 8 && !(await primera.count()); i++) await page.click(".tj-teste-mao");
    await ((await primera.count()) ? primera.first() : page.locator(".tj-mao-linha .tj-mao .tj-carta").first()).click({ button: "right" });
    await page.click(".tj-menu button:has-text('Ativar efeito')");
    await page.waitForSelector(".tj-ind-acao");
    await page.waitForTimeout(1500);
    await foto("teste-avancado");
  },
  // Meta Call com o Top 5 do TCG (precisa da camada com o metagame)
  "meta-call": async () => {
    await menu();
    await page.click(".menu-btn:has-text('Meta Call')");
    await page.waitForSelector(".meta-call", { timeout: 120_000 });
    await page.click(".mc-atalhos button:has-text('Top 5')");
    await page.waitForSelector(".mc-rec", { timeout: 60_000 });
    await page.waitForTimeout(1500);
    await foto("meta-call");
  },
  colecao: async () => {
    await menu();
    await page.click(".menu-btn:has-text('Minha Coleção')");
    await page.waitForSelector(".col-tabela", { timeout: 120_000 });
    await page.click(".de-resultados .de-thumb >> nth=1");
    await page.waitForTimeout(1500);
    await foto("colecao");
  },
  // precisa da camada com o metagame do TCG (metaTcg); sem ela, a tela mostra o aviso
  guia: async () => {
    await menu();
    await page.click(".menu-btn:has-text('Guia de Deck')");
    await page.waitForSelector(".guia-deck", { timeout: 120_000 });
    await page.waitForTimeout(1500);
    await foto("guia");
  },
  conta: async () => {
    await menu();
    await page.click(".menu-conta");
    await page.waitForSelector(".ia-grade");
    await page.waitForTimeout(500);
    await foto("conta");
  },
};

// MANUAL_ETAPAS=menu,meta-call gera só essas
const so = process.env.MANUAL_ETAPAS?.split(",");
for (const [nome, etapa] of Object.entries(etapas)) {
  if (so && !so.includes(nome)) continue;
  try {
    await etapa();
    console.log(`ok ${nome}`);
  } catch (e) {
    console.log(`falhou ${nome}: ${e.message.split("\n")[0]}`);
  }
}
await browser.close();
