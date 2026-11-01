// Testes de ponta a ponta da versão web, no WebKit (mesmo motor do app no macOS).
// Pré-requisito: servidor rodando (`npm run dev` ou `npm run desktop`) em TEST_URL.
// Imagens das cartas são bloqueadas para não gerar milhares de downloads na YGOPRODeck.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webkit } from "playwright";

const URL = process.env.TEST_URL ?? "http://localhost:1420";

let browser;
let page;
const pageErrors = [];

const resultCount = async () => {
  await page.waitForTimeout(450); // a lista atualiza logo depois do filtro (useDeferredValue)
  return Number((await page.textContent(".results-count")).replace(/\D/g, ""));
};

const openSearch = async () => {
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
  await page.click(".menu-btn:has-text('Buscar Carta')");
  await page.waitForSelector(".grid .tile", { timeout: 120_000 });
};

/** Volta ao estado inicial: sem filtros e sem painel aberto */
const reset = async () => {
  if (await page.$(".drawer")) await page.click(".drawer-close");
  const clearAll = await page.$(".active-filters .link-btn");
  if (clearAll) await clearAll.click();
  else if (await page.$(".active-chip")) await page.click(".active-chip");
  await page.waitForTimeout(300);
};

/** Abre uma seção recolhível dos filtros (sem fechar se já estiver aberta) */
const openSection = async (title) => {
  await page.$eval(`.filters details:has(summary:has-text("${title}"))`, (d) => (d.open = true)).catch(async () => {
    const details = page.locator(".filters details", { hasText: title });
    await details.evaluate((d) => (d.open = true));
  });
};

const search = async (text) => {
  await page.fill(".search-input input", text);
  await page.waitForTimeout(450);
};

/** Abre o Editor de Deck com um deck gravado neste computador (o editor não importa .ydk) */
const abrirEditorCom = async (deck) => {
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
  await page.waitForTimeout(1500); // deixa a camada terminar de baixar antes de recarregar
  await page.evaluate((d) => {
    const agora = new Date().toISOString();
    localStorage.setItem("cartas-decks", JSON.stringify({ decks: [{ id: "t", side: [], atualizadoEm: agora, ...d }], padrao: "t" }));
  }, deck);
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
  await page.click(".menu-btn:has-text('Editor de Deck')");
  await page.waitForSelector(".deck-editor", { timeout: 120_000 });
};

before(async () => {
  browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: "block" });
  // links externos abertos pelos testes não carregam o site de verdade
  await ctx.route("https://ygoprodeck.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>ok</p>" }));
  page = await ctx.newPage();
  // imagens das cartas não carregam nos testes: o endereço vira um vazio (falha na hora, como um
  // bloqueio), dentro da própria página. Com page.route, cada imagem passava pelo processo do teste,
  // que guarda um registro por pedido até a página fechar (centenas de MB nas listas de cartas).
  await ctx.addInitScript(() => {
    const vazio = (v) => (String(v).includes("images.ygoprodeck.com") ? "data:," : v);
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    Object.defineProperty(HTMLImageElement.prototype, "src", { ...src, set(v) { src.set.call(this, vazio(v)); } });
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (nome, v) {
      return setAttribute.call(this, nome, this instanceof HTMLImageElement && nome === "src" ? vazio(v) : v);
    };
  });
  // cotação fixa: US$ 1 = R$ 5,00 e € 1 = R$ 6,00 (deixa os valores em reais previsíveis)
  await page.route("**/economia.awesomeapi.com.br/**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        USDBRL: { bid: "5.00", create_date: "2026-10-24 12:00:00" },
        EURBRL: { bid: "6.00", create_date: "2026-10-24 12:00:00" },
      }),
    }),
  );
  await page.route("**/juniordsmates/Jam-Cards-YGO/main/dados/camada.json", async (r) => {
    const res = await r.fetch();
    const camada = await res.json();
    camada.combos = JSON.parse(readFileSync(new globalThis.URL("./fixtures/combos.json", import.meta.url), "utf8"));
    await r.fulfill({ response: res, json: camada });
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await openSearch();
});

after(async () => {
  await browser?.close();
});

test("menu: Buscar Carta abre a busca com o campo vazio", async () => {
  assert.equal(await page.inputValue(".search-input input"), "");
  assert.ok((await resultCount()) > 14_000);
});

test("busca por nome em português e em inglês", async () => {
  await search("mago negro");
  assert.equal(await page.textContent(".grid .tile-name >> nth=0"), "Mago Negro");
  await search("dark magician");
  assert.equal(await page.textContent(".grid .tile-name >> nth=0"), "Mago Negro");
  await search("");
});

test("rolagem infinita carrega mais cartas", async () => {
  const before = await page.$$eval(".grid .tile", (e) => e.length);
  await page.$eval(".grid", (g) => g.scrollTo({ top: g.scrollHeight }));
  await page.waitForTimeout(500);
  const after = await page.$$eval(".grid .tile", (e) => e.length);
  assert.ok(after > before, `${before} → ${after}`);
});

test("filtro por tag mostra chip ativo removível", async () => {
  const all = await resultCount();
  await openSection("Efeitos e termos");
  await page.click(".filters .tag-chip:has-text('Hand trap')");
  const filtered = await resultCount();
  assert.ok(filtered > 50 && filtered < all, `hand traps: ${filtered}`);
  assert.equal(await page.textContent(".active-chip"), "Hand trap✕");
  await page.click(".active-chip");
  assert.equal(await resultCount(), all);
});

test("formato e ordenação por mais recentes", async () => {
  const all = await resultCount();
  await openSection("Formato e lançamento");
  await page.selectOption(".filters select >> nth=0", "GOAT");
  const goat = await resultCount();
  assert.ok(goat > 500 && goat < all / 4, `GOAT: ${goat}`);
  await page.click(".active-chip:has-text('GOAT')");
  await page.selectOption("select.sort", "new");
  await page.waitForTimeout(450);
  const first = await page.textContent(".grid .tile-name >> nth=0");
  assert.ok(first.length > 0);
  await page.selectOption("select.sort", "relevance");
});

test("popup ao passar o mouse sobre a carta", async () => {
  await search("ash blossom");
  await page.hover(".grid .tile >> nth=0");
  await page.waitForSelector(".preview", { timeout: 2000 });
  assert.ok((await page.textContent(".preview")).includes("Efeito Rápido"));
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  assert.equal(await page.$(".preview"), null);
});

test("painel da Aleister: leitura, camada revisada, informações e metagame", async () => {
  await search("aleister the invoker");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".drawer");
  const tags = await page.$$eval(".drawer .tag-chip", (e) => e.map((x) => x.textContent));
  assert.ok(!tags.includes("Hand trap"), `correção da camada não aplicada: ${tags}`);
  assert.ok(tags.includes("Starter"));
  const kinds = await page.$$eval(".drawer .effect .kind", (e) => e.map((x) => x.textContent));
  assert.deepEqual(kinds, ["Efeito Rápido", "Gatilho"]);
  assert.ok((await page.textContent(".format-badges")).includes("Master Duel"));
  assert.equal(await page.$$eval(".meta-chart .meta-col", (e) => e.length), 8);
});

test("arquétipo no painel abre a busca com cartas de suporte", async () => {
  await page.click(".drawer .tag-btn:has-text('Invoked')");
  await page.waitForTimeout(450); // o painel fica aberto; a lista muda ao lado
  assert.ok((await page.textContent(".active-filters")).includes("Arquétipo: Invoked + suporte"));
  const n = await resultCount();
  assert.ok(n > 20, `Invoked + suporte: ${n}`);
});

test("busca por arquétipo/nome citado: 'dark magician' encontra a Cortina de Mago Negro", async () => {
  await reset();
  await search("dark magician");
  const names = await page.$$eval(".grid .tile-name", (e) => e.map((x) => x.textContent));
  assert.equal(names[0], "Mago Negro");
  assert.ok(names.includes("Cortina de Mago Negro"), "Cortina não apareceu");
  await search("");
});

test("filtro de arquétipo aceita o nome em português", async () => {
  await reset();
  await openSection("Arquétipo");
  await page.fill(".filters input[list='archetype-list']", "Dark Magician");
  const en = await resultCount();
  await page.fill(".filters input[list='archetype-list']", "Mago Negro");
  const pt = await resultCount();
  assert.ok(en > 40 && en === pt, `en ${en} × pt ${pt}`);
  await page.fill(".filters input[list='archetype-list']", "");
});

test("relacionamentos: Cortina invoca Mago Negro e o inverso", async () => {
  await reset();
  await search("cortina de mago negro");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".drawer .relations", { timeout: 5000 });
  assert.ok((await page.textContent(".drawer .effect-links")).includes("Invoca → Mago Negro"));
  assert.ok((await page.textContent(".relation-group.rel-out-invoca")).includes("Mago Negro"));
  // "Ver na busca" mostra só as cartas que ela invoca
  await page.click(".relation-group.rel-out-invoca .link-btn:has-text('Ver na busca')");
  await page.waitForTimeout(450); // o painel fica aberto; a lista muda ao lado
  assert.equal(await resultCount(), 1);
  assert.equal(await page.textContent(".grid .tile-name >> nth=0"), "Mago Negro");
  // no Mago Negro, o sentido inverso
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".drawer .relation-group.rel-in-invoca");
  // chips ordenados por popularidade: expande o "+N" antes de procurar
  const more = await page.$(".relation-group.rel-in-invoca .chips .link-btn");
  if (more) await more.click();
  assert.ok((await page.textContent(".relation-group.rel-in-invoca")).includes("Cortina de Mago Negro"));
  await page.click(".drawer-close");
  await page.click(".active-chip:has-text('Invoca: Cortina')");
  await search("");
});

test("relacionamentos: 'Combinar com filtros' mantém os filtros atuais", async () => {
  await reset();
  await page.click(".filters .chip:has-text('Magia')");
  await search("cortina de mago negro");
  await page.click(".grid .tile >> nth=0");
  // segue o link do efeito até o Mago Negro, sem sair do painel
  await page.click(".drawer .effect-link:has-text('Mago Negro')");
  await page.waitForFunction(() => document.querySelector(".drawer-head h3")?.textContent === "Mago Negro");
  await page.waitForSelector(".drawer .relation-group.rel-in-invoca");
  const all = await page.$eval(".relation-group.rel-in-invoca .relation-count", (e) => Number(e.textContent));
  await page.click(".relation-group.rel-in-invoca .link-btn:has-text('Combinar com filtros')");
  await page.waitForTimeout(450); // o painel fica aberto; a lista muda ao lado
  // Magia + "cortina de mago negro" + invocadoras do Mago Negro = só a Cortina
  assert.ok(all > 5, `invocadoras do Mago Negro: ${all}`);
  assert.equal(await resultCount(), 1);
  assert.equal(await page.textContent(".grid .tile-name >> nth=0"), "Cortina de Mago Negro");
  const chips = await page.textContent(".active-filters");
  assert.ok(chips.includes("Magia") && chips.includes("Invocada por: Mago Negro"), chips);
  await page.click(".active-filters .link-btn:has-text('Limpar tudo')");
  await search("");
});

test("Dark Magical Curtain: citadas + 'Outros' ordenado, e sem busca falsa do Enforcado da Profecia", async () => {
  await reset();
  await search("dark magical curtain");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".drawer .rel-out-invoca");
  const chips = await page.$$eval(".rel-out-invoca .rel-chip", (e) => e.map((x) => x.textContent));
  assert.deepEqual(chips.sort(), ["Mago Negro", "Pequena Maga Negra"]);
  assert.ok((await page.textContent(".rel-out-invoca .set-toggle")).includes("monstro Mago de TREVAS"));
  await page.click(".rel-out-invoca .set-toggle");
  const first = await page.$$eval(".rel-out-invoca .ranked-row", (e) => e.slice(0, 3).map((x) => x.innerText));
  assert.ok(first[0].includes("Citada") && first[1].includes("Citada"), first.join(" / "));
  assert.ok(first[2].includes("Combo"), first[2]);
  const buscadaPor = await page.textContent(".rel-in-busca");
  assert.ok(!buscadaPor.includes("Enforcado da Profecia"), buscadaPor);
});

test("botão Voltar no painel retorna à carta anterior", async () => {
  // continua no painel da Dark Magical Curtain
  await page.click(".rel-out-invoca .rel-chip:has-text('Mago Negro')");
  await page.waitForFunction(() => document.querySelector(".drawer-head h3")?.textContent === "Mago Negro");
  assert.ok((await page.textContent(".drawer-back")).includes("Dark Magical Curtain"));
  await page.click(".drawer-back");
  await page.waitForFunction(() => document.querySelector(".drawer-head h3")?.textContent === "Dark Magical Curtain");
  assert.equal(await page.$(".drawer-back"), null);
  await page.click(".drawer-close");
  await search("");
});

test("painel à esquerda não bloqueia a lista: clicar em outra carta e ver o popup", async () => {
  await reset();
  await search("mago negro");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".left-col .drawer.docked");
  // a grade continua clicável com o painel aberto
  const second = await page.textContent(".grid .tile-name >> nth=1");
  await page.click(".grid .tile >> nth=1");
  await page.waitForFunction((n) => document.querySelector(".drawer-head h3")?.textContent === n, second);
  assert.ok(await page.$(".grid .tile.selected"), "carta aberta deveria ficar destacada");
  // o popup da lista também funciona com o painel aberto
  await page.hover(".grid .tile >> nth=2");
  await page.waitForSelector(".preview", { timeout: 3000 });
  await page.mouse.move(5, 5);
  // a aba Filtros continua acessível
  await page.click(".left-tabs button:has-text('Filtros')");
  await page.waitForSelector(".left-col .filters");
  await page.click(".left-tabs button:has-text('Carta')");
  await page.waitForSelector(".left-col .drawer.docked");
});

test("carta referenciada aparece na lista, e Voltar restaura a lista anterior", async () => {
  await reset();
  await search("cortina de mago negro");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".drawer .effect-link");
  // Mago Negro não está na lista atual: aparece fixado no início da grade, sem mexer nos filtros
  await page.click(".drawer .effect-link:has-text('Mago Negro')");
  await page.waitForFunction(() => document.querySelector(".drawer-head h3")?.textContent === "Mago Negro");
  assert.equal(await page.textContent(".grid .pinned-slot .tile-name"), "Mago Negro");
  assert.ok(await page.$(".grid .pinned-slot .tile.selected"));
  assert.equal(await page.inputValue(".search-input input"), "cortina de mago negro");
  assert.equal(await resultCount(), 1);
  // Voltar: painel anterior, sem a carta fixada
  await page.click(".drawer-back");
  await page.waitForFunction(() => document.querySelector(".drawer-head h3")?.textContent === "Cortina de Mago Negro");
  assert.equal(await page.$(".grid .pinned-slot"), null);
  assert.equal(await page.inputValue(".search-input input"), "cortina de mago negro");
  await page.click(".drawer-close");
  await search("");
});

test("preços em reais: conversão pela cotação e TCG API só no desktop", async () => {
  await reset();
  await search("ash blossom");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".prices-section .money strong");
  const usd = await page.$eval(".prices-section .price-list div:nth-child(2) .money small", (e) => e.textContent);
  const brl = await page.$eval(".prices-section .price-list div:nth-child(2) .money strong", (e) => e.textContent);
  const n = (t) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
  assert.ok(Math.abs(n(brl) - n(usd) * 5) < 0.02, `${usd} → ${brl}`);
  assert.ok((await page.textContent(".prices-section")).includes("US$ 1 = R$"));
  assert.ok((await page.textContent(".tcgapi")).includes("app desktop"));
  // Coleções antes de Preços, com raridade em sigla (nome completo no title)
  const order = await page.$$eval(".drawer .drawer-section h4", (hs) => hs.map((h) => h.textContent));
  assert.ok(order.findIndex((t) => t.startsWith("Coleções")) < order.indexOf("Preços"), order.join(" / "));
  const badge = await page.$eval(".sets .rarity", (b) => ({ code: b.textContent, name: b.title }));
  assert.ok(badge.code.length <= 5 && badge.name.length > badge.code.length, JSON.stringify(badge));
  await page.click(".drawer-close");
  await search("");
});

test("TCG API: leitura da resposta fica só com as impressões da carta, da mais barata para a mais cara", async () => {
  const prices = await page.evaluate(async () => {
    const { parseTcgApi } = await import("/src/db/prices.ts");
    const body = JSON.stringify({
      data: [
        { name: "Ash Blossom & Joyous Spring", set_name: "Maximum Crisis", rarity: "Secret Rare", printing: "1st Edition", product_type: "Cards", market_price: 12.5, low_price: 10 },
        { name: "Ash Blossom & Joyous Spring", set_name: "Rarity Collection", rarity: "Prismatic Secret Rare", printing: "Unlimited", market_price: "3.10", low_price: null },
        { name: "Ash Blossom & Joyous Spring (Alternate Art)", set_name: "Outra", market_price: 1 },
        { name: "Ash Blossom & Joyous Spring", set_name: "Booster Box", product_type: "Sealed Products", market_price: 90 },
      ],
      meta: { total: 4, page: 1, per_page: 50, has_more: false },
      rate_limit: { daily_limit: 100, daily_remaining: 99 },
    });
    return parseTcgApi(body, { name: "Ash Blossom & Joyous Spring" });
  });
  assert.deepEqual(prices.map((p) => [p.set, p.market, p.currency]), [
    ["Rarity Collection", 3.1, "USD"],
    ["Maximum Crisis", 12.5, "USD"],
  ]);
});

test("raridades em sigla e casamento das impressões da TCG API com as coleções", async () => {
  const r = await page.evaluate(async () => {
    const { rarityInfo } = await import("/src/db/rarities.ts");
    const { matchPrinting } = await import("/src/db/prices.ts");
    const prices = [
      { set: "Maximum Crisis", rarity: "Secret Rare", median: 9, currency: "USD" },
      { set: "Rarity Collection", rarity: "Prismatic Secret Rare", median: 3, currency: "USD" },
    ];
    return {
      codes: ["Secret Rare", "Quarter Century Secret Rare", "Starlight Rare", "PLatinum Secret Rare", "New"].map((n) => rarityInfo(n).code),
      match: matchPrinting(prices, "Maximum Crisis", "Secret Rare")?.median,
      noMatch: matchPrinting(prices, "Maximum Crisis", "Ultra Rare") ?? null,
    };
  });
  assert.deepEqual(r.codes, ["ScR", "QCSR", "StR", "PlScR", "N"]);
  assert.equal(r.match, 9);
  assert.equal(r.noMatch, null);
});

test("nomes oficiais em português da camada (Yu-Gi-Oh! Wiki)", async () => {
  await reset();
  await search('"a" cell breeding device');
  assert.equal(await page.textContent(".grid .tile-name >> nth=0"), 'Dispositivo de Cruzamento de Células "A"');
  await search("dispositivo de cruzamento");
  assert.ok((await resultCount()) >= 1);
  await search("");
});

test("Esc volta ao menu e Sair pede confirmação", async () => {
  await reset();
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
  await page.click(".menu-btn:has-text('Sair')");
  await page.waitForSelector(".dialog");
  await page.keyboard.press("Escape");
  assert.equal(await page.$(".dialog"), null);
});

test("combos: sugestões respeitam o formato e mão sem linha calculada avisa", async () => {
  // tela de combos pelo menu
  await page.click(".menu-btn:has-text('Combos')");
  await page.waitForSelector(".combos-setup");
  // proibida no TCG aparece desabilitada nas sugestões
  await page.fill(".hand-search input", "ame no habakiri");
  await page.waitForSelector(".suggestions button");
  assert.ok(await page.$eval(".suggestions button", (b) => b.disabled));
  assert.ok((await page.textContent(".suggestions")).includes("proibida"));
  // no OCG ela pode
  await page.click(".format-switch button:has-text('OCG')");
  await page.waitForTimeout(300);
  assert.ok(!(await page.$eval(".suggestions button", (b) => b.disabled)));
  await page.click(".format-switch button:has-text('TCG')");
  // carta sem combo calculado: nenhuma linha inventada
  await page.fill(".hand-search input", "pot of greed");
  await page.waitForSelector(".suggestions button");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".combos-empty:has-text('Nenhum combo calculado')");
  assert.equal(await page.$(".verified-combos"), null);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("combos: Trudea mostra só linhas calculadas com o App, com deck de torneio e linha da comunidade confirmada", async () => {
  await page.click(".menu-btn:has-text('Combos')");
  await page.waitForSelector(".combos-setup");
  // atalhos da tela vazia, por deck
  await page.click(".starter-chips:has-text('Centur-Ion') .chip:has-text('Trudea')");
  await page.waitForSelector(".verified-combos .vc", { timeout: 15_000 });
  const lines = await page.$$eval(".verified-combos .vc", (e) => e.map((x) => x.textContent));
  assert.ok(lines.every((t) => t.includes("Calculado com o App")));
  const first = lines[0];
  assert.ok(first.includes("Invocação-Sincro"), "a linha passa por uma Sincro");
  assert.ok(first.includes("Auxila"), first.slice(0, 300));
  // a linha escrita pela comunidade só aparece porque o motor a confirmou
  assert.ok(lines.some((t) => t.includes("Confirma a linha da comunidade")));
  assert.ok((await page.textContent(".known-combos:not(.verified-combos)")).includes("conferidas com o App"));
  // "Fontes" abre a lista de sites, com o deck usado no cálculo em destaque; o link abre fora do app
  await page.click(".verified-combos .vc[open] .fontes-btn");
  await page.waitForSelector(".fontes-dialog");
  const fontes = await page.textContent(".fontes-dialog");
  for (const site of ["YGOPRODeck", "Master Duel Meta", "YGO Combo Builder", "CardCluster", "Project Ignis"]) assert.ok(fontes.includes(site), site);
  const [popup] = await Promise.all([
    page.context().waitForEvent("page"),
    page.click(".fontes-here a:has-text('Deck:')"),
  ]);
  assert.ok(popup.url().startsWith("https://ygoprodeck.com/deck/centur-ion"), popup.url());
  await popup.close();
  assert.ok(page.url().startsWith("http://localhost"), "o app não deve navegar para o link");
  // Esc fecha só a tela de Fontes; o segundo volta ao menu
  await page.keyboard.press("Escape");
  await page.waitForSelector(".fontes-dialog", { state: "detached" });
  assert.ok(await page.$(".combos-setup"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("combos: Primera sozinha só segue com descarte, e linhas que chegam nela", async () => {
  await page.click(".menu-btn:has-text('Combos')");
  await page.waitForSelector(".combos-setup");
  await page.fill(".hand-search input", "centur-ion primera");
  await page.waitForSelector(".suggestions button");
  await page.click(".suggestions button:has-text('Primera'):not(:has-text('Primus'))");
  await page.waitForSelector(".verified-combos .vc", { timeout: 15_000 });
  const hands = await page.$$eval("section[aria-label='Combos começando com a mão'] .vc .kc-hand", (e) => e.map((x) => x.textContent));
  assert.ok(hands.length > 0 && hands.every((h) => h.includes("carta qualquer")), hands.join(" | "));
  // linhas que chegam na Primera (ex.: a Trudea a coloca no campo), com o passo destacado
  const reach = page.locator("section[aria-label^='Combos que chegam em']");
  assert.ok((await reach.locator(".vc").count()) > 0);
  assert.ok((await reach.locator(".vc >> nth=0").textContent()).includes("Chega em"));
  assert.ok((await reach.locator(".vc[open] .vc-hit").count()) > 0);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("busca: atalhos para Combos (cabeçalho e painel da carta com a carta na mão)", async () => {
  await openSearch();
  await search("centur-ion trudea");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".drawer-combos");
  await page.click(".drawer-combos");
  await page.waitForSelector(".combos-setup");
  assert.ok((await page.textContent(".hand-cards")).includes("Trudea"));
  await page.waitForSelector(".verified-combos .vc", { timeout: 15_000 });
  // Menu volta para a busca, de onde veio
  await page.click(".screen-header .ghost-btn >> nth=0");
  await page.waitForSelector(".search-input input");
  await page.click(".combos-shortcut");
  await page.waitForSelector(".combos-setup");
  assert.equal(await page.$$eval(".hand-card", (e) => e.length), 0);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("conta: botão Entrar no menu abre a tela de conta com a integração de IA; Esc fecha só ela", async () => {
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
  await page.click(".menu-conta");
  await page.waitForSelector(".conta-dialog");
  const text = await page.textContent(".conta-dialog");
  assert.ok(text.includes("IAs") && text.includes("Política de Privacidade"), text.slice(0, 200));
  // contas ativas: abre em Entrar, com recuperar senha e sem cadastro público (só o administrador cria contas)
  assert.ok(text.includes("Esqueci a senha") && !text.includes("Criar conta"), text.slice(0, 200));
  assert.ok(text.includes("criadas pelo administrador"));
  // um botão por IA; dentro: para que serve, tutorial e cadastro
  assert.ok((await page.$$(".ia-grade .ia-botao")).length >= 10);
  await page.click(".ia-botao:has-text('Gemini')");
  const gemini = await page.textContent(".ia-detalhe");
  assert.ok(gemini.includes("Para que serve") && gemini.includes("vídeo do YouTube") && gemini.includes("Tutorial"), gemini.slice(0, 300));
  await page.click(".ia-detalhe .link-btn:has-text('Todas as IAs')");
  // digitar números num campo da conta não aciona o menu por trás (não há atalhos numéricos)
  await page.fill(".conta-form input[type=email]", "");
  await page.type(".conta-form input[type=email]", "1234");
  assert.ok(await page.$(".conta-dialog"), "a tela de conta continua aberta");
  assert.ok(await page.$(".menu-btn"), "continua no menu");
  // documento legal dentro do app
  await page.click(".conta-docs .link-btn:has-text('Política')");
  assert.ok((await page.textContent(".conta-dialog")).includes("LGPD"));
  await page.keyboard.press("Escape"); // volta para a conta
  await page.keyboard.press("Escape"); // fecha
  await page.waitForSelector(".conta-dialog", { state: "detached" });
  assert.ok(await page.$(".menu-btn"), "continua no menu");
});

test("Combo Search: carta final encontra linhas do App, e a IA (resposta simulada) sugere combos", async () => {
  // resposta da API do Claude simulada: a IA chama registrar_combos direto
  const registro = {
    combos: [
      {
        titulo: "Trudea até Auxila",
        iniciais: ["Centur-Ion Trudea"],
        passos: [
          { texto: "Invocação-Normal da Trudea e ativa o efeito dela.", cartas: ["Centur-Ion Trudea"] },
          { texto: "Invocação-Sincro da Auxila.", cartas: ["Centur-Ion Auxila"] },
        ],
        campo_final: ["Centur-Ion Auxila", "Carta Que Não Existe"],
        fontes: [{ nome: "Guia de teste", url: "https://example.com/guia" }],
        observacoes: "Linha de teste.",
      },
    ],
  };
  const sse = [
    ["message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "registrar_combos", input: {} } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(registro) } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 50 } }],
    ["message_stop", { type: "message_stop" }],
  ].map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
  let pedidos = 0;
  await page.route("**/api.anthropic.com/**", (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    pedidos++;
    return r.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream" }, body: sse });
  });
  await page.evaluate(() => localStorage.setItem("cartas-ia", JSON.stringify({ chave: "sk-ant-teste", modelo: "claude-opus-5-5" })));

  await page.click(".menu-btn:has-text('Combos')");
  await page.waitForSelector(".combos-setup");
  await page.click(".combos-modos button:has-text('Combo Search')");
  await page.fill(".cs-finais input", "centur-ion auxila");
  await page.waitForSelector(".cs-finais .suggestions button");
  await page.keyboard.press("Enter");
  await page.click(".cs-buscar");
  // linhas calculadas pelo App que chegam na Auxila
  await page.waitForSelector("section[aria-label='Calculados pelo App'] .vc", { timeout: 15_000 });
  assert.ok((await page.textContent("section[aria-label='Calculados pelo App']")).includes("Auxila"));

  await page.click(".cs-ia");
  await page.waitForSelector(".ia-section .base-combo", { timeout: 15_000 });
  const ia = await page.textContent(".ia-section");
  assert.equal(pedidos, 1);
  assert.ok(ia.includes("Sugestão de IA") && ia.includes("Trudea até Auxila"), ia.slice(0, 300));
  assert.ok(ia.includes("Invocação-Sincro da Auxila."));
  assert.ok(ia.includes("Entre na sua conta"), "sem conta, avisa que não gravou");

  await page.evaluate(() => localStorage.removeItem("cartas-ia"));
  await page.unroute("**/api.anthropic.com/**");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("Combo Search: IA no formato OpenAI (resposta simulada) com ferramentas do app", async () => {
  // 1ª chamada: a IA consulta uma carta; 2ª: entrega os combos
  const chamadas = [];
  const resposta = (message) => ({ choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] });
  await page.route("**/api.openai.com/v1/chat/completions", async (r) => {
    const body = JSON.parse(r.request().postData());
    chamadas.push(body);
    const json =
      chamadas.length === 1
        ? resposta({ role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "buscar_carta", arguments: JSON.stringify({ nome: "Centur-Ion Trudea" }) } }] })
        : resposta({
            role: "assistant",
            content: "Pronto.",
            tool_calls: [
              {
                id: "c2",
                type: "function",
                function: {
                  name: "registrar_combos",
                  arguments: JSON.stringify({
                    combos: [{ titulo: "Linha GPT", iniciais: ["Centur-Ion Trudea"], passos: [{ texto: "Passo gerado pelo GPT.", cartas: ["Centur-Ion Trudea"] }], campo_final: ["Centur-Ion Auxila"], fontes: [], observacoes: "" }],
                  }),
                },
              },
            ],
          });
    await r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify(json) });
  });
  await page.route("**/api.openai.com/**", (r) =>
    r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } }) : r.fallback(),
  );
  await page.evaluate(() =>
    localStorage.setItem("cartas-ia", JSON.stringify({ provedor: "openai", chave: "sk-teste", modelo: "gpt-teste", url: "https://api.openai.com/v1" })),
  );

  await page.click(".menu-btn:has-text('Combos')");
  await page.waitForSelector(".combos-setup");
  await page.click(".combos-modos button:has-text('Combo Search')");
  await page.fill(".cs-iniciais input", "centur-ion trudea");
  await page.waitForSelector(".cs-iniciais .suggestions button");
  await page.keyboard.press("Enter");
  await page.click(".cs-buscar");
  assert.ok((await page.textContent(".cs-ia")).includes("ChatGPT"));
  await page.click(".cs-ia");
  await page.waitForSelector(".ia-section .base-combo", { timeout: 15_000 });
  assert.ok((await page.textContent(".ia-section")).includes("Linha GPT"));
  // a resposta da ferramenta buscar_carta voltou para a IA com o texto da carta
  assert.equal(chamadas.length, 2);
  const tool = chamadas[1].messages.find((m) => m.role === "tool");
  assert.ok(tool && JSON.parse(tool.content).nome === "Centur-Ion Trudea", JSON.stringify(tool));
  assert.equal(chamadas[0].model, "gpt-teste");

  await page.evaluate(() => localStorage.removeItem("cartas-ia"));
  await page.unroute("**/api.openai.com/**");
  await page.unroute("**/api.openai.com/v1/chat/completions");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("respostas: passos mostram as interrupções do oponente, com opção de esconder, e o painel da carta soma as linhas", async () => {
  await page.click(".menu-btn:has-text('Combos')");
  await page.waitForSelector(".combos-setup");
  await page.fill(".hand-search input", "centur-ion trudea");
  await page.waitForSelector(".suggestions button");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".verified-combos .vc[open] .vc-resp", { timeout: 15_000 });
  assert.ok((await page.textContent(".verified-combos .vc[open]")).includes("Pode ser respondido por"));
  // a linha mostra a carta que a primeira busca adicionou
  assert.ok((await page.textContent(".verified-combos .vc .kc-hand")).includes("adicionando"));
  await page.uncheck(".respostas-toggle input");
  assert.equal(await page.$(".verified-combos .vc-resp"), null);
  await page.check(".respostas-toggle input");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");

  // painel da carta: seção Respostas
  await page.click(".menu-btn:has-text('Buscar Carta')");
  await page.waitForSelector(".grid .tile");
  await search("centur-ion trudea");
  await page.click(".grid .tile >> nth=0");
  await page.waitForSelector(".respostas-section", { timeout: 15_000 });
  assert.ok((await page.textContent(".respostas-section")).includes("o oponente pode responder com"));
  await reset();
});

test("editor de deck: selos de banlist e classificação, adicionar pela busca, Extra e salvar (sem Side, Importar, Exportar ou Limpar)", async () => {
  // Ash x2, Pote da Ganância e Accesscode Talker no Extra
  await abrirEditorCom({ nome: "Teste", main: [14558127, 14558127, 55144522], extra: [86066372] });
  await page.waitForSelector(".de-main .de-thumb");
  const total = (parte) => page.textContent(`.de-${parte} .de-total`);
  assert.equal(await total("main"), "3");
  assert.equal(await total("extra"), "1");
  assert.equal(await page.$(".de-side"), null);
  // sem Importar, Exportar e Limpar; opções do deck num bloco separado da carta
  const botoes = await page.$$eval(".de-botoes button", (b) => b.map((x) => x.textContent));
  // (o "Importar deck list" de .ydk/ydke:// é outro recurso e continua)
  assert.ok(!botoes.some((b) => /^Importar$|Exportar|Limpar/.test(b)), botoes.join(" | "));
  assert.ok(await page.$(".de-left .de-opcoes .de-controles"));
  assert.ok(await page.$(".de-left .de-carta .de-preview"));
  // Pote da Ganância é proibido no TCG: selo como na busca e aviso
  assert.equal(await page.textContent(".de-main .de-thumb[data-card-id='55144522'] .selo-ban"), "Proibida");
  assert.ok((await page.textContent(".de-avisos")).includes("máximo 0 no TCG"));
  // classificação: Ash Blossom é hand trap (selo HT na carta e por extenso no painel)
  assert.ok(await page.$(".de-main .de-thumb[data-card-id='14558127'] .selo-papel:has-text('HT')"));
  await page.hover(".de-main .de-thumb[data-card-id='14558127']");
  assert.ok((await page.textContent(".de-carta .papeis-da-carta")).includes("Hand trap"));
  // busca: clique adiciona ao Main (3ª Ash); a 4ª é bloqueada pelo limite de cópias
  await page.fill(".de-busca input[aria-label=Nome]", "ash blossom");
  await page.waitForSelector(".de-resultados .de-thumb[data-card-id='14558127']");
  await page.click(".de-resultados .de-thumb[data-card-id='14558127']");
  assert.equal(await total("main"), "4");
  await page.click(".de-resultados .de-thumb[data-card-id='14558127']");
  assert.equal(await total("main"), "4");
  assert.ok((await page.textContent(".de-controles")).includes("Limite de 3 cópias"));
  // botão direito numa carta do deck retira; na busca, também adiciona ao Deck
  await page.click(".de-main .de-thumb[data-card-id='55144522']", { button: "right" });
  assert.equal(await total("main"), "3");
  await page.fill(".de-busca input[aria-label=Nome]", "effect veiler");
  await page.waitForSelector(".de-resultados .de-thumb[data-card-id='97268402']");
  await page.click(".de-resultados .de-thumb[data-card-id='97268402']", { button: "right" });
  assert.equal(await total("main"), "4");
  // salvar
  await page.click(".de-salvar");
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem("cartas-decks")).decks[0]);
  assert.equal(salvo.main.length, 4);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("editor de deck: um deck por nome (Salvar como e Novo com nome existente não duplicam; repetidos antigos somem)", async () => {
  // dois decks com o mesmo nome guardados por uma versão anterior: fica só o salvo por último
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
  await page.waitForTimeout(1500); // deixa a camada terminar de baixar antes de recarregar
  await page.evaluate(() =>
    localStorage.setItem(
      "cartas-decks",
      JSON.stringify({
        decks: [
          { id: "a", nome: "Meu Deck", main: [14558127], extra: [], side: [], atualizadoEm: "2026-10-01T00:00:00Z" },
          { id: "b", nome: "MEU DECK", main: [14558127, 14558127], extra: [], side: [], atualizadoEm: "2026-10-02T00:00:00Z" },
          { id: "c", nome: "Outro", main: [97268402], extra: [], side: [], atualizadoEm: "2026-10-02T00:00:00Z" },
        ],
        padrao: "a",
      }),
    ),
  );
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
  await page.click(".menu-btn:has-text('Editor de Deck')");
  await page.waitForSelector(".deck-editor", { timeout: 120_000 });
  const opcoes = async () => page.$$eval(".de-controles select option", (o) => o.map((x) => x.textContent.trim()));
  assert.deepEqual(await opcoes(), ["MEU DECK (padrão)", "Outro"]);
  // "Outro" salvo como "Meu Deck": vai por cima, sem criar um terceiro deck
  await page.selectOption(".de-controles select", { label: "Outro" });
  await page.click(".de-botoes button:has-text('Salvar como')");
  await page.fill("input[aria-label='Nome do deck']", "meu deck");
  await page.click(".de-nome button:has-text('OK')");
  assert.deepEqual(await opcoes(), ["MEU DECK (padrão)", "Outro"]);
  assert.ok((await page.textContent(".de-controles")).includes("Salvo por cima"));
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem("cartas-decks")).decks.find((d) => d.id === "b"));
  assert.deepEqual(salvo.main, [97268402]);
  // Novo com nome existente só abre o deck
  await page.click(".de-botoes button:has-text('Novo')");
  await page.fill("input[aria-label='Nome do deck']", "Outro");
  await page.click(".de-nome button:has-text('OK')");
  assert.equal((await opcoes()).length, 2);
  await page.evaluate(() => localStorage.removeItem("cartas-decks"));
});

test("teste de jogo: Teste de Mão compra 5 de um Deck embaralhado, comprar, invocar pelo menu e Esc volta ao editor", async () => {
  const ids = [42493140, 15005145, 41371602, 14558127, 10045474, 40155014, 97698279, 96030710, 77765207, 97268402];
  const main = Array.from({ length: 40 }, (_, i) => ids[i % ids.length]);
  await abrirEditorCom({ nome: "Teste de Jogo", main, extra: [8841431] });
  await page.click(".de-teste");
  await page.waitForSelector(".teste-jogo");
  const deck = async () => Number(await page.textContent(".tj-zona[data-zona=deck] .tj-contagem"));
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 5);
  assert.equal(await deck(), 35);
  // abaixo de cada carta: chance de abrir (4 cópias em 40, mão de 5 = 42,7%)
  const chances = await page.$$eval(".tj-mao .tj-chance", (e) => e.map((x) => x.textContent));
  assert.equal(chances.length, 5);
  assert.ok(chances.every((c) => c === "42,7%"), chances.join(" "));
  // cor da chance: do vermelho (baixa) ao azul (alta), passando pelo verde
  assert.ok((await page.getAttribute(".tj-mao .tj-chance >> nth=0", "style")).includes("background"));
  // probabilidade desta mão específica, ao lado da mão
  assert.ok((await page.textContent(".tj-prob-mao")).includes("%"));
  // probabilidade geral: deck de 10 cartas com 4 cópias → mão sempre no perfil "cartas com 4 cópias"
  assert.ok((await page.textContent(".tj-prob-geral")).includes("com 4 cópias"));
  // "Esta mão" como exemplo em 100 mãos, e a caixa com a classificação das cartas da mão
  assert.ok((await page.textContent(".tj-prob-mao")).includes("em 100 mãos"));
  const papeisMao = await page.textContent(".tj-papeis-mao");
  assert.ok(papeisMao.includes("Nesta mão") && /\d/.test(papeisMao), papeisMao);
  // Visualizar Deck: clique abre as opções; ao fechar, o Deck é embaralhado
  // uma carta no campo antes de abrir o Deck: fechar a visualização não pode mexer nela
  await page.click(".tj-mao .tj-carta >> nth=0");
  await page.click(".tj-zona[data-zona=m0]");
  const noDeck = await deck();
  await page.click(".tj-visualizar");
  await page.waitForSelector(".tj-lista .tj-carta");
  await page.click(".tj-lista .tj-carta >> nth=0");
  await page.click(".tj-menu button:has-text('Adicionar à mão')");
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 5);
  await page.click(".tj-lista [aria-label=Fechar]");
  assert.equal(await page.textContent(".tj-log li >> nth=0"), "Embaralhou o Deck.");
  // só o Deck foi embaralhado: mão, campo e contagem do Deck continuam
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 5);
  assert.ok(await page.$(".tj-zona[data-zona=m0] .tj-carta"));
  assert.equal(await deck(), noDeck - 1);
  await page.click(".tj-teste-mao");
  // Ativar efeito: em qualquer carta, registrado no histórico
  await page.click(".tj-mao .tj-carta >> nth=0", { button: "right" });
  await page.click(".tj-menu button:has-text('Ativar efeito')");
  assert.ok((await page.textContent(".tj-log li >> nth=0")).startsWith("Ativou o efeito de"));
  // Deck: clique esquerdo não faz nada; o direito abre "Abrir deck" / "Comprar uma carta"
  await page.click(".tj-zona[data-zona=deck]");
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 5);
  assert.equal(await page.$(".tj-menu"), null);
  await page.click(".tj-zona[data-zona=deck]", { button: "right" });
  await page.click(".tj-menu button:has-text('Comprar uma carta')");
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 6);
  // com o Deck aberto, as opções continuam (comprar pela própria visualização)
  await page.click(".tj-zona[data-zona=deck]", { button: "right" });
  await page.click(".tj-menu button:has-text('Abrir deck')");
  await page.click(".tj-lista-comprar");
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 7);
  await page.click(".tj-lista [aria-label=Fechar]");
  await page.click(".tj-teste-mao");
  await page.click(".tj-zona[data-zona=deck]", { button: "right" });
  await page.click(".tj-menu button:has-text('Comprar uma carta')");
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 6);
  assert.equal(await deck(), 34);
  // Teste de Mão de novo: volta a 5 na mão e 35 no Deck
  await page.click(".tj-teste-mao");
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 5);
  assert.equal(await deck(), 35);
  // clicar para mover: seleciona a carta da mão e clica na zona
  const primeira = await page.getAttribute(".tj-mao .tj-carta >> nth=0", "data-card-id");
  await page.click(".tj-mao .tj-carta >> nth=0");
  assert.ok(await page.$(".tj-mao .tj-carta.tj-sel"));
  await page.click(".tj-zona[data-zona=m2]");
  assert.ok(await page.$(`.tj-zona[data-zona=m2] .tj-carta[data-card-id='${primeira}']`));
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 4);
  // e do campo para o Cemitério, do mesmo jeito
  await page.click(".tj-zona[data-zona=m2] .tj-carta");
  await page.click(".tj-zona[data-zona=cemiterio]");
  assert.equal(await page.textContent(".tj-zona[data-zona=cemiterio] .tj-contagem"), "1");
  // Reiniciar: recolhe tudo, embaralha e compra 5
  await page.click(".tj-teste-mao");
  assert.equal(await page.$$eval(".tj-mao .tj-carta", (e) => e.length), 5);
  assert.equal(await deck(), 35);
  assert.equal(await page.textContent(".tj-zona[data-zona=cemiterio] .tj-contagem"), "0");
  // Extra Deck: como o Deck, clique esquerdo não faz nada; o direito abre "Abrir Extra Deck"
  await page.click(".tj-zona[data-zona=extra]");
  assert.equal(await page.$(".tj-lista"), null);
  await page.click(".tj-zona[data-zona=deck]", { button: "right" });
  await page.click(".tj-menu button:has-text('Comprar uma carta')");
  await page.click(".tj-zona[data-zona=deck]", { button: "right" });
  await page.click(".tj-menu button:has-text('Comprar uma carta')");
  await page.click(".tj-zona[data-zona=extra]", { button: "right" });
  await page.click(".tj-menu button:has-text('Abrir Extra Deck')");
  await page.waitForSelector(".tj-lista .tj-carta");
  // monstro do Extra Deck: só invocar, Cemitério ou banir (nada de mão ou Deck)
  await page.click(".tj-lista .tj-carta", { button: "right" });
  const opcoesExtra = await page.$$eval(".tj-menu button", (b) => b.map((x) => x.textContent));
  assert.ok(!opcoesExtra.some((o) => /mão|topo|fundo/.test(o)), opcoesExtra.join(" | "));
  await page.click(".tj-menu button:has-text('Invocar em ataque')");
  assert.ok(await page.$(".tj-zona[data-zona=em0] .tj-carta[data-card-id='8841431']"));
  await page.keyboard.press("Escape"); // fecha a lista
  // levar para a mão é recusado
  await page.click(".tj-zona[data-zona=em0] .tj-carta");
  await page.click(".tj-mao");
  assert.ok(await page.$(".tj-zona[data-zona=em0] .tj-carta[data-card-id='8841431']"));
  assert.ok((await page.textContent(".tj-log li >> nth=0")).includes("é do Extra Deck"));
  // Criar combo: os passos do teste (compras juntas num passo e a Invocação do Extra Deck)
  await page.click(".tj-criar-combo");
  await page.waitForSelector(".tj-criar");
  const passosCombo = await page.$$eval(".tj-criar-passos li", (l) => l.map((x) => x.textContent));
  assert.equal(passosCombo.length, 2, passosCombo.join(" | "));
  assert.ok(passosCombo[0].startsWith("Compra ") && passosCombo[0].includes(","), passosCombo[0]);
  assert.ok(/de Centur/.test(passosCombo[1]), passosCombo[1]);
  // validade na banlist atual dos dois formatos e, sem login, "Entrar para criar"
  assert.equal(await page.$$eval(".tj-criar-validade .combo-validade", (e) => e.length), 2);
  assert.ok(await page.$(".tj-criar-entrar"));
  assert.equal(await page.isChecked(".tj-criar-compartilhar input"), false);
  await page.click(".tj-criar-passos li >> nth=0 >> button");
  assert.equal(await page.$$eval(".tj-criar-passos li", (l) => l.length), 1);
  await page.keyboard.press("Escape"); // fecha o Criar combo
  assert.equal(await page.$(".tj-criar"), null);
  await page.keyboard.press("Escape"); // volta ao editor
  await page.waitForSelector(".deck-editor");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("combo → Teste de Jogo: deck temporário do arquétipo, Executar combo com passos Anterior/Próximo", async () => {
  await page.evaluate(() => localStorage.removeItem("cartas-decks"));
  await page.goto(URL);
  await page.waitForSelector(".menu-btn");
  await page.click(".menu-btn:has-text('Combos')");
  await page.waitForSelector(".combos-setup");
  await page.fill(".hand-search input", "centur-ion trudea");
  await page.waitForSelector(".suggestions button");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".verified-combos .vc .vc-testar", { timeout: 15_000 });
  await page.click(".verified-combos .vc >> nth=1 >> .vc-testar");
  await page.waitForSelector(".teste-jogo");
  assert.ok((await page.textContent(".tj-dir h3")).includes("Centur-Ion Temporário"));
  // Executar combo: a mão vira a mão da linha e a caixa de passos aparece no topo
  await page.click(".tj-executar");
  await page.waitForSelector(".tj-passo");
  assert.ok((await page.textContent(".tj-passo")).includes("Passo 1 de"));
  assert.ok((await page.textContent(".tj-mao")).length >= 0);
  assert.equal(await page.$$eval(".tj-mao .tj-carta[data-card-id='42493140']", (e) => e.length), 1);
  await page.click(".tj-passo-nav button:has-text('Próximo')");
  assert.ok((await page.textContent(".tj-passo")).includes("Passo 2 de"));
  await page.click(".tj-passo-nav button:has-text('Anterior')");
  assert.ok((await page.textContent(".tj-passo")).includes("Passo 1 de"));
  // o deck temporário fica salvo, sem aviso de mínimo de 40
  const deck = await page.evaluate(() => JSON.parse(localStorage.getItem("cartas-decks")).decks[0]);
  assert.ok(deck.temporario && deck.nome === "Centur-Ion Temporário" && deck.main.includes(42493140), JSON.stringify(deck).slice(0, 200));
  await page.keyboard.press("Escape"); // fecha os passos
  await page.keyboard.press("Escape"); // volta ao editor
  await page.waitForSelector(".deck-editor");
  assert.ok(!(await page.textContent(".de-controles")).includes("mínimo 40"));
  // Menu volta para Combos, de onde veio
  await page.click(".screen-header .ghost-btn >> nth=0");
  await page.waitForSelector(".combos-setup");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
  // Teste de Jogo pela tela principal abre com o deck padrão
  await page.click(".menu-btn:has-text('Teste de Jogo')");
  await page.waitForSelector(".teste-jogo");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".deck-editor");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".menu-btn");
});

test("sem o menu nativo do navegador no botão direito (fora dos campos de texto)", async () => {
  const bloqueado = await page.evaluate(() => {
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    document.querySelector("main")?.dispatchEvent(e);
    return e.defaultPrevented;
  });
  assert.equal(bloqueado, true);
});

test("nenhum erro de JavaScript na página", () => {
  assert.deepEqual(pageErrors, []);
});
