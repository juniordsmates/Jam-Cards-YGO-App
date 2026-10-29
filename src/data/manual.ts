// Manual "Como Utilizar" (menu principal). Um capítulo por tela, mais as ligações entre as telas e
// um glossário. **texto** vira negrito.
//
// ATENÇÃO: ao mudar uma tela do app, atualize o capítulo dela aqui e as imagens do manual
// (public/manual/*.jpg), geradas por `node scripts/manual-imagens.mjs` com o servidor de
// desenvolvimento aberto (npm run dev).

export interface Topico {
  titulo: string;
  itens: string[];
}

export interface Capitulo {
  id: string;
  titulo: string;
  resumo: string;
  /** imagem em public/manual/ */
  imagem?: { arquivo: string; legenda: string };
  topicos: Topico[];
  /** exemplo prático, passo a passo */
  exemplo?: { titulo: string; passos: string[] };
  /** como esta tela conversa com as outras */
  ligacoes?: string[];
}

export const CAPITULOS: Capitulo[] = [
  {
    id: "inicio",
    titulo: "Primeiros passos",
    resumo:
      "O Jam Cards - YGO! junta num lugar só a busca de cartas de Yu-Gi-Oh!, os combos, a montagem de decks, o teste de mãos e a sua coleção. Funciona no computador (Windows e Mac) e no navegador.",
    imagem: { arquivo: "menu.jpg", legenda: "Menu principal" },
    topicos: [
      {
        titulo: "Menu principal",
        itens: [
          "Cada botão abre uma tela: **Buscar Carta**, **Combos**, **Editor de Deck**, **Teste de Jogo**, **Minha Coleção** e este **Como Utilizar**.",
          "Dá para navegar com as setas do teclado e abrir com **Enter**. Em qualquer tela, **Esc** volta para a anterior.",
          "No canto superior direito fica **Entrar**: com uma conta, seus decks, sua coleção e seus combos ficam salvos na nuvem e aparecem em qualquer computador ou navegador.",
          "Embaixo do menu aparecem a versão e se você está no app de computador (**Desktop**) ou no navegador (**Web**).",
        ],
      },
      {
        titulo: "Primeira abertura",
        itens: [
          "Na primeira vez, o app baixa a base de cartas (mais de 14 mil cartas, em inglês e português) e guarda no seu computador. Leva alguns segundos e não se repete.",
          "As imagens das cartas também ficam guardadas conforme você navega: depois de vistas, abrem mesmo sem internet.",
        ],
      },
      {
        titulo: "TCG e OCG",
        itens: [
          "Várias telas têm o seletor **TCG / OCG** no canto superior direito. Ele escolhe a banlist e quais cartas existem: o **TCG** é o jogo do ocidente (Brasil, EUA, Europa) e o **OCG**, o da Ásia.",
          "Uma carta lançada só no Japão aparece como **Não lançada** no TCG; uma carta proibida no TCG pode ser liberada no OCG, e vice-versa.",
        ],
      },
      {
        titulo: "Fontes",
        itens: ["Onde houver o botão **Fontes**, ele mostra de onde vieram os dados daquela tela (YGOPRODeck, Yu-Gi-Oh! Wiki, regras do EDOPro, sites de combos e de probabilidade)."],
      },
    ],
  },
  {
    id: "busca",
    titulo: "Buscar Carta",
    resumo: "Encontre qualquer carta pelo nome (em português ou inglês), pelo texto ou por filtros, e veja tudo sobre ela.",
    imagem: { arquivo: "busca.jpg", legenda: "Buscar Carta com o painel da Ash Blossom aberto" },
    topicos: [
      {
        titulo: "Buscar",
        itens: [
          "Digite parte do nome em **português ou inglês**: **ash blossom** e **florescer de cinzas** encontram a mesma carta.",
          "O nome do **arquétipo** também funciona: **dark magician** traz as cartas do arquétipo e as que citam o nome no texto.",
          "A lista carrega mais cartas sozinha conforme você desce. Passe o mouse sobre uma carta para ver uma prévia.",
        ],
      },
      {
        titulo: "Filtros (coluna da esquerda)",
        itens: [
          "**Monstro**: atributo, tipo, classe (Efeito, Fusão, Link…), Nível/Rank/Link, ATK e DEF.",
          "**Efeitos e termos**: tags como **Hand trap**, **Starter**, **Extender**, **Floodgate**, **Negação**, **Busca**… Combine várias.",
          "**Arquétipo**: aceita o nome em português ou inglês. Marque **Incluir cartas de suporte** para trazer cartas de outros arquétipos que citam este no texto.",
          "**Formato e lançamento** e **Banlist**: só cartas de um formato, de um período ou de uma situação na banlist (ex.: só as Limitadas).",
          "Os filtros ativos aparecem como chips no topo; clique num chip para tirá-lo.",
        ],
      },
      {
        titulo: "Painel da carta (clique numa carta)",
        itens: [
          "**Leitura da carta**: o texto dividido em efeitos, com custo, condição e o que cada efeito faz.",
          "**Cartas citadas**: nomes entre aspas no texto viram links para a carta (ou para a busca, se for um arquétipo).",
          "**Tags**: clique numa tag para buscar todas as cartas com ela.",
          "**Relacionamentos**: cartas que esta busca, invoca ou ajuda, e o inverso. **Combinar com filtros** mantém os filtros que você já tinha.",
          "**Respostas**: cartas que o oponente costuma usar contra esta (ex.: a Ash Blossom responde a efeitos que buscam no Deck).",
          "**Coleções e Preços**: cada impressão (código e raridade) com o preço convertido para reais pela cotação do dia.",
          "**Informações** e metagame: arquétipo, datas de lançamento, situação na banlist e uso em torneios.",
          "O botão **Voltar** do painel retorna à carta anterior quando você navega por links.",
        ],
      },
    ],
    exemplo: {
      titulo: "Exemplo: descobrir se uma carta é hand trap",
      passos: [
        "Digite **ash** na busca e clique em **Florescer de Cinzas & Primavera Feliz** (Ash Blossom & Joyous Spring).",
        "Nas **Tags** aparece **Hand trap**; clicando nela, a busca lista todas as hand traps.",
        "Em **Respostas**, veja contra quais tipos de efeito ela funciona.",
      ],
    },
    ligacoes: [
      "**Combos com esta carta** (no painel da carta) abre a tela de Combos **já com a carta na mão inicial**; o botão **Combos** do topo abre a tela vazia.",
      "As tags e as classificações vistas aqui (Hand trap, Starter…) são as mesmas dos selos no Editor de Deck e no Teste de Jogo.",
    ],
  },
  {
    id: "combos",
    titulo: "Combos: Mão inicial",
    resumo:
      "Escolha as cartas da mão e veja os combos que o app conseguiu jogar com elas, passo a passo, com as respostas que o oponente poderia usar em cada passo.",
    imagem: { arquivo: "combos.jpg", legenda: "Combos com Centur-Ion Trudea na mão" },
    topicos: [
      {
        titulo: "Escolher a mão",
        itens: [
          "Digite o nome da carta (português ou inglês) em **Mão inicial**. Dá para pôr mais de uma carta.",
          "Sem nenhuma carta escolhida, a tela mostra atalhos: as cartas que **começam combos sozinhas**, agrupadas por arquétipo (nome em inglês e em português).",
        ],
      },
      {
        titulo: "Combos calculados pelo App",
        itens: [
          "Cada linha foi **jogada pelo motor de regras do EDOPro**, com as regras oficiais de cada carta: custos, condições, \"uma vez por turno\" e o limite de uma Invocação-Normal.",
          "Elas usam decklists reais de torneio e consideram o **primeiro turno**, com o oponente passando.",
          "**adicionando X** no título indica uma ramificação: o que a primeira busca no Deck trouxe naquela linha.",
          "O **Campo final** mostra onde o combo termina.",
          "**Combos que chegam em…**: linhas que passam pelas cartas escolhidas sem começar com elas.",
        ],
      },
      {
        titulo: "Respostas do oponente",
        itens: [
          "Com **Mostrar respostas do oponente** marcado, cada passo lista as cartas da mão do oponente que poderiam interromper ali (ex.: **Ash Blossom** quando você ativa um efeito que busca no Deck).",
          "São até 5 por passo, na ordem: mais usadas em torneio, hand trap e staple, hand trap, staple e demais. O botão **+N** abre a lista completa, com filtros.",
          "Respostas que valem em quase todo o combo (como **Maxx \"C\"**) aparecem uma vez, no topo da linha.",
        ],
      },
      {
        titulo: "Combos da Comunidade",
        itens: [
          "Abaixo das linhas do App aparecem os **Combos da Comunidade** que começam com a mesma mão (ou os mais recentes, sem mão escolhida).",
          "Cada um mostra o **autor**, a **data** e se ele é **Válido no TCG/OCG** com a banlist atual (cartas proibidas ou cópias acima do limite deixam o combo \"Fora da banlist\").",
          "Quem criou o combo vê **Editar** (título, passos, observações, compartilhar) e **Excluir**.",
        ],
      },
    ],
    exemplo: {
      titulo: "Exemplo: do combo ao teste",
      passos: [
        "Escolha **Centur-Ion Trudea** na mão inicial.",
        "Abra uma linha e leia os passos; veja as respostas possíveis em cada passo.",
        "Clique em **▶ Teste de Jogo** na linha: o app cria um deck temporário (\"Centur-Ion Temporário\") com as cartas da linha e abre o Teste de Jogo.",
        "Lá, **Executar combo** coloca a mão do combo e mostra os passos com **‹ Anterior / Próximo ›** para você reproduzir no tabuleiro.",
      ],
    },
    ligacoes: [
      "**▶ Teste de Jogo** leva a linha (ou o Combo da Comunidade) para o Teste de Jogo, com um deck temporário.",
      "Combos criados no Teste de Jogo com **Compartilhar** aparecem aqui, em Combos da Comunidade.",
    ],
  },
  {
    id: "combo-search",
    titulo: "Combos: Combo Search",
    resumo: "Procure combos dizendo de onde você parte (cartas iniciais) e/ou onde quer chegar (cartas finais). O app procura nas linhas dele, na base de combos e, se você quiser, com IA.",
    topicos: [
      {
        titulo: "Como buscar",
        itens: [
          "Declare **0 ou mais cartas iniciais** e/ou **1 ou mais cartas finais** e clique em **Buscar**.",
          "**Calculados pelo App**: linhas com as iniciais na mão que passam pelas finais.",
          "**Na base de combos**: Combos da Comunidade e buscas anteriores com essas cartas.",
          "**Busca com IA**: com uma IA cadastrada em Minha conta → IAs, o app pede à IA combos novos; o Claude ainda pesquisa na web. As sugestões vêm marcadas como **não conferidas**.",
        ],
      },
      {
        titulo: "Publicar",
        itens: ["Gostou de uma sugestão? Com login, **Salvar como Combo da Comunidade** grava o combo com o seu nome de autor."],
      },
    ],
    ligacoes: ["A IA usada aqui é a marcada como **Usar no Combo Search** em Minha conta → IAs."],
  },
  {
    id: "combo-video",
    titulo: "Combos: Vídeo (experimental)",
    resumo: "Cole o link de um vídeo de combo do YouTube e o Gemini assiste e transcreve o combo para você conferir, refazer e salvar.",
    topicos: [
      {
        titulo: "Ler combo do vídeo",
        itens: [
          "Precisa do **Gemini** cadastrado (Minha conta → IAs → Gemini, com tutorial). Só vídeos **públicos**.",
          "Cole o link e clique em **Ler combo do vídeo**. Pode levar alguns minutos e usa a sua cota do Gemini.",
          "O resultado aparece como sugestão de IA, com as cartas conferidas na base. Cartas que o Gemini citou e não existem são avisadas.",
          "Por ser experimental, **confira sempre**: combos rápidos e cartas parecidas podem sair errados.",
        ],
      },
      {
        titulo: "Editar e Importar",
        itens: [
          "**✎ Editar e Importar** abre o combo no Teste de Jogo: cria um deck temporário com as cartas, coloca a mão inicial e mostra os passos lidos do vídeo como guia.",
          "Refaça o combo no tabuleiro, **pulando ou acrescentando etapas**, e salve pelo **Criar combo**: o título do vídeo já vem preenchido e o link fica como fonte.",
        ],
      },
    ],
    ligacoes: ["Vídeo → **Editar e Importar** → Teste de Jogo → **Criar combo** → (Compartilhar) → Combos da Comunidade."],
  },
  {
    id: "guia",
    titulo: "Guia de Deck",
    resumo:
      "Os decks mais fortes do TCG nos últimos 6 meses, cada um com ideias para iniciantes e para jogadores avançados, combos, interações e artigos de jogadores. Escolha o idioma (Português, English, Español) no canto superior direito.",
    imagem: { arquivo: "guia.jpg", legenda: "Guia de Deck do Kewl Tune" },
    topicos: [
      {
        titulo: "A lista do meta (esquerda)",
        itens: [
          "Vem de cerca de 2 mil decklists de torneio do TCG dos últimos 6 meses (YGOPRODeck) e se atualiza toda semana.",
          "Cada deck mostra a % dos decks em 6 meses e a tendência: **▲** subindo nos últimos 2 meses, **▼** caindo.",
          "**✎** marca os decks com texto escrito (Ideias Iniciais e Avançadas); os outros têm as seções calculadas.",
        ],
      },
      {
        titulo: "As abas de cada deck",
        itens: [
          "**Ideias Iniciais**: como o deck funciona, as cartas que você quer abrir, boas práticas e o esqueleto dos combos; depois, o **núcleo do deck** (cartas presentes em boa parte das listas, com a média de cópias), as cartas que começam combos e as **listas campeãs** com link.",
          "**Ideias Avançadas**: o campo final e as interrupções, como jogar através das hand traps, o jogo indo para o ataque e o Side; no fim, onde o deck costuma ser parado.",
          "**Combos**: as linhas calculadas pelo motor de regras, passo a passo, com as respostas do oponente em cada passo e **▶ Teste de Jogo**; e os Combos da Comunidade do deck.",
          "**Interações**: as respostas que mais param o deck (em quantas linhas, a partir de qual passo e onde acertam), os **pontos críticos** do combo e as interrupções do próprio deck.",
          "**Artigos de Jogadores**: táticas e ideias escritas por jogadores. Com login, **Enviar um artigo**; ele aparece depois da aprovação do administrador. Dá para citar cartas com [[Nome da carta]].",
        ],
      },
    ],
    exemplo: {
      titulo: "Exemplo: preparar-se contra o deck mais jogado",
      passos: [
        "Abra **Guia de Deck** e escolha o primeiro da lista (ex.: **Kewl Tune**).",
        "Em **Interações**, veja quais hand traps param mais linhas e em que passo: são as melhores para o seu Side.",
        "Em **Combos**, abra uma linha e clique em **▶ Teste de Jogo** para treinar onde usar a sua hand trap.",
      ],
    },
    ligacoes: [
      "**▶ Teste de Jogo** leva a linha para o Teste de Jogo, com um deck temporário.",
      "Os Combos da Comunidade criados no Teste de Jogo (com Compartilhar) aparecem na aba Combos do deck.",
      "As cartas citadas abrem a prévia, como na busca.",
    ],
  },
  {
    id: "editor",
    titulo: "Editor de Deck",
    resumo: "Monte decks como no Duelingbook: busque cartas à direita, monte o Deck e o Extra Deck no centro e controle o deck à esquerda.",
    imagem: { arquivo: "editor.jpg", legenda: "Editor de Deck com selos de banlist e de classificação" },
    topicos: [
      {
        titulo: "Bloco Deck (esquerda)",
        itens: [
          "**Escolher o deck** na lista; **(padrão)** marca o deck que abre primeiro e que o Teste de Jogo do menu usa.",
          "**Novo** cria um deck vazio. **Salvar** grava as alterações (o • em \"Salvar •\" avisa que há mudanças não salvas).",
          "**Salvar como** grava uma cópia com outro nome. **Um deck por nome**: salvar com um nome que já existe **salva por cima** dele.",
          "**Renomear**, **Definir padrão** e **Excluir** (pede confirmação).",
          "**Importar deck list**: arquivo **.ydk** (Duelingbook, EDOPro, YGOPRODeck) ou link **ydke://**. Vira um deck novo com o nome do arquivo; o Side é ignorado.",
          "Os avisos em vermelho apontam problemas: cartas acima do limite da banlist ou Deck com menos de 40.",
          "Embaixo, o bloco da carta mostra a carta em foco (passe o mouse): imagem, tipo, classificação e texto.",
        ],
      },
      {
        titulo: "Montar o deck",
        itens: [
          "**Clique** numa carta da busca para adicionar. Monstros de Fusão, Sincro, Xyz e Link vão **sozinhos para o Extra Deck**.",
          "**Botão direito** numa carta do deck **retira** a carta; na busca, também adiciona.",
          "**Arraste** para mudar a ordem, levar de uma parte para outra ou soltar fora (na busca) para retirar.",
          "O Deck mostra 10 cartas por linha (até 60) e o Extra, as 15 numa linha; tudo cabe na tela.",
          "Os contadores mostram o total, os monstros, as magias e as armadilhas. **A-Z** ordena: monstros, magias, armadilhas e, dentro, por nome.",
        ],
      },
      {
        titulo: "Selos nas cartas",
        itens: [
          "No canto de cima, a banlist do formato escolhido: **Proibida**, **Limitada** (1 cópia), **Semi-Limitada** (2) ou **Não lançada**.",
          "Embaixo, a classificação: **HT** hand trap, **ST** starter, **EX** extender, **BB** board breaker, **FG** floodgate, **SP** staple.",
          "Exemplo: **Ash Blossom** tem HT e SP; o **Pote da Ganância** aparece como **Proibida** no TCG.",
        ],
      },
      {
        titulo: "Opções do topo (abaixo de TCG / OCG)",
        itens: [
          "**TCG / OCG**: troca a banlist usada nos selos, nos limites de cópia e nos avisos.",
          "**Desativar limite de cartas**: ignora a banlist e se a carta foi lançada no formato (útil para testar decks de outro formato ou cartas novas). Continuam valendo as **3 cópias por carta** e os tamanhos do Main (60) e do Extra (15).",
          "**Estoque de cartas** (compara com a Minha Coleção):",
          "• **Não Aplicar Estoque de Cartas** (padrão): tudo como sempre.",
          "• **Listar todas as cartas**: a busca mostra todas, com **possuo N**; no deck, as cópias **além das que você tem** ficam escurecidas.",
          "• **Listar apenas cartas que possuo**: a busca mostra só as suas cartas.",
          "Só a **quantidade** conta, somando as raridades: com 1 Ash Secret e 1 Ash Common na coleção e 3 Ash no deck, as 2 primeiras ficam claras e **a 3ª fica escurecida**.",
          "**▶ Teste de Jogo** testa o deck aberto.",
        ],
      },
    ],
    exemplo: {
      titulo: "Exemplo: saber o que falta comprar",
      passos: [
        "Cadastre suas cartas em **Minha Coleção** (ou importe a lista da MYP Cards).",
        "No Editor, abra o deck e escolha **Listar todas as cartas** no estoque.",
        "As cartas escurecidas no deck são as cópias que você ainda não tem.",
      ],
    },
    ligacoes: [
      "**Minha Coleção** alimenta o estoque (possuo N e escurecimento).",
      "**▶ Teste de Jogo** usa este deck; os combos testados a partir de Combos criam decks \"… Temporário\" aqui.",
      "Com login, os decks ficam salvos na conta e aparecem no site e em outros computadores.",
    ],
  },
  {
    id: "teste",
    titulo: "Teste de Jogo",
    resumo: "Um tabuleiro livre (sem regras), como o Solo Mode do Duelingbook: compre mãos, mova cartas, teste jogadas e transforme o que fez num combo.",
    imagem: { arquivo: "teste.jpg", legenda: "Teste de Jogo com as probabilidades da mão" },
    topicos: [
      {
        titulo: "Mão e probabilidades",
        itens: [
          "**Reiniciar (Teste de Mão)** recolhe tudo, embaralha e compra 5.",
          "Embaixo de cada carta da mão: a **chance de abrir** ao menos 1 cópia dela numa mão de 5 (vermelho = baixa, azul = alta). Ex.: 3 cópias em 40 cartas ≈ 33,8%.",
          "**Esta mão**: a chance de abrir exatamente estas cartas, com o exemplo **em 100 mãos**.",
          "**Geral**: a chance de abrir uma mão com o mesmo perfil (ex.: \"4 cartas com 3 cópias\").",
          "**Nesta mão**: quantas cartas de cada classificação vieram (Hand trap, Starter, Floodgate, Staple…).",
        ],
      },
      {
        titulo: "Mover e agir",
        itens: [
          "**Arraste** a carta até a zona, ou **clique** nela e depois **clique na zona**.",
          "**Botão direito** numa carta abre as ações: Ativar efeito (fica no histórico), Invocação-Normal, Invocar em ataque/defesa, Baixar, Ativar, Virar, Posição, Desanexar matéria, Para a mão, Cemitério, Banir, Topo/Fundo do Deck.",
          "Soltar uma carta numa Zona de Monstros ocupada a anexa como **matéria Xyz**.",
          "**Deck**: o clique esquerdo não faz nada; o **direito** abre **Abrir deck** e **Comprar uma carta**. Ao fechar a visualização, só o que ficou no Deck é embaralhado.",
          "**Extra Deck**: o **botão direito** abre **Abrir Extra Deck**. Monstros do Extra só podem ser **invocados**, ir para o **Cemitério** ou ser **banidos** (nunca para a mão ou o Deck).",
          "**Criar token** (botão ou botão direito numa Zona de Monstros vazia): carta Token com Nível ?, ATK ?, DEF ?, tipo ? e sem atributo. Ao sair do campo, ela deixa de existir.",
          "LP (digite -1000, por exemplo, e Enter), fases, **Dado**, **Moeda** e **Histórico** de tudo o que você fez.",
        ],
      },
      {
        titulo: "Executar combo (vindo de Combos)",
        itens: ["Quando o teste vem de um combo, **Executar combo** coloca a mão do combo e abre a caixa de passos no topo, com **‹ Anterior / Próximo ›**."],
      },
      {
        titulo: "Criar combo",
        itens: [
          "Cada ação vira um passo, no mesmo formato da tela de Combos (compras seguidas se juntam; matérias de Link/Xyz entram na invocação).",
          "**Criar combo** mostra a prévia: mão inicial, passos (o **✕** tira um passo), campo final e se o combo é **válido no TCG e no OCG** pela banlist atual.",
          "Dê um título, escreva observações e marque **Compartilhar** para divulgar a todos na aba Combos, com o seu nome de usuário e a data. Precisa estar logado.",
        ],
      },
    ],
    exemplo: {
      titulo: "Exemplo: registrar um combo seu",
      passos: [
        "No Editor, abra o seu deck e clique em **▶ Teste de Jogo**.",
        "Faça o combo: Invocação-Normal pelo botão direito, buscas pelo **Abrir deck**, invocações do Extra pelo **Abrir Extra Deck**.",
        "Clique em **Criar combo**, confira os passos, marque **Compartilhar** e crie.",
        "O combo aparece em **Combos → Mão inicial**, em Combos da Comunidade, para quem escolher a mesma mão.",
      ],
    },
    ligacoes: [
      "Vem do **Editor de Deck** (deck aberto), do **menu** (deck padrão) ou de **Combos** (deck temporário com a linha).",
      "**Criar combo** publica em **Combos da Comunidade**.",
      "**Esc** volta para o Editor de Deck.",
    ],
  },
  {
    id: "colecao",
    titulo: "Minha Coleção",
    resumo: "Cadastre as cartas que você tem, com a impressão e a raridade, e veja quanto a coleção vale e o que falta.",
    imagem: { arquivo: "colecao.jpg", legenda: "Minha Coleção com o resumo e a busca" },
    topicos: [
      {
        titulo: "Adicionar",
        itens: [
          "Busque a carta à direita e clique nela.",
          "**Impressão** (código e raridade, ex.: MP24-EN001 · Secret Rare), **Idioma**, **Edição** e **Estado** começam em **Não aplicado**: preencha só o que quiser.",
          "Digite a **quantidade** (de **1 a 99**; zero não vale) e clique em **Adicionar à coleção**. A mesma carta com os mesmos detalhes soma na linha que já existe.",
        ],
      },
      {
        titulo: "Retirar",
        itens: ["Em cada linha, **Retirar da coleção** abre um campo para digitar quantas cópias retirar e um **Confirmar**. Retirando todas, a linha sai da coleção."],
      },
      {
        titulo: "Resumo e filtros",
        itens: [
          "**Cópias**, **cartas diferentes** e **valor total em R$** (preço da impressão na YGOPRODeck, pela cotação do dólar do dia), e o valor por raridade.",
          "Filtre a lista por nome e por raridade.",
        ],
      },
      {
        titulo: "Importar lista (MYP Cards)",
        itens: [
          "Cole (ou abra o arquivo .txt) a lista exportada da MYP Cards, uma carta por linha, como **1 #Mago Negro [GFTP] GFTP-EN128**.",
          "A carta é achada pelo código da impressão (ou pelo nome); a raridade entre parênteses, como **(Starlight Rare)**, é usada; o idioma sai do código (**EN** = Inglês, **PT** = Português).",
          "Antes de gravar, uma **prévia** mostra o que foi e o que não foi reconhecido.",
        ],
      },
    ],
    ligacoes: [
      "Alimenta o **estoque de cartas** do Editor de Deck (possuo N e cópias escurecidas).",
      "Com login, fica salva na conta; sem login, só neste computador.",
    ],
  },
  {
    id: "conta",
    titulo: "Conta e IAs",
    resumo: "Entre na sua conta para salvar tudo na nuvem e cadastre as IAs que o app usa (Combo Search e leitura de vídeos).",
    imagem: { arquivo: "conta.jpg", legenda: "Minha conta: um botão para cada IA" },
    topicos: [
      {
        titulo: "Conta",
        itens: [
          "**Entrar** com e-mail e senha. **Esqueci a senha** envia um link; ao abri-lo, o app pede a senha nova.",
          "As contas são criadas pelo **administrador** do app (não há cadastro aberto).",
          "Com login, ficam salvos: decks, coleção, combos que você cria e, se quiser, as IAs.",
        ],
      },
      {
        titulo: "IAs",
        itens: [
          "Cada IA tem um botão. Dentro: **para que serve no app**, um **tutorial** do cadastro (onde criar a chave), o custo e os campos.",
          "**Claude**: o melhor resultado no Combo Search, com pesquisa na web. **Gemini**: Combo Search e o único que **lê vídeos do YouTube**. **Ollama/LM Studio**: IA no seu computador, sem custo.",
          "**Usar no Combo Search** escolhe qual IA a busca usa. **Guardar esta IA na minha conta** leva a chave para os seus outros computadores.",
          "As chaves são suas: os custos ficam na sua conta do provedor.",
        ],
      },
    ],
  },
  {
    id: "ligacoes",
    titulo: "Como as telas se ligam",
    resumo: "Os caminhos mais úteis entre as telas, do começo ao fim.",
    topicos: [
      {
        titulo: "Da carta ao combo publicado",
        itens: [
          "**Buscar Carta** → painel da carta → **Combos** (a carta já vai para a mão inicial).",
          "**Combos** → linha → **▶ Teste de Jogo** (deck temporário) → **Executar combo**.",
          "**Teste de Jogo** → refaça ou melhore → **Criar combo** → **Compartilhar**.",
          "**Combos** → **Combos da Comunidade**: o seu combo aparece com o seu nome e a data.",
        ],
      },
      {
        titulo: "Da coleção ao deck",
        itens: [
          "**Minha Coleção** → cadastre ou importe (MYP Cards).",
          "**Editor de Deck** → estoque **Listar todas as cartas** → veja o que falta (cópias escurecidas).",
          "Ou **Listar apenas cartas que possuo** → monte só com o que você tem.",
        ],
      },
      {
        titulo: "Do vídeo ao combo",
        itens: ["**Combos → Vídeo** → **Ler combo do vídeo** → **✎ Editar e Importar** → Teste de Jogo → **Criar combo**."],
      },
      {
        titulo: "Do meta ao treino",
        itens: ["**Guia de Deck** → deck do topo → **Interações** (o que o para) → **Combos** → **▶ Teste de Jogo** para treinar contra ele."],
      },
      {
        titulo: "Do arquivo ao teste",
        itens: ["**Editor de Deck** → **Importar deck list** (.ydk ou ydke://) → **▶ Teste de Jogo** → veja as probabilidades da mão."],
      },
    ],
  },
  {
    id: "glossario",
    titulo: "Glossário",
    resumo: "Termos que aparecem no app.",
    topicos: [
      {
        titulo: "Classificação das cartas",
        itens: [
          "**Hand trap (HT)**: carta ativada da mão no turno do oponente para interromper o combo (ex.: Ash Blossom, Effect Veiler).",
          "**Starter (ST)**: carta que começa um combo sozinha (ex.: Centur-Ion Trudea).",
          "**Extender (EX)**: carta que dá mais jogadas depois que o combo começou.",
          "**Board breaker (BB)**: carta que desmonta o campo do oponente.",
          "**Floodgate (FG)**: carta que trava ações dos dois jogadores enquanto está no campo.",
          "**Staple (SP)**: carta genérica usada em muitos decks.",
        ],
      },
      {
        titulo: "Banlist e formatos",
        itens: [
          "**Proibida**: 0 cópias. **Limitada**: 1. **Semi-Limitada**: 2. As demais: até 3.",
          "**Não lançada**: a carta ainda não saiu naquele formato (TCG ou OCG).",
          "**Válido no TCG/OCG**: todas as cartas do combo, nas cópias usadas, são permitidas pela banlist atual.",
        ],
      },
      {
        titulo: "Do app",
        itens: [
          "**Calculado com o App**: combo jogado pelo motor de regras do EDOPro, com as regras oficiais das cartas.",
          "**Combo da Comunidade**: combo criado por um usuário (no Teste de Jogo ou salvo de uma sugestão); não é conferido previamente.",
          "**Sugestão de IA**: combo sugerido pela IA; confira antes de usar.",
          "**Deck temporário**: deck criado para testar um combo (\"<arquétipo> Temporário\"), sem mínimo de 40 cartas.",
        ],
      },
    ],
  },
];
