# Cartas

App de busca de cartas e montagem de decks de Yu-Gi-Oh! que roda na **web**, no **macOS** e no **Windows** a partir do mesmo código.

> **⬇ Instaladores:** abra a pasta [Install](Install/) para baixar o Cartas para Windows (`.exe`) ou macOS (`.dmg`), com as instruções de instalação.

- **Frontend:** React 18 + TypeScript + Vite
- **Desktop:** Tauri 2 (Rust + WebView do sistema)

## Pré-requisitos

| Ferramenta | macOS | Windows |
| --- | --- | --- |
| Node.js 20+ | `brew install node` | instalador em nodejs.org |
| Rust | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` | instalador em rustup.rs |
| Dependências nativas | `xcode-select --install` | Visual Studio Build Tools (C++) + WebView2 |

## Primeiros passos

```bash
npm install
npx tauri icon public/app-icon.svg   # gera os ícones em src-tauri/icons (uma vez só)
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Versão web em http://localhost:1420 |
| `npm run build` | Build web estático em `dist/` |
| `npm run desktop` | Abre o app nativo em modo desenvolvimento |
| `npm run desktop:build` | Gera o instalador (`.dmg`/`.app` no macOS, `.msi`/`.exe` no Windows) |

O instalador de cada sistema precisa ser gerado nesse sistema (ou via CI, como GitHub Actions).

## Versões e branches

Versão atual: **0.0.1 Alpha** (número em `package.json`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`; canal em [src/version.ts](src/version.ts) e na Action).

| Branch | Papel |
| --- | --- |
| `main` | desenvolvimento: tudo é feito aqui |
| `0.0.1` | versão de distribuição (o nome do branch é o número da versão): só recebe as mudanças da `main` **quando o dono do projeto pede**; cada push nela gera os instaladores |

O arquivo [Notas de Atualização](Notas%20de%20Atualiza%C3%A7%C3%A3o) está **desativado**: o que estiver nele não é aplicado ao projeto.

### Instaladores (Windows e macOS)

A GitHub Action [versao.yml](.github/workflows/versao.yml) roda a cada push num branch de distribuição (`0.0.1`, `0.0.2`…) e publica no mesmo Release (tag `v<versão>-<canal>`):

- **Windows:** `Cartas_<versão>_x64-setup.exe`. Se o app já estiver instalado, o instalador só atualiza, e os dados ficam.
- **macOS:** `Cartas_<versão>_universal.dmg` (Apple Silicon e Intel).
- **Pasta Install:** depois dos dois builds, a Action copia os instaladores para [Install/](Install/)`<versão>/` na `main` e atualiza o [Install/README.md](Install/README.md) ([scripts/install-readme.mjs](scripts/install-readme.mjs)), uma pasta por versão de distribuição.

Para atualizar a distribuição: quando o dono pedir, leve a `main` para o branch da versão (`0.0.1`). Para uma versão nova: suba o número nos três arquivos acima e crie o branch com o novo número a partir da `main`.

O app não tem assinatura digital. No Windows, na primeira execução pode aparecer "O Windows protegeu o computador" → **Mais informações** → **Executar assim mesmo**. No macOS: **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**; se aparecer "está danificado", `xattr -cr /Applications/Cartas.app`.

## Estrutura

```
src/
  App.tsx                 navegação entre telas
  platform.ts             detecta web x desktop e fecha o app
  screens/MainMenu.tsx    menu principal (Buscar Carta, Editor de Deck, Sair)
  screens/ScreenShell.tsx moldura das telas internas
  components/ExitDialog.tsx confirmação de saída
  styles.css              tema neon
src-tauri/                configuração e código nativo (Rust)
```

## Atalhos

- `↑` `↓` navegar no menu, `Enter` selecionar
- `1` `2` `3` `4` acionam os botões do menu direto
- `Esc` volta ao menu ou cancela o diálogo

## Dados das cartas

- **Cartas:** baixadas da [YGOPRODeck](https://ygoprodeck.com/api-guide/) na primeira abertura (inglês com `misc=yes`, português e staples) e guardadas no dispositivo (IndexedDB). A busca é toda local. Uma vez por dia o app confere se há versão nova.
- **Camada de marcações:** tags revisadas, ajustes de leitura, arquétipos oficiais, metagame do OCG e pontos do Genesys vêm de [Database-Cards-Ygo-Camada](https://github.com/juniordsmates/Database-Cards-Ygo-Camada) (público, sem textos de cartas), gerada todo dia pelo repositório privado `Database-Cards-Ygo`. Cartas que ainda não estão na camada usam as regras locais de [src/db/tags.ts](src/db/tags.ts).
- **Imagens:** baixadas uma vez e guardadas em cache (desktop: protocolo `ygoimg://` no Rust; web: service worker).

`src/db/tags.ts`, `effects.ts`, `relations.ts`, `types.ts` e `ygoprodeck.ts` são cópias do repositório `Database-Cards-Ygo`, onde fica o original. Correções de cartas e regras novas devem ser feitas lá.

## Preços

O painel da carta mostra os preços **em reais**. Nenhuma fonte traz reais hoje: quando um valor vier em BRL ele é usado direto; senão, é convertido pela cotação do dia ([AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas), guardada por 12 horas).

- **YGOPRODeck:** menor preço no Cardmarket (euro) e no TCGplayer (dólar), sempre visíveis.
- **[TCG API](https://tcgapi.dev/games/yugioh/):** preço de mercado e menor preço por impressão (coleção, raridade e versão), vindos do TCGplayer. Precisa de uma chave gratuita (100 consultas por dia), colada no painel e guardada só no computador. A consulta é feita pelo Rust (`tcgapi_search` em [src-tauri/src/lib.rs](src-tauri/src/lib.rs)) porque a API só aceita chamadas do próprio site; por isso **só funciona no app desktop**. Cada consulta é manual e o resultado fica guardado por 24 horas.

A licença da TCG API proíbe redistribuir os preços: eles não vão para a camada pública nem para outro lugar fora do app.

## Relacionamentos entre cartas

O painel de cada carta mostra, nos dois sentidos, as relações lidas dos nomes entre aspas no texto ([src/db/relations.ts](src/db/relations.ts)):

| A carta… | …e no sentido inverso |
| --- | --- |
| Invoca (ex.: Cortina de Mago Negro → Mago Negro) | Invocada por |
| Só pode ser invocada com (ex.: Guardião do Portão → Sanga do Trovão) | Necessária para invocar |
| Invocada por Ritual com | Invoca por Ritual |
| Materiais (Fusão etc.) | Material de |
| Busca | Buscada por |
| Cita | Citada por |

O alvo pode ser uma carta, um arquétipo ('"Invoked" monster') ou "cartas que citam X". Cada grupo tem **Ver na busca** (só essas cartas) e **Combinar com filtros** (aplica sobre os filtros atuais). Dentro da leitura, cada efeito mostra o que invoca ou busca.

## Combos

A aba Combos (pelo menu, pelo botão **Combos** da busca ou por **Combos com esta carta** no painel da carta) mostra **só linhas calculadas**: o pipeline da base (Database-Cards-Ygo, `npm run combos`) joga cada mão inicial no motor de regras do EDOPro (Project Ignis) com decklists reais de torneio da YGOPRODeck. Custos, condições de ativação, "uma vez por turno", travas e o limite de Invocação-Normal vêm dos scripts oficiais das cartas, não da leitura do texto. O app recebe as linhas prontas na camada pública (campo `combos`, só ids e zonas) e mostra as que começam com a mão escolhida e as que **chegam** nas cartas escolhidas, com o passo em que a carta aparece destacado e a continuação depois dela ([src/db/motor.ts](src/db/motor.ts), [src/components/VerifiedCombos.tsx](src/components/VerifiedCombos.tsx)).

As linhas escritas pela comunidade ([src/data/combos.ts](src/data/combos.ts)) só aparecem quando o motor as confirma (mesmo id em `maos` de `dados/combos-alvos.json` na base). O motor e os scripts (AGPL-3.0) não vão no app.

## Sites / Referências

Todos os sites de onde vêm os dados ficam em [src/data/referencias.ts](src/data/referencias.ts), por grupo (Cartas, Combos, Metagame, Preços). O app não lista sites em cada tela: mostra só o botão **Fontes**, que abre a tela com todos e destaca os usados ali (ex.: o deck de uma linha de combo) ([src/components/Fontes.tsx](src/components/Fontes.tsx)).

## Combo Search, contas e base de combos (Supabase)

Na aba Combos, **Combo Search** recebe 0 ou mais cartas iniciais (starters) e/ou 1 ou mais cartas finais, e procura em três lugares:

1. **Calculados pelo App:** as linhas da camada pública em que as iniciais estão na mão e as finais aparecem na linha.
2. **Base de combos** (Supabase): combos da comunidade e sugestões de IA de buscas anteriores.
3. **Busca com IA** ([src/db/ia.ts](src/db/ia.ts)): o app chama a IA escolhida pelo usuário, com a **chave de API dele**, cadastrada em *Minha conta → Integração com IA* e guardada só no dispositivo.
   - **Claude (Anthropic):** SDK oficial, com pesquisa na web.
   - **Qualquer API no formato da OpenAI** (`/chat/completions`): ChatGPT, Gemini, OpenRouter, DeepSeek, Groq, Mistral, Grok, Ollama e LM Studio no computador, ou outro endereço. No desktop, a chamada sai pelo Rust (`ia_chat` em [src-tauri/src/lib.rs](src-tauri/src/lib.rs)), que só aceita `/chat/completions` em https ou no próprio computador.
   - **Pesquisa na web:** nesses provedores não há pesquisa na web, salvo no OpenRouter com `:online` no fim do modelo. A IA usa os dados do app e o próprio conhecimento.
   - **Como a IA trabalha:** consulta o app por ferramentas (o texto das cartas e os combos já registrados) e entrega os combos pela ferramenta `registrar_combos`.
   - **Gravação:** as sugestões são **gravadas na base logo após a busca**, com origem `ia`. O usuário pode publicar qualquer uma como **Combo da Comunidade**, com o nome do autor.

**Base de combos** ([supabase/migrations/](supabase/migrations/)): uma tabela `combos` com o JSON completo de cada combo em `dados` e índices por `arquetipos` (nomes em inglês), `iniciais` (starters), `finais` e `cartas` (todas, preenchido pelo banco). A visão `combos_indice` dá a navegação **Arquétipo > Starter > combos**. A `origem` diz de onde veio o combo: `app`, `comunidade` ou `ia`.

**Contas:**
- **Acesso:** botão **Entrar** no canto superior direito da tela principal, com e-mail, usuário (público) e senha.
- **Senhas:** ficam no Supabase Auth, só como hash. Toda tabela tem RLS: cada pessoa só altera o que é dela.
- **Chave do app:** o app usa a URL do projeto e a chave pública em [src/db/supabase.ts](src/db/supabase.ts). Enquanto ela estiver vazia, as contas e a base de combos ficam desativadas, mas a busca com IA funciona sem gravar.
- **Documentos legais:** [Política de Privacidade](docs/politica-de-privacidade.md) e [Termos de Uso](docs/termos-de-uso.md), que também abrem dentro do app.

## Testes

```bash
npm run dev        # em outro terminal
npm run test:e2e   # testes de ponta a ponta no WebKit (mesmo motor do app no macOS)
```

Os testes bloqueiam as imagens das cartas para não gerar milhares de downloads na YGOPRODeck. Os combos calculados vêm de [tests/fixtures/combos.json](tests/fixtures/combos.json) (um recorte de `dados/combos-motor.json` da base), injetado na camada.

## Leitura da carta

O texto de cada carta é dividido em efeitos estruturados a partir da pontuação padrão da Konami (PSCT): `Condição: Custo/Alvo; Efeito.` O código fica em [src/db/effects.ts](src/db/effects.ts).

- **Tipos de efeito:** Efeito Rápido, Gatilho, Ignição, Contínuo, Ativação (Magia/Armadilha), Materiais, Condição de invocação, Regra, Restrição e Ambientação (monstros Normais).
- **Detalhes de cada efeito:** local de ativação (Mão, Campo, Cemitério, Banido, Zona de Pêndulo), opcional ou obrigatório, limite por turno (*soft* ou *hard*) e duração.
- **Cartas citadas:** nomes entre aspas no texto; o clique abre a carta ou, se o nome não for de uma carta (arquétipo, por exemplo), faz a busca por ele.
- **Idioma:** a estrutura é lida no texto em inglês. O português é exibido quando as frases batem uma a uma com o inglês; caso contrário, aparece o inglês.
