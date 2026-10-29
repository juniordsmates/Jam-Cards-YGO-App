// Guia de Deck: textos escritos para os arquétipos do topo do meta do TCG (Ideias Iniciais e
// Avançadas), em português, inglês e espanhol. O resto do guia (núcleo do deck, listas campeãs,
// combos e interações) é calculado a partir dos dados da camada (metaTcg, combos, respondedores).
//
// [[Nome da carta em inglês]] vira o nome da carta no idioma escolhido, com prévia ao passar o mouse.
// Os textos foram escritos a partir do texto oficial das cartas e dos decklists de torneio
// (núcleo do deck); afirmações de regra (o que cada hand trap responde) ficam na aba Interações,
// que vem do motor de regras. Revise ao mudar a banlist ou ao sair uma carta nova do arquétipo.

export type Idioma = "pt" | "en" | "es";

export interface BlocoGuia {
  titulo: string;
  itens: string[];
}

export interface TextoGuia {
  resumo: string;
  iniciais: BlocoGuia[];
  avancadas: BlocoGuia[];
}

export interface GuiaEscrito {
  arquetipo: string;
  /** mês da revisão do texto (o núcleo e as interações se atualizam sozinhos) */
  revisado: string;
  textos: Record<Idioma, TextoGuia>;
}

export const GUIAS_ESCRITOS: GuiaEscrito[] = [
  // ------------------------------------------------------------------ Kewl Tune
  {
    arquetipo: "Kewl Tune",
    revisado: "2026-10",
    textos: {
      pt: {
        resumo:
          "Deck de Sincro feito só de Reguladores. Os monstros \"Kewl Tune\" buscam uns aos outros, a Mágica Rápida [[Kewl Tune Synchro]] faz Invocação-Sincro até no turno do oponente e cada monstro, ao virar Matéria Sincro, gera uma interrupção (destruir, devolver, banir).",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "Quase todo o deck é Regulador. Os monstros \"Kewl Tune\" no campo podem usar **1 Regulador da mão** como uma das matérias Sincro: dá para Sincronizar com uma carta só no campo.",
              "Muitos efeitos deixam você só Invocar por Invocação-Especial **Reguladores** pelo resto do turno. Por isso o Extra Deck é quase todo de Sincro Reguladores: [[Kewl Tune Track Maker]], [[Kewl Tune Remix]], [[Kewl Tune RS]], [[Kewl Tune Loudness War]], [[Kewl Tune B2B]], [[Kewl Tune Crackle]] e [[Visas Amritara]].",
              "Cada monstro, ao ser enviado ao Cemitério como Matéria Sincro, ativa um efeito: [[Kewl Tune Reco]] destrói 1 Mágica/Armadilha, [[Kewl Tune Mix]] destrói 1 monstro, [[Kewl Tune Clip]] bane 1 carta aleatória virada para baixo do Extra Deck do oponente, [[Kewl Tune Rotary]] devolve 1 carta do Cemitério do oponente ao Deck (ou olha a mão dele) e [[Kewl Tune Cue]] escava 2 cartas do topo do Deck do oponente e bane 1.",
            ],
          },
          {
            titulo: "Cartas que você quer abrir",
            itens: [
              "[[Kewl Tune Cue]]: com a Invocação-Normal, Invoca por Invocação-Especial 1 Regulador da mão, do Deck ou do Cemitério. É o starter mais simples.",
              "[[Kewl Tune Reco]] e [[Kewl Tune Mix]]: ao serem Invocados, buscam 1 monstro \"Kewl Tune\" de outro Nível. Um puxa o outro.",
              "[[Kewl Tune Synchro]]: busca qualquer carta \"Kewl Tune\" e, logo depois, deixa você fazer uma Invocação-Sincro de Sincro Regulador. Você pode ativar até 2 por turno.",
              "[[JJ \"Kewl Tune\"]] (Campo): dá uma Invocação-Normal extra de Regulador e, oferecendo 1 Regulador como Tributo, busca ou Invoca 1 monstro \"Kewl Tune\" do Deck.",
              "[[Synchro Overtake]]: revela um Sincro do Extra Deck e busca ou Invoca do Deck/Cemitério uma matéria citada nele (ex.: [[Kewl Tune Mix]] para o [[Kewl Tune Remix]]).",
            ],
          },
          {
            titulo: "Boas práticas",
            itens: [
              "Guarde uma [[Kewl Tune Synchro]] para o turno do oponente: por ser Mágica Rápida, ela busca e Sincroniza no turno dele, virando uma interrupção.",
              "[[Kewl Tune Track Maker]] busca uma carta \"Kewl Tune\" ao ser Invocado; como Matéria Sincro, devolve 1 carta do oponente à mão. Ele é uma peça de meio de combo e de interrupção ao mesmo tempo.",
              "Encha o Cemitério de monstros \"Kewl Tune\": o [[Kewl Tune Loudness War]] bane um deles quando o oponente ativa algo e aplica o efeito de \"Matéria Sincro\" dele. Cada monstro no Cemitério é uma resposta guardada.",
              "Conte as Invocações-Normais: [[Kewl Tune Cue]] usa a sua; o [[JJ \"Kewl Tune\"]] dá outra só para Regulador; o [[Kewl Tune Rotary]] pode revelar-se com outro Regulador para Invocar-Normal um Regulador na hora.",
              "O deck usa muitas hand traps no Main (quase todas as listas têm 3 [[Ash Blossom & Joyous Spring]], 3 [[Effect Veiler]] e [[Ghost Belle & Haunted Mansion]]): no segundo turno, use-as no starter do oponente e jogue a sua parte no seu turno.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "As linhas calculadas pelo app (aba **Combos**) mostram, passo a passo, o que cada mão de 1 carta alcança, jogadas com as regras oficiais das cartas.",
              "Esqueleto comum: starter (ex.: [[Kewl Tune Cue]]) → busca de outro \"Kewl Tune\" → Sincro de [[Kewl Tune Track Maker]] (que busca de novo) → Sincro dos Reguladores de Nível 5 e 6 ([[Kewl Tune Remix]], [[Kewl Tune RS]], [[Kewl Tune Loudness War]]) → termina com interrupções e cartas no Cemitério para o [[Kewl Tune Loudness War]].",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "O campo final e as interrupções",
            itens: [
              "[[Kewl Tune Loudness War]]: deixa os outros Reguladores sem poder ser destruídos por efeitos nem alvejados pelo oponente e, quando ele ativa algo, aplica o efeito de \"Matéria Sincro\" de um \"Kewl Tune\" banido do seu Cemitério.",
              "[[Kewl Tune RS]]: na Main Phase (Efeito Rápido), bane 1 Regulador do Cemitério para negar os efeitos de 1 carta virada para cima do oponente até o fim do turno.",
              "[[Kewl Tune B2B]] (Nível 10): quando o oponente ativa um efeito de monstro, traz de volta 1 Regulador do Cemitério ou banido e Sincroniza de novo, até 2 vezes por turno.",
              "[[Kewl Tune Remix]]: no turno do oponente, oferece-se como Tributo para pegar 2 Reguladores não Sincro do Cemitério (1 para a mão, 1 para o campo) e Sincronizar na hora.",
            ],
          },
          {
            titulo: "Jogando através das hand traps",
            itens: [
              "Comece pelas cartas que o oponente mais quer parar e que você pode repetir (você pode ativar 2 [[Kewl Tune Synchro]] por turno). Veja na aba **Interações** quais respostas cada passo aceita.",
              "O efeito de revelar do [[Kewl Tune Rotary]] acontece na mão: use-o como extensor depois que o oponente gastar uma negação em monstro no campo.",
              "Contra [[Droll & Lock Bird]], priorize a busca que monta o resto (normalmente a que leva ao [[Kewl Tune Track Maker]]).",
            ],
          },
          {
            titulo: "Indo para o ataque (segundo turno)",
            itens: [
              "Os efeitos de \"Matéria Sincro\" são a sua remoção: [[Kewl Tune Mix]] destrói monstro, [[Kewl Tune Reco]] destrói Mágica/Armadilha, [[Kewl Tune Clip]] tira cartas do Extra Deck do oponente e o [[Kewl Tune Track Maker]] devolve uma carta à mão.",
              "[[Kewl Tune Clip]] pode Invocar-se da mão na Main Phase do oponente e Sincronizar na hora: é uma jogada no turno dele.",
              "No Side, as listas trazem [[Harpie's Feather Duster]] e [[Lightning Storm]] contra campos com Armadilhas, e mais hand traps ([[Mulcharmy Fuwalos]], [[Mulcharmy Purulia]], [[Droll & Lock Bird]]).",
            ],
          },
        ],
      },
      en: {
        resumo:
          "A Synchro deck made only of Tuners. \"Kewl Tune\" monsters search each other, the Quick-Play [[Kewl Tune Synchro]] Synchro Summons even on your opponent's turn, and every monster becomes an interruption (destroy, bounce, banish) when it is used as Synchro Material.",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "Almost the whole deck is Tuners. \"Kewl Tune\" monsters on the field can use **1 Tuner in your hand** as one of the Synchro Materials, so a single card on the field is enough to Synchro.",
              "Many effects lock you into Special Summoning only **Tuners** for the rest of the turn. That is why the Extra Deck is mostly Synchro Tuners: [[Kewl Tune Track Maker]], [[Kewl Tune Remix]], [[Kewl Tune RS]], [[Kewl Tune Loudness War]], [[Kewl Tune B2B]], [[Kewl Tune Crackle]] and [[Visas Amritara]].",
              "Each monster triggers when sent to the GY as Synchro Material: [[Kewl Tune Reco]] destroys 1 Spell/Trap, [[Kewl Tune Mix]] destroys 1 monster, [[Kewl Tune Clip]] banishes 1 random face-down card from your opponent's Extra Deck, [[Kewl Tune Rotary]] returns 1 card from their GY to the Deck (or looks at their hand), and [[Kewl Tune Cue]] excavates 2 cards from the top of their Deck and banishes 1.",
            ],
          },
          {
            titulo: "Cards you want to open",
            itens: [
              "[[Kewl Tune Cue]]: when Normal Summoned, Special Summons 1 Tuner from your hand, Deck or GY. The simplest starter.",
              "[[Kewl Tune Reco]] and [[Kewl Tune Mix]]: when Summoned, each searches 1 \"Kewl Tune\" monster of a different Level. One finds the other.",
              "[[Kewl Tune Synchro]]: searches any \"Kewl Tune\" card and then lets you Synchro Summon a Synchro Tuner. You can activate up to 2 per turn.",
              "[[JJ \"Kewl Tune\"]] (Field): an extra Normal Summon for a Tuner and, by Tributing 1 Tuner, adds or Special Summons 1 \"Kewl Tune\" monster from the Deck.",
              "[[Synchro Overtake]]: reveal a Synchro in the Extra Deck and add or Special Summon one of its listed materials from the Deck/GY (e.g., [[Kewl Tune Mix]] for [[Kewl Tune Remix]]).",
            ],
          },
          {
            titulo: "Good habits",
            itens: [
              "Keep a [[Kewl Tune Synchro]] for your opponent's turn: as a Quick-Play it searches and Synchro Summons during their turn, becoming an interruption.",
              "[[Kewl Tune Track Maker]] searches a \"Kewl Tune\" card when Summoned and, as Synchro Material, returns 1 opponent's card to the hand: it is a combo piece and an interruption at once.",
              "Fill your GY with \"Kewl Tune\" monsters: [[Kewl Tune Loudness War]] banishes one of them when your opponent activates something and applies its \"Synchro Material\" effect. Every monster in the GY is a stored answer.",
              "Count your Normal Summons: [[Kewl Tune Cue]] uses yours; [[JJ \"Kewl Tune\"]] grants an extra one for Tuners; [[Kewl Tune Rotary]] can be revealed with another Tuner to Normal Summon a Tuner immediately.",
              "The deck runs many hand traps in the Main Deck (almost every list has 3 [[Ash Blossom & Joyous Spring]], 3 [[Effect Veiler]] and [[Ghost Belle & Haunted Mansion]]): going second, use them on your opponent's starter and play your own turn afterwards.",
            ],
          },
          {
            titulo: "Basic combos",
            itens: [
              "The lines calculated by the app (**Combos** tab) show, step by step, what each 1-card hand reaches, played with the official card rules.",
              "Common skeleton: starter (e.g., [[Kewl Tune Cue]]) → search another \"Kewl Tune\" → Synchro [[Kewl Tune Track Maker]] (which searches again) → Synchro the Level 5 and 6 Tuners ([[Kewl Tune Remix]], [[Kewl Tune RS]], [[Kewl Tune Loudness War]]) → end with interruptions and cards in the GY for [[Kewl Tune Loudness War]].",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "End board and interruptions",
            itens: [
              "[[Kewl Tune Loudness War]]: your other Tuners cannot be destroyed by effects or targeted by your opponent, and when they activate something it applies the \"Synchro Material\" effect of a \"Kewl Tune\" banished from your GY.",
              "[[Kewl Tune RS]]: during the Main Phase (Quick Effect), banish 1 Tuner from your GY to negate 1 face-up opponent's card until the end of the turn.",
              "[[Kewl Tune B2B]] (Level 10): when your opponent activates a monster effect, it brings back 1 Tuner from the GY or banishment and Synchro Summons again, up to twice per turn.",
              "[[Kewl Tune Remix]]: on your opponent's turn, Tribute it to take 2 non-Synchro Tuners from your GY (1 to the hand, 1 to the field) and Synchro immediately.",
            ],
          },
          {
            titulo: "Playing through hand traps",
            itens: [
              "Start with the cards your opponent most wants to stop and that you can repeat (you can activate 2 [[Kewl Tune Synchro]] per turn). The **Interactions** tab shows which answers each step accepts.",
              "[[Kewl Tune Rotary]]'s reveal effect happens in the hand: use it as an extender after your opponent spends a negation on a monster on the field.",
              "Against [[Droll & Lock Bird]], prioritize the search that builds the rest (usually the one leading to [[Kewl Tune Track Maker]]).",
            ],
          },
          {
            titulo: "Going second",
            itens: [
              "The \"Synchro Material\" effects are your removal: [[Kewl Tune Mix]] destroys a monster, [[Kewl Tune Reco]] destroys a Spell/Trap, [[Kewl Tune Clip]] strips the opponent's Extra Deck and [[Kewl Tune Track Maker]] bounces a card.",
              "[[Kewl Tune Clip]] can Special Summon itself from the hand during your opponent's Main Phase and Synchro right away: a play on their turn.",
              "Side Deck lists bring [[Harpie's Feather Duster]] and [[Lightning Storm]] against Trap-heavy boards, plus more hand traps ([[Mulcharmy Fuwalos]], [[Mulcharmy Purulia]], [[Droll & Lock Bird]]).",
            ],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Sincronía formado solo por Cantantes. Los monstruos \"Kewl Tune\" se buscan entre sí, la Mágica de Juego Rápido [[Kewl Tune Synchro]] hace Invocaciones por Sincronía incluso en el turno del rival y cada monstruo, al usarse como Material de Sincronía, genera una interrupción (destruir, devolver, desterrar).",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "Casi todo el deck son Cantantes. Los monstruos \"Kewl Tune\" en el campo pueden usar **1 Cantante de tu mano** como uno de los Materiales de Sincronía: basta una carta en el campo para Sincronizar.",
              "Muchos efectos te obligan a Invocar de Modo Especial solo **Cantantes** el resto del turno. Por eso el Deck Extra es casi todo de Cantantes de Sincronía: [[Kewl Tune Track Maker]], [[Kewl Tune Remix]], [[Kewl Tune RS]], [[Kewl Tune Loudness War]], [[Kewl Tune B2B]], [[Kewl Tune Crackle]] y [[Visas Amritara]].",
              "Cada monstruo se activa al ser enviado al Cementerio como Material de Sincronía: [[Kewl Tune Reco]] destruye 1 Mágica/Trampa, [[Kewl Tune Mix]] destruye 1 monstruo, [[Kewl Tune Clip]] destierra 1 carta aleatoria boca abajo del Deck Extra rival, [[Kewl Tune Rotary]] devuelve 1 carta de su Cementerio al Deck (o mira su mano) y [[Kewl Tune Cue]] excava 2 cartas de su Deck y destierra 1.",
            ],
          },
          {
            titulo: "Cartas que quieres robar",
            itens: [
              "[[Kewl Tune Cue]]: al ser Invocado de Modo Normal, Invoca de Modo Especial 1 Cantante de tu mano, Deck o Cementerio. El iniciador más simple.",
              "[[Kewl Tune Reco]] y [[Kewl Tune Mix]]: al ser Invocados, cada uno busca 1 monstruo \"Kewl Tune\" de otro Nivel. Uno encuentra al otro.",
              "[[Kewl Tune Synchro]]: busca cualquier carta \"Kewl Tune\" y luego te deja Invocar por Sincronía un Cantante de Sincronía. Puedes activar hasta 2 por turno.",
              "[[JJ \"Kewl Tune\"]] (Campo): una Invocación Normal extra de Cantante y, Sacrificando 1 Cantante, añade o Invoca 1 monstruo \"Kewl Tune\" del Deck.",
              "[[Synchro Overtake]]: revela una Sincronía del Deck Extra y añade o Invoca del Deck/Cementerio uno de sus materiales (p. ej., [[Kewl Tune Mix]] para [[Kewl Tune Remix]]).",
            ],
          },
          {
            titulo: "Buenas prácticas",
            itens: [
              "Guarda una [[Kewl Tune Synchro]] para el turno del rival: al ser de Juego Rápido busca y Sincroniza en su turno, como interrupción.",
              "[[Kewl Tune Track Maker]] busca una carta \"Kewl Tune\" al ser Invocado y, como Material de Sincronía, devuelve 1 carta rival a la mano: es pieza de combo e interrupción a la vez.",
              "Llena tu Cementerio de monstruos \"Kewl Tune\": [[Kewl Tune Loudness War]] destierra uno cuando el rival activa algo y aplica su efecto de \"Material de Sincronía\". Cada monstruo en el Cementerio es una respuesta guardada.",
              "Cuenta tus Invocaciones Normales: [[Kewl Tune Cue]] usa la tuya; [[JJ \"Kewl Tune\"]] da otra solo para Cantantes; [[Kewl Tune Rotary]] puede revelarse con otro Cantante para Invocar de Modo Normal un Cantante al momento.",
              "El deck juega muchas hand traps en el Main (casi todas las listas tienen 3 [[Ash Blossom & Joyous Spring]], 3 [[Effect Veiler]] y [[Ghost Belle & Haunted Mansion]]): yendo segundo, úsalas en el iniciador del rival y juega tu turno después.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "Las líneas calculadas por la app (pestaña **Combos**) muestran paso a paso lo que alcanza cada mano de 1 carta, jugadas con las reglas oficiales.",
              "Esqueleto común: iniciador (p. ej., [[Kewl Tune Cue]]) → buscar otro \"Kewl Tune\" → Sincronía de [[Kewl Tune Track Maker]] (que vuelve a buscar) → Sincronía de los Cantantes de Nivel 5 y 6 ([[Kewl Tune Remix]], [[Kewl Tune RS]], [[Kewl Tune Loudness War]]) → terminar con interrupciones y cartas en el Cementerio para [[Kewl Tune Loudness War]].",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Campo final e interrupciones",
            itens: [
              "[[Kewl Tune Loudness War]]: tus otros Cantantes no pueden ser destruidos por efectos ni seleccionados por el rival y, cuando él activa algo, aplica el efecto de \"Material de Sincronía\" de un \"Kewl Tune\" desterrado de tu Cementerio.",
              "[[Kewl Tune RS]]: en la Main Phase (Efecto Rápido), destierra 1 Cantante de tu Cementerio para negar 1 carta boca arriba del rival hasta el final del turno.",
              "[[Kewl Tune B2B]] (Nivel 10): cuando el rival activa un efecto de monstruo, recupera 1 Cantante del Cementerio o desterrado y vuelve a Sincronizar, hasta 2 veces por turno.",
              "[[Kewl Tune Remix]]: en el turno rival, se Sacrifica para tomar 2 Cantantes que no sean de Sincronía de tu Cementerio (1 a la mano, 1 al campo) y Sincronizar al momento.",
            ],
          },
          {
            titulo: "Jugar a través de las hand traps",
            itens: [
              "Empieza por lo que el rival más quiere parar y que tú puedes repetir (puedes activar 2 [[Kewl Tune Synchro]] por turno). La pestaña **Interacciones** muestra qué respuestas acepta cada paso.",
              "El efecto de revelar de [[Kewl Tune Rotary]] ocurre en la mano: úsalo como extensor después de que el rival gaste una negación en un monstruo del campo.",
              "Contra [[Droll & Lock Bird]], prioriza la búsqueda que arma el resto (normalmente la que lleva a [[Kewl Tune Track Maker]]).",
            ],
          },
          {
            titulo: "Yendo segundo",
            itens: [
              "Los efectos de \"Material de Sincronía\" son tu remoción: [[Kewl Tune Mix]] destruye monstruos, [[Kewl Tune Reco]] destruye Mágicas/Trampas, [[Kewl Tune Clip]] vacía el Deck Extra rival y [[Kewl Tune Track Maker]] devuelve una carta a la mano.",
              "[[Kewl Tune Clip]] puede Invocarse de su mano en la Main Phase del rival y Sincronizar al momento: una jugada en su turno.",
              "En el Side, las listas llevan [[Harpie's Feather Duster]] y [[Lightning Storm]] contra campos con Trampas, y más hand traps ([[Mulcharmy Fuwalos]], [[Mulcharmy Purulia]], [[Droll & Lock Bird]]).",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Elfnote
  {
    arquetipo: "Elfnote",
    revisado: "2026-10",
    textos: {
      pt: {
        resumo:
          "Deck de Feiticeiros de Nível 6 que disputam a **Zona de Monstros Principal do centro**: eles se Invocam sozinhos para lá, cada um faz algo na sua Main Phase e, no turno do oponente, trocam de lugar com o monstro do centro para interromper. O motor \"Power Patron\" e os Sincros completam o campo.",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "[[Elfnote Lucina]], [[Elfnote Fortuna]] e [[Elfnote Tinia]] se Invocam por Invocação-Especial da mão para a **zona do centro** (1 vez por turno cada). Na sua Main Phase: Lucina busca um monstro \"Elfnote\", Fortuna coloca uma Armadilha Contínua \"Elfnote\" e Tinia coloca uma Mágica Contínua \"Elfnote\".",
              "No turno do oponente (Efeito Rápido), cada um troca de lugar com o monstro do centro e interrompe: Lucina devolve 1 monstro de Nível 6 ou menor à mão, Fortuna devolve 1 Mágica/Armadilha virada para cima e Tinia bane 1 carta aleatória da mão do oponente até a End Phase.",
              "[[Elfnote Regina]] (Efeito Rápido, da mão): envia outra carta \"Elfnote\" da mão ou do campo para se Invocar; se chegar ao centro, Invoca outro \"Elfnote\" do Deck. Como Matéria Sincro, volta para a mão.",
              "[[Elfnote Power Patron]] (Regulador Nível 1): na Main Phase (Efeito Rápido), aumenta em 3 o Nível do monstro do centro e Sincroniza um Sincro \"Elfnote\" ou [[Junora the Power Patron of Tuning]]. Como Matéria Sincro, busca uma carta \"Elfnote\". Com ele em campo, você só Invoca Sincros do Extra Deck.",
            ],
          },
          {
            titulo: "Cartas que você quer abrir",
            itens: [
              "[[Elfnote Lucina]]: se Invoca sozinha para o centro e busca outro \"Elfnote\". O starter mais direto.",
              "[[Elfnote Regina]]: com outra carta \"Elfnote\", vira dois monstros (ela e um do Deck).",
              "[[Medius the Pure]]: busca ou Invoca um monstro \"Power Patron\" do Deck (inclusive o [[Elfnote Power Patron]]).",
              "[[Prohibited Power Patron Portal - Terminus]]: envia um \"Power Patron\" do Deck/Extra Deck ao Cemitério e busca um monstro Fada TREVAS (ex.: [[Medius the Pure]]).",
              "[[Elfnotes: Welcome Home]] (Mágica Contínua): o monstro do centro não pode ser destruído por efeitos, e você envia 1 monstro para Invocar do Deck um \"Elfnote\" de outro Atributo.",
            ],
          },
          {
            titulo: "Boas práticas",
            itens: [
              "A zona do centro é uma só: decida quem fica lá ao fim do turno. Os efeitos de troca do turno do oponente funcionam com os outros \"Elfnote\" nas zonas ao lado.",
              "Varie os Atributos: [[Elfnotes: Welcome Home]] e [[Elfnotes: Rhapsodia of Madness]] Invocam um \"Elfnote\" de Atributo **diferente** do monstro enviado (Lucina é FOGO, Fortuna LUZ, Regina VENTO, Tinia ÁGUA).",
              "[[Elfnote Power Patron]] funciona na Main Phase de qualquer jogador: guarde-o para Sincronizar no turno do oponente.",
              "As listas têm muitas hand traps ([[Ash Blossom & Joyous Spring]], [[Mulcharmy Fuwalos]], [[Droll & Lock Bird]], [[Ghost Belle & Haunted Mansion]]): o deck joga bem tanto primeiro quanto segundo.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "A aba **Combos** traz as linhas calculadas pelo app com cada starter, passo a passo.",
              "Esqueleto comum: [[Elfnote Lucina]] no centro → busca [[Elfnote Regina]] → Regina se Invoca e traz outro \"Elfnote\" do Deck → [[Elfnote Power Patron]] (do [[Medius the Pure]]) aumenta o Nível do centro → Sincro de [[Elfnote Seraphim Strelitzia]] ou [[Junora the Power Patron of Tuning]].",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Os Sincros e o que cada um resolve",
            itens: [
              "[[Elfnote Seraphim Strelitzia]] (Nível 7): no centro tem 3000 de ATK; na Main Phase (Efeito Rápido) Invoca um \"Elfnote\" de Nível 6 ou menor da mão/Cemitério e reduz em 3 os Níveis dos monstros de Nível 4+ (abre Sincros novos).",
              "[[Junora the Power Patron of Tuning]] (Nível 10): pode tratar o monstro do centro como Regulador; ao ser Invocada por Sincro, nega os efeitos de todas as cartas viradas para cima do oponente. É a principal jogada indo para o ataque.",
              "[[Elfnote June Pride]] (Nível 10): no centro, só monstros de zonas centrais atacam; ela volta ao Extra Deck para Invocar até 1 \"Elfnote\" da mão, do Deck e do Cemitério.",
              "Os Sincros genéricos das listas ([[Crystal Wing Synchro Dragon]], [[F.A. Dawn Dragster]], [[Chaos Angel]], [[Black Rose Dragon]]) cobrem negação de monstro, de Mágica/Armadilha, remoção e limpeza de campo.",
            ],
          },
          {
            titulo: "Jogando através das hand traps",
            itens: [
              "As buscas e Invocações do Deck ([[Elfnote Lucina]], [[Elfnote Regina]], [[Medius the Pure]], [[Prohibited Power Patron Portal - Terminus]]) são os alvos naturais do oponente. A aba **Interações** mostra, passo a passo, o que cada uma aceita.",
              "Começar por [[Prohibited Power Patron Portal - Terminus]] ou [[Medius the Pure]] tende a atrair a primeira resposta antes do motor \"Elfnote\".",
              "As Contínuas ([[Elfnotes: Welcome Home]], [[Elfnotes: Rhapsodia of Madness]]) dão jogadas extras de Invocação a cada turno: elas mantêm o deck jogando mesmo depois de uma interrupção.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["As listas usam [[Solemn Judgment]], [[Harpie's Feather Duster]], [[Triple Tactics Talent]], [[Nibiru, the Primal Being]] e hand traps extras ([[Mulcharmy Purulia]], [[Ghost Ogre & Snow Rabbit]])."],
          },
        ],
      },
      en: {
        resumo:
          "A deck of Level 6 Spellcasters fighting for the **center Main Monster Zone**: they Summon themselves there, each does something during your Main Phase, and on your opponent's turn they switch places with the center monster to interrupt. The \"Power Patron\" engine and Synchros complete the board.",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "[[Elfnote Lucina]], [[Elfnote Fortuna]] and [[Elfnote Tinia]] Special Summon themselves from the hand to the **center zone** (once per turn each). During your Main Phase: Lucina searches an \"Elfnote\" monster, Fortuna places an \"Elfnote\" Continuous Trap and Tinia places an \"Elfnote\" Continuous Spell.",
              "On your opponent's turn (Quick Effect), each switches places with the center monster and interrupts: Lucina bounces 1 Level 6 or lower monster, Fortuna bounces 1 face-up Spell/Trap and Tinia banishes 1 random card from your opponent's hand until the End Phase.",
              "[[Elfnote Regina]] (Quick Effect, from the hand): send another \"Elfnote\" card from your hand or field to Summon it; if it lands in the center, it Summons another \"Elfnote\" from the Deck. As Synchro Material, it returns to the hand.",
              "[[Elfnote Power Patron]] (Level 1 Tuner): during the Main Phase (Quick Effect), raise the center monster's Level by 3 and Synchro Summon an \"Elfnote\" Synchro or [[Junora the Power Patron of Tuning]]. As Synchro Material, it searches an \"Elfnote\" card. While you control it, you can only Special Summon Synchros from the Extra Deck.",
            ],
          },
          {
            titulo: "Cards you want to open",
            itens: [
              "[[Elfnote Lucina]]: Summons itself to the center and searches another \"Elfnote\". The most direct starter.",
              "[[Elfnote Regina]]: with another \"Elfnote\" card, becomes two monsters (itself and one from the Deck).",
              "[[Medius the Pure]]: adds or Special Summons a \"Power Patron\" monster from the Deck (including [[Elfnote Power Patron]]).",
              "[[Prohibited Power Patron Portal - Terminus]]: sends a \"Power Patron\" from the Deck/Extra Deck to the GY and searches a DARK Fairy (e.g., [[Medius the Pure]]).",
              "[[Elfnotes: Welcome Home]] (Continuous Spell): the center monster cannot be destroyed by effects, and you send 1 monster to Summon an \"Elfnote\" of a different Attribute from the Deck.",
            ],
          },
          {
            titulo: "Good habits",
            itens: [
              "There is only one center zone: decide who stays there at the end of your turn. The switch effects on your opponent's turn work with the other \"Elfnote\" monsters in the side zones.",
              "Vary Attributes: [[Elfnotes: Welcome Home]] and [[Elfnotes: Rhapsodia of Madness]] Summon an \"Elfnote\" with a **different** Attribute from the monster sent (Lucina is FIRE, Fortuna LIGHT, Regina WIND, Tinia WATER).",
              "[[Elfnote Power Patron]] works during either player's Main Phase: keep it to Synchro on your opponent's turn.",
              "Lists run many hand traps ([[Ash Blossom & Joyous Spring]], [[Mulcharmy Fuwalos]], [[Droll & Lock Bird]], [[Ghost Belle & Haunted Mansion]]): the deck plays well going first or second.",
            ],
          },
          {
            titulo: "Basic combos",
            itens: [
              "The **Combos** tab has the app's calculated lines for each starter, step by step.",
              "Common skeleton: [[Elfnote Lucina]] in the center → search [[Elfnote Regina]] → Regina Summons itself and brings another \"Elfnote\" from the Deck → [[Elfnote Power Patron]] (from [[Medius the Pure]]) raises the center's Level → Synchro [[Elfnote Seraphim Strelitzia]] or [[Junora the Power Patron of Tuning]].",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "The Synchros and what each one solves",
            itens: [
              "[[Elfnote Seraphim Strelitzia]] (Level 7): 3000 ATK in the center; during the Main Phase (Quick Effect) it Summons a Level 6 or lower \"Elfnote\" from the hand/GY and lowers Level 4+ monsters by 3 (opening new Synchros).",
              "[[Junora the Power Patron of Tuning]] (Level 10): can treat the center monster as a Tuner; when Synchro Summoned, negates all face-up cards your opponent controls. The key play going second.",
              "[[Elfnote June Pride]] (Level 10): in the center, only center-zone monsters can attack; it returns to the Extra Deck to Summon up to 1 \"Elfnote\" each from the hand, Deck and GY.",
              "The generic Synchros in the lists ([[Crystal Wing Synchro Dragon]], [[F.A. Dawn Dragster]], [[Chaos Angel]], [[Black Rose Dragon]]) cover monster negation, Spell/Trap negation, removal and board wipes.",
            ],
          },
          {
            titulo: "Playing through hand traps",
            itens: [
              "Searches and Summons from the Deck ([[Elfnote Lucina]], [[Elfnote Regina]], [[Medius the Pure]], [[Prohibited Power Patron Portal - Terminus]]) are your opponent's natural targets. The **Interactions** tab shows, step by step, what each accepts.",
              "Opening with [[Prohibited Power Patron Portal - Terminus]] or [[Medius the Pure]] tends to draw the first answer before the \"Elfnote\" engine.",
              "The Continuous cards ([[Elfnotes: Welcome Home]], [[Elfnotes: Rhapsodia of Madness]]) give extra Summons every turn: they keep the deck playing after an interruption.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Lists side [[Solemn Judgment]], [[Harpie's Feather Duster]], [[Triple Tactics Talent]], [[Nibiru, the Primal Being]] and extra hand traps ([[Mulcharmy Purulia]], [[Ghost Ogre & Snow Rabbit]])."],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Lanzadores de Conjuros de Nivel 6 que pelean por la **Zona de Monstruos Principal del centro**: se Invocan solos allí, cada uno hace algo en tu Main Phase y, en el turno del rival, cambian de lugar con el monstruo del centro para interrumpir. El motor \"Power Patron\" y las Sincronías completan el campo.",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "[[Elfnote Lucina]], [[Elfnote Fortuna]] y [[Elfnote Tinia]] se Invocan de Modo Especial desde la mano a la **zona del centro** (1 vez por turno cada uno). En tu Main Phase: Lucina busca un monstruo \"Elfnote\", Fortuna coloca una Trampa Continua \"Elfnote\" y Tinia una Mágica Continua \"Elfnote\".",
              "En el turno rival (Efecto Rápido), cada uno cambia de lugar con el monstruo del centro e interrumpe: Lucina devuelve 1 monstruo de Nivel 6 o menor a la mano, Fortuna devuelve 1 Mágica/Trampa boca arriba y Tinia destierra 1 carta aleatoria de la mano rival hasta la End Phase.",
              "[[Elfnote Regina]] (Efecto Rápido, desde la mano): envía otra carta \"Elfnote\" de tu mano o campo para Invocarse; si llega al centro, Invoca otro \"Elfnote\" del Deck. Como Material de Sincronía, vuelve a la mano.",
              "[[Elfnote Power Patron]] (Cantante de Nivel 1): en la Main Phase (Efecto Rápido), sube 3 Niveles al monstruo del centro e Invoca por Sincronía una Sincronía \"Elfnote\" o [[Junora the Power Patron of Tuning]]. Como Material de Sincronía, busca una carta \"Elfnote\". Mientras lo controlas, solo Invocas Sincronías del Deck Extra.",
            ],
          },
          {
            titulo: "Cartas que quieres robar",
            itens: [
              "[[Elfnote Lucina]]: se Invoca sola al centro y busca otro \"Elfnote\". El iniciador más directo.",
              "[[Elfnote Regina]]: con otra carta \"Elfnote\", se vuelve dos monstruos (ella y uno del Deck).",
              "[[Medius the Pure]]: añade o Invoca un monstruo \"Power Patron\" del Deck (incluido [[Elfnote Power Patron]]).",
              "[[Prohibited Power Patron Portal - Terminus]]: envía un \"Power Patron\" del Deck/Deck Extra al Cementerio y busca un Hada OSCURIDAD (p. ej., [[Medius the Pure]]).",
              "[[Elfnotes: Welcome Home]] (Mágica Continua): el monstruo del centro no puede ser destruido por efectos, y envías 1 monstruo para Invocar del Deck un \"Elfnote\" de otro Atributo.",
            ],
          },
          {
            titulo: "Buenas prácticas",
            itens: [
              "Solo hay una zona central: decide quién se queda allí al final del turno. Los efectos de cambio en el turno rival funcionan con los otros \"Elfnote\" en las zonas laterales.",
              "Varía los Atributos: [[Elfnotes: Welcome Home]] y [[Elfnotes: Rhapsodia of Madness]] Invocan un \"Elfnote\" de Atributo **distinto** al del monstruo enviado (Lucina es FUEGO, Fortuna LUZ, Regina VIENTO, Tinia AGUA).",
              "[[Elfnote Power Patron]] funciona en la Main Phase de cualquier jugador: guárdalo para Sincronizar en el turno rival.",
              "Las listas juegan muchas hand traps ([[Ash Blossom & Joyous Spring]], [[Mulcharmy Fuwalos]], [[Droll & Lock Bird]], [[Ghost Belle & Haunted Mansion]]): el deck juega bien primero y segundo.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "La pestaña **Combos** trae las líneas calculadas por la app con cada iniciador, paso a paso.",
              "Esqueleto común: [[Elfnote Lucina]] en el centro → busca [[Elfnote Regina]] → Regina se Invoca y trae otro \"Elfnote\" del Deck → [[Elfnote Power Patron]] (con [[Medius the Pure]]) sube el Nivel del centro → Sincronía de [[Elfnote Seraphim Strelitzia]] o [[Junora the Power Patron of Tuning]].",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Las Sincronías y qué resuelve cada una",
            itens: [
              "[[Elfnote Seraphim Strelitzia]] (Nivel 7): 3000 de ATK en el centro; en la Main Phase (Efecto Rápido) Invoca un \"Elfnote\" de Nivel 6 o menor de la mano/Cementerio y baja 3 Niveles a los monstruos de Nivel 4+ (abre nuevas Sincronías).",
              "[[Junora the Power Patron of Tuning]] (Nivel 10): puede tratar al monstruo del centro como Cantante; al ser Invocada por Sincronía niega todas las cartas boca arriba del rival. La jugada clave yendo segundo.",
              "[[Elfnote June Pride]] (Nivel 10): en el centro, solo atacan los monstruos de zonas centrales; vuelve al Deck Extra para Invocar hasta 1 \"Elfnote\" de la mano, del Deck y del Cementerio.",
              "Las Sincronías genéricas de las listas ([[Crystal Wing Synchro Dragon]], [[F.A. Dawn Dragster]], [[Chaos Angel]], [[Black Rose Dragon]]) cubren negación de monstruos, de Mágicas/Trampas, remoción y limpieza de campo.",
            ],
          },
          {
            titulo: "Jugar a través de las hand traps",
            itens: [
              "Las búsquedas e Invocaciones desde el Deck ([[Elfnote Lucina]], [[Elfnote Regina]], [[Medius the Pure]], [[Prohibited Power Patron Portal - Terminus]]) son los blancos naturales del rival. La pestaña **Interacciones** muestra qué acepta cada paso.",
              "Empezar con [[Prohibited Power Patron Portal - Terminus]] o [[Medius the Pure]] suele atraer la primera respuesta antes del motor \"Elfnote\".",
              "Las Continuas ([[Elfnotes: Welcome Home]], [[Elfnotes: Rhapsodia of Madness]]) dan Invocaciones extra cada turno: mantienen el deck jugando tras una interrupción.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Las listas usan [[Solemn Judgment]], [[Harpie's Feather Duster]], [[Triple Tactics Talent]], [[Nibiru, the Primal Being]] y hand traps extra ([[Mulcharmy Purulia]], [[Ghost Ogre & Snow Rabbit]])."],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Branded
  {
    arquetipo: "Branded",
    revisado: "2026-10",
    textos: {
      pt: {
        resumo:
          "Deck de Fusão em volta de [[Fallen of Albaz]]: as Fusões usam monstros dos dois campos, e o que vai para o Cemitério volta na End Phase como busca ou interrupção. Hoje as listas misturam o motor \"Virtuous\" (Ecclesia) e [[Super Polymerization]].",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "[[Fallen of Albaz]]: ao ser Invocado, descarta 1 carta para fazer uma Fusão usando monstros **de qualquer campo** (mas só ele dos seus). É ao mesmo tempo starter e remoção.",
              "[[Branded Fusion]]: Fusão de um monstro que cita \"Fallen of Albaz\" usando 2 monstros da mão, do **Deck** ou do campo. É o que coloca as peças no Cemitério para a End Phase.",
              "Muitas Fusões têm efeito no Cemitério na **End Phase** do turno em que foram enviadas: [[Albion the Branded Dragon]] busca ou baixa uma Mágica/Armadilha \"Branded\", entre outras.",
              "[[Aluber the Jester of Despia]] busca uma Mágica/Armadilha \"Branded\" ao ser Invocado (normalmente a [[Branded Fusion]]).",
            ],
          },
          {
            titulo: "Cartas que você quer abrir",
            itens: [
              "[[Aluber the Jester of Despia]] e [[Fallen of Albaz]]: Invocação-Normal e o deck começa.",
              "[[Branded Fusion]]: a Fusão do Deck que monta o Cemitério.",
              "[[Blazing Cartesia, the Virtuous]]: Invoca-se da mão se você controla [[Fallen of Albaz]] ou ele está no Cemitério, e faz Fusão de Nível 8+ como Efeito Rápido na Main Phase (inclusive no turno do oponente).",
              "[[The Fallen & The Virtuous]] (Mágica Rápida, 3 cópias em todas as listas): envia do Extra Deck um monstro que cita Albaz para destruir 1 carta virada para cima, ou revive um monstro de qualquer Cemitério se você tiver um \"Ecclesia\".",
            ],
          },
          {
            titulo: "Boas práticas",
            itens: [
              "Pense na End Phase desde o começo do turno: quais Fusões vão estar no Cemitério e o que cada uma vai buscar.",
              "[[Fallen of Albaz]] e [[Super Polymerization]] usam os monstros do oponente como material: no segundo turno, são remoção que não destrói nem alveja.",
              "[[Mirrorjade the Iceblade Dragon]] (só 1 no campo): uma vez por turno, envia uma Fusão que cita Albaz do Extra Deck para banir 1 monstro do campo.",
              "Quase todas as listas usam 3 [[Mulcharmy Fuwalos]]: no segundo turno, ele cobra caro de um oponente que Invoca muito do Deck e do Extra Deck.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "A aba **Combos** mostra as linhas calculadas pelo app com cada starter, inclusive o campo final e o que fica para a End Phase.",
              "Esqueleto comum: [[Aluber the Jester of Despia]] → busca [[Branded Fusion]] → Fusão (ex.: [[Albion the Branded Dragon]]) usando monstros do Deck → mais Fusões em cadeia → na End Phase, os efeitos do Cemitério buscam e baixam cartas \"Branded\".",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "As Fusões do Extra Deck",
            itens: [
              "[[Albion the Branded Dragon]]: ao ser Invocado por Fusão, faz outra Fusão de Nível 8 ou menor banindo materiais da mão, campo ou Cemitério; na End Phase no Cemitério, busca ou baixa uma Mágica/Armadilha \"Branded\".",
              "[[Granguignol the Dusk Dragon]]: ao ser Invocado por Fusão, envia ao Cemitério um monstro LUZ ou TREVAS de Nível 6+ do Deck ou do Extra Deck.",
              "[[Rindbrumm the Striking Dragon]]: Efeito Rápido que nega o efeito de um monstro de Fusão, Sincro, Xyz ou Link e devolve 1 monstro à mão.",
              "[[Lubellion the Searing Dragon]]: ao ser Invocado por Fusão, faz outra Fusão embaralhando os materiais no Deck (recicla o Cemitério).",
            ],
          },
          {
            titulo: "Jogando através das hand traps",
            itens: [
              "Os pontos fracos são as buscas ([[Aluber the Jester of Despia]]) e as Fusões que pegam material do Deck. Confira na aba **Interações** o que cada passo aceita.",
              "Como as Fusões rendem na End Phase, remoção que **bane** cartas do seu Cemitério atrapalha mais do que parece: guarde cópias de [[Fallen of Albaz]] e caminhos alternativos.",
              "[[Branded in High Spirits]], [[Branded Retribution]] e [[Branded Opening]] aparecem em quase todas as listas atuais: leia o texto delas no painel da carta para decidir em que ponto do combo usar cada uma.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["As listas usam [[Harpie's Feather Duster]], [[Lightning Storm]], [[Mistaken Arrest]] e hand traps extras ([[Mulcharmy Purulia]], [[Droll & Lock Bird]], [[Ash Blossom & Joyous Spring]])."],
          },
        ],
      },
      en: {
        resumo:
          "A Fusion deck built around [[Fallen of Albaz]]: Fusions use monsters from both fields, and whatever goes to the GY comes back in the End Phase as a search or an interruption. Current lists mix in the \"Virtuous\" (Ecclesia) engine and [[Super Polymerization]].",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "[[Fallen of Albaz]]: when Summoned, discard 1 card to Fusion Summon using monsters **on either field** (but only itself from yours). It is both a starter and removal.",
              "[[Branded Fusion]]: Fusion Summons a monster that mentions \"Fallen of Albaz\" using 2 monsters from your hand, **Deck** or field. It loads the GY for the End Phase.",
              "Many Fusions have a GY effect in the **End Phase** of the turn they were sent: [[Albion the Branded Dragon]] adds or Sets a \"Branded\" Spell/Trap, among others.",
              "[[Aluber the Jester of Despia]] searches a \"Branded\" Spell/Trap when Summoned (usually [[Branded Fusion]]).",
            ],
          },
          {
            titulo: "Cards you want to open",
            itens: [
              "[[Aluber the Jester of Despia]] and [[Fallen of Albaz]]: Normal Summon and the deck starts.",
              "[[Branded Fusion]]: the Fusion from the Deck that sets up the GY.",
              "[[Blazing Cartesia, the Virtuous]]: Summons itself from the hand if you control [[Fallen of Albaz]] or it is in the GY, and Fusion Summons a Level 8+ as a Quick Effect during the Main Phase (including your opponent's).",
              "[[The Fallen & The Virtuous]] (Quick-Play, 3 copies in every list): send from the Extra Deck a monster that mentions Albaz to destroy 1 face-up card, or revive a monster from either GY if you have an \"Ecclesia\".",
            ],
          },
          {
            titulo: "Good habits",
            itens: [
              "Plan the End Phase from the start of the turn: which Fusions will be in the GY and what each one will fetch.",
              "[[Fallen of Albaz]] and [[Super Polymerization]] use your opponent's monsters as material: going second, that is removal that neither destroys nor targets.",
              "[[Mirrorjade the Iceblade Dragon]] (only 1 on the field): once per turn, send a Fusion that mentions Albaz from the Extra Deck to banish 1 monster on the field.",
              "Almost every list plays 3 [[Mulcharmy Fuwalos]]: going second, it punishes an opponent who Summons a lot from the Deck and Extra Deck.",
            ],
          },
          {
            titulo: "Basic combos",
            itens: [
              "The **Combos** tab shows the app's calculated lines for each starter, including the end board and what is left for the End Phase.",
              "Common skeleton: [[Aluber the Jester of Despia]] → search [[Branded Fusion]] → Fusion (e.g., [[Albion the Branded Dragon]]) using monsters from the Deck → more Fusions in a chain → in the End Phase, GY effects search and Set \"Branded\" cards.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "The Extra Deck Fusions",
            itens: [
              "[[Albion the Branded Dragon]]: when Fusion Summoned, makes another Level 8 or lower Fusion by banishing materials from the hand, field or GY; in the End Phase in the GY, adds or Sets a \"Branded\" Spell/Trap.",
              "[[Granguignol the Dusk Dragon]]: when Fusion Summoned, sends a Level 6+ LIGHT or DARK monster from the Deck or Extra Deck to the GY.",
              "[[Rindbrumm the Striking Dragon]]: Quick Effect that negates a Fusion, Synchro, Xyz or Link Monster's effect and bounces 1 monster.",
              "[[Lubellion the Searing Dragon]]: when Fusion Summoned, makes another Fusion by shuffling materials into the Deck (recycles the GY).",
            ],
          },
          {
            titulo: "Playing through hand traps",
            itens: [
              "The weak points are the searches ([[Aluber the Jester of Despia]]) and the Fusions that take material from the Deck. Check the **Interactions** tab for what each step accepts.",
              "Since the Fusions pay off in the End Phase, removal that **banishes** cards from your GY hurts more than it looks: keep copies of [[Fallen of Albaz]] and alternative routes.",
              "[[Branded in High Spirits]], [[Branded Retribution]] and [[Branded Opening]] show up in almost every current list: read their text in the card panel to decide where in the combo to use each one.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Lists side [[Harpie's Feather Duster]], [[Lightning Storm]], [[Mistaken Arrest]] and extra hand traps ([[Mulcharmy Purulia]], [[Droll & Lock Bird]], [[Ash Blossom & Joyous Spring]])."],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Fusión alrededor de [[Fallen of Albaz]]: las Fusiones usan monstruos de ambos campos, y lo que va al Cementerio vuelve en la End Phase como búsqueda o interrupción. Las listas actuales mezclan el motor \"Virtuous\" (Ecclesia) y [[Super Polymerization]].",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "[[Fallen of Albaz]]: al ser Invocado, descarta 1 carta para Invocar por Fusión usando monstruos **de cualquier campo** (pero de los tuyos solo él). Es iniciador y remoción a la vez.",
              "[[Branded Fusion]]: Invoca por Fusión un monstruo que menciona \"Fallen of Albaz\" usando 2 monstruos de tu mano, **Deck** o campo. Es lo que carga el Cementerio para la End Phase.",
              "Muchas Fusiones tienen efecto en el Cementerio en la **End Phase** del turno en que fueron enviadas: [[Albion the Branded Dragon]] añade o coloca una Mágica/Trampa \"Branded\", entre otras.",
              "[[Aluber the Jester of Despia]] busca una Mágica/Trampa \"Branded\" al ser Invocado (normalmente [[Branded Fusion]]).",
            ],
          },
          {
            titulo: "Cartas que quieres robar",
            itens: [
              "[[Aluber the Jester of Despia]] y [[Fallen of Albaz]]: Invocación Normal y el deck arranca.",
              "[[Branded Fusion]]: la Fusión desde el Deck que arma el Cementerio.",
              "[[Blazing Cartesia, the Virtuous]]: se Invoca desde la mano si controlas [[Fallen of Albaz]] o está en el Cementerio, e Invoca por Fusión un Nivel 8+ como Efecto Rápido en la Main Phase (también la del rival).",
              "[[The Fallen & The Virtuous]] (Juego Rápido, 3 copias en todas las listas): envía del Deck Extra un monstruo que menciona a Albaz para destruir 1 carta boca arriba, o revive un monstruo de cualquier Cementerio si tienes un \"Ecclesia\".",
            ],
          },
          {
            titulo: "Buenas prácticas",
            itens: [
              "Piensa en la End Phase desde el inicio del turno: qué Fusiones estarán en el Cementerio y qué buscará cada una.",
              "[[Fallen of Albaz]] y [[Super Polymerization]] usan los monstruos del rival como material: yendo segundo, es remoción que no destruye ni selecciona.",
              "[[Mirrorjade the Iceblade Dragon]] (solo 1 en el campo): una vez por turno, envía del Deck Extra una Fusión que menciona a Albaz para desterrar 1 monstruo del campo.",
              "Casi todas las listas juegan 3 [[Mulcharmy Fuwalos]]: yendo segundo, castiga al rival que Invoca mucho desde el Deck y el Deck Extra.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "La pestaña **Combos** muestra las líneas calculadas por la app con cada iniciador, incluido el campo final y lo que queda para la End Phase.",
              "Esqueleto común: [[Aluber the Jester of Despia]] → busca [[Branded Fusion]] → Fusión (p. ej., [[Albion the Branded Dragon]]) usando monstruos del Deck → más Fusiones en cadena → en la End Phase, los efectos del Cementerio buscan y colocan cartas \"Branded\".",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Las Fusiones del Deck Extra",
            itens: [
              "[[Albion the Branded Dragon]]: al ser Invocado por Fusión, hace otra Fusión de Nivel 8 o menor desterrando materiales de la mano, campo o Cementerio; en la End Phase en el Cementerio, añade o coloca una Mágica/Trampa \"Branded\".",
              "[[Granguignol the Dusk Dragon]]: al ser Invocado por Fusión, envía al Cementerio un monstruo LUZ u OSCURIDAD de Nivel 6+ del Deck o Deck Extra.",
              "[[Rindbrumm the Striking Dragon]]: Efecto Rápido que niega el efecto de un monstruo de Fusión, Sincronía, Xyz o Enlace y devuelve 1 monstruo a la mano.",
              "[[Lubellion the Searing Dragon]]: al ser Invocado por Fusión, hace otra Fusión barajando los materiales en el Deck (recicla el Cementerio).",
            ],
          },
          {
            titulo: "Jugar a través de las hand traps",
            itens: [
              "Los puntos débiles son las búsquedas ([[Aluber the Jester of Despia]]) y las Fusiones que toman material del Deck. Mira en la pestaña **Interacciones** qué acepta cada paso.",
              "Como las Fusiones rinden en la End Phase, la remoción que **destierra** cartas de tu Cementerio duele más de lo que parece: guarda copias de [[Fallen of Albaz]] y rutas alternativas.",
              "[[Branded in High Spirits]], [[Branded Retribution]] y [[Branded Opening]] aparecen en casi todas las listas actuales: lee su texto en el panel de la carta para decidir en qué punto del combo usar cada una.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Las listas usan [[Harpie's Feather Duster]], [[Lightning Storm]], [[Mistaken Arrest]] y hand traps extra ([[Mulcharmy Purulia]], [[Droll & Lock Bird]], [[Ash Blossom & Joyous Spring]])."],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Light and Darkness Ritual
  {
    arquetipo: "Light and Darkness Ritual",
    revisado: "2026-10",
    textos: {
      pt: {
        resumo:
          "Deck de Ritual com os dois monstros de Nível 8 de [[Light and Darkness Ritual]]: [[Black Luster Soldier - Soldier of Light and Darkness]] e [[Magician of Dark Chaos - Black Chaos]]. Eles não são afetados por efeitos ativados do oponente (salvo os que os alvejam) e banem cartas ao entrar. As listas costumam misturar Azamina/\"Sinful Spoils\", Mago Negro ou Branded.",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "[[Light and Darkness Ritual]] invoca os dois Rituais. O Tributo pode vir da mão ou do campo e/ou de monstros **banidos do Cemitério**. Do Cemitério, ele volta à mão junto com uma carta que o cita.",
              "[[Black Luster Soldier - Soldier of Light and Darkness]]: ao ser Invocado por Invocação-Especial, bane 1 carta do oponente; não pode ser destruído em batalha e ataca de novo ao destruir um monstro.",
              "[[Magician of Dark Chaos - Black Chaos]]: protege as suas Mágicas/Armadilhas de destruição e banimento; ao ser Invocado por Invocação-Especial, recupera 1 Mágica do Cemitério; e bane 1 carta do oponente virada para baixo (alvejando).",
              "[[Griffoh]] (Nível 1) serve de **Tributo inteiro** para um Ritual de Nível 8 e, descartado (Efeito Rápido), baixa do Deck uma Mágica Rápida/Armadilha que cita o Ritual, que pode ser ativada no mesmo turno.",
            ],
          },
          {
            titulo: "Cartas que você quer abrir",
            itens: [
              "[[Griffoh]]: Tributo completo e acesso às Armadilhas/Mágicas do arquétipo.",
              "[[Skull Archfiend of Chaos]]: ao ir para o Cemitério, envia uma Mágica de Ritual da mão/Deck e busca o Ritual citado nela.",
              "[[Mind Shuffle]] (Armadilha Contínua): em qualquer turno, busca um monstro que cita o Ritual e descarta 1; quando o oponente ativa algo, devolve um monstro Nível 7+ à mão para Invocar outro da mão ignorando as condições.",
              "[[Black Chaos]] (Efeito, Nível 8): se Invoca da mão embaralhando um Ritual Feiticeiro/Guerreiro no Deck, bane 2 cartas do oponente na sua Main Phase e, descartado, coloca do Deck/Cemitério uma Armadilha Contínua que cita o Ritual (como [[Mind Shuffle]]).",
            ],
          },
          {
            titulo: "Boas práticas",
            itens: [
              "Os dois Rituais não são afetados por efeitos ativados do oponente que não os alvejem (e o [[Magician of Dark Chaos - Black Chaos]] ainda pode ser destruído em batalha): o oponente vai depender de alvejar. Proteja o campo de efeitos com alvo.",
              "Recicle: [[Light and Darkness Ritual]] volta do Cemitério com outra carta, e [[Skull Archfiend of Chaos]] volta do Cemitério devolvendo 3 cartas ao Deck.",
              "As listas usam muitas hand traps ([[Mulcharmy Fuwalos]], [[Ash Blossom & Joyous Spring]], [[Droll & Lock Bird]], [[Mulcharmy Purulia]]) porque o deck joga bem no segundo turno, banindo o campo do oponente.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "A aba **Combos** traz as linhas calculadas pelo app, passo a passo.",
              "Esqueleto comum: [[Griffoh]] ou [[Skull Archfiend of Chaos]] → acesso ao [[Light and Darkness Ritual]] e ao Ritual → Ritual de Nível 8 usando [[Griffoh]] como Tributo inteiro → o Ritual bane uma carta ao entrar → [[Mind Shuffle]] fica de interrupção.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Variantes (o que cada mistura acrescenta)",
            itens: [
              "Azamina/\"Sinful Spoils\": [[Diabellstar the Black Witch]] e [[WANTED: Seeker of Sinful Spoils]] dão acesso a Mágicas/Armadilhas e às Fusões Azamina ([[Azamina Ilia Silvia]] nega um efeito; [[Azamina Mu Rcielago]] busca).",
              "Mago Negro: [[Magicians' Souls]] e [[Dark Magician of Destruction]] (que busca \"Dark Magician\" ou carta que o cita).",
              "Branded: [[The Fallen & The Virtuous]] e [[Albion the Branded Dragon]], com a [[Ecclesia and the Dark Dragon]] no Extra.",
            ],
          },
          {
            titulo: "Jogando através das hand traps",
            itens: [
              "As buscas ([[Mind Shuffle]], [[Skull Archfiend of Chaos]]) são o alvo natural do oponente. A aba **Interações** mostra, passo a passo, o que cada uma aceita.",
              "Depois que um Ritual está no campo, a maior parte das hand traps comuns não o afeta: o importante é chegar à Invocação.",
              "Contra decks que alvejam, deixe [[Mind Shuffle]] pronto para trocar o monstro alvejado por outro da mão.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["As listas usam [[Pot of Sloth]], [[Lava Golem]], [[Nibiru, the Primal Being]], [[Mulcharmy Purulia]], [[Solemn Judgment]], [[Triple Tactics Talent]] e [[Harpie's Feather Duster]]."],
          },
        ],
      },
      en: {
        resumo:
          "A Ritual deck with the two Level 8 monsters of [[Light and Darkness Ritual]]: [[Black Luster Soldier - Soldier of Light and Darkness]] and [[Magician of Dark Chaos - Black Chaos]]. They are unaffected by your opponent's activated effects (unless targeted) and banish cards when they arrive. Lists often mix in Azamina/\"Sinful Spoils\", Dark Magician or Branded.",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "[[Light and Darkness Ritual]] Summons both Rituals. The Tribute can come from the hand or field and/or monsters **banished from the GY**. From the GY, it returns to the hand together with a card that mentions it.",
              "[[Black Luster Soldier - Soldier of Light and Darkness]]: when Special Summoned, banishes 1 opponent's card; cannot be destroyed by battle and attacks again after destroying a monster.",
              "[[Magician of Dark Chaos - Black Chaos]]: protects your Spells/Traps from destruction and banishment; when Special Summoned, adds 1 Spell from the GY; and banishes 1 opponent's card face-down (targeting).",
              "[[Griffoh]] (Level 1) can be the **entire Tribute** for a Level 8 Ritual and, when discarded (Quick Effect), Sets from the Deck a Quick-Play Spell/Trap that mentions the Ritual, activatable that turn.",
            ],
          },
          {
            titulo: "Cards you want to open",
            itens: [
              "[[Griffoh]]: full Tribute and access to the archetype's Spells/Traps.",
              "[[Skull Archfiend of Chaos]]: when sent to the GY, sends a Ritual Spell from the hand/Deck and searches the Ritual Monster named on it.",
              "[[Mind Shuffle]] (Continuous Trap): on either turn, searches a monster that mentions the Ritual and discards 1; when your opponent activates something, returns a Level 7+ monster to the hand to Summon another from the hand, ignoring its Summoning conditions.",
              "[[Black Chaos]] (Effect, Level 8): Summons itself from the hand by shuffling a Spellcaster/Warrior Ritual into the Deck, banishes 2 opponent's cards during your Main Phase and, when discarded, places from the Deck/GY a Continuous Trap that mentions the Ritual (like [[Mind Shuffle]]).",
            ],
          },
          {
            titulo: "Good habits",
            itens: [
              "Both Rituals are unaffected by your opponent's activated effects that do not target them (and [[Magician of Dark Chaos - Black Chaos]] can still be destroyed by battle): your opponent will rely on targeting. Guard against targeted effects.",
              "Recycle: [[Light and Darkness Ritual]] comes back from the GY with another card, and [[Skull Archfiend of Chaos]] comes back from the GY by returning 3 cards to the Deck.",
              "Lists run many hand traps ([[Mulcharmy Fuwalos]], [[Ash Blossom & Joyous Spring]], [[Droll & Lock Bird]], [[Mulcharmy Purulia]]) because the deck plays well going second, banishing the opponent's board.",
            ],
          },
          {
            titulo: "Basic combos",
            itens: [
              "The **Combos** tab has the app's calculated lines, step by step.",
              "Common skeleton: [[Griffoh]] or [[Skull Archfiend of Chaos]] → access to [[Light and Darkness Ritual]] and the Ritual Monster → Level 8 Ritual using [[Griffoh]] as the entire Tribute → the Ritual banishes a card on arrival → [[Mind Shuffle]] stays up as an interruption.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Variants (what each mix adds)",
            itens: [
              "Azamina/\"Sinful Spoils\": [[Diabellstar the Black Witch]] and [[WANTED: Seeker of Sinful Spoils]] give access to Spells/Traps and the Azamina Fusions ([[Azamina Ilia Silvia]] negates an effect; [[Azamina Mu Rcielago]] searches).",
              "Dark Magician: [[Magicians' Souls]] and [[Dark Magician of Destruction]] (which searches \"Dark Magician\" or a card that mentions it).",
              "Branded: [[The Fallen & The Virtuous]] and [[Albion the Branded Dragon]], with [[Ecclesia and the Dark Dragon]] in the Extra Deck.",
            ],
          },
          {
            titulo: "Playing through hand traps",
            itens: [
              "The searches ([[Mind Shuffle]], [[Skull Archfiend of Chaos]]) are your opponent's natural targets. The **Interactions** tab shows, step by step, what each accepts.",
              "Once a Ritual is on the field, most common hand traps do not affect it: what matters is reaching the Summon.",
              "Against targeting decks, keep [[Mind Shuffle]] ready to swap the targeted monster for another from the hand.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Lists side [[Pot of Sloth]], [[Lava Golem]], [[Nibiru, the Primal Being]], [[Mulcharmy Purulia]], [[Solemn Judgment]], [[Triple Tactics Talent]] and [[Harpie's Feather Duster]]."],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Ritual con los dos monstruos de Nivel 8 de [[Light and Darkness Ritual]]: [[Black Luster Soldier - Soldier of Light and Darkness]] y [[Magician of Dark Chaos - Black Chaos]]. No son afectados por efectos activados del rival (salvo los que los seleccionan) y destierran cartas al llegar. Las listas suelen mezclar Azamina/\"Sinful Spoils\", Mago Oscuro o Branded.",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "[[Light and Darkness Ritual]] Invoca ambos Rituales. El Sacrificio puede salir de la mano o el campo y/o de monstruos **desterrados del Cementerio**. Desde el Cementerio, vuelve a la mano junto con una carta que lo menciona.",
              "[[Black Luster Soldier - Soldier of Light and Darkness]]: al ser Invocado de Modo Especial, destierra 1 carta rival; no puede ser destruido en batalla y vuelve a atacar al destruir un monstruo.",
              "[[Magician of Dark Chaos - Black Chaos]]: protege tus Mágicas/Trampas de destrucción y destierro; al ser Invocado de Modo Especial, recupera 1 Mágica del Cementerio; y destierra boca abajo 1 carta rival (seleccionando).",
              "[[Griffoh]] (Nivel 1) puede ser el **Sacrificio entero** de un Ritual de Nivel 8 y, al descartarse (Efecto Rápido), coloca del Deck una Mágica de Juego Rápido/Trampa que menciona el Ritual, activable ese turno.",
            ],
          },
          {
            titulo: "Cartas que quieres robar",
            itens: [
              "[[Griffoh]]: Sacrificio completo y acceso a las Mágicas/Trampas del arquetipo.",
              "[[Skull Archfiend of Chaos]]: al ir al Cementerio, envía una Mágica de Ritual de la mano/Deck y busca el Ritual que nombra.",
              "[[Mind Shuffle]] (Trampa Continua): en cualquier turno, busca un monstruo que menciona el Ritual y descarta 1; cuando el rival activa algo, devuelve un monstruo de Nivel 7+ a la mano para Invocar otro de la mano ignorando sus condiciones.",
              "[[Black Chaos]] (Efecto, Nivel 8): se Invoca de la mano barajando un Ritual Lanzador de Conjuros/Guerrero en el Deck, destierra 2 cartas rivales en tu Main Phase y, al descartarse, coloca del Deck/Cementerio una Trampa Continua que menciona el Ritual (como [[Mind Shuffle]]).",
            ],
          },
          {
            titulo: "Buenas prácticas",
            itens: [
              "Ambos Rituales no son afectados por efectos activados del rival que no los seleccionen (y [[Magician of Dark Chaos - Black Chaos]] aún puede ser destruido en batalla): el rival dependerá de seleccionar. Protégete de los efectos con objetivo.",
              "Recicla: [[Light and Darkness Ritual]] vuelve del Cementerio con otra carta, y [[Skull Archfiend of Chaos]] vuelve del Cementerio devolviendo 3 cartas al Deck.",
              "Las listas juegan muchas hand traps ([[Mulcharmy Fuwalos]], [[Ash Blossom & Joyous Spring]], [[Droll & Lock Bird]], [[Mulcharmy Purulia]]) porque el deck juega bien segundo, desterrando el campo rival.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "La pestaña **Combos** trae las líneas calculadas por la app, paso a paso.",
              "Esqueleto común: [[Griffoh]] o [[Skull Archfiend of Chaos]] → acceso a [[Light and Darkness Ritual]] y al Ritual → Ritual de Nivel 8 usando a [[Griffoh]] como Sacrificio entero → el Ritual destierra una carta al llegar → [[Mind Shuffle]] queda como interrupción.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Variantes (qué aporta cada mezcla)",
            itens: [
              "Azamina/\"Sinful Spoils\": [[Diabellstar the Black Witch]] y [[WANTED: Seeker of Sinful Spoils]] dan acceso a Mágicas/Trampas y a las Fusiones Azamina ([[Azamina Ilia Silvia]] niega un efecto; [[Azamina Mu Rcielago]] busca).",
              "Mago Oscuro: [[Magicians' Souls]] y [[Dark Magician of Destruction]] (que busca \"Dark Magician\" o una carta que lo menciona).",
              "Branded: [[The Fallen & The Virtuous]] y [[Albion the Branded Dragon]], con [[Ecclesia and the Dark Dragon]] en el Deck Extra.",
            ],
          },
          {
            titulo: "Jugar a través de las hand traps",
            itens: [
              "Las búsquedas ([[Mind Shuffle]], [[Skull Archfiend of Chaos]]) son el blanco natural del rival. La pestaña **Interacciones** muestra qué acepta cada paso.",
              "Una vez que un Ritual está en el campo, la mayoría de las hand traps comunes no lo afecta: lo importante es llegar a la Invocación.",
              "Contra decks que seleccionan, deja [[Mind Shuffle]] listo para cambiar el monstruo seleccionado por otro de la mano.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Las listas usan [[Pot of Sloth]], [[Lava Golem]], [[Nibiru, the Primal Being]], [[Mulcharmy Purulia]], [[Solemn Judgment]], [[Triple Tactics Talent]] y [[Harpie's Feather Duster]]."],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Mitsurugi
  {
    arquetipo: "Mitsurugi",
    revisado: "2026-10",
    textos: {
      pt: {
        resumo:
          "Deck de Répteis TREVAS em que **oferecer como Tributo é recurso, não custo**: os monstros \"Mitsurugi\", ao serem Tributados, buscam outra carta e muitas vezes voltam ao campo. Os Rituais de Nível 8 destroem o campo do oponente, negam ou revivem.",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "Os \"Mikoto\" de Nível 4 ativam ao serem Invocados **ou Tributados**: [[Mitsurugi no Mikoto, Aramasa]] busca um monstro \"Mitsurugi\", [[Mitsurugi no Mikoto, Saji]] busca uma Mágica/Armadilha \"Mitsurugi\" e [[Mitsurugi no Mikoto, Kusanagi]] recupera uma carta \"Mitsurugi\" do Cemitério ou banida. Eles também protegem outros Répteis, sendo Tributados no lugar deles.",
              "Os Rituais de Nível 8, ao serem Tributados, buscam uma carta \"Mitsurugi\" e podem se Invocar de novo: [[Ame no Murakumo no Mitsurugi]] (ao entrar, destrói todos os monstros do oponente; Efeito Rápido \"descarte 1 ou o efeito é negado\"), [[Futsu no Mitama no Mitsurugi]] (revive um Réptil quando o oponente Invoca por Invocação-Especial) e [[Ame no Habakiri no Mitsurugi]] (monstros do oponente perdem 800 de ATK).",
              "[[Mitsurugi Ritual]]: Ritual de um Réptil do **Deck** (Tributando Répteis da mão/campo) ou da mão (Tributando até 2 Répteis, inclusive do Deck).",
            ],
          },
          {
            titulo: "Cartas que você quer abrir",
            itens: [
              "[[Mitsurugi Prayers]] (Mágica Rápida, 3 em todas as listas): busca um monstro \"Mitsurugi\" e/ou revive um do Cemitério; Tributando um Réptil na ativação, faz os dois.",
              "[[Mitsurugi no Mikoto, Aramasa]]: Invocação-Normal e busca.",
              "[[Ame no Habakiri no Mitsurugi]]: revelado da mão (1 vez por Duelo), Invoca um \"Mitsurugi\" do Deck e Tributa 1 monstro, o que já ativa os efeitos de Tributo.",
              "[[Pre-Preparation of Rites]] aparece em quase todas as listas para buscar Ritual e Mágica de Ritual juntos.",
            ],
          },
          {
            titulo: "Boas práticas",
            itens: [
              "Cada Tributo é uma busca: antes de oferecer, veja qual \"Mitsurugi\" no campo gera a busca que você precisa.",
              "[[Mitsurugi Mirror]] também invoca Rituais do Cemitério, e volta ao Deck quando um dos Rituais é Tributado: dá para repetir.",
              "[[Dominus Impulse]] aparece em muitas listas: o deck é todo TREVAS, então a restrição de ativá-la da mão (não ativar efeitos de monstros LUZ, TERRA e VENTO pelo resto do Duelo) quase não pesa.",
              "Deixe [[Mitsurugi Great Purification]] baixada: ela Tributa um Réptil de Nível 5+ para negar e destruir, e do Cemitério revive um Réptil.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "A aba **Combos** mostra as linhas calculadas pelo app com cada starter.",
              "Esqueleto comum: [[Mitsurugi Prayers]] ou [[Mitsurugi no Mikoto, Aramasa]] → buscas encadeadas pelos \"Mikoto\" → [[Mitsurugi Ritual]] do Deck Tributando Répteis (os Tributos buscam de novo) → campo com Ritual e Armadilha baixada.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Escolhendo o Ritual",
            itens: [
              "Indo para o ataque, [[Ame no Murakumo no Mitsurugi]] destrói todos os monstros do oponente ao entrar.",
              "Primeiro turno: [[Futsu no Mitama no Mitsurugi]] castiga Invocações-Especiais do oponente (revive Répteis), e [[Ame no Murakumo no Mitsurugi]] dá uma interrupção de \"descarte ou seja negado\".",
              "Como os Rituais buscam e voltam ao serem Tributados, uma remoção que Tributa ou envia ao Cemitério tende a render mais para você do que para o oponente: prefira o oponente gastar banimento ou negação.",
            ],
          },
          {
            titulo: "Jogando através das hand traps",
            itens: [
              "As buscas ([[Mitsurugi Prayers]], os \"Mikoto\") são o primeiro alvo. A aba **Interações** mostra, passo a passo, o que cada uma aceita.",
              "Contra [[Droll & Lock Bird]], priorize a busca que leva ao [[Mitsurugi Ritual]]: ele joga do Deck.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["As listas usam [[Harpie's Feather Duster]], [[Lightning Storm]], [[Triple Tactics Talent]], [[Solemn Judgment]], [[Lava Golem]] e [[Droll & Lock Bird]]."],
          },
        ],
      },
      en: {
        resumo:
          "A DARK Reptile deck where **Tributing is a resource, not a cost**: \"Mitsurugi\" monsters search another card when Tributed and often come back to the field. The Level 8 Rituals wipe the opponent's monsters, negate or revive.",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "The Level 4 \"Mikoto\" trigger when Summoned **or Tributed**: [[Mitsurugi no Mikoto, Aramasa]] searches a \"Mitsurugi\" monster, [[Mitsurugi no Mikoto, Saji]] a \"Mitsurugi\" Spell/Trap and [[Mitsurugi no Mikoto, Kusanagi]] recovers a \"Mitsurugi\" card from the GY or banishment. They also protect other Reptiles by being Tributed instead.",
              "The Level 8 Rituals search a \"Mitsurugi\" card when Tributed and can Summon themselves again: [[Ame no Murakumo no Mitsurugi]] (on arrival, destroys all opponent's monsters; Quick Effect \"discard 1 or the effect is negated\"), [[Futsu no Mitama no Mitsurugi]] (revives a Reptile when your opponent Special Summons) and [[Ame no Habakiri no Mitsurugi]] (opponent's monsters lose 800 ATK).",
              "[[Mitsurugi Ritual]]: Ritual Summon a Reptile from the **Deck** (Tributing Reptiles from the hand/field) or from the hand (Tributing up to 2 Reptiles, including from the Deck).",
            ],
          },
          {
            titulo: "Cards you want to open",
            itens: [
              "[[Mitsurugi Prayers]] (Quick-Play, 3 in every list): searches a \"Mitsurugi\" monster and/or revives one from the GY; Tributing a Reptile on activation does both.",
              "[[Mitsurugi no Mikoto, Aramasa]]: Normal Summon and search.",
              "[[Ame no Habakiri no Mitsurugi]]: revealed from the hand (once per Duel), Special Summons a \"Mitsurugi\" from the Deck and Tributes 1 monster, which already triggers the Tribute effects.",
              "[[Pre-Preparation of Rites]] shows up in almost every list to search a Ritual Monster and Ritual Spell together.",
            ],
          },
          {
            titulo: "Good habits",
            itens: [
              "Every Tribute is a search: before Tributing, check which \"Mitsurugi\" on the field gives the search you need.",
              "[[Mitsurugi Mirror]] also Summons Rituals from the GY, and shuffles back into the Deck when one of the Rituals is Tributed: you can repeat it.",
              "[[Dominus Impulse]] appears in many lists: the deck is all DARK, so the restriction for activating it from the hand (no LIGHT, EARTH or WIND monster effects for the rest of the Duel) barely matters.",
              "Keep [[Mitsurugi Great Purification]] Set: it Tributes a Level 5+ Reptile to negate and destroy, and from the GY it revives a Reptile.",
            ],
          },
          {
            titulo: "Basic combos",
            itens: [
              "The **Combos** tab shows the app's calculated lines for each starter.",
              "Common skeleton: [[Mitsurugi Prayers]] or [[Mitsurugi no Mikoto, Aramasa]] → chained searches by the \"Mikoto\" → [[Mitsurugi Ritual]] from the Deck Tributing Reptiles (the Tributes search again) → board with a Ritual and a Set Trap.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Choosing the Ritual",
            itens: [
              "Going second, [[Ame no Murakumo no Mitsurugi]] destroys all your opponent's monsters on arrival.",
              "Going first: [[Futsu no Mitama no Mitsurugi]] punishes your opponent's Special Summons (revives Reptiles), and [[Ame no Murakumo no Mitsurugi]] gives a \"discard or be negated\" interruption.",
              "Since the Rituals search and return when Tributed, removal that Tributes or sends to the GY tends to help you more than your opponent: make them spend banish or negation.",
            ],
          },
          {
            titulo: "Playing through hand traps",
            itens: [
              "The searches ([[Mitsurugi Prayers]], the \"Mikoto\") are the first target. The **Interactions** tab shows, step by step, what each accepts.",
              "Against [[Droll & Lock Bird]], prioritize the search that leads to [[Mitsurugi Ritual]]: it plays from the Deck.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Lists side [[Harpie's Feather Duster]], [[Lightning Storm]], [[Triple Tactics Talent]], [[Solemn Judgment]], [[Lava Golem]] and [[Droll & Lock Bird]]."],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Reptiles OSCURIDAD donde **Sacrificar es un recurso, no un coste**: los monstruos \"Mitsurugi\", al ser Sacrificados, buscan otra carta y muchas veces vuelven al campo. Los Rituales de Nivel 8 limpian los monstruos rivales, niegan o reviven.",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "Los \"Mikoto\" de Nivel 4 se activan al ser Invocados **o Sacrificados**: [[Mitsurugi no Mikoto, Aramasa]] busca un monstruo \"Mitsurugi\", [[Mitsurugi no Mikoto, Saji]] una Mágica/Trampa \"Mitsurugi\" y [[Mitsurugi no Mikoto, Kusanagi]] recupera una carta \"Mitsurugi\" del Cementerio o desterrada. También protegen a otros Reptiles Sacrificándose en su lugar.",
              "Los Rituales de Nivel 8, al ser Sacrificados, buscan una carta \"Mitsurugi\" y pueden volver a Invocarse: [[Ame no Murakumo no Mitsurugi]] (al llegar, destruye todos los monstruos rivales; Efecto Rápido \"descarta 1 o el efecto se niega\"), [[Futsu no Mitama no Mitsurugi]] (revive un Reptil cuando el rival Invoca de Modo Especial) y [[Ame no Habakiri no Mitsurugi]] (los monstruos rivales pierden 800 de ATK).",
              "[[Mitsurugi Ritual]]: Invoca por Ritual un Reptil del **Deck** (Sacrificando Reptiles de la mano/campo) o de la mano (Sacrificando hasta 2 Reptiles, incluso del Deck).",
            ],
          },
          {
            titulo: "Cartas que quieres robar",
            itens: [
              "[[Mitsurugi Prayers]] (Juego Rápido, 3 en todas las listas): busca un monstruo \"Mitsurugi\" y/o revive uno del Cementerio; Sacrificando un Reptil al activarla, hace ambas cosas.",
              "[[Mitsurugi no Mikoto, Aramasa]]: Invocación Normal y búsqueda.",
              "[[Ame no Habakiri no Mitsurugi]]: revelado de la mano (una vez por Duelo), Invoca un \"Mitsurugi\" del Deck y Sacrifica 1 monstruo, lo que ya activa los efectos de Sacrificio.",
              "[[Pre-Preparation of Rites]] aparece en casi todas las listas para buscar Ritual y Mágica de Ritual juntos.",
            ],
          },
          {
            titulo: "Buenas prácticas",
            itens: [
              "Cada Sacrificio es una búsqueda: antes de Sacrificar, mira qué \"Mitsurugi\" del campo da la búsqueda que necesitas.",
              "[[Mitsurugi Mirror]] también Invoca Rituales desde el Cementerio, y vuelve al Deck cuando uno de los Rituales es Sacrificado: puedes repetirla.",
              "[[Dominus Impulse]] aparece en muchas listas: el deck es todo OSCURIDAD, así que la restricción de activarla desde la mano (no activar efectos de monstruos LUZ, TIERRA y VIENTO el resto del Duelo) casi no pesa.",
              "Deja [[Mitsurugi Great Purification]] colocada: Sacrifica un Reptil de Nivel 5+ para negar y destruir, y desde el Cementerio revive un Reptil.",
            ],
          },
          {
            titulo: "Combos básicos",
            itens: [
              "La pestaña **Combos** muestra las líneas calculadas por la app con cada iniciador.",
              "Esqueleto común: [[Mitsurugi Prayers]] o [[Mitsurugi no Mikoto, Aramasa]] → búsquedas encadenadas de los \"Mikoto\" → [[Mitsurugi Ritual]] desde el Deck Sacrificando Reptiles (los Sacrificios vuelven a buscar) → campo con Ritual y Trampa colocada.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Eligiendo el Ritual",
            itens: [
              "Yendo segundo, [[Ame no Murakumo no Mitsurugi]] destruye todos los monstruos rivales al llegar.",
              "Yendo primero: [[Futsu no Mitama no Mitsurugi]] castiga las Invocaciones Especiales rivales (revive Reptiles), y [[Ame no Murakumo no Mitsurugi]] da una interrupción de \"descarta o se niega\".",
              "Como los Rituales buscan y vuelven al ser Sacrificados, la remoción que Sacrifica o envía al Cementerio suele ayudarte más a ti: haz que el rival gaste destierros o negaciones.",
            ],
          },
          {
            titulo: "Jugar a través de las hand traps",
            itens: [
              "Las búsquedas ([[Mitsurugi Prayers]], los \"Mikoto\") son el primer blanco. La pestaña **Interacciones** muestra qué acepta cada paso.",
              "Contra [[Droll & Lock Bird]], prioriza la búsqueda que lleva a [[Mitsurugi Ritual]]: juega desde el Deck.",
            ],
          },
          {
            titulo: "Side deck",
            itens: ["Las listas usan [[Harpie's Feather Duster]], [[Lightning Storm]], [[Triple Tactics Talent]], [[Solemn Judgment]], [[Lava Golem]] y [[Droll & Lock Bird]]."],
          },
        ],
      },
    },
  },
];
