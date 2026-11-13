import { t } from "../i18n";
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
    titulo: t("Primeiros passos"),
    resumo:
      t("O Jam Cards - YGO! junta num lugar só a busca de cartas de Yu-Gi-Oh!, os combos, a montagem de decks, o teste de mãos e a sua coleção. Funciona no computador (Windows e Mac) e no navegador."),
    imagem: { arquivo: "menu.jpg", legenda: t("Menu principal") },
    topicos: [
      {
        titulo: t("Menu principal"),
        itens: [
          t("Os botões ficam em três colunas: **Explorar** (Buscar Carta, Combos, Guia de Deck, Meta Call), **Seus decks e cartas** (Editor de Deck, Teste de Jogo, Minha Coleção, Lista de Desejos) e **Comunidade e app** (Comunidade, Eventos, Rank e Conquistas e este Como Utilizar). Em telas menores viram duas colunas e, no celular, uma."),
          t("Dá para navegar com as setas do teclado (**↑ ↓** na coluna, **← →** entre as colunas) e abrir com **Enter**. Em qualquer tela, **Esc** volta para a anterior."),
          t("No canto superior direito fica **Entrar**: com uma conta, seus decks, sua coleção e seus combos ficam salvos na nuvem e aparecem em qualquer computador ou navegador. Ao lado, **Sair** fecha o aplicativo (no navegador, encerra a sessão)."),
          t("Ao lado, **Português / English / Español** troca o idioma de todo o app (ele recarrega na hora). Em inglês e espanhol, as cartas aparecem com o nome e o texto oficiais em inglês; a busca continua aceitando o nome em português."),
          t("Mais à esquerda, **☀ Claro / ☾ Escuro** troca o tema de todas as telas na hora. O modo escuro usa um fundo azul-acinzentado. A escolha fica salva neste aparelho; na primeira vez, o app segue o tema do sistema."),
          t("**Links**: o endereço do site acompanha a tela. **🔗 Copiar link** (no painel da carta, nos combos, na mão escolhida em Combos, no Guia de Deck e no Meta Call) copia um link que abre direto naquilo; no app de computador, o link é o do site. Combos só neste aparelho ou não compartilhados não têm link para outras pessoas."),
          t("Embaixo do menu aparecem a versão e se você está no app de computador (**Desktop**) ou no navegador (**Web**)."),
          t("**No celular** (navegador do smartphone), cada tela mostra só o conteúdo principal. Os painéis laterais (filtros, lista de decks, índice, opções do deck) ficam recolhidos: toque na seta **›** na borda esquerda (ou **‹** na direita) para abrir e na seta do topo do painel, ou fora dele, para recolher. Ao escolher algo na lista, o painel se recolhe sozinho."),
        ],
      },
      {
        titulo: t("Primeira abertura"),
        itens: [
          t("Na primeira vez, o app baixa a base de cartas (mais de 14 mil cartas, em inglês e português) e guarda no seu computador. Leva alguns segundos e não se repete."),
          t("As imagens das cartas também ficam guardadas conforme você navega: depois de vistas, abrem mesmo sem internet."),
        ],
      },
      {
        titulo: t("TCG e OCG"),
        itens: [
          t("Várias telas têm o seletor **TCG / OCG** no canto superior direito. Ele escolhe a banlist e quais cartas existem: o **TCG** é o jogo do ocidente (Brasil, EUA, Europa) e o **OCG**, o da Ásia."),
          t("Uma carta lançada só no Japão aparece como **Não lançada** no TCG; uma carta proibida no TCG pode ser liberada no OCG, e vice-versa."),
        ],
      },
      {
        titulo: t("Fontes"),
        itens: [t("Onde houver o botão **Fontes**, ele mostra de onde vieram os dados daquela tela (YGOPRODeck, Yu-Gi-Oh! Wiki, regras do EDOPro, sites de combos e de probabilidade).")],
      },
    ],
  },
  {
    id: "busca",
    titulo: t("Buscar Carta"),
    resumo: t("Encontre qualquer carta pelo nome (em português ou inglês), pelo texto ou por filtros, e veja tudo sobre ela."),
    imagem: { arquivo: "busca.jpg", legenda: t("Buscar Carta com o painel da Ash Blossom aberto") },
    topicos: [
      {
        titulo: t("Buscar"),
        itens: [
          t("Digite parte do nome em **português ou inglês**: **ash blossom** e **florescer de cinzas** encontram a mesma carta."),
          t("O nome do **arquétipo** também funciona: **dark magician** traz as cartas do arquétipo e as que citam o nome no texto."),
          t("A lista carrega mais cartas sozinha conforme você desce. Passe o mouse sobre uma carta para ver uma prévia."),
        ],
      },
      {
        titulo: t("Filtros (coluna da esquerda)"),
        itens: [
          t("**Monstro**: atributo, tipo, classe (Efeito, Fusão, Link…), Nível/Rank/Link, ATK e DEF."),
          t("**Efeitos e termos**: tags como **Hand trap**, **Starter**, **Extender**, **Floodgate**, **Negação**, **Busca**… Combine várias."),
          t("**Arquétipo**: aceita o nome em português ou inglês. Marque **Incluir cartas de suporte** para trazer cartas de outros arquétipos que citam este no texto."),
          t("**Formato e lançamento** e **Banlist**: só cartas de um formato, de um período ou de uma situação na banlist (ex.: só as Limitadas)."),
          t("Os filtros ativos aparecem como chips no topo; clique num chip para tirá-lo."),
        ],
      },
      {
        titulo: t("Painel da carta (clique numa carta)"),
        itens: [
          t("**Leitura da carta**: o texto dividido em efeitos, com custo, condição e o que cada efeito faz."),
          t("**Cartas citadas**: nomes entre aspas no texto viram links para a carta (ou para a busca, se for um arquétipo)."),
          t("**Tags**: clique numa tag para buscar todas as cartas com ela."),
          t("**Relacionamentos**: cartas que esta busca, invoca ou ajuda, e o inverso. **Combinar com filtros** mantém os filtros que você já tinha."),
          t("**Respostas**: cartas que o oponente costuma usar contra esta (ex.: a Ash Blossom responde a efeitos que buscam no Deck)."),
          t("**Cartas respostas**: para cada efeito ativado da carta, o que pode responder a ele; também **Quando é Invocada** e **Parada no campo** (o que costuma ser usado contra ela no campo, como **Typhoon** e **Cosmic Cyclone** contra Magias de Campo e Contínuas). Das mais usadas em torneios; **só OCG** marca as proibidas no TCG."),
          t("**Coleções e Preços**: cada impressão (código e raridade) com o preço convertido para reais pela cotação do dia."),
          t("**Informações** e metagame: arquétipo, datas de lançamento, situação na banlist e uso em torneios."),
          t("O botão **Voltar** do painel retorna à carta anterior quando você navega por links."),
        ],
      },
    ],
    exemplo: {
      titulo: t("Exemplo: descobrir se uma carta é hand trap"),
      passos: [
        t("Digite **ash** na busca e clique em **Florescer de Cinzas & Primavera Feliz** (Ash Blossom & Joyous Spring)."),
        t("Nas **Tags** aparece **Hand trap**; clicando nela, a busca lista todas as hand traps."),
        t("Em **Respostas**, veja contra quais tipos de efeito ela funciona."),
      ],
    },
    ligacoes: [
      t("**Combos com esta carta** (no painel da carta) abre a tela de Combos **já com a carta na mão inicial**; o botão **Combos** do topo abre a tela vazia."),
      t("As tags e as classificações vistas aqui (Hand trap, Starter…) são as mesmas dos selos no Editor de Deck e no Teste de Jogo."),
    ],
  },
  {
    id: "combos",
    titulo: t("Combos: Mão inicial"),
    resumo:
      t("Escolha as cartas da mão e veja os combos que o app conseguiu jogar com elas, passo a passo, com as respostas que o oponente poderia usar em cada passo."),
    imagem: { arquivo: "combos.jpg", legenda: t("Combos com Centur-Ion Trudea na mão") },
    topicos: [
      {
        titulo: t("Escolher a mão"),
        itens: [
          t("Digite o nome da carta (português ou inglês) em **Mão inicial**. Dá para pôr mais de uma carta."),
          t("Sem nenhuma carta escolhida, a tela mostra atalhos: as cartas que **começam combos sozinhas**, agrupadas por arquétipo (nome em inglês e em português)."),
        ],
      },
      {
        titulo: t("Combos calculados pelo App"),
        itens: [
          t("Cada linha foi **jogada pelo motor de regras do EDOPro**, com as regras oficiais de cada carta: custos, condições, \"uma vez por turno\" e o limite de uma Invocação-Normal."),
          t("Elas usam decklists reais de torneio e consideram o **primeiro turno**, com o oponente passando."),
          t("**adicionando X** no título indica uma ramificação: o que a primeira busca no Deck trouxe naquela linha."),
          t("O **Campo final** mostra onde o combo termina."),
          t("**Combos que chegam em…**: linhas que passam pelas cartas escolhidas sem começar com elas."),
        ],
      },
      {
        titulo: t("Respostas do oponente"),
        itens: [
          t("Com **Mostrar respostas do oponente** marcado, cada passo lista as cartas da mão do oponente que poderiam interromper ali (ex.: **Ash Blossom** quando você ativa um efeito que busca no Deck)."),
          t("São até 5 por passo, na ordem: mais usadas em torneio, hand trap e staple, hand trap, staple e demais. O botão **+N** abre a lista completa, com filtros."),
          t("Respostas que valem em quase todo o combo (como **Maxx \"C\"**) aparecem uma vez, no topo da linha."),
        ],
      },
      {
        titulo: t("Combos da Comunidade"),
        itens: [
          t("Abaixo das linhas do App aparecem os **Combos da Comunidade** que começam com a mesma mão (ou os mais recentes, sem mão escolhida)."),
          t("Cada um mostra o **autor**, a **data** e se ele é **Válido no TCG/OCG** com a banlist atual (cartas proibidas ou cópias acima do limite deixam o combo \"Fora da banlist\")."),
          t("Quem criou o combo vê **Editar** (título, passos, observações, compartilhar) e **Excluir**."),
          t("**Arquétipos vinculados**: ao salvar, editar, exportar ou criar um combo, marque um ou mais arquétipos (até 5). Os arquétipos das cartas do combo já vêm sugeridos; dá para vincular outro digitando o nome. Compartilhado, o combo aparece na aba **Comunidade** de cada arquétipo vinculado."),
          t("Antes de compartilhar, o app confere se o combo tem ao menos uma carta de cada arquétipo marcado. Se não tiver, aparece **Esse combo não possui cartas do arquétipo selecionado**, nada é gravado e o formulário continua aberto (o arquétipo fica em vermelho) para você desmarcá-lo."),
          t("**Meus combos neste aparelho**: os combos de Usuário Padrão (Criar combo ou Salvar como Combo da Comunidade) ficam aqui, só neste computador ou navegador. **Exportar** (ou **Exportar todos**) os envia para a base quando a conta for Avançado ou Mentor."),
        ],
      },
    ],
    exemplo: {
      titulo: t("Exemplo: do combo ao teste"),
      passos: [
        t("Escolha **Centur-Ion Trudea** na mão inicial."),
        t("Abra uma linha e leia os passos; veja as respostas possíveis em cada passo."),
        t("Clique em **▶ Teste de Jogo** na linha: o app cria um deck temporário (\"Centur-Ion Temporário\") com as cartas da linha e abre o Teste de Jogo."),
        t("Lá, **Executar combo** coloca a mão do combo e mostra os passos com **‹ Anterior / Próximo ›** para você reproduzir no tabuleiro."),
      ],
    },
    ligacoes: [
      t("**▶ Teste de Jogo** leva a linha (ou o Combo da Comunidade) para o Teste de Jogo, com um deck temporário."),
      t("Combos criados no Teste de Jogo com **Compartilhar** aparecem aqui, em Combos da Comunidade."),
    ],
  },
  {
    id: "combo-search",
    titulo: t("Combos: Combo Search"),
    resumo: t("Procure combos dizendo de onde você parte (cartas iniciais) e/ou onde quer chegar (cartas finais). O app procura nas linhas dele, na base de combos e, se você quiser, com IA."),
    topicos: [
      {
        titulo: t("Como buscar"),
        itens: [
          t("Declare **0 ou mais cartas iniciais** e/ou **1 ou mais cartas finais** e clique em **Buscar**."),
          t("**Calculados pelo App**: linhas com as iniciais na mão que passam pelas finais."),
          t("**Na base de combos**: Combos da Comunidade e buscas anteriores com essas cartas."),
          t("**Busca com IA**: com uma IA cadastrada em Minha conta → IAs, o app pede à IA combos novos; o Claude ainda pesquisa na web. As sugestões vêm marcadas como **não conferidas**."),
        ],
      },
      {
        titulo: t("Publicar"),
        itens: [t("Gostou de uma sugestão? Com login, **Salvar como Combo da Comunidade** grava o combo com o seu nome de autor.")],
      },
    ],
    ligacoes: [t("A IA usada aqui é a marcada como **Usar no Combo Search** em Minha conta → IAs.")],
  },
  {
    id: "combo-video",
    titulo: t("Combos: Vídeo (experimental)"),
    resumo: t("Cole o link de um vídeo de combo do YouTube e o Gemini assiste e transcreve o combo para você conferir, refazer e salvar."),
    topicos: [
      {
        titulo: t("Ler combo do vídeo"),
        itens: [
          t("Precisa do **Gemini** cadastrado (Minha conta → IAs → Gemini, com tutorial). Só vídeos **públicos**."),
          t("Cole o link e clique em **Ler combo do vídeo**. Pode levar alguns minutos e usa a sua cota do Gemini."),
          t("O resultado aparece como sugestão de IA, com as cartas conferidas na base. Cartas que o Gemini citou e não existem são avisadas."),
          t("Por ser experimental, **confira sempre**: combos rápidos e cartas parecidas podem sair errados."),
        ],
      },
      {
        titulo: t("Editar e Importar"),
        itens: [
          t("**✎ Editar e Importar** abre o combo no Teste de Jogo: cria um deck temporário com as cartas, coloca a mão inicial e mostra os passos lidos do vídeo como guia."),
          t("Refaça o combo no tabuleiro, **pulando ou acrescentando etapas**, e salve pelo **Criar combo**: o título do vídeo já vem preenchido e o link fica como fonte."),
        ],
      },
    ],
    ligacoes: [t("Vídeo → **Editar e Importar** → Teste de Jogo → **Criar combo** → (Compartilhar) → Combos da Comunidade.")],
  },
  {
    id: "guia",
    titulo: t("Guia de Deck"),
    resumo:
      t("Os decks mais fortes do TCG nos últimos 6 meses, cada um com ideias para iniciantes e para jogadores avançados, combos, interações e artigos de jogadores. Escolha o idioma (Português, English, Español) no canto superior direito."),
    imagem: { arquivo: "guia.jpg", legenda: t("Guia de Deck do Kewl Tune") },
    topicos: [
      {
        titulo: t("A lista do meta (esquerda)"),
        itens: [
          t("Vem de cerca de 2 mil decklists de torneio do TCG dos últimos 6 meses (YGOPRODeck) e se atualiza toda semana."),
          t("Cada deck mostra a % dos decks em 6 meses e a tendência: **▲** subindo nos últimos 2 meses, **▼** caindo."),
          t("**✎** marca os decks com texto escrito (Ideias Iniciais e Avançadas); os outros têm as seções calculadas."),
        ],
      },
      {
        titulo: t("As abas de cada deck"),
        itens: [
          t("**Ideias Iniciais**: como o deck funciona, as cartas que você quer abrir, boas práticas e o esqueleto dos combos; depois, o **núcleo do deck** (cartas presentes em boa parte das listas, com a média de cópias), as cartas que começam combos e as **listas campeãs** com link."),
          t("**Ideias Avançadas**: o campo final e as interrupções, como jogar através das hand traps, o jogo indo para o ataque e o Side; no fim, onde o deck costuma ser parado."),
          t("**Combos**: as linhas calculadas pelo motor de regras, passo a passo, com as respostas do oponente em cada passo e **▶ Teste de Jogo**; e os Combos da Comunidade do deck."),
          t("**Interações**: as respostas que mais param o deck (em quantas linhas, a partir de qual passo e onde acertam), os **pontos críticos** do combo e as interrupções do próprio deck."),
          t("**Artigos de Jogadores**: táticas e ideias escritas por jogadores. Com login, **Enviar um artigo**; ele aparece depois da aprovação do administrador. Dá para citar cartas com [[Nome da carta]]."),
        ],
      },
      {
        titulo: t("Decks acrescentados e referências"),
        itens: [
          t("Depois dos decks do meta vêm os **acrescentados** por um administrador: o núcleo sai da deck list cadastrada, sem dados de torneio."),
          t("**Referências da comunidade** (em Ideias Iniciais): páginas sobre o deck nos sites que o app usa como fonte, revisadas por um administrador."),
          t("Administrador: **+ Acrescentar deck** no fim da lista, **Editar deck** e **Apagar deck** no topo, e **Buscar novos decks** ao lado do idioma, em que a IA configurada procura referências novas e decks que faltam."),
        ],
      },
    ],
    exemplo: {
      titulo: t("Exemplo: preparar-se contra o deck mais jogado"),
      passos: [
        t("Abra **Guia de Deck** e escolha o primeiro da lista (ex.: **Kewl Tune**)."),
        t("Em **Interações**, veja quais hand traps param mais linhas e em que passo: são as melhores para o seu Side."),
        t("Em **Combos**, abra uma linha e clique em **▶ Teste de Jogo** para treinar onde usar a sua hand trap."),
      ],
    },
    ligacoes: [
      t("**▶ Teste de Jogo** leva a linha para o Teste de Jogo, com um deck temporário."),
      t("Os Combos da Comunidade criados no Teste de Jogo (com Compartilhar) aparecem na aba Combos do deck."),
      t("As cartas citadas abrem a prévia, como na busca."),
      t("Para escolher as cartas contra vários decks do meta de uma vez, use o **Meta Call**."),
    ],
  },
  {
    id: "metacall",
    titulo: t("Meta Call"),
    resumo:
      t("Diga quais decks você espera no torneio (e quanto de cada um) e o app indica as cartas boas contra eles: hand traps, respostas, cartas para jogar em segundo e de Side, com o motivo em cada deck e uma sugestão de Main e de Side."),
    imagem: { arquivo: "meta-call.jpg", legenda: t("Meta Call com o Top 5 do TCG") },
    topicos: [
      {
        titulo: t("Escolher os decks (esquerda)"),
        itens: [
          t("**TCG / OCG**: no TCG, os decks vêm de 6 meses de decklists de torneio (com a tendência ▲▼ dos últimos 2 meses); no OCG, do Road of the King (o perfil é estimado pelas cartas do arquétipo)."),
          t("**Consultar deck**: procure qualquer arquétipo (ex.: **Angelechy**). Os filtros **Relevantes agora** (meta do TCG e último trimestre do OCG) e **Já foram relevantes** (pico no OCG nos últimos 2 anos) ajudam a achar decks que podem aparecer; **+ Adicionar** põe o deck na lista. Sem decklists, o perfil é estimado pelas cartas do arquétipo (as mais usadas em torneios pesam mais)."),
          t("Marque os decks esperados; o **%** começa com a participação no meta e pode ser trocado (vale como proporção entre eles). **Top 5** e **Top 10** marcam os primeiros."),
          t("**Meu deck (opcional)**: com ele, o app avisa cartas que também travam você (ex.: **Macro Cosmos** num deck que usa o Cemitério; **Dominus** da mão, que tranca Atributos) e confere requisitos (**Herald of Orange Light** precisa de Fadas; **Fydraulis Harmonia**, de Sincros)."),
        ],
      },
      {
        titulo: t("Leitura dos decks"),
        itens: [
          t("Cada deck mostra o que o motor dele faz, lido do texto oficial das cartas do núcleo de torneio: **busca no Deck**, **Invoca do Deck**, **usa o Cemitério**, **efeitos de monstro no campo**, **Magias/Armadilhas**."),
          t("Com linhas do motor de regras: Invocações e buscas por combo e o tamanho do campo final; **Onde parar** (os passos que mais respostas param); as hand traps que o deck **joga**; e os **chefes** do campo final."),
        ],
      },
      {
        titulo: t("Recomendação"),
        itens: [
          t("A **nota** (0 a 100) junta **70% o confronto** com os decks escolhidos e **30% o uso real em torneios** (Main e Side dos decklists)."),
          t("Os selos de cada deck mostram a nota contra ele; **⚙** quer dizer que veio das linhas do motor: em que passo a carta já entra e **quanto do combo ela corta** (entrar cedo corta mais)."),
          t("Filtre por **Hand traps**, **Respostas**, **Jogando em segundo** e **Side e floodgates**. **máx. N** é o limite da banlist; **possuo N**, a sua coleção."),
          t("**Main: interrupções** sugere as cartas boas contra todos; **Side Deck (15)**, as específicas. **Copiar** copia a lista."),
          t("**Ver o motivo e os choke points em cada deck** mostra, para cada deck, onde a carta acerta: os **passos do combo** em que ela entra (⚙, das linhas do motor, com a frequência), as **cartas do deck** que ela para (pelas regras da carta) e, para as cartas de jogar em segundo, os **chefes** e o **campo final**. Ex.: Ash Blossom contra Kewl Tune nega o efeito de Kewl Tune Synchro, que busca no Deck, em 14 de 14 linhas."),
        ],
      },
    ],
    exemplo: {
      titulo: t("Exemplo: montar o Side para um regional"),
      passos: [
        t("Abra **Meta Call**, deixe **TCG** e clique em **Top 5**."),
        t("Ajuste o %: se você espera mais **Kewl Tune**, aumente o dele."),
        t("Escolha **Meu deck** para ver os avisos (cartas que travam você também)."),
        t("Use a sugestão de **Main** e de **Side**, abra **Ver o motivo em cada deck** nas dúvidas e treine no **Teste Avançado**."),
      ],
    },
    ligacoes: [
      t("Usa o metagame e as **Interações** do **Guia de Deck** e as linhas do motor de **Combos**."),
      t("**Minha Coleção** mostra o que você já tem; o **Teste Avançado** treina com as cartas escolhidas na mão do oponente."),
    ],
  },
  {
    id: "editor",
    titulo: t("Editor de Deck"),
    resumo: t("Monte decks como no Duelingbook: busque cartas à direita, monte o Deck e o Extra Deck no centro e controle o deck à esquerda."),
    imagem: { arquivo: "editor.jpg", legenda: t("Editor de Deck com selos de banlist e de classificação") },
    topicos: [
      {
        titulo: t("Bloco Deck (esquerda)"),
        itens: [
          t("**Escolher o deck** na lista; **(padrão)** marca o deck que abre primeiro e que o Teste de Jogo do menu usa."),
          t("**Novo** cria um deck vazio. **Salvar** grava as alterações (o • em \"Salvar •\" avisa que há mudanças não salvas)."),
          t("**Salvar como** grava uma cópia com outro nome. **Um deck por nome**: salvar com um nome que já existe **salva por cima** dele."),
          t("**Renomear**, **Definir padrão** e **Excluir** (pede confirmação)."),
          "**Importar deck list**: arquivo **.ydk** (Duelingbook, EDOPro, YGOPRODeck) ou link **ydke://**. Vira um deck novo com o nome do arquivo; o Side é ignorado.",
          t("Os avisos em vermelho apontam problemas: cartas acima do limite da banlist ou Deck com menos de 40."),
          t("Embaixo, o bloco da carta mostra a carta em foco (passe o mouse): imagem, tipo, classificação e texto."),
        ],
      },
      {
        titulo: t("Montar o deck"),
        itens: [
          t("**Clique** numa carta da busca para adicionar. Monstros de Fusão, Sincro, Xyz e Link vão **sozinhos para o Extra Deck**."),
          t("**Botão direito** numa carta do deck **retira** a carta; na busca, também adiciona."),
          t("**Arraste** para mudar a ordem, levar de uma parte para outra ou soltar fora (na busca) para retirar."),
          t("O Deck mostra 10 cartas por linha (até 60) e o Extra, as 15 numa linha; tudo cabe na tela."),
          t("Os contadores mostram o total, os monstros, as magias e as armadilhas. **A-Z** ordena: monstros, magias, armadilhas e, dentro, por nome."),
        ],
      },
      {
        titulo: t("Selos nas cartas"),
        itens: [
          t("No canto de cima, a banlist do formato escolhido: **Proibida**, **Limitada** (1 cópia), **Semi-Limitada** (2) ou **Não lançada**."),
          t("Embaixo, a classificação: **HT** hand trap, **ST** starter, **EX** extender, **BB** board breaker, **FG** floodgate, **SP** staple."),
          t("Exemplo: **Ash Blossom** tem HT e SP; o **Pote da Ganância** aparece como **Proibida** no TCG."),
        ],
      },
      {
        titulo: t("Opções do topo (abaixo de TCG / OCG)"),
        itens: [
          t("**TCG / OCG**: troca a banlist usada nos selos, nos limites de cópia e nos avisos."),
          t("**Desativar limite de cartas**: ignora a banlist e se a carta foi lançada no formato (útil para testar decks de outro formato ou cartas novas). Continuam valendo as **3 cópias por carta** e os tamanhos do Main (60) e do Extra (15)."),
          t("**Estoque de cartas** (compara com a Minha Coleção):"),
          t("• **Não Aplicar Estoque de Cartas** (padrão): tudo como sempre."),
          t("• **Listar todas as cartas**: a busca mostra todas, com **possuo N**; no deck, as cópias **além das que você tem** ficam escurecidas."),
          t("• **Listar apenas cartas que possuo**: a busca mostra só as suas cartas."),
          t("Só a **quantidade** conta, somando as raridades: com 1 Ash Secret e 1 Ash Common na coleção e 3 Ash no deck, as 2 primeiras ficam claras e **a 3ª fica escurecida**."),
          t("**▶ Teste de Jogo** testa o deck aberto; **▶ Teste Avançado** (Usuário Avançado ou Mentor) testa com o campo do oponente e as Indicações de resposta."),
        ],
      },
    ],
    exemplo: {
      titulo: t("Exemplo: saber o que falta comprar"),
      passos: [
        t("Cadastre suas cartas em **Minha Coleção** (ou importe a lista da MYP Cards)."),
        t("No Editor, abra o deck e escolha **Listar todas as cartas** no estoque."),
        t("As cartas escurecidas no deck são as cópias que você ainda não tem."),
      ],
    },
    ligacoes: [
      t("**Minha Coleção** alimenta o estoque (possuo N e escurecimento)."),
      t("**▶ Teste de Jogo** usa este deck; os combos testados a partir de Combos criam decks \"… Temporário\" aqui."),
      t("Com login, os decks ficam salvos na conta e aparecem no site e em outros computadores."),
    ],
  },
  {
    id: "teste",
    titulo: t("Teste de Jogo"),
    resumo: t("Um tabuleiro livre (sem regras), como o Solo Mode do Duelingbook: compre mãos, mova cartas, teste jogadas e transforme o que fez num combo."),
    imagem: { arquivo: "teste.jpg", legenda: t("Teste de Jogo com as probabilidades da mão") },
    topicos: [
      {
        titulo: t("Mão e probabilidades"),
        itens: [
          t("**Reiniciar (Teste de Mão)** recolhe tudo, embaralha e compra 5."),
          t("Embaixo de cada carta da mão: a **chance de abrir** ao menos 1 cópia dela numa mão de 5 (vermelho = baixa, azul = alta). Ex.: 3 cópias em 40 cartas ≈ 33,8%."),
          t("**Esta mão**: a chance de abrir exatamente estas cartas, com o exemplo **em 100 mãos**."),
          t("**Geral**: a chance de abrir uma mão com o mesmo perfil (ex.: \"4 cartas com 3 cópias\")."),
          t("**Nesta mão**: quantas cartas de cada classificação vieram (Hand trap, Starter, Floodgate, Staple…)."),
        ],
      },
      {
        titulo: t("Mover e agir"),
        itens: [
          t("**Arraste** a carta até a zona, ou **clique** nela e depois **clique na zona**."),
          t("**Botão direito** numa carta abre as ações: Ativar efeito (fica no histórico), Invocação-Normal, Invocar em ataque/defesa, Baixar, Ativar, Virar, Posição, Desanexar matéria, Para a mão, Cemitério, Banir, Topo/Fundo do Deck."),
          t("Soltar uma carta numa Zona de Monstros ocupada a anexa como **matéria Xyz**."),
          t("**Deck**: o clique esquerdo não faz nada; o **direito** abre **Abrir deck** e **Comprar uma carta**. Ao fechar a visualização, só o que ficou no Deck é embaralhado."),
          t("**Extra Deck**: o **botão direito** abre **Abrir Extra Deck**. Monstros do Extra só podem ser **invocados**, ir para o **Cemitério** ou ser **banidos** (nunca para a mão ou o Deck)."),
          t("**Criar token** (botão ou botão direito numa Zona de Monstros vazia): carta Token com Nível ?, ATK ?, DEF ?, tipo ? e sem atributo. Ao sair do campo, ela deixa de existir."),
          t("LP (digite -1000, por exemplo, e Enter), fases, **Dado**, **Moeda** e **Histórico** de tudo o que você fez."),
        ],
      },
      {
        titulo: t("Executar combo (vindo de Combos)"),
        itens: [t("Quando o teste vem de um combo, **Executar combo** coloca a mão do combo e abre a caixa de passos no topo, com **‹ Anterior / Próximo ›**.")],
      },
      {
        titulo: t("Criar combo"),
        itens: [
          t("Cada ação vira um passo, no mesmo formato da tela de Combos (compras seguidas se juntam; matérias de Link/Xyz entram na invocação)."),
          t("**Criar combo** mostra a prévia: mão inicial, passos (o **✕** tira um passo), campo final e se o combo é **válido no TCG e no OCG** pela banlist atual."),
          t("Dê um título, escreva observações e marque **Compartilhar** para divulgar a todos na aba Combos, com o seu nome de usuário e a data. Precisa estar logado."),
          t("**Usuário Padrão**: o combo fica **só neste aparelho** (Combos → **Meus combos neste aparelho**). Quando a conta passar a Avançado ou Mentor, **Exportar** leva o combo para a base."),
        ],
      },
    ],
    exemplo: {
      titulo: t("Exemplo: registrar um combo seu"),
      passos: [
        t("No Editor, abra o seu deck e clique em **▶ Teste de Jogo**."),
        t("Faça o combo: Invocação-Normal pelo botão direito, buscas pelo **Abrir deck**, invocações do Extra pelo **Abrir Extra Deck**."),
        t("Clique em **Criar combo**, confira os passos, marque **Compartilhar** e crie."),
        t("O combo aparece em **Combos → Mão inicial**, em Combos da Comunidade, para quem escolher a mesma mão."),
      ],
    },
    ligacoes: [
      t("Vem do **Editor de Deck** (deck aberto), do **menu** (deck padrão) ou de **Combos** (deck temporário com a linha)."),
      t("**Criar combo** publica em **Combos da Comunidade**."),
      t("**Esc** volta para o Editor de Deck."),
    ],
  },
  {
    id: "teste-avancado",
    titulo: t("Teste Avançado"),
    resumo:
      t("O Teste de Jogo com o campo do oponente espelhado em cima e as **Indicações de resposta**: a cada ação, as cartas que podem responder — as que o oponente tem e as do meta. Um facilitador, não um simulador. Para Usuário Avançado e Mentor."),
    imagem: { arquivo: "teste-avancado.jpg", legenda: t("Teste Avançado: Ash Blossom na mão do oponente e as Indicações de resposta") },
    topicos: [
      {
        titulo: t("Abrir"),
        itens: [
          t("No Editor de Deck, **▶ Teste Avançado**; ou, já no teste, a aba **Teste Avançado** no topo da coluna da direita."),
          t("O seu teste fica embaixo, igual ao Teste de Jogo (mão, probabilidades, Criar combo)."),
        ],
      },
      {
        titulo: t("Campo do oponente"),
        itens: [
          t("As cartas do oponente **não saem de deck nenhum**: use **+ Carta do oponente** e escolha a carta e onde ela entra (mão, campo, baixada, Cemitério, banidas)."),
          t("**Colocar** só monta o cenário; as opções com **(ação)** — Invocar, Ativar — contam como jogada do oponente e mostram o que **você** pode responder."),
          t("Botão direito nas cartas do oponente: Ativar efeito, Invocar, Ativar/Baixar, Virar, Para a mão, Cemitério, Banir e **Tirar do teste**."),
          t("As **Zonas de Monstros Extra** são compartilhadas: a da esquerda de um é a da direita do outro."),
          t("**Limpar oponente** esvazia o campo e a mão dele; **LP do oponente** se ajusta como o seu (ex.: -1000 e Enter)."),
        ],
      },
      {
        titulo: t("Indicações de resposta (coluna da direita)"),
        itens: [
          t("A cada ação (ativar, Invocar, buscar, mandar ao Cemitério…), o painel diz **o que o efeito faz** (lido do texto oficial: busca do Deck, Invoca do Cemitério…) e lista:"),
          t("• **O oponente tem**: as cartas da mão ou do campo dele que podem responder agora, com o motivo."),
          t("• **Podem responder (meta)**: as interrupções conhecidas para essa ação, das mais usadas em torneios (independente de o oponente tê-las), legais no formato. **motor · N**: confirmada nas linhas do motor de regras."),
          t("• **Outras usadas em torneios (confira)**: cartas de mão do meta que podem interromper, sem regra escrita no app."),
          t("Cada indicação traz as **condições** (ex.: **Effect Veiler** só na Main Phase; **Mulcharmy** só sem cartas no seu campo; **PSY-Framegear Gamma** só sem monstros) e fica apagada com **Agora não** quando não vale."),
          t("**Turno** (Você/Oponente) e a fase **DP** começam um turno novo: o contador de Invocações volta a zero (o **Nibiru** aparece a partir da 5ª)."),
          t("**‹ ›** volta às ações anteriores; **Indicações: ligadas/desligadas** esconde o painel. Passe o mouse numa carta do painel para ler o texto dela à esquerda."),
        ],
      },
    ],
    exemplo: {
      titulo: t("Exemplo: treinar contra Ash Blossom e Infinite Impermanence"),
      passos: [
        t("Abra o seu deck no **▶ Teste Avançado**."),
        t("**+ Carta do oponente** → **Ash Blossom** → **Para a mão**; **Infinite Impermanence** → **Baixar no campo**."),
        t("Comece o combo: ao ativar a busca, o painel mostra **O oponente tem: Ash Blossom** (nega a busca)."),
        t("Ative a Ash do oponente (botão direito → Ativar efeito) e veja o que **você** pode responder; refaça a ordem do combo para contornar."),
      ],
    },
    ligacoes: [
      t("O **Meta Call** diz quais hand traps esperar; coloque-as na mão do oponente aqui para treinar."),
      t("**Criar combo** funciona igual ao Teste de Jogo."),
    ],
  },
  {
    id: "colecao",
    titulo: t("Minha Coleção"),
    resumo: t("Cadastre as cartas que você tem, com a impressão e a raridade, e veja quanto a coleção vale e o que falta."),
    imagem: { arquivo: "colecao.jpg", legenda: t("Minha Coleção com o resumo e a busca") },
    topicos: [
      {
        titulo: t("Adicionar"),
        itens: [
          t("Busque a carta à direita e clique nela."),
          t("**Impressão** (código e raridade, ex.: MP24-EN001 · Secret Rare), **Idioma**, **Edição** e **Estado** começam em **Não aplicado**: preencha só o que quiser."),
          t("Digite a **quantidade** (de **1 a 99**; zero não vale) e clique em **Adicionar à coleção**. A mesma carta com os mesmos detalhes soma na linha que já existe."),
        ],
      },
      {
        titulo: t("Retirar"),
        itens: [t("Em cada linha, **Retirar da coleção** abre um campo para digitar quantas cópias retirar e um **Confirmar**. Retirando todas, a linha sai da coleção.")],
      },
      {
        titulo: t("Resumo e filtros"),
        itens: [
          t("**Cópias**, **cartas diferentes** e **valor total em R$** (preço da impressão na YGOPRODeck, pela cotação do dólar do dia), e o valor por raridade."),
          t("Filtre a lista por nome e por raridade."),
        ],
      },
      {
        titulo: t("Importar lista (MYP Cards)"),
        itens: [
          t("Cole (ou abra o arquivo .txt) a lista exportada da MYP Cards, uma carta por linha, como **1 #Mago Negro [GFTP] GFTP-EN128**."),
          t("A carta é achada pelo código da impressão (ou pelo nome); a raridade entre parênteses, como **(Starlight Rare)**, é usada; o idioma sai do código (**EN** = Inglês, **PT** = Português)."),
          t("Antes de gravar, uma **prévia** mostra o que foi e o que não foi reconhecido."),
        ],
      },
    ],
    ligacoes: [
      t("Alimenta o **estoque de cartas** do Editor de Deck (possuo N e cópias escurecidas)."),
      t("Com login, fica salva na conta; sem login, só neste computador."),
    ],
  },
  {
    id: "desejos",
    titulo: t("Lista de Desejos"),
    resumo: t("As cartas que você quer conseguir, com a quantidade de cada uma e quantas já tem na Minha Coleção."),
    topicos: [
      {
        titulo: t("Adicionar cartas"),
        itens: [
          t("Na própria Lista de Desejos, em **Adicionar cartas**, busque pelo nome (português ou inglês), escolha uma ou várias e clique em **Adicionar à lista**."),
          t("Em qualquer painel de carta (**Buscar Carta**, **Editor de Deck** e **Minha Coleção**), o botão **♡ Lista de Desejos** pede a quantidade e soma à lista; com a carta já na lista, ele mostra **♥ Na Lista de Desejos (N)**."),
        ],
      },
      {
        titulo: t("Adicionar deck"),
        itens: [
          t("No **Editor de Deck**, bloco Deck, **♡ Adicionar deck à Lista de Desejos** leva as cartas do deck aberto com as quantidades (Main, Extra e Side)."),
          t("Escolha **Todas as cartas do deck** ou **Só o que falta na Minha Coleção**. Carta que já está na lista fica com a quantidade maior: adicionar o mesmo deck duas vezes não dobra a lista."),
        ],
      },
      {
        titulo: t("Selecionar e remover"),
        itens: [
          t("Marque as cartas uma por uma ou use **Selecionar todas** (vale para as que aparecem com o filtro) e clique em **Remover selecionadas**, depois em **Confirmar**."),
          t("O **✕** de cada linha tira só aquela carta; **−** e **+** mudam a quantidade."),
          t("Cada linha mostra quantas você já tem na coleção e quantas faltam; a carta completa aparece com **✓ Já tenho**."),
        ],
      },
    ],
    ligacoes: [t("Com login, a lista fica salva na conta; sem login, só neste aparelho."), t("Usa a **Minha Coleção** para saber o que falta.")],
  },
  {
    id: "comunidade",
    titulo: t("Comunidade e Rank"),
    resumo: t("Pesquise um arquétipo e veja quem mais compartilha combos dele, os Combos da Comunidade com a tag dele e o resumo do Guia de Deck. No Rank, os duelistas com mais pontos."),
    topicos: [
      {
        titulo: t("Comunidade"),
        itens: [
          t("À esquerda, pesquise o arquétipo pelo nome em inglês ou em português (os mesmos da busca de cartas). A lista vem em três grupos, separados por uma linha: os **5 mais jogados no meta atual** (fatia dos torneios do TCG nos últimos 2 meses), os **5 mais ativos na comunidade** (combos compartilhados e artigos aprovados) e **todos os demais em ordem alfabética**."),
          t("**Quem mais compartilha combos**: os duelistas com mais combos compartilhados daquele arquétipo e os pontos deles."),
          t("**Combos**: os Combos da Comunidade vinculados ao arquétipo (Arquétipos vinculados, ao compartilhar) e quantas linhas o App calculou; **Ver as linhas do App no Guia de Deck** abre a aba Combos do guia."),
          t("**Guia de Deck**: o resumo e os tópicos do guia escrito; **Abrir o Guia de Deck** vai direto ao deck (o voltar retorna para a Comunidade)."),
        ],
      },
      {
        titulo: t("Pontos e Rank"),
        itens: [
          t("**Compartilhar um combo vale 5 pontos** (Combo da Comunidade compartilhado com todos, criado por você)."),
          t("Os pontos são calculados pelo servidor a partir dos combos: tirar o compartilhamento ou excluir o combo tira os pontos dele, e salvar o mesmo combo de novo não soma outra vez."),
          t("O **Rank** lista os duelistas com mais pontos e mostra os seus pontos e a sua posição (com login). O botão **Conquistas**, no topo, abre as suas conquistas."),
        ],
      },
    ],
    ligacoes: [t("Os combos vêm da aba Combos e do Teste de Jogo (Arquétipos vinculados); o guia, do Guia de Deck.")],
  },
  {
    id: "eventos",
    titulo: t("Eventos"),
    resumo: t("Resultados de torneio compartilhados pelos jogadores, com a decklist completa. Filtre por **TCG / OCG** e por **Meta, Conceito ou Local**, abra um resultado para ver as cartas e salve o deck em Meus decks."),
    topicos: [
      {
        titulo: t("Resultados"),
        itens: [t("Cada cartão mostra a arte da carta mais usada do deck, a categoria, o **nome do deck**, o **nome do jogador**, a colocação (ex.: 1º de ~32 jogadores), o evento e a data."), t("Abra um resultado para ver o Main, o Extra e o Side, as observações do jogador, **🔗 Copiar link** e **Salvar em Meus decks** (abre no Editor de Deck).")],
      },
      {
        titulo: t("Compartilhar resultado"),
        itens: [t("Com login: escolha um dos seus decks ou cole um link **ydke://** ou o conteúdo de um **.ydk**; informe o nome do jogador e o nome do deck."), t("Escolha o formato (**TCG** ou **OCG**) e a categoria: **Meta** (torneio competitivo), **Local** (resultado em torneio) ou **Conceito** (ideia de deck, sem torneio)."), t("Em Meta e Local, informe o **tipo de torneio** (os principais oficiais da Konami, como YCS, WCQ e Regional, ou **Torneio Local**), a **posição final** e **quantos jogadores**, aproximadamente, participaram."), t("Conceito e Local são publicados na hora. **Meta passa por uma avaliação antes de ser publicado**: até lá, só você e os administradores veem o resultado (com o selo Em avaliação)."), t("A banlist atual aparece só como aviso: o torneio pode ter usado outra lista. Quem enviou pode excluir o próprio resultado.")],
      },
      {
        titulo: t("Análise de resultados (administradores)"),
        itens: [t("Só para administradores: **Aguardando análise** lista os resultados Meta enviados; **Aprovar e publicar** coloca o resultado na lista, **Recusar** (com motivo opcional) tira da lista, e o autor vê o motivo. **Já analisados** permite mudar a decisão.")],
      },
    ],
    ligacoes: [t("O deck vem do **Editor de Deck** (Meus decks) ou de uma deck list importada; **Salvar em Meus decks** leva o deck de volta ao Editor.")],
  },
  {
    id: "conquistas",
    titulo: t("Conquistas"),
    resumo: t("Conquistas desbloqueáveis, como os troféus do PS5 e as conquistas da Steam: cada uma tem um ícone (a arte de uma carta), uma descrição e um nível. Abra pelo botão **Conquistas** no Rank, pela Visão Geral da conta ou tocando no aviso de desbloqueio."),
    imagem: { arquivo: "conquistas.jpg", legenda: t("Conquistas com duas desbloqueadas") },
    topicos: [
      {
        titulo: t("Como funcionam"),
        itens: [
          t("No topo, quantas você já tem e a porcentagem. As bloqueadas aparecem apagadas, com cadeado; as obtidas mostram a data."),
          t("Ao desbloquear, aparece um aviso no alto da tela (em qualquer tela); toque nele para abrir as Conquistas."),
          t("Cada conquista tem um nível (**Bronze**, **Prata**, **Ouro** ou **Platina**) e, com o servidor ativo, a **raridade**: quantos % dos duelistas com conta já a obtiveram."),
          t("Sem login, as conquistas ficam neste aparelho; ao entrar, vão para a sua conta, e as da conta aparecem aqui. Quem já tinha compartilhado combos ou salvo decks na conta já começa com essas conquistas."),
        ],
      },
      {
        titulo: t("As conquistas"),
        itens: [
          t("**Compartilhar**: obtida após compartilhar o primeiro combo (Combo da Comunidade compartilhado com todos)."),
          t("**Entrando na Comunidade**: obtida após entrar na aba Comunidade e acessar qualquer arquétipo."),
          t("**Meu Primeiro Deck**: obtida após salvar o primeiro deck (Salvar, Salvar como ou Importar deck list no Editor de Deck)."),
        ],
      },
    ],
    ligacoes: [t("As conquistas vêm da aba Combos e do Teste de Jogo (compartilhar), da Comunidade e do Editor de Deck.")],
  },
  {
    id: "conta",
    titulo: t("Conta e IAs"),
    resumo: t("Entre na sua conta para salvar tudo na nuvem e cadastre as IAs que o app usa (Combo Search e leitura de vídeos)."),
    imagem: { arquivo: "conta.jpg", legenda: t("Minha conta: um botão para cada IA") },
    topicos: [
      {
        titulo: t("Conta"),
        itens: [
          t("**Entrar** com e-mail e senha. **Esqueci a senha** envia um link; ao abri-lo, o app pede a senha nova."),
          t("**Criar conta**: nome de usuário (3 a 20 letras minúsculas, números ou _; aparece como autor e no Rank), e-mail, senha de 8+ caracteres e o aceite da Política de Privacidade e dos Termos de Uso. Se o servidor pedir, confirme pelo link enviado ao e-mail antes de entrar."),
          t("Logado, a tela fica maior e tem duas abas. **Visão Geral**: dados da conta (usuário, e-mail, nível, membro desde, coleção e Lista de Desejos), os seus **pontos** e a posição, o **ranking geral** (os 5 primeiros, com você destacado), as **contribuições** (combos compartilhados, combos só seus, combos no aparelho e artigos) e as **conquistas** (os ícones e quantas você já tem). **Opções**: as IAs e, para o administrador, usuários, recálculos e camada."),
          t("Com login, ficam salvos: decks, coleção, combos que você cria e, se quiser, as IAs."),
        ],
      },
      {
        titulo: t("Níveis de usuário"),
        itens: [
          t("**Usuário Padrão**: usa o app todo, menos o **Teste Avançado**; os combos que cria ficam **só no aparelho** (podem ser exportados depois)."),
          t("**Usuário Avançado** e **Usuário Mentor**: todos os recursos, inclusive o Teste Avançado e os combos na base (com Compartilhar)."),
          t("O seu nível aparece ao lado do seu e-mail. Só o administrador muda o nível, em **Usuários cadastrados** (lista com e-mail, data de cadastro e último acesso)."),
        ],
      },
      {
        titulo: t("IAs"),
        itens: [
          t("Cada IA tem um botão. Dentro: **para que serve no app**, um **tutorial** do cadastro (onde criar a chave), o custo e os campos."),
          t("**Claude**: o melhor resultado no Combo Search, com pesquisa na web. **Gemini**: Combo Search e o único que **lê vídeos do YouTube**. **Ollama/LM Studio**: IA no seu computador, sem custo."),
          t("**Usar no Combo Search** escolhe qual IA a busca usa. **Guardar esta IA na minha conta** leva a chave para os seus outros computadores."),
          t("As chaves são suas: os custos ficam na sua conta do provedor."),
        ],
      },
    ],
  },
  {
    id: "ligacoes",
    titulo: t("Como as telas se ligam"),
    resumo: t("Os caminhos mais úteis entre as telas, do começo ao fim."),
    topicos: [
      {
        titulo: t("Da carta ao combo publicado"),
        itens: [
          t("**Buscar Carta** → painel da carta → **Combos** (a carta já vai para a mão inicial)."),
          t("**Combos** → linha → **▶ Teste de Jogo** (deck temporário) → **Executar combo**."),
          t("**Teste de Jogo** → refaça ou melhore → **Criar combo** → **Compartilhar**."),
          t("**Combos** → **Combos da Comunidade**: o seu combo aparece com o seu nome e a data."),
        ],
      },
      {
        titulo: t("Da coleção ao deck"),
        itens: [
          t("**Minha Coleção** → cadastre ou importe (MYP Cards)."),
          t("**Editor de Deck** → estoque **Listar todas as cartas** → veja o que falta (cópias escurecidas)."),
          t("Ou **Listar apenas cartas que possuo** → monte só com o que você tem."),
        ],
      },
      {
        titulo: t("Do vídeo ao combo"),
        itens: [t("**Combos → Vídeo** → **Ler combo do vídeo** → **✎ Editar e Importar** → Teste de Jogo → **Criar combo**.")],
      },
      {
        titulo: t("Do meta ao treino"),
        itens: [t("**Guia de Deck** → deck do topo → **Interações** (o que o para) → **Combos** → **▶ Teste de Jogo** para treinar contra ele.")],
      },
      {
        titulo: t("Do meta ao Side"),
        itens: [
          t("**Meta Call** → decks esperados → sugestão de **Main** e **Side** → **Editor de Deck** → **▶ Teste Avançado** com essas hand traps na mão do oponente."),
        ],
      },
      {
        titulo: t("Do arquivo ao teste"),
        itens: ["**Editor de Deck** → **Importar deck list** (.ydk ou ydke://) → **▶ Teste de Jogo** → veja as probabilidades da mão."],
      },
    ],
  },
  {
    id: "glossario",
    titulo: t("Glossário"),
    resumo: t("Termos que aparecem no app."),
    topicos: [
      {
        titulo: t("Classificação das cartas"),
        itens: [
          t("**Hand trap (HT)**: carta ativada da mão no turno do oponente para interromper o combo (ex.: Ash Blossom, Effect Veiler)."),
          t("**Starter (ST)**: carta que começa um combo sozinha (ex.: Centur-Ion Trudea)."),
          t("**Extender (EX)**: carta que dá mais jogadas depois que o combo começou."),
          t("**Board breaker (BB)**: carta que desmonta o campo do oponente."),
          t("**Floodgate (FG)**: carta que trava ações dos dois jogadores enquanto está no campo."),
          t("**Staple (SP)**: carta genérica usada em muitos decks."),
        ],
      },
      {
        titulo: t("Banlist e formatos"),
        itens: [
          t("**Proibida**: 0 cópias. **Limitada**: 1. **Semi-Limitada**: 2. As demais: até 3."),
          t("**Não lançada**: a carta ainda não saiu naquele formato (TCG ou OCG)."),
          t("**Válido no TCG/OCG**: todas as cartas do combo, nas cópias usadas, são permitidas pela banlist atual."),
        ],
      },
      {
        titulo: t("Do app"),
        itens: [
          t("**Calculado com o App**: combo jogado pelo motor de regras do EDOPro, com as regras oficiais das cartas."),
          t("**Combo da Comunidade**: combo criado por um usuário (no Teste de Jogo ou salvo de uma sugestão); não é conferido previamente."),
          t("**Sugestão de IA**: combo sugerido pela IA; confira antes de usar."),
          t("**Deck temporário**: deck criado para testar um combo (\"<arquétipo> Temporário\"), sem mínimo de 40 cartas."),
          t("**Indicações de resposta**: no Teste Avançado, as cartas que podem responder a cada ação, pelas regras escritas a partir do texto das cartas, pelo motor de regras e pelo uso em torneios."),
          t("**Combos neste aparelho**: combos de Usuário Padrão, guardados só no computador ou navegador; **Exportar** os leva para a base."),
        ],
      },
    ],
  },
];
