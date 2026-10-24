# Cartas

App de busca de cartas e montagem de decks de Yu-Gi-Oh! que roda na **web**, no **macOS** e no **Windows** a partir do mesmo código.

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
| `main` | desenvolvimento: mudanças novas, inclusive as do agente agendado |
| `release` | versão final: só recebe mudanças por **Pull Request aprovado pelo dono do projeto**; cada push nela gera o instalador |

Pedidos de mudança ficam em [Notas de Atualização](Notas%20de%20Atualiza%C3%A7%C3%A3o) (qualquer autor). Elas são implementadas na `main` e propostas para a `release` por Pull Request.

### Instalador do Windows

A GitHub Action [versao-windows.yml](.github/workflows/versao-windows.yml) roda a cada push na `release`, compila numa máquina Windows e publica `Cartas_<versão>_x64-setup.exe` num Release (tag `v<versão>-<canal>`). Se o app já estiver instalado, o instalador só atualiza, e os dados ficam.

Para lançar uma versão: suba o número nos três arquivos acima, junte a `main` na `release` por Pull Request e aprove.

O app não tem assinatura digital: na primeira execução o Windows pode mostrar "O Windows protegeu o computador" → **Mais informações** → **Executar assim mesmo**.

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

## Testes

```bash
npm run dev        # em outro terminal
npm run test:e2e   # testes de ponta a ponta no WebKit (mesmo motor do app no macOS)
```

Os testes bloqueiam as imagens das cartas para não gerar milhares de downloads na YGOPRODeck.

## Leitura da carta

O texto de cada carta é dividido em efeitos estruturados a partir da pontuação padrão da Konami (PSCT): `Condição: Custo/Alvo; Efeito.` O código fica em [src/db/effects.ts](src/db/effects.ts).

- **Tipos de efeito:** Efeito Rápido, Gatilho, Ignição, Contínuo, Ativação (Magia/Armadilha), Materiais, Condição de invocação, Regra, Restrição e Ambientação (monstros Normais).
- **Detalhes de cada efeito:** local de ativação (Mão, Campo, Cemitério, Banido, Zona de Pêndulo), opcional ou obrigatório, limite por turno (*soft* ou *hard*) e duração.
- **Cartas citadas:** nomes entre aspas no texto; o clique abre a carta ou, se o nome não for de uma carta (arquétipo, por exemplo), faz a busca por ele.
- **Idioma:** a estrutura é lida no texto em inglês. O português é exibido quando as frases batem uma a uma com o inglês; caso contrário, aparece o inglês.
