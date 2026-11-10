# Jam Cards - YGO!

App de busca de cartas e montagem de decks de Yu-Gi-Oh! que roda na **web**, no **macOS** e no **Windows** a partir do mesmo código.

> **⬇ Instaladores:** abra a pasta [Install](Install/) para baixar o Jam Cards - YGO! para Windows (`.exe`) ou macOS (`.dmg`), com as instruções de instalação.
>
> Este repositório é público, sob a licença [AGPL-3.0](LICENSE) (o Simulador usa o motor e os scripts do Project Ignis, que são AGPL). Os instaladores da versão final ficam nas [Releases do repositório Jam-Cards-YGO](https://github.com/juniordsmates/Jam-Cards-YGO/releases).

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

Versão atual: **1.0.11 Alpha** (número em `package.json`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`; canal em [src/version.ts](src/version.ts) e na Action).

| Branch | Papel |
| --- | --- |
| `main` | desenvolvimento: tudo é feito aqui |
| `release` | versão de distribuição (hoje 1.0.11): só recebe as mudanças da `main` **quando o dono do projeto pede**; cada push nela gera os instaladores |

O arquivo [Notas de Atualização](Notas%20de%20Atualiza%C3%A7%C3%A3o) está **desativado**: o que estiver nele não é aplicado ao projeto.

### Instaladores (Windows e macOS)

A GitHub Action [versao.yml](.github/workflows/versao.yml) roda a cada push no branch `release` e publica no Release da versão (tag `v<versão>-<canal>`, com o número do `package.json`):

- **Windows:** `Jam Cards - YGO!_<versão>_x64-setup.exe` (o nome do app vem do `productName` do Tauri; no GitHub, espaços e "!" viram pontos: `Jam.Cards.-.YGO._<versão>_x64-setup.exe`). Se o app já estiver instalado, o instalador só atualiza, e os dados ficam.
- **macOS:** `Jam Cards - YGO!_<versão>_universal.dmg` (Apple Silicon e Intel).
- **Pasta Install:** depois dos dois builds, a Action copia os instaladores para [Install/](Install/)`<versão>/` na `main` e atualiza o [Install/README.md](Install/README.md) ([scripts/install-readme.mjs](scripts/install-readme.mjs)), uma pasta por versão de distribuição.

Para atualizar a distribuição: quando o dono pedir, leve a `main` para o branch `release`. Para uma versão nova: suba o número nos três arquivos acima (e no `package-lock.json` e `src-tauri/Cargo.lock`) na `main` antes de levar para a `release`. A release pública do repositório [Jam-Cards-YGO](https://github.com/juniordsmates/Jam-Cards-YGO/releases) só troca de instalador quando o dono pede.

O app não tem assinatura digital. No Windows, na primeira execução pode aparecer "O Windows protegeu o computador" → **Mais informações** → **Executar assim mesmo**. No macOS: **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**; se aparecer "está danificado", `xattr -cr '/Applications/Jam Cards - YGO!.app'`.

## Estrutura

```
src/
  sim/                    Simulador: motor de regras (Worker), sessão de duelo e IA
  App.tsx                 navegação entre telas
  platform.ts             detecta web x desktop e fecha o app
  screens/MainMenu.tsx    menu principal (Buscar Carta, Editor de Deck, Sair)
  screens/ScreenShell.tsx moldura das telas internas
  components/ExitDialog.tsx confirmação de saída
  styles.css              tema neon
src-tauri/                configuração e código nativo (Rust)
```

## Atalhos

- `↑` `↓` navegar no menu, `Enter` selecionar, `Tab` entre os campos
- `Esc` fecha a janela aberta (Fontes, conta, painel da carta) ou volta ao menu
- Não há atalhos de letras ou números: digitar em qualquer campo nunca aciona outra tela

## Dados das cartas

- **Cartas:** baixadas da [YGOPRODeck](https://ygoprodeck.com/api-guide/) na primeira abertura (inglês com `misc=yes`, português e staples) e guardadas no dispositivo (IndexedDB). A busca é toda local. Uma vez por dia o app confere se há versão nova.
- **Camada de marcações:** tags revisadas, ajustes de leitura, arquétipos oficiais, metagame do OCG e pontos do Genesys vêm de [dados/camada.json](https://github.com/juniordsmates/Jam-Cards-YGO/blob/main/dados/camada.json) no repositório público [Jam-Cards-YGO](https://github.com/juniordsmates/Jam-Cards-YGO) (o mesmo dos instaladores, sem textos de cartas), gerada todo dia pelo repositório privado `Database-Cards-Ygo`. Cartas que ainda não estão na camada usam as regras locais de [src/db/tags.ts](src/db/tags.ts).
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

**Ramificações:** quando a primeira jogada escolhe cartas do Deck (busca, Invocação ou envio), o pipeline abre uma linha para cada carta possível. Por exemplo, cada carta que a Sky Striker Mobilize - Engage! adiciona; o resumo da linha mostra "adicionando X".

**Respostas do oponente:** o pipeline rejoga cada linha com **todas as cartas ativáveis da mão** no turno do oponente (cerca de 640, achadas nos scripts oficiais) na mão dele. Em cada passo, marca as que o motor de regras deixaria ativar. [src/data/respostas.ts](src/data/respostas.ts) descreve as mais comuns; as demais mostram o tipo de resposta tirado do script.
- **Ordem** ([src/db/respostas.ts](src/db/respostas.ts)):
  1. mais usadas em torneios (em ao menos 1% de 1.000 decklists recentes da YGOPRODeck);
  2. hand trap e staple;
  3. hand trap;
  4. staple;
  5. as demais.
- **Quantidade:** no combo, até 5 por item; no painel da carta, até 15. O **+** abre a janela com todas ([src/components/RespostasDialog.tsx](src/components/RespostasDialog.tsx)), que tem filtro de classificação e de **Tipo de Resposta** e ordenação por prioridade, nome ou tipo. Assim, a Ash Blossom só aparece onde há busca, Invocação ou envio do Deck, e o Nibiru só depois da 5ª Invocação.
- As que valem em quase toda a linha (Maxx "C", Mulcharmy…) aparecem uma vez, no topo.
- As proibidas no formato escolhido não aparecem.
- A opção "Mostrar respostas do oponente" liga e desliga.
- No painel de cada carta, a seção **Respostas** soma todas as linhas: quem responde quando a carta ativa ou é invocada e, se ela for uma interrupção, a que ela responde ([src/components/CardRespostas.tsx](src/components/CardRespostas.tsx)).

As linhas escritas pela comunidade ([src/data/combos.ts](src/data/combos.ts)) só aparecem quando o motor as confirma (mesmo id em `maos` de `dados/combos-alvos.json` na base). O motor e os scripts (AGPL-3.0) não vão no app.

## Sites / Referências

Todos os sites de onde vêm os dados ficam em [src/data/referencias.ts](src/data/referencias.ts), por grupo (Cartas, Combos, Metagame, Preços). O app não lista sites em cada tela: mostra só o botão **Fontes**, que abre a tela com todos e destaca os usados ali (ex.: o deck de uma linha de combo) ([src/components/Fontes.tsx](src/components/Fontes.tsx)).

## Editor de Deck

Arranjo do Duelingbook ([src/screens/DeckEditor.tsx](src/screens/DeckEditor.tsx), regras em [src/db/decks.ts](src/db/decks.ts)):
- **Esquerda:** a carta em detalhe (imagem e texto) e os controles do deck: Novo, Renomear, Salvar, Salvar como, Importar, Exportar, Limpar, Definir padrão e Excluir.
- **Centro:** Main (com total, monstros, magias e armadilhas, e ordenação A-Z), Side e Extra, cada carta com o selo da banlist do formato escolhido (0, 1 ou 2).
- **Direita:** busca por nome, texto, tipo de carta, tipo, raça, atributo, faixas de Nível, ATK e DEF, limite da banlist e ordem, com páginas.

Interação:
- Clicar numa carta da busca adiciona ao Main, ou ao Extra no caso de Fusão, Sincro, Xyz e Link. O botão direito adiciona ao Side.
- Arrastar move entre as partes. O botão direito numa carta do deck, ou soltá-la na busca, a retira.
- Regras: Main de 40 a 60, Extra e Side até 15, até 3 cópias somando as partes, e o limite da banlist do formato (TCG/OCG, no canto superior direito).
- **Importar/Exportar** no formato `.ydk` (Duelingbook, EDOPro, YGOPRODeck). Artes alternativas viram a carta original.
- Os decks ficam neste dispositivo. Com conta, **Salvar** também guarda o deck na conta (tabela `decks`), e ao entrar em outro computador os decks da conta são trazidos.

## Teste de Jogo (Solo Mode)

Tabuleiro sem regras, como o Solo Mode do Duelingbook ([src/screens/TesteJogo.tsx](src/screens/TesteJogo.tsx), estado em [src/db/testeJogo.ts](src/db/testeJogo.ts)).
- **Onde abre:** pelo botão **Teste de Jogo** do Editor de Deck, pela tela principal (com o deck padrão) ou pelo atalho **Teste de Jogo** de cada linha de combo.
- **Mesa:** zonas de monstro (5 + 2 Extra), Magia/Armadilha, Campo, Deck, Extra Deck, Cemitério, Banidas e mão.
- **Interação:**
  - arrastar entre as zonas; soltar sobre um monstro anexa como matéria Xyz;
  - botão direito: Invocar, Baixar, Ativar, virar, mudar de posição, desanexar, mão, Cemitério, banir e topo ou fundo do Deck;
  - clique no Deck compra uma carta.
- **Teste de Mão:** tudo volta ao Deck, que é embaralhado (Fisher-Yates com o gerador criptográfico do sistema), e você compra 5. Há também LP, fases (só marcação), dado, moeda e histórico.
- **A partir de um combo:**
  - o app cria (ou atualiza) o deck temporário **"<arquétipo> Temporário"** com as cartas da linha: sem mínimo, com máximo de 60 e 15 e a banlist normal;
  - **Executar combo** monta a mão da linha e mostra no topo da tela o passo atual, com **‹ Anterior / Próximo ›**.

## Simulador (duelo com regras contra a IA)

Duelo com as regras do jogo: o motor é o do EDOPro (`ocgcore`, via [ocgcore-wasm](https://github.com/n1xx1/ocgcore-wasm)) com os dados (BabelCDB) e os scripts das cartas (CardScripts) do [Project Ignis](https://github.com/ProjectIgnis). Custos, condições, cadeias, "uma vez por turno" e procedimentos de Invocação valem como no jogo.

- **Tela:** [src/screens/Simulador.tsx](src/screens/Simulador.tsx), no menu principal (**Simulador**, rota `#/simulador`). Você escolhe o seu deck, o deck da IA (um deck seu ou um decklist de torneio que o motor já jogou, da camada), o nível da IA e quem começa.
- **Jogar:**
  - cartas com ações ficam com contorno brilhante; o clique abre as ações (Invocar, Ativar, Baixar, Atacar…);
  - as outras decisões do motor (alvos, matérias, zonas, posições, sim/não, declarar carta…) aparecem no painel da direita;
  - por padrão, o simulador pergunta "Encadear?" sempre que há uma corrente aberta (de qualquer jogador: dá para encadear até à própria ativação) e logo depois de uma jogada do oponente; pula as janelas vazias (mudanças de fase). **Pausar em todas as janelas de resposta** liga todas.
- **Partidas 1x1 (contra um amigo):** quem cria a sala recebe o link `#/duelo/<id>` (ou o código) para mandar ao oponente; o duelo começa quando ele entra com o deck dele. Precisa estar com a conta aberta.
  - Os dois aparelhos rodam o motor com a mesma semente e os mesmos decks e trocam só as respostas (o motor é determinístico). As salas ficam em `duelos` e as respostas, numeradas, em `duelo_respostas`, com Realtime: migração [20261110000000_duelos.sql](supabase/migrations/20261110000000_duelos.sql).
  - O banco só aceita a resposta de quem tem a vez e na ordem; entrar confere se os dois têm a mesma versão do app e do motor.
  - Quem cai volta ao duelo abrindo o link: o duelo é refeito pelas respostas salvas.
  - **Desistir** (ou sair) dá a vitória ao oponente, que vê o aviso na hora.
  - Limite: o duelo inteiro fica nos dois aparelhos (quem souber abrir as ferramentas do navegador consegue ver a mão do outro). Serve para partidas entre amigos, não para competição; não vale pontos no Rank.
- **Motor:** roda num Worker ([src/sim/worker.ts](src/sim/worker.ts)), para a IA pensar sem travar a tela.
  - [src/sim/regras.ts](src/sim/regras.ts): abre o motor com o pacote e cria o duelo;
  - [src/sim/sessao.ts](src/sim/sessao.ts): conduz o duelo, monta o estado e o registro;
  - [src/sim/cliente.ts](src/sim/cliente.ts): baixa o pacote e conversa com o Worker.
- **Pacote do motor:** `motor.json.gz` (~6 MB) no bucket privado `camada` do Supabase, publicado pelo pipeline (Database-Cards-Ygo, `npm run pacote-motor`), com `motor-versao.json` ao lado.
  - O app baixa o pacote uma vez e guarda no IndexedDB; só baixa de novo quando a versão muda.
  - O bucket precisa aceitar gzip: migração [20261109020000_motor_no_bucket.sql](supabase/migrations/20261109020000_motor_no_bucket.sql).
  - Em desenvolvimento, sem pacote no bucket, o app usa `public/motor.json.gz` (fora do git): copie o `dist/motor.json.gz` do pipeline para lá.
- **Aprendizado (etapa 1, só no aparelho):** em cada duelo, a sessão guarda os turnos de combo do jogador (mão no início da Main Phase 1, passos pelo conversor do pipeline em [src/sim/passos.ts](src/sim/passos.ts), campo final) e as janelas de resposta que ele viu (o que podia ativar, o que fez e o contexto: busca, Invocação, ativação, ataque, fase, cadeia). Tudo fica no IndexedDB com a prova (decks, semente, respostas) em [src/sim/aprendizado.ts](src/sim/aprendizado.ts) e aparece no fim do duelo em "O que este duelo ensinou". O envio para a IA aprender, com autorização (desligada por padrão), vem na etapa 2.
- **Ordem dos efeitos:** é a do motor do EDOPro, que segue o livro de regras (SEGOC: gatilhos obrigatórios do jogador do turno, do oponente, opcionais do jogador do turno, do oponente; depois Efeitos Rápidos, começando pelo oponente de quem ativou o último elo). Quando vários efeitos do jogador acontecem ao mesmo tempo, ele escolhe a ordem (o app explica na escolha; em SORT_CHAIN, clique na ordem dos elos).
- **Tela do duelo:** PV dos dois ao lado da fase e do turno, no centro do campo; nome de cada jogador à esquerda da mão (espaço fixo de 15 caracteres); **Criar Token** (na sua Main Phase: Ficha com Tipo, Atributo, Nível, ATK e DEF escolhidos; padrão Token, Nível 1, TREVAS, Besta, 0/0) entra no histórico como comando, seguido de um embaralhar da mão para o motor refazer as ações, e por isso a revisão e o oponente (1x1) refazem a mesma Ficha; **Jogar dado** (2 s de animação, resultado no registro, só neste aparelho).
- **Revisão e "?":** no fim do duelo, **Revisar a partida** refaz a partida no motor e permite voltar lance a lance ou turno a turno, com as cartas escondidas dos dois lados à vista; a tela inicial lista as partidas recentes (guardadas no aparelho e 1x1 do servidor). O botão **? Por que não pôde?** (no duelo e na revisão) pergunta ao motor sobre uma carta de um jogador naquele momento: onde ela estava, se o motor oferecia a ação, matérias pedidas x monstros no campo, Zonas de Monstros Extra, "uma vez por turno" e efeitos ativos que proíbem Invocação-Especial ([src/sim/porque.ts](src/sim/porque.ts)). Na revisão, a análise usa a Main Phase do jogador naquele turno.
- **IA** ([src/sim/ia.ts](src/sim/ia.ts)):
  - **planejamento:** na Main Phase 1, repete o duelo até o ponto atual (com a mesma semente e as mesmas respostas o motor refaz tudo igual) e joga o turno várias vezes com escolhas sorteadas, puxadas para as cartas das linhas de combo conhecidas do deck; executa a sequência que deixou o melhor campo. Se você responder diferente do previsto, ela planeja de novo;
  - **batalha:** ataca quando destrói o alvo ou quando pode atacar direto;
  - **respostas:** no seu turno, responde às suas jogadas com a chance do nível;
  - **níveis:** Passiva (só passa: para treinar combos), Fácil (uma tentativa), Normal (1,5 s de planejamento) e Difícil (4 s, responde sempre que pode).
- **Limites:**
  - os textos dos efeitos nas escolhas vêm em inglês (os do Project Ignis);
  - a ordem de cartas e de cadeia (SORT_CARD/SORT_CHAIN) usa a ordem proposta pelo motor;
  - a IA vê o estado inteiro do duelo (mão e Deck do jogador): ela é para treino, não para jogo justo.
- **Licença:** o `ocgcore` e os scripts do Project Ignis são AGPL-3.0, e por isso o app inteiro está sob a AGPL-3.0 ([LICENSE](LICENSE)). Quem recebe o app (instalador ou site) tem direito ao código-fonte: este repositório é público, e o rodapé do menu principal tem o link **Código-fonte**.

## Combo Search, contas e base de combos (Supabase)

- **Usuário Premium:** assinatura que libera recursos exclusivos; o primeiro previsto é o auxílio de jogadas no Simulador (indicar possibilidades). É separado do nível (Padrão, Avançado, Mentor). Só o administrador marca, em Minha conta → Usuários cadastrados; no app, `temPremium(conta)` ([src/db/conta.ts](src/db/conta.ts)); no banco, `public.sou_premium()` (migração [20261110010000_usuario_premium.sql](supabase/migrations/20261110010000_usuario_premium.sql)).

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

**Administração:** quem estiver na tabela `admins` (pelo id da conta, não pelo e-mail) vê em *Minha conta* o botão **Recalcular Ações**. O pedido entra na tabela `recalculos`, e o próprio banco dispara a Action "Atualizar base" da base pela API do GitHub. O token fica no cofre do Supabase (segredo `github_token`) e nunca chega ao app.

**Configuração de IA na conta (opcional):** marcando "guardar na minha conta", provedor, modelo, endereço e chave vão para a tabela `config_ia`, que só o dono lê. Ao entrar em outro computador sem IA configurada, o app usa essa configuração.

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
