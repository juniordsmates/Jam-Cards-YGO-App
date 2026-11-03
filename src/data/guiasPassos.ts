// Guia de Deck: combo principal passo a passo, o que o campo final faz e onde cada hand trap pesa
// mais (jogando com o deck e contra ele). Os blocos daqui entram no fim das abas Ideias Iniciais e
// Ideias Avançadas dos guias de guias.ts; os arquétipos que ainda não têm guia ganham um aqui.
//
// Mesmo formato de guias.ts: [[Nome da carta em inglês]] vira o nome no idioma escolhido. Cada
// afirmação foi conferida com o texto oficial das cartas e com a banlist TCG de outubro de 2026.

import type { BlocoGuia, Idioma } from "./guias";

export interface PassosGuia {
  arquetipo: string;
  revisado: string;
  textos: Record<Idioma, { resumo?: string; iniciais: BlocoGuia[]; avancadas: BlocoGuia[] }>;
}

export const GUIAS_PASSOS: PassosGuia[] = [
  // ------------------------------------------------------------------ Kewl Tune
  {
    arquetipo: "Kewl Tune",
    revisado: "2026-11",
    textos: {
      pt: {
        iniciais: [
          {
            titulo: "Combo principal: 1 Reco (lista com Rotary)",
            itens: [
              "Atenção à banlist: [[Kewl Tune Rotary]] está **Proibido no TCG** desde a lista de setembro de 2026 (no OCG é Limitado). A linha abaixo vale para o OCG e para treinar a lista anterior; no TCG, os mesmos pontos de parada valem para as linhas que começam com [[Kewl Tune Cue]], [[Kewl Tune Mix]] ou [[Kewl Tune Synchro]].",
              "1. Invocação-Normal de [[Kewl Tune Reco]], que busca [[Kewl Tune Rotary]]. É a primeira busca do turno e o passo que o oponente mais quer parar.",
              "2. Sincro de [[Kewl Tune Track Maker]] (Nível 4) com o Reco no campo e o Rotary **da mão** (3 + 1): a cláusula de matéria da mão do Reco faz o Rotary virar matéria sem ser Invocado.",
              "3. O Track Maker busca [[Kewl Tune Cue]]; o Rotary, enviado como matéria, olha a mão do oponente e busca [[JJ \"Kewl Tune\"]].",
              "4. Ative o JJ e use a Invocação-Normal extra de Regulador no Cue, que Invoca [[Kewl Tune Mix]] do Deck; o Mix busca outro Reco.",
              "5. Sincro de [[Zalen the Shackled Dragon]] (Nível 7) com o Track Maker no campo e o Reco da mão (4 + 3). É a 5ª Invocação do turno.",
              "6. Sincro de [[Kewl Tune Remix]] (Nível 5) com Cue e Mix (3 + 2); o Cue, como matéria, bane 1 das 2 cartas do topo do Deck do oponente.",
              "Campo final: Zalen, Remix e o JJ, com 5 monstros \"Kewl Tune\" no Cemitério. Como o Rotary já viu a mão do oponente, você monta o campo sabendo o que ele tem.",
              "Variante: com o Rotary e qualquer Regulador de Nível 3 na mão (até uma hand trap), o Rotary se revela com ele e se Invoca por Invocação-Normal sem gastar a sua. Os dois fazem o Track Maker, que busca a [[Kewl Tune Synchro]], e a linha termina no mesmo campo com o [[Kewl Tune Clip]] na mão.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Contra o deck: onde parar",
            itens: [
              "**A primeira busca (a do Reco) é o ponto de parada.** [[Ash Blossom & Joyous Spring]], [[Ghost Belle & Haunted Mansion]], [[Effect Veiler]] ou [[Infinite Impermanence]] ali deixam uma mão de 1 Reco sem nada. Se o oponente tiver [[Kewl Tune Synchro]] para encadear, ele busca o que precisa e chega ao campo completo mesmo assim.",
              "[[Ghost Ogre & Snow Rabbit]] no Reco destrói o monstro, mas a busca resolve: só funciona contra a mão de 1 carta.",
              "[[Droll & Lock Bird]] depois da primeira busca: o Track Maker ainda sai e o turno para. Mãos que começam pelo [[Kewl Tune Cue]] escapam melhor, porque as buscas resolvem na mesma Corrente e o resto vem do Cemitério.",
              "[[Mulcharmy Fuwalos]] antes da primeira Invocação faz o oponente parar cedo (normalmente no Track Maker com [[Kewl Tune Synchro]] baixadas) para não te dar várias compras.",
              "[[Nibiru, the Primal Being]] na linha principal cai entre o Zalen (5ª Invocação) e o Remix. Como o Nibiru abre a própria Corrente, o Zalen não pode responder: o turno termina no JJ e no Token.",
              "Interrompa **antes do Zalen**. Depois dele, uma hand trap encadeada a um efeito do deck vira o 2º elo da Corrente, e o Zalen nega e destrói o 1º ou o 2º.",
            ],
          },
          {
            titulo: "Contra o deck: indo segundo",
            itens: [
              "[[Zalen the Shackled Dragon]] só age numa Corrente de 2 ou mais elos. Um efeito seu ativado sozinho (elo 1, sem resposta) fica fora do alcance dele; quem costuma criar o 2º elo é o próprio Kewl Tune, encadeando o Remix, uma [[Kewl Tune Synchro]] baixada ou uma hand trap.",
              "[[Kewl Tune Remix]] precisa de 2 Reguladores não Sincro no Cemitério do dono. Banir o Cemitério desliga o Remix (o [[Kewl Tune B2B]] ainda usa Reguladores banidos).",
              "O [[Kewl Tune B2B]] só reage a **efeitos de monstro**, 2 vezes por turno: Mágicas e Armadilhas não o ativam.",
              "Remix e B2B ficam maiores enquanto **você** tiver Regulador no campo ou no Cemitério, e quase todas as hand traps são Reguladores (Ash, Veiler, Ghost Belle, Ghost Ogre). Conte o ATK antes de atacar.",
            ],
          },
        ],
      },
      en: {
        iniciais: [
          {
            titulo: "Main combo: 1 Reco (list with Rotary)",
            itens: [
              "Banlist note: [[Kewl Tune Rotary]] is **Forbidden in the TCG** since the September 2026 list (Limited in the OCG). The line below works in the OCG and for practicing the previous list; in the TCG, the same choke points apply to the lines that start with [[Kewl Tune Cue]], [[Kewl Tune Mix]] or [[Kewl Tune Synchro]].",
              "1. Normal Summon [[Kewl Tune Reco]], which searches [[Kewl Tune Rotary]]. It is the turn's first search and the step your opponent most wants to stop.",
              "2. Synchro Summon [[Kewl Tune Track Maker]] (Level 4) with Reco on the field and Rotary **from the hand** (3 + 1): Reco's hand-material clause turns Rotary into material without summoning it.",
              "3. Track Maker searches [[Kewl Tune Cue]]; Rotary, sent as material, looks at your opponent's hand and searches [[JJ \"Kewl Tune\"]].",
              "4. Activate JJ and use its extra Tuner Normal Summon on Cue, which Special Summons [[Kewl Tune Mix]] from the Deck; Mix searches another Reco.",
              "5. Synchro Summon [[Zalen the Shackled Dragon]] (Level 7) with Track Maker on the field and Reco from the hand (4 + 3). This is the turn's 5th summon.",
              "6. Synchro Summon [[Kewl Tune Remix]] (Level 5) with Cue and Mix (3 + 2); Cue, as material, banishes 1 of the top 2 cards of your opponent's Deck.",
              "End board: Zalen, Remix and JJ, with 5 \"Kewl Tune\" monsters in the GY. Rotary has already seen your opponent's hand, so you build the board knowing what they hold.",
              "Variant: with Rotary and any Level 3 Tuner in hand (even a hand trap), Rotary reveals itself with it and Normal Summons itself without using your regular Normal Summon. The two make Track Maker, which searches [[Kewl Tune Synchro]], and the line ends on the same board with [[Kewl Tune Clip]] in hand.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Against the deck: where to stop it",
            itens: [
              "**The first search (Reco's) is the choke point.** [[Ash Blossom & Joyous Spring]], [[Ghost Belle & Haunted Mansion]], [[Effect Veiler]] or [[Infinite Impermanence]] there leave a 1-Reco hand with nothing. If they hold [[Kewl Tune Synchro]] to chain, they search what they need and still reach the full board.",
              "[[Ghost Ogre & Snow Rabbit]] on Reco destroys the monster, but the search resolves: it only works against a 1-card hand.",
              "[[Droll & Lock Bird]] after the first search: Track Maker still comes out and the turn stops. Hands that start with [[Kewl Tune Cue]] get through more easily, because their searches resolve in the same Chain and the rest comes from the GY.",
              "[[Mulcharmy Fuwalos]] before the first summon makes them stop early (usually on Track Maker with [[Kewl Tune Synchro]] Set) instead of giving you several draws.",
              "In the main line, [[Nibiru, the Primal Being]] lands between Zalen (5th summon) and Remix. Nibiru starts its own Chain, so Zalen cannot answer it: the turn ends on JJ and the Token.",
              "Interrupt **before Zalen**. After it, a hand trap chained to one of the deck's effects becomes Chain Link 2, and Zalen negates and destroys either the 1st or the 2nd.",
            ],
          },
          {
            titulo: "Against the deck: going second",
            itens: [
              "[[Zalen the Shackled Dragon]] only works in a Chain of 2 or more links. An effect you activate on its own (Chain Link 1, nothing chained) is out of its reach; the 2nd link usually comes from Kewl Tune itself, chaining Remix, a Set [[Kewl Tune Synchro]] or a hand trap.",
              "[[Kewl Tune Remix]] needs 2 non-Synchro Tuners in its owner's GY. Banishing the GY shuts Remix off ([[Kewl Tune B2B]] can still use banished Tuners).",
              "[[Kewl Tune B2B]] only reacts to **monster effects**, twice per turn: Spells and Traps do not trigger it.",
              "Remix and B2B get bigger while **you** have a Tuner on the field or in the GY, and almost every hand trap is a Tuner (Ash, Veiler, Ghost Belle, Ghost Ogre). Count the ATK before attacking.",
            ],
          },
        ],
      },
      es: {
        iniciais: [
          {
            titulo: "Combo principal: 1 Reco (lista con Rotary)",
            itens: [
              "Ojo con la banlist: [[Kewl Tune Rotary]] está **Prohibido en el TCG** desde la lista de septiembre de 2026 (en el OCG está Limitado). La línea de abajo vale para el OCG y para practicar la lista anterior; en el TCG, los mismos puntos de corte valen para las líneas que empiezan con [[Kewl Tune Cue]], [[Kewl Tune Mix]] o [[Kewl Tune Synchro]].",
              "1. Invoca de Modo Normal [[Kewl Tune Reco]], que busca [[Kewl Tune Rotary]]. Es la primera búsqueda del turno y el paso que el rival más quiere parar.",
              "2. Invoca por Sincronía [[Kewl Tune Track Maker]] (Nivel 4) con Reco en el campo y Rotary **de la mano** (3 + 1): la cláusula de material de la mano de Reco convierte a Rotary en material sin Invocarlo.",
              "3. Track Maker busca [[Kewl Tune Cue]]; Rotary, enviado como material, mira la mano del rival y busca [[JJ \"Kewl Tune\"]].",
              "4. Activa JJ y usa su Invocación Normal extra de Cantante en Cue, que Invoca [[Kewl Tune Mix]] del Deck; Mix busca otro Reco.",
              "5. Invoca por Sincronía [[Zalen the Shackled Dragon]] (Nivel 7) con Track Maker en el campo y Reco de la mano (4 + 3). Es la 5ª Invocación del turno.",
              "6. Invoca por Sincronía [[Kewl Tune Remix]] (Nivel 5) con Cue y Mix (3 + 2); Cue, como material, destierra 1 de las 2 cartas superiores del Deck rival.",
              "Campo final: Zalen, Remix y JJ, con 5 monstruos \"Kewl Tune\" en el Cementerio. Rotary ya vio la mano del rival, así que armas el campo sabiendo lo que tiene.",
              "Variante: con Rotary y cualquier Cantante de Nivel 3 en la mano (incluso una hand trap), Rotary se revela con él y se Invoca de Modo Normal sin gastar tu Invocación Normal. Los dos hacen a Track Maker, que busca [[Kewl Tune Synchro]], y la línea termina en el mismo campo con [[Kewl Tune Clip]] en la mano.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Contra el deck: dónde pararlo",
            itens: [
              "**La primera búsqueda (la de Reco) es el punto de corte.** [[Ash Blossom & Joyous Spring]], [[Ghost Belle & Haunted Mansion]], [[Effect Veiler]] o [[Infinite Impermanence]] ahí dejan sin nada a una mano de 1 Reco. Si el rival tiene [[Kewl Tune Synchro]] para encadenar, busca lo que necesita y llega igual al campo completo.",
              "[[Ghost Ogre & Snow Rabbit]] sobre Reco destruye al monstruo, pero la búsqueda se resuelve: solo funciona contra la mano de 1 carta.",
              "[[Droll & Lock Bird]] tras la primera búsqueda: Track Maker sale igual y el turno se detiene. Las manos que empiezan con [[Kewl Tune Cue]] pasan mejor, porque sus búsquedas se resuelven en la misma Cadena y el resto viene del Cementerio.",
              "[[Mulcharmy Fuwalos]] antes de la primera Invocación hace que el rival se detenga pronto (normalmente en Track Maker con [[Kewl Tune Synchro]] colocadas) para no darte varios robos.",
              "En la línea principal, [[Nibiru, the Primal Being]] cae entre Zalen (5ª Invocación) y Remix. Nibiru abre su propia Cadena, así que Zalen no puede responder: el turno termina en JJ y el Token.",
              "Interrumpe **antes de Zalen**. Después, una hand trap encadenada a un efecto del deck pasa a ser el Eslabón 2, y Zalen niega y destruye el 1º o el 2º.",
            ],
          },
          {
            titulo: "Contra el deck: yendo segundo",
            itens: [
              "[[Zalen the Shackled Dragon]] solo actúa en una Cadena de 2 o más eslabones. Un efecto tuyo activado solo (Eslabón 1, sin respuesta) queda fuera de su alcance; el 2º eslabón suele crearlo el propio Kewl Tune, encadenando Remix, una [[Kewl Tune Synchro]] colocada o una hand trap.",
              "[[Kewl Tune Remix]] necesita 2 Cantantes que no sean de Sincronía en el Cementerio de su dueño. Desterrar el Cementerio lo apaga ([[Kewl Tune B2B]] todavía usa Cantantes desterrados).",
              "[[Kewl Tune B2B]] solo reacciona a **efectos de monstruo**, 2 veces por turno: las Mágicas y Trampas no lo activan.",
              "Remix y B2B crecen mientras **tú** tengas un Cantante en el campo o en el Cementerio, y casi todas las hand traps son Cantantes (Ash, Veiler, Ghost Belle, Ghost Ogre). Cuenta el ATK antes de atacar.",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Elfnote
  {
    arquetipo: "Elfnote",
    revisado: "2026-11",
    textos: {
      pt: {
        iniciais: [
          {
            titulo: "Banlist de outubro de 2026 e o combo atual",
            itens: [
              "Na lista TCG de 19 de outubro de 2026, [[Elfnote Tinia]], [[Crystal Wing Synchro Dragon]] e [[F.A. Dawn Dragster]] estão **Proibidos**, e [[Droll & Lock Bird]] fica em 1 cópia. As listas atuais trocaram essas peças por uma ponte com [[Elfnote Fortuna]] e pelo motor Ars Magna.",
              "1. [[Elfnote Lucina]] busca [[Elfnote Power Patron]]. Invocação-Normal do Patron e Sincro de [[Elfnote Seraphim Strelitzia]] com os dois; o Patron, como matéria, busca a Fortuna. Guarde o efeito de reviver da Strelitzia para depois.",
              "2. A Fortuna se Invoca no centro vazio e coloca [[Elfnotes: Rhapsodia of Madness]]. Fortuna e Strelitzia fazem [[Purification Power Patron]], que busca [[Theorealized Medius]]; ele se Invoca, busca [[Theorealize Past Lull]], e o Past Lull Invoca [[Medius the Pure]], que traz [[Vidolium the Unstable Power Patron of Unity]].",
              "3. Purification e Medius fazem [[Haggard Lizardose]]; a sequência de buscas e Invocações Ars Magna leva a [[Mediclius the Extraordinary Power Patron]] e a 2 monstros de Nível 8 para o [[Number 90: Galaxy-Eyes Photon Lord]].",
              "4. Extensão sem interrupção: Vidolium revive o Patron e busca [[Junoldo the Shadespirit Power Patron]]; a Rhapsodia revive a Fortuna e o aumento de Nível do Patron faz a [[Elfnote June Pride]], que traz a [[Elfnote Regina]] do Deck. Regina e Lucina viram [[I:P Masquerena]], e Strelitzia + Patron fazem [[Adamancipator Risen - Dragite]].",
              "Ordem importa: o Patron virado para cima só deixa Invocar Sincros do Extra Deck, e o reviver da Strelitzia trava em Sincros pelo resto do turno. Por isso os Links e o Xyz vêm **antes** do reviver.",
              "Campo final sem interrupção: Mediclius, Number 90, Dragite, I:P Masquerena e Theorealized Medius, com [[Ars Magna \"Citrinitas\"]] e a Rhapsodia, a Regina na mão e o Haggard no Cemitério (é o monstro de ÁGUA que o Dragite precisa).",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "O que o campo faz no turno do oponente",
            itens: [
              "[[Mediclius the Extraordinary Power Patron]] ganha efeitos pelo número de monstros para os quais aponta: com 2, fica imune aos efeitos ativados do oponente; com 3, no turno dele, bane a si mesmo e todas as cartas do oponente. Tirar um dos monstros apontados desliga esses efeitos.",
              "[[Number 90: Galaxy-Eyes Photon Lord]] desanexa 1 matéria para negar 1 efeito de monstro. Com matérias Ars Magna (que não são \"Galaxy\"), ele nega mas **não destrói**.",
              "[[Adamancipator Risen - Dragite]] nega Mágica/Armadilha enquanto houver monstro de ÁGUA no seu Cemitério: banir o [[Haggard Lizardose]] desliga essa negação.",
              "[[I:P Masquerena]] faz Link no turno do oponente (normalmente o [[S:P Little Knight]]). A Rhapsodia nega os efeitos de 1 carta virada para cima do oponente só se você controlar um Sincro.",
            ],
          },
          {
            titulo: "Contra o deck: onde parar",
            itens: [
              "[[Ash Blossom & Joyous Spring]], [[Effect Veiler]] ou [[Infinite Impermanence]] na Lucina param a primeira busca. O corpo da Lucina ainda serve para outro starter (Medius ou [[Pendulum Treasure]]), então mãos com 2 starters continuam.",
              "[[Droll & Lock Bird]] depois da primeira adição corta as buscas, mas não colocações nem Invocações: a June Pride ainda pode trazer a Fortuna para a Rhapsodia.",
              "[[Mulcharmy Fuwalos]] cobra Invocações do Deck e do Extra Deck; contra ela, o deck costuma parar cedo (Purification, Theorealized Medius e um Ars Magna) em vez de ir ao Number 90. [[Mulcharmy Purulia]] cobra Invocações da mão e Normais.",
              "[[Nibiru, the Primal Being]] funciona antes do Number 90 estar pronto. Depois disso, o Number 90 nega o Nibiru.",
            ],
          },
        ],
      },
      en: {
        iniciais: [
          {
            titulo: "October 2026 banlist and the current combo",
            itens: [
              "On the October 19, 2026 TCG list, [[Elfnote Tinia]], [[Crystal Wing Synchro Dragon]] and [[F.A. Dawn Dragster]] are **Forbidden**, and [[Droll & Lock Bird]] is at 1 copy. Current lists replaced those pieces with an [[Elfnote Fortuna]] bridge and the Ars Magna engine.",
              "1. [[Elfnote Lucina]] searches [[Elfnote Power Patron]]. Normal Summon Patron and Synchro Summon [[Elfnote Seraphim Strelitzia]] with both; Patron, as material, searches Fortuna. Save Strelitzia's revival for later.",
              "2. Fortuna summons itself to the empty center zone and places [[Elfnotes: Rhapsodia of Madness]]. Fortuna and Strelitzia make [[Purification Power Patron]], which searches [[Theorealized Medius]]; it summons itself and searches [[Theorealize Past Lull]], and Past Lull summons [[Medius the Pure]], which adds [[Vidolium the Unstable Power Patron of Unity]].",
              "3. Purification and Medius make [[Haggard Lizardose]]; the chain of Ars Magna searches and summons leads to [[Mediclius the Extraordinary Power Patron]] and 2 Level 8 monsters for [[Number 90: Galaxy-Eyes Photon Lord]].",
              "4. Unimpeded extension: Vidolium revives Patron and searches [[Junoldo the Shadespirit Power Patron]]; Rhapsodia revives Fortuna and Patron's Level boost makes [[Elfnote June Pride]], which brings [[Elfnote Regina]] from the Deck. Regina and Lucina become [[I:P Masquerena]], and Strelitzia + Patron make [[Adamancipator Risen - Dragite]].",
              "Order matters: a face-up Patron only lets you Special Summon Synchros from the Extra Deck, and Strelitzia's revival locks you into Synchros for the rest of the turn. That is why the Links and the Xyz come **before** the revival.",
              "Unimpeded end board: Mediclius, Number 90, Dragite, I:P Masquerena and Theorealized Medius, with [[Ars Magna \"Citrinitas\"]] and Rhapsodia, Regina in hand and Haggard in the GY (it is the WATER monster Dragite needs).",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "What the board does on your opponent's turn",
            itens: [
              "[[Mediclius the Extraordinary Power Patron]] gains effects by how many monsters it points to: with 2 it is unaffected by your opponent's activated effects; with 3, on their turn, it banishes itself and every card they control. Removing a pointed monster turns those effects off.",
              "[[Number 90: Galaxy-Eyes Photon Lord]] detaches 1 material to negate 1 monster effect. With Ars Magna materials (not \"Galaxy\" cards) it negates but does **not destroy**.",
              "[[Adamancipator Risen - Dragite]] negates Spells/Traps while a WATER monster is in your GY: banishing [[Haggard Lizardose]] turns that negate off.",
              "[[I:P Masquerena]] Link Summons on your opponent's turn (usually [[S:P Little Knight]]). Rhapsodia negates 1 face-up opposing card only if you control a Synchro.",
            ],
          },
          {
            titulo: "Against the deck: where to stop it",
            itens: [
              "[[Ash Blossom & Joyous Spring]], [[Effect Veiler]] or [[Infinite Impermanence]] on Lucina stop the first search. Lucina's body still works with another starter (Medius or [[Pendulum Treasure]]), so 2-starter hands keep going.",
              "[[Droll & Lock Bird]] after the first add cuts the searches, but not placements or summons: June Pride can still bring Fortuna for Rhapsodia.",
              "[[Mulcharmy Fuwalos]] charges Deck and Extra Deck summons; against it the deck tends to stop early (Purification, Theorealized Medius and one Ars Magna) instead of reaching Number 90. [[Mulcharmy Purulia]] charges hand summons and Normal Summons.",
              "[[Nibiru, the Primal Being]] works before Number 90 is ready. After that, Number 90 negates Nibiru.",
            ],
          },
        ],
      },
      es: {
        iniciais: [
          {
            titulo: "Banlist de octubre de 2026 y el combo actual",
            itens: [
              "En la lista TCG del 19 de octubre de 2026, [[Elfnote Tinia]], [[Crystal Wing Synchro Dragon]] y [[F.A. Dawn Dragster]] están **Prohibidos**, y [[Droll & Lock Bird]] queda a 1 copia. Las listas actuales cambiaron esas piezas por un puente con [[Elfnote Fortuna]] y por el motor Ars Magna.",
              "1. [[Elfnote Lucina]] busca [[Elfnote Power Patron]]. Invoca de Modo Normal a Patron e Invoca por Sincronía [[Elfnote Seraphim Strelitzia]] con los dos; Patron, como material, busca a Fortuna. Guarda la revivida de Strelitzia para después.",
              "2. Fortuna se Invoca en la zona central vacía y coloca [[Elfnotes: Rhapsodia of Madness]]. Fortuna y Strelitzia hacen [[Purification Power Patron]], que busca [[Theorealized Medius]]; este se Invoca, busca [[Theorealize Past Lull]], y Past Lull Invoca a [[Medius the Pure]], que añade [[Vidolium the Unstable Power Patron of Unity]].",
              "3. Purification y Medius hacen [[Haggard Lizardose]]; la secuencia de búsquedas e Invocaciones Ars Magna lleva a [[Mediclius the Extraordinary Power Patron]] y a 2 monstruos de Nivel 8 para [[Number 90: Galaxy-Eyes Photon Lord]].",
              "4. Extensión sin interrupción: Vidolium revive a Patron y busca [[Junoldo the Shadespirit Power Patron]]; Rhapsodia revive a Fortuna y el aumento de Nivel de Patron hace a [[Elfnote June Pride]], que trae a [[Elfnote Regina]] del Deck. Regina y Lucina se vuelven [[I:P Masquerena]], y Strelitzia + Patron hacen [[Adamancipator Risen - Dragite]].",
              "El orden importa: Patron boca arriba solo te deja Invocar Sincronías del Deck Extra, y la revivida de Strelitzia te limita a Sincronías el resto del turno. Por eso los Link y el Xyz van **antes** de la revivida.",
              "Campo final sin interrupción: Mediclius, Number 90, Dragite, I:P Masquerena y Theorealized Medius, con [[Ars Magna \"Citrinitas\"]] y Rhapsodia, Regina en la mano y Haggard en el Cementerio (es el monstruo de AGUA que Dragite necesita).",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Qué hace el campo en el turno rival",
            itens: [
              "[[Mediclius the Extraordinary Power Patron]] gana efectos según cuántos monstruos apunta: con 2 no le afectan los efectos activados del rival; con 3, en el turno rival, se destierra a sí mismo y a todas las cartas del rival. Quitar un monstruo apuntado apaga esos efectos.",
              "[[Number 90: Galaxy-Eyes Photon Lord]] desacopla 1 material para negar 1 efecto de monstruo. Con materiales Ars Magna (que no son \"Galaxy\") niega pero **no destruye**.",
              "[[Adamancipator Risen - Dragite]] niega Mágicas/Trampas mientras haya un monstruo de AGUA en tu Cementerio: desterrar a [[Haggard Lizardose]] apaga esa negación.",
              "[[I:P Masquerena]] hace Invocaciones por Enlace en el turno rival (normalmente [[S:P Little Knight]]). Rhapsodia niega 1 carta rival boca arriba solo si controlas una Sincronía.",
            ],
          },
          {
            titulo: "Contra el deck: dónde pararlo",
            itens: [
              "[[Ash Blossom & Joyous Spring]], [[Effect Veiler]] o [[Infinite Impermanence]] sobre Lucina paran la primera búsqueda. El cuerpo de Lucina sirve con otro iniciador (Medius o [[Pendulum Treasure]]), así que las manos con 2 iniciadores siguen.",
              "[[Droll & Lock Bird]] tras la primera adición corta las búsquedas, pero no las colocaciones ni las Invocaciones: June Pride todavía puede traer a Fortuna para Rhapsodia.",
              "[[Mulcharmy Fuwalos]] cobra las Invocaciones desde el Deck y el Deck Extra; contra ella el deck suele parar pronto (Purification, Theorealized Medius y un Ars Magna) en vez de llegar a Number 90. [[Mulcharmy Purulia]] cobra Invocaciones desde la mano y Normales.",
              "[[Nibiru, the Primal Being]] funciona antes de que Number 90 esté listo. Después, Number 90 niega a Nibiru.",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Light and Darkness Ritual (Dark Magician)
  {
    arquetipo: "Light and Darkness Ritual",
    revisado: "2026-11",
    textos: {
      pt: {
        iniciais: [
          {
            titulo: "Combo principal (versão Dark Magician): 1 starter + 2 cartas",
            itens: [
              "Starters: [[Dark Magical Curtain]], [[Dark Magician Girl the Magician's Apprentice]] ou [[Magician's Rod]], cada um com quaisquer 2 outras cartas (uma é descartada para a Invocação da Dark Magician Girl e o [[Illusion of Chaos]] coloca a outra no topo do Deck).",
              "1. Number 90 primeiro: o Curtain Invoca o [[Dark Magician]] e busca [[Soul Servant]], que compra a Dark Magician Girl; ela busca [[Shining Sarcophagus]], que traz [[Gandora-G the Dragon of Destruction]]. O [[Dark Magician of Destruction]] e o Gandora-G fazem o [[Number 90: Galaxy-Eyes Photon Lord]] na 5ª Invocação.",
              "2. Rumo ao Illusion of Chaos: o Rod busca [[The Gaze of Timaeus]]; a [[Cyberse Contract Witch]] busca o Illusion of Chaos, que traz o [[Dark Magician, the Pharaoh's Servant]], que coloca o [[Chaos Form]].",
              "3. Ponte Sincro: o Gaze faz o [[Master of Chaos]], que revive o Rod; [[Magistus Chorozo]] e Rod fazem o [[Clear Wing Synchro Dragon]], e o Chaos Form Invoca o Illusion of Chaos por Ritual.",
              "4. A Witch revive o Master of Chaos, a [[Selene, Queen of the Master Magicians]] revive o Chorozo, e o [[Crimson Dragon]] vira [[Crimson Blade Dragon]], que pega o [[Black Chaos]].",
              "5. O Black Chaos coloca o [[Mind Shuffle]], que busca o [[Skull Archfiend of Chaos]]; o [[Light and Darkness Ritual]] Invoca o [[Magician of Dark Chaos - Black Chaos]], e Black Chaos + Crimson Blade viram [[I:P Masquerena]].",
              "Campo final: I:P Masquerena, Skull Archfiend, Magician of Dark Chaos, Clear Wing, Number 90 e Selene, com o Mind Shuffle virado para cima e o Gaze baixado. Começando pelo [[Ragged Records of Rites]] ou pelo Illusion of Chaos, sai o mesmo campo sem o Number 90.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "O que o campo faz no turno do oponente",
            itens: [
              "[[Number 90: Galaxy-Eyes Photon Lord]] nega o primeiro efeito de monstro que importar (1 vez por turno).",
              "[[Clear Wing Synchro Dragon]] nega, 1 vez cada, um monstro de Nível 5+ que ativa efeito no campo e um efeito que alveja 1 monstro de Nível 5+.",
              "[[Magician of Dark Chaos - Black Chaos]] não é afetado por efeitos ativados do oponente que não o alvejem, e enquanto está virado para cima as suas Mágicas/Armadilhas não podem ser destruídas nem banidas por efeitos do oponente.",
              "[[Mind Shuffle]]: no turno do oponente busca (ex.: [[Griffoh]]) e, quando ele ativa algo, devolve 1 monstro de Nível 7+ à mão para Invocar o [[Black Luster Soldier - Soldier of Light and Darkness]], que bane uma carta.",
              "[[I:P Masquerena]] faz Link no turno do oponente ([[S:P Little Knight]] ou outro Link com a Selene e o Skull Archfiend).",
            ],
          },
          {
            titulo: "Contra o deck: Nibiru e indo segundo",
            itens: [
              "Onde o [[Nibiru, the Primal Being]] cai depende do starter: pelo Curtain e pela Dark Magician Girl, o Number 90 já está em campo na 5ª Invocação e nega o Nibiru. Pelo Rod, a 5ª Invocação é o Gandora-G, antes do Number 90: aí o Nibiru resolve. Pelo Ragged Records, a 5ª é o Chorozo.",
              "O Tributo do Nibiru não alveja, mas o [[Magician of Dark Chaos - Black Chaos]] não é afetado por efeitos que não o alvejem: ele fica em campo.",
              "Indo segundo: gaste a negação do Number 90 com um efeito de monstro barato antes do que importa. Contra o Magician of Dark Chaos, use efeitos que o alvejem.",
            ],
          },
        ],
      },
      en: {
        iniciais: [
          {
            titulo: "Main combo (Dark Magician version): 1 starter + 2 cards",
            itens: [
              "Starters: [[Dark Magical Curtain]], [[Dark Magician Girl the Magician's Apprentice]] or [[Magician's Rod]], each with any 2 other cards (one is discarded for Dark Magician Girl's summon and [[Illusion of Chaos]] places the other on top of the Deck).",
              "1. Number 90 first: Curtain summons [[Dark Magician]] and searches [[Soul Servant]], which draws Dark Magician Girl; she searches [[Shining Sarcophagus]], which brings [[Gandora-G the Dragon of Destruction]]. [[Dark Magician of Destruction]] and Gandora-G make [[Number 90: Galaxy-Eyes Photon Lord]] as the 5th summon.",
              "2. Into Illusion of Chaos: Rod searches [[The Gaze of Timaeus]]; [[Cyberse Contract Witch]] searches Illusion of Chaos, which brings [[Dark Magician, the Pharaoh's Servant]], which Sets [[Chaos Form]].",
              "3. Synchro bridge: Gaze makes [[Master of Chaos]], which revives Rod; [[Magistus Chorozo]] and Rod make [[Clear Wing Synchro Dragon]], and Chaos Form Ritual Summons Illusion of Chaos.",
              "4. Witch revives Master of Chaos, [[Selene, Queen of the Master Magicians]] revives Chorozo, and [[Crimson Dragon]] becomes [[Crimson Blade Dragon]], which takes [[Black Chaos]].",
              "5. Black Chaos places [[Mind Shuffle]], which searches [[Skull Archfiend of Chaos]]; [[Light and Darkness Ritual]] summons [[Magician of Dark Chaos - Black Chaos]], and Black Chaos + Crimson Blade become [[I:P Masquerena]].",
              "End board: I:P Masquerena, Skull Archfiend, Magician of Dark Chaos, Clear Wing, Number 90 and Selene, with Mind Shuffle face-up and Gaze Set. Starting from [[Ragged Records of Rites]] or Illusion of Chaos gives the same board without Number 90.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "What the board does on your opponent's turn",
            itens: [
              "[[Number 90: Galaxy-Eyes Photon Lord]] negates the first monster effect that matters (once per turn).",
              "[[Clear Wing Synchro Dragon]] negates, once each, a Level 5+ monster activating its effect on the field and an effect that targets 1 Level 5+ monster.",
              "[[Magician of Dark Chaos - Black Chaos]] is unaffected by your opponent's activated effects that do not target it, and while it is face-up your Spells/Traps cannot be destroyed or banished by their effects.",
              "[[Mind Shuffle]]: searches on your opponent's turn (e.g., [[Griffoh]]) and, when they activate something, returns 1 Level 7+ monster to the hand to summon [[Black Luster Soldier - Soldier of Light and Darkness]], which banishes a card.",
              "[[I:P Masquerena]] Link Summons on your opponent's turn ([[S:P Little Knight]] or another Link with Selene and Skull Archfiend).",
            ],
          },
          {
            titulo: "Against the deck: Nibiru and going second",
            itens: [
              "Where [[Nibiru, the Primal Being]] lands depends on the starter: from Curtain and Dark Magician Girl, Number 90 is already on the field by the 5th summon and negates Nibiru. From Rod, the 5th summon is Gandora-G, before Number 90: Nibiru resolves. From Ragged Records, the 5th is Chorozo.",
              "Nibiru's Tribute does not target, but [[Magician of Dark Chaos - Black Chaos]] is unaffected by effects that do not target it: it stays on the field.",
              "Going second: spend Number 90's negate on a cheap monster effect before the one that matters. Against Magician of Dark Chaos, use effects that target it.",
            ],
          },
        ],
      },
      es: {
        iniciais: [
          {
            titulo: "Combo principal (versión Dark Magician): 1 iniciador + 2 cartas",
            itens: [
              "Iniciadores: [[Dark Magical Curtain]], [[Dark Magician Girl the Magician's Apprentice]] o [[Magician's Rod]], cada uno con otras 2 cartas cualesquiera (una se descarta para la Invocación de Dark Magician Girl e [[Illusion of Chaos]] coloca la otra en la parte superior del Deck).",
              "1. Primero Number 90: Curtain Invoca a [[Dark Magician]] y busca [[Soul Servant]], que roba a Dark Magician Girl; ella busca [[Shining Sarcophagus]], que trae a [[Gandora-G the Dragon of Destruction]]. [[Dark Magician of Destruction]] y Gandora-G hacen [[Number 90: Galaxy-Eyes Photon Lord]] en la 5ª Invocación.",
              "2. Hacia Illusion of Chaos: Rod busca [[The Gaze of Timaeus]]; [[Cyberse Contract Witch]] busca Illusion of Chaos, que trae a [[Dark Magician, the Pharaoh's Servant]], que coloca [[Chaos Form]].",
              "3. Puente de Sincronía: Gaze hace a [[Master of Chaos]], que revive a Rod; [[Magistus Chorozo]] y Rod hacen [[Clear Wing Synchro Dragon]], y Chaos Form Invoca por Ritual a Illusion of Chaos.",
              "4. Witch revive a Master of Chaos, [[Selene, Queen of the Master Magicians]] revive a Chorozo, y [[Crimson Dragon]] pasa a [[Crimson Blade Dragon]], que toma a [[Black Chaos]].",
              "5. Black Chaos coloca [[Mind Shuffle]], que busca [[Skull Archfiend of Chaos]]; [[Light and Darkness Ritual]] Invoca a [[Magician of Dark Chaos - Black Chaos]], y Black Chaos + Crimson Blade se vuelven [[I:P Masquerena]].",
              "Campo final: I:P Masquerena, Skull Archfiend, Magician of Dark Chaos, Clear Wing, Number 90 y Selene, con Mind Shuffle boca arriba y Gaze colocada. Empezando por [[Ragged Records of Rites]] o por Illusion of Chaos sale el mismo campo sin Number 90.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Qué hace el campo en el turno rival",
            itens: [
              "[[Number 90: Galaxy-Eyes Photon Lord]] niega el primer efecto de monstruo que importe (1 vez por turno).",
              "[[Clear Wing Synchro Dragon]] niega, 1 vez cada uno, a un monstruo de Nivel 5+ que active su efecto en el campo y un efecto que seleccione a 1 monstruo de Nivel 5+.",
              "[[Magician of Dark Chaos - Black Chaos]] no es afectado por los efectos activados del rival que no lo seleccionen, y mientras esté boca arriba tus Mágicas/Trampas no pueden ser destruidas ni desterradas por efectos rivales.",
              "[[Mind Shuffle]]: busca en el turno rival (p. ej., [[Griffoh]]) y, cuando el rival activa algo, devuelve 1 monstruo de Nivel 7+ a la mano para Invocar a [[Black Luster Soldier - Soldier of Light and Darkness]], que destierra una carta.",
              "[[I:P Masquerena]] hace Invocaciones por Enlace en el turno rival ([[S:P Little Knight]] u otro Enlace con Selene y Skull Archfiend).",
            ],
          },
          {
            titulo: "Contra el deck: Nibiru y yendo segundo",
            itens: [
              "Dónde cae [[Nibiru, the Primal Being]] depende del iniciador: desde Curtain y Dark Magician Girl, Number 90 ya está en el campo en la 5ª Invocación y niega a Nibiru. Desde Rod, la 5ª es Gandora-G, antes de Number 90: Nibiru se resuelve. Desde Ragged Records, la 5ª es Chorozo.",
              "El Sacrificio de Nibiru no selecciona, pero [[Magician of Dark Chaos - Black Chaos]] no es afectado por efectos que no lo seleccionen: se queda en el campo.",
              "Yendo segundo: gasta la negación de Number 90 con un efecto de monstruo barato antes del que importa. Contra Magician of Dark Chaos, usa efectos que lo seleccionen.",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Mitsurugi (pilha com Dark Magician e Azamina)
  {
    arquetipo: "Mitsurugi",
    revisado: "2026-11",
    textos: {
      pt: {
        iniciais: [
          {
            titulo: "Combo principal: 1 Habakiri",
            itens: [
              "1. Revele [[Ame no Habakiri no Mitsurugi]] na mão: Invoque [[Mitsurugi no Mikoto, Saji]] do Deck e ofereça-o como Tributo; o Saji busca [[Mitsurugi Ritual]]. O revelar do Habakiri é **1 vez por Duelo**.",
              "2. O Mitsurugi Ritual Invoca [[Ame no Murakumo no Mitsurugi]] do Deck oferecendo o Habakiri da mão; o Habakiri, Tributado, busca [[Mitsurugi Prayers]]. A partir daqui, o Murakumo cobra cada hand trap do oponente.",
              "3. Ative o Prayers oferecendo o Murakumo e aplique os dois efeitos: busque [[Mitsurugi no Mikoto, Aramasa]] e, pagando 800, reviva o Saji. O Murakumo, Tributado, busca o 2º Prayers e volta ao campo.",
              "4. Baixe o 2º Prayers (só 1 Prayers por turno): ele espera o turno do oponente.",
              "Campo: Murakumo, Saji e Prayers baixado, com o Aramasa na mão, em 4 Invocações (uma a menos que o Nibiru pede), com 7.200 PV.",
              "Na pilha de 60 cartas com Dark Magician, [[Light and Darkness Ritual]] e Azamina, o mesmo começo continua com uma carta a mais até [[Red-Eyes Dark Dragoon]] e [[Azamina Ilia Silvia]] ao lado do Murakumo, com [[Mitsurugi Prayers]] e [[Deception of the Sinful Spoils]] baixados. Essa linha longa passa de 15 Invocações.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Contra o deck: onde parar",
            itens: [
              "**Bata antes do Murakumo.** [[Ash Blossom & Joyous Spring]] no revelar do Habakiri, na busca do Saji ou no Mitsurugi Ritual deixa a mão de 1 Habakiri sem nada (o revelar já foi gasto no Duelo) e não paga a taxa do Murakumo. Com uma 2ª carta Mitsurugi (Ritual, [[Pre-Preparation of Rites]] ou Prayers), o deck continua.",
              "[[Droll & Lock Bird]] depois da busca do Saji: de 1 Habakiri, o turno termina só no Murakumo.",
              "[[Mulcharmy Fuwalos]] e [[Mulcharmy Purulia]] cedo fazem o deck parar no campo curto (Murakumo e Prayers) em vez de te dar compras.",
              "[[Nibiru, the Primal Being]] só cai na linha longa (5ª Invocação: o Aramasa). A linha curta nunca chega a 5.",
              "[[Effect Veiler]] e [[Infinite Impermanence]] no Murakumo antes do Prayers rendem pouco: o efeito de Tributo dele funciona no Cemitério. Guarde-os para o seu turno.",
              "[[Ghost Ogre & Snow Rabbit]] quase não age na linha curta: o revelar é na mão e as buscas acontecem com as cartas já no Cemitério.",
            ],
          },
          {
            titulo: "Contra o deck: indo segundo",
            itens: [
              "As respostas são a taxa do Murakumo (você descarta ou o efeito é negado), o [[Red-Eyes Dark Dragoon]] (o dono descarta para negar), a [[Azamina Ilia Silvia]] (oferece-se como Tributo para negar, sem destruir) e a limpeza de campo. Cada uma é 1 vez por turno.",
              "A limpeza: o Prayers oferece o Murakumo, o efeito de Tributo dele busca uma carta Mitsurugi e o traz de volta, e a Invocação destrói todos os seus monstros. [[Ash Blossom & Joyous Spring]] nesse efeito de Tributo impede a volta; Ash no Prayers não, porque o Murakumo já foi Tributado. Um [[Droll & Lock Bird]] resolvido antes também impede a busca e a volta.",
              "O Dragoon não pode ser alvejado nem destruído por efeitos: use banir sem alvo, Tributo ou tomar o controle. Enquanto o Habakiri estiver no campo, seus monstros perdem 800 de ATK.",
            ],
          },
        ],
      },
      en: {
        iniciais: [
          {
            titulo: "Main combo: 1 Habakiri",
            itens: [
              "1. Reveal [[Ame no Habakiri no Mitsurugi]] in your hand: Special Summon [[Mitsurugi no Mikoto, Saji]] from the Deck and Tribute it; Saji searches [[Mitsurugi Ritual]]. Habakiri's reveal is **once per Duel**.",
              "2. Mitsurugi Ritual summons [[Ame no Murakumo no Mitsurugi]] from the Deck by Tributing Habakiri from the hand; Habakiri, Tributed, searches [[Mitsurugi Prayers]]. From here on, Murakumo taxes every hand trap your opponent activates.",
              "3. Activate Prayers Tributing Murakumo and apply both effects: search [[Mitsurugi no Mikoto, Aramasa]] and, paying 800, revive Saji. Murakumo, Tributed, searches the 2nd Prayers and comes back to the field.",
              "4. Set the 2nd Prayers (only 1 Prayers per turn): it waits for your opponent's turn.",
              "Board: Murakumo, Saji and a Set Prayers, with Aramasa in hand, in 4 summons (one short of what Nibiru needs), at 7,200 LP.",
              "In the 60-card pile with Dark Magician, [[Light and Darkness Ritual]] and Azamina, the same start goes on with one more card to [[Red-Eyes Dark Dragoon]] and [[Azamina Ilia Silvia]] next to Murakumo, with [[Mitsurugi Prayers]] and [[Deception of the Sinful Spoils]] Set. That long line goes past 15 summons.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Against the deck: where to stop it",
            itens: [
              "**Hit before Murakumo.** [[Ash Blossom & Joyous Spring]] on Habakiri's reveal, Saji's search or Mitsurugi Ritual leaves a 1-Habakiri hand with nothing (the reveal is spent for the Duel) and pays no Murakumo tax. With a 2nd Mitsurugi card (Ritual, [[Pre-Preparation of Rites]] or Prayers), the deck keeps going.",
              "[[Droll & Lock Bird]] after Saji's search: from 1 Habakiri, the turn ends on Murakumo alone.",
              "[[Mulcharmy Fuwalos]] and [[Mulcharmy Purulia]] early make the deck stop on the short board (Murakumo and Prayers) instead of giving you draws.",
              "[[Nibiru, the Primal Being]] only lands in the long line (5th summon: Aramasa). The short line never reaches 5.",
              "[[Effect Veiler]] and [[Infinite Impermanence]] on Murakumo before Prayers do little: its Tribute effect works from the GY. Save them for your own turn.",
              "[[Ghost Ogre & Snow Rabbit]] barely does anything in the short line: the reveal is in the hand and the searches happen with the cards already in the GY.",
            ],
          },
          {
            titulo: "Against the deck: going second",
            itens: [
              "Its answers are Murakumo's tax (you discard or the effect is negated), [[Red-Eyes Dark Dragoon]] (its owner discards to negate), [[Azamina Ilia Silvia]] (Tributes itself to negate, without destroying) and the board wipe. Each is once per turn.",
              "The wipe: Prayers Tributes Murakumo, its Tribute effect searches a Mitsurugi card and brings it back, and its summon destroys all your monsters. [[Ash Blossom & Joyous Spring]] on that Tribute effect stops the return; Ash on Prayers does not, since Murakumo is already Tributed. A [[Droll & Lock Bird]] resolved earlier also stops the search and the return.",
              "Dragoon cannot be targeted or destroyed by card effects: use non-targeting banish, Tribute or control change. While Habakiri is on the field, your monsters lose 800 ATK.",
            ],
          },
        ],
      },
      es: {
        iniciais: [
          {
            titulo: "Combo principal: 1 Habakiri",
            itens: [
              "1. Revela [[Ame no Habakiri no Mitsurugi]] en tu mano: Invoca de Modo Especial a [[Mitsurugi no Mikoto, Saji]] del Deck y Sacrifícalo; Saji busca [[Mitsurugi Ritual]]. El revelar de Habakiri es **1 vez por Duelo**.",
              "2. Mitsurugi Ritual Invoca a [[Ame no Murakumo no Mitsurugi]] del Deck Sacrificando a Habakiri de la mano; Habakiri, Sacrificado, busca [[Mitsurugi Prayers]]. Desde aquí, Murakumo cobra cada hand trap del rival.",
              "3. Activa Prayers Sacrificando a Murakumo y aplica los dos efectos: busca [[Mitsurugi no Mikoto, Aramasa]] y, pagando 800, revive a Saji. Murakumo, Sacrificado, busca el 2º Prayers y vuelve al campo.",
              "4. Coloca el 2º Prayers (solo 1 Prayers por turno): espera el turno rival.",
              "Campo: Murakumo, Saji y Prayers colocada, con Aramasa en la mano, en 4 Invocaciones (una menos de las que pide Nibiru), con 7.200 LP.",
              "En la pila de 60 cartas con Dark Magician, [[Light and Darkness Ritual]] y Azamina, el mismo inicio sigue con una carta más hasta [[Red-Eyes Dark Dragoon]] y [[Azamina Ilia Silvia]] junto a Murakumo, con [[Mitsurugi Prayers]] y [[Deception of the Sinful Spoils]] colocadas. Esa línea larga pasa de 15 Invocaciones.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Contra el deck: dónde pararlo",
            itens: [
              "**Golpea antes de Murakumo.** [[Ash Blossom & Joyous Spring]] en el revelar de Habakiri, en la búsqueda de Saji o en Mitsurugi Ritual deja sin nada a una mano de 1 Habakiri (el revelar ya se gastó en el Duelo) y no paga el impuesto de Murakumo. Con una 2ª carta Mitsurugi (Ritual, [[Pre-Preparation of Rites]] o Prayers), el deck sigue.",
              "[[Droll & Lock Bird]] tras la búsqueda de Saji: desde 1 Habakiri, el turno termina solo en Murakumo.",
              "[[Mulcharmy Fuwalos]] y [[Mulcharmy Purulia]] pronto hacen que el deck pare en el campo corto (Murakumo y Prayers) en vez de darte robos.",
              "[[Nibiru, the Primal Being]] solo cae en la línea larga (5ª Invocación: Aramasa). La línea corta nunca llega a 5.",
              "[[Effect Veiler]] e [[Infinite Impermanence]] sobre Murakumo antes de Prayers rinden poco: su efecto de Sacrificio funciona en el Cementerio. Guárdalos para tu turno.",
              "[[Ghost Ogre & Snow Rabbit]] casi no actúa en la línea corta: el revelar es en la mano y las búsquedas ocurren con las cartas ya en el Cementerio.",
            ],
          },
          {
            titulo: "Contra el deck: yendo segundo",
            itens: [
              "Sus respuestas son el impuesto de Murakumo (descartas o el efecto se niega), [[Red-Eyes Dark Dragoon]] (su dueño descarta para negar), [[Azamina Ilia Silvia]] (se Sacrifica para negar, sin destruir) y la limpieza de campo. Cada una es 1 vez por turno.",
              "La limpieza: Prayers Sacrifica a Murakumo, su efecto de Sacrificio busca una carta Mitsurugi y lo devuelve, y su Invocación destruye todos tus monstruos. [[Ash Blossom & Joyous Spring]] en ese efecto de Sacrificio impide la vuelta; Ash en Prayers no, porque Murakumo ya fue Sacrificado. Un [[Droll & Lock Bird]] resuelto antes también impide la búsqueda y la vuelta.",
              "Dragoon no puede ser seleccionado ni destruido por efectos: usa destierro sin selección, Sacrificio o cambio de control. Mientras Habakiri esté en el campo, tus monstruos pierden 800 ATK.",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Angelechy
  {
    arquetipo: "Angelechy",
    revisado: "2026-11",
    textos: {
      pt: {
        resumo:
          "Deck de Sincros que quase nunca são Invocados por Sincro: os efeitos os colocam **na Zona de Mágicas e Armadilhas como Mágicas Contínuas** (\"guardados\"), onde cada um aplica uma trava enquanto fica lá. Com 30 Mágicas/Armadilhas em 40 cartas, o deck vence por dano de efeito, pelo [[Angelechy Verdict]] ou em batalha.",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "Cada Sincro \"Angelechy\" tem 3 efeitos: banir algo enquanto é monstro (1 vez por turno), um efeito quando é colocado na Zona de Mágicas e Armadilhas e uma trava contínua enquanto está guardado lá.",
              "As travas: [[Angelechy Destrier]] causa 500 de dano ao oponente a cada carta ou efeito que ele ativa; [[Angelechy Bastion]] impede que efeitos do oponente destruam as outras cartas \"Angelechy\"; [[Angelechy Shatranga]] limita o oponente a tentar ativar 5 efeitos de monstro por turno; [[Angelechy Castellan]] deixa cada jogador ativar só 1 carta ou efeito por Corrente.",
              "[[Angelechy Problem]] (Campo) descarta 1 Mágica/Armadilha para Invocar o [[Angelechy Enlisted]] (Nível 2) e guardar outro Sincro. É por isso que o deck joga tantas Mágicas e Armadilhas: elas são o custo.",
              "O campo indo primeiro inclui o [[Black-Winged Assault Dragon]], que causa 700 a cada efeito de monstro do oponente, e um [[Angelechy Opening to e4]] baixado, que monta mais campo no turno do oponente.",
            ],
          },
          {
            titulo: "Combo principal: Opposition + 1 Mágica/Armadilha",
            itens: [
              "1. [[Angelechy Opposition]] escolhendo [[Angelechy Seneschal]] e [[Angelechy Destrier]]: o Seneschal vai para o campo **do oponente** e o Destrier é guardado. Pelo resto do turno, você só Invoca do Extra Deck Sincros de LUZ ou TREVAS.",
              "2. O Destrier, guardado, busca o [[Angelechy Problem]]. A Invocação do Seneschal deixa cada jogador Invocar 1 Sincro Fada com efeitos negados: você Invoca o [[Angelechy Bastion]]. Quem ativou o efeito do Seneschal foi o oponente (ele controla o monstro), então o Destrier já cobra 500 dele.",
              "3. Ative o Problem: descarte 1 Mágica/Armadilha, Invoque o [[Angelechy Enlisted]] e guarde o [[Angelechy Castellan]], que envia o [[Angelechy Verdict]] ao Cemitério.",
              "4. Sincro do [[Black-Winged Assault Dragon]] com Enlisted e Bastion (2 + 8); o Bastion volta ao Extra Deck por causa do Seneschal.",
              "5. Bana o Verdict do Cemitério para mandar o Castellan ao Cemitério e guardar o outro Bastion; o Bastion guarda o [[Angelechy Shatranga]], que busca o [[Angelechy Opening to e4]].",
              "6. Bana a Opposition do Cemitério para embaralhar Castellan e Verdict de volta; bana o [[Angelechy Disturbance]] descartado para buscar outra Mágica/Armadilha \"Angelechy\". Baixe o Opening to e4.",
              "Campo: Assault Dragon; Destrier, Bastion e Shatranga guardados; Opening to e4 baixado; Problem no Campo. O oponente controla o Seneschal e está com 7.500 PV.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "A conta que decide o jogo",
            itens: [
              "Com 7.500 PV, cada efeito de monstro do oponente que resolve custa 1.200 (700 do Assault Dragon + 500 do Destrier), e cada Mágica/Armadilha custa 500. Cinco efeitos de monstro (o máximo do Shatranga) e três Mágicas/Armadilhas somam exatamente 7.500.",
              "Com 4 Marcadores de Pena Negra, o Assault Dragon pode se oferecer como Tributo no turno do oponente para destruir todas as cartas do campo. Ele não é \"Angelechy\", então o Bastion não o protege.",
              "O [[Angelechy Verdict]] conta as Cartas de Monstro \"Angelechy\" dos **dois** lados (o Seneschal do oponente entra na conta): com 5 ou mais, bane todas as cartas do oponente.",
            ],
          },
          {
            titulo: "Contra o deck: onde parar",
            itens: [
              "**A busca do Destrier é o ponto de parada.** [[Ash Blossom & Joyous Spring]] nela tira o Problem de uma mão de 1 starter: sem Problem, não há Enlisted nem Assault Dragon. [[Ghost Ogre & Snow Rabbit]] no Destrier guardado, com a busca na Corrente, também resolve.",
              "[[Droll & Lock Bird]] depois da busca do Destrier: o turno ainda termina no Assault Dragon com Destrier, Bastion e Shatranga guardados, mas sem o Opening to e4 (o Shatranga busca do Cemitério e enviar não é adicionar).",
              "[[Mulcharmy Fuwalos]] e [[Infinite Impermanence]] da mão pedem que você não controle cartas: use **antes** da Opposition resolver, porque depois o Seneschal está no seu campo.",
              "[[Effect Veiler]] e [[Nibiru, the Primal Being]] não fazem nada aqui: os monstros guardados não são monstros no campo e a linha tem só 4 Invocações (colocar na Zona de Mágicas e Armadilhas não é Invocar). Tire-os no Side.",
              "Cada hand trap também custa: com o Destrier guardado, ela causa 500 em você; com o Assault Dragon em campo, uma hand trap de monstro causa mais 700.",
            ],
          },
          {
            titulo: "Contra o deck: indo segundo",
            itens: [
              "Comece o turno sabendo o orçamento de PV. Depois de 4 efeitos de monstro resolvidos você levou 4.800, e o Assault Dragon já pode destruir tudo.",
              "O Bastion só impede **destruição**: banir, devolver à mão e negar passam por ele, e ele não protege a si mesmo nem o Assault Dragon.",
              "O Seneschal é um monstro de 3000 ATK no seu campo; não pode ser matéria de Xyz nem de Link e volta ao Extra Deck do dono quando sai do campo.",
              "No Side, as listas usam [[Typhoon]], [[Harpie's Feather Duster]] e [[Evenly Matched]] contra o campo de Mágicas Contínuas; [[Typhoon]] pode ser ativado da mão quando o oponente controla 2 ou mais Mágicas/Armadilhas e você não controla nenhuma.",
            ],
          },
        ],
      },
      en: {
        resumo:
          "A Synchro deck whose Synchros are almost never Synchro Summoned: effects **place them in the Spell & Trap Zone as Continuous Spells** (\"stored\"), where each applies a lock while it stays. With 30 Spells/Traps in 40 cards, the deck wins by burn, by [[Angelechy Verdict]] or in battle.",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "Each \"Angelechy\" Synchro has 3 effects: a banish while it is a monster (once per turn), an effect when it is placed in the Spell & Trap Zone, and a continuous lock while it is stored there.",
              "The locks: [[Angelechy Destrier]] deals 500 damage to your opponent each time they activate a card or effect; [[Angelechy Bastion]] stops your opponent's effects from destroying your other \"Angelechy\" cards; [[Angelechy Shatranga]] limits your opponent to attempting 5 monster effects per turn; [[Angelechy Castellan]] lets each player activate only 1 card or effect per Chain.",
              "[[Angelechy Problem]] (Field) discards 1 Spell/Trap to Special Summon [[Angelechy Enlisted]] (Level 2) and store another Synchro. That is why the deck runs so many Spells and Traps: they are the cost.",
              "The going-first board includes [[Black-Winged Assault Dragon]], which deals 700 for each monster effect your opponent resolves, and a Set [[Angelechy Opening to e4]], which builds more board on their turn.",
            ],
          },
          {
            titulo: "Main combo: Opposition + 1 Spell/Trap",
            itens: [
              "1. [[Angelechy Opposition]] choosing [[Angelechy Seneschal]] and [[Angelechy Destrier]]: Seneschal goes to **your opponent's** field and Destrier is stored. For the rest of the turn you can only Special Summon LIGHT or DARK Synchros from the Extra Deck.",
              "2. Destrier, stored, searches [[Angelechy Problem]]. Seneschal's summon lets each player Special Summon 1 Fairy Synchro with its effects negated: you summon [[Angelechy Bastion]]. Your opponent activated Seneschal's effect (they control it), so Destrier already burns them 500.",
              "3. Activate Problem: discard 1 Spell/Trap, Special Summon [[Angelechy Enlisted]] and store [[Angelechy Castellan]], which sends [[Angelechy Verdict]] to the GY.",
              "4. Synchro Summon [[Black-Winged Assault Dragon]] with Enlisted and Bastion (2 + 8); Bastion returns to the Extra Deck because of Seneschal.",
              "5. Banish Verdict from the GY to send Castellan to the GY and store the other Bastion; Bastion stores [[Angelechy Shatranga]], which searches [[Angelechy Opening to e4]].",
              "6. Banish Opposition from the GY to shuffle Castellan and Verdict back; banish the discarded [[Angelechy Disturbance]] to search another \"Angelechy\" Spell/Trap. Set Opening to e4.",
              "Board: Assault Dragon; Destrier, Bastion and Shatranga stored; Opening to e4 Set; Problem in the Field Zone. Your opponent controls Seneschal and is at 7,500 LP.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "The arithmetic that decides the game",
            itens: [
              "At 7,500 LP, each monster effect your opponent resolves costs 1,200 (700 from Assault Dragon + 500 from Destrier), and each Spell/Trap costs 500. Five monster effects (Shatranga's maximum) and three Spells/Traps add up to exactly 7,500.",
              "With 4 Black Feather Counters, Assault Dragon can Tribute itself on your opponent's turn to destroy every card on the field. It is not an \"Angelechy\" card, so Bastion does not protect it.",
              "[[Angelechy Verdict]] counts \"Angelechy\" Monster Cards on **both** sides (your opponent's Seneschal counts): with 5 or more, it banishes every card your opponent controls.",
            ],
          },
          {
            titulo: "Against the deck: where to stop it",
            itens: [
              "**Destrier's search is the choke point.** [[Ash Blossom & Joyous Spring]] there takes Problem away from a 1-starter hand: no Problem, no Enlisted, no Assault Dragon. [[Ghost Ogre & Snow Rabbit]] on the stored Destrier, with the search on the Chain, also works.",
              "[[Droll & Lock Bird]] after Destrier's search: the turn still ends on Assault Dragon with Destrier, Bastion and Shatranga stored, but without Opening to e4 (Shatranga searches from the GY, and sending is not adding).",
              "[[Mulcharmy Fuwalos]] and [[Infinite Impermanence]] from the hand require you to control no cards: use them **before** Opposition resolves, because afterwards Seneschal is on your field.",
              "[[Effect Veiler]] and [[Nibiru, the Primal Being]] do nothing here: stored monsters are not monsters on the field, and the line has only 4 summons (placing in the Spell & Trap Zone is not a summon). Side them out.",
              "Every hand trap costs you too: with Destrier stored it burns you 500; with Assault Dragon on the field, a monster hand trap burns another 700.",
            ],
          },
          {
            titulo: "Against the deck: going second",
            itens: [
              "Start the turn knowing your LP budget. After 4 monster effects have resolved you have taken 4,800, and Assault Dragon can already destroy everything.",
              "Bastion only stops **destruction**: banishing, returning to the hand and negating all get past it, and it protects neither itself nor Assault Dragon.",
              "Seneschal is a 3000 ATK monster on your field; it cannot be Xyz or Link Material and returns to its owner's Extra Deck when it leaves the field.",
              "Side Decks use [[Typhoon]], [[Harpie's Feather Duster]] and [[Evenly Matched]] against the Continuous Spell board; [[Typhoon]] can be activated from the hand when your opponent controls 2 or more Spells/Traps and you control none.",
            ],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Sincronías que casi nunca se Invocan por Sincronía: los efectos los **colocan en la Zona de Mágicas y Trampas como Mágicas Continuas** (\"guardados\"), donde cada uno aplica un bloqueo mientras sigue ahí. Con 30 Mágicas/Trampas en 40 cartas, el deck gana por daño de efecto, con [[Angelechy Verdict]] o en batalla.",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "Cada Sincronía \"Angelechy\" tiene 3 efectos: desterrar algo mientras es monstruo (1 vez por turno), un efecto al ser colocado en la Zona de Mágicas y Trampas y un bloqueo continuo mientras está guardado allí.",
              "Los bloqueos: [[Angelechy Destrier]] inflige 500 de daño al rival cada vez que activa una carta o efecto; [[Angelechy Bastion]] impide que los efectos rivales destruyan tus otras cartas \"Angelechy\"; [[Angelechy Shatranga]] limita al rival a intentar 5 efectos de monstruo por turno; [[Angelechy Castellan]] deja a cada jugador activar solo 1 carta o efecto por Cadena.",
              "[[Angelechy Problem]] (Campo) descarta 1 Mágica/Trampa para Invocar a [[Angelechy Enlisted]] (Nivel 2) y guardar otra Sincronía. Por eso el deck juega tantas Mágicas y Trampas: son el coste.",
              "El campo yendo primero incluye a [[Black-Winged Assault Dragon]], que inflige 700 por cada efecto de monstruo rival que se resuelve, y una [[Angelechy Opening to e4]] colocada, que arma más campo en el turno rival.",
            ],
          },
          {
            titulo: "Combo principal: Opposition + 1 Mágica/Trampa",
            itens: [
              "1. [[Angelechy Opposition]] eligiendo a [[Angelechy Seneschal]] y [[Angelechy Destrier]]: Seneschal va al campo **del rival** y Destrier queda guardado. El resto del turno solo puedes Invocar del Deck Extra Sincronías de LUZ u OSCURIDAD.",
              "2. Destrier, guardado, busca [[Angelechy Problem]]. La Invocación de Seneschal deja a cada jugador Invocar 1 Sincronía Hada con sus efectos negados: tú Invocas a [[Angelechy Bastion]]. Quien activó el efecto de Seneschal fue el rival (lo controla), así que Destrier ya le cobra 500.",
              "3. Activa Problem: descarta 1 Mágica/Trampa, Invoca a [[Angelechy Enlisted]] y guarda a [[Angelechy Castellan]], que envía [[Angelechy Verdict]] al Cementerio.",
              "4. Invoca por Sincronía a [[Black-Winged Assault Dragon]] con Enlisted y Bastion (2 + 8); Bastion vuelve al Deck Extra por el efecto de Seneschal.",
              "5. Destierra Verdict del Cementerio para enviar a Castellan al Cementerio y guardar el otro Bastion; Bastion guarda a [[Angelechy Shatranga]], que busca [[Angelechy Opening to e4]].",
              "6. Destierra Opposition del Cementerio para barajar Castellan y Verdict de vuelta; destierra la [[Angelechy Disturbance]] descartada para buscar otra Mágica/Trampa \"Angelechy\". Coloca Opening to e4.",
              "Campo: Assault Dragon; Destrier, Bastion y Shatranga guardados; Opening to e4 colocada; Problem en la Zona de Campo. El rival controla a Seneschal y tiene 7.500 LP.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "La cuenta que decide la partida",
            itens: [
              "Con 7.500 LP, cada efecto de monstruo rival que se resuelve cuesta 1.200 (700 de Assault Dragon + 500 de Destrier), y cada Mágica/Trampa cuesta 500. Cinco efectos de monstruo (el máximo de Shatranga) y tres Mágicas/Trampas suman exactamente 7.500.",
              "Con 4 Contadores de Pluma Negra, Assault Dragon puede Sacrificarse en el turno rival para destruir todas las cartas del campo. No es \"Angelechy\", así que Bastion no lo protege.",
              "[[Angelechy Verdict]] cuenta las Cartas de Monstruo \"Angelechy\" de **ambos** lados (el Seneschal del rival cuenta): con 5 o más, destierra todas las cartas del rival.",
            ],
          },
          {
            titulo: "Contra el deck: dónde pararlo",
            itens: [
              "**La búsqueda de Destrier es el punto de corte.** [[Ash Blossom & Joyous Spring]] ahí le quita Problem a una mano de 1 iniciador: sin Problem, no hay Enlisted ni Assault Dragon. [[Ghost Ogre & Snow Rabbit]] sobre el Destrier guardado, con la búsqueda en la Cadena, también funciona.",
              "[[Droll & Lock Bird]] tras la búsqueda de Destrier: el turno termina igual en Assault Dragon con Destrier, Bastion y Shatranga guardados, pero sin Opening to e4 (Shatranga busca del Cementerio y enviar no es añadir).",
              "[[Mulcharmy Fuwalos]] e [[Infinite Impermanence]] desde la mano piden que no controles cartas: úsalas **antes** de que se resuelva Opposition, porque después Seneschal está en tu campo.",
              "[[Effect Veiler]] y [[Nibiru, the Primal Being]] no hacen nada aquí: los monstruos guardados no son monstruos en el campo y la línea tiene solo 4 Invocaciones (colocar en la Zona de Mágicas y Trampas no es Invocar). Sácalos en el Side.",
              "Cada hand trap también te cuesta: con Destrier guardado te inflige 500; con Assault Dragon en el campo, una hand trap de monstruo inflige otros 700.",
            ],
          },
          {
            titulo: "Contra el deck: yendo segundo",
            itens: [
              "Empieza el turno sabiendo tu presupuesto de LP. Tras 4 efectos de monstruo resueltos llevas 4.800 de daño, y Assault Dragon ya puede destruirlo todo.",
              "Bastion solo impide la **destrucción**: desterrar, devolver a la mano y negar pasan, y no se protege a sí mismo ni a Assault Dragon.",
              "Seneschal es un monstruo de 3000 ATK en tu campo; no puede ser material de Xyz ni de Enlace y vuelve al Deck Extra de su dueño al dejar el campo.",
              "En el Side, las listas usan [[Typhoon]], [[Harpie's Feather Duster]] y [[Evenly Matched]] contra el campo de Mágicas Continuas; [[Typhoon]] puede activarse desde la mano cuando el rival controla 2 o más Mágicas/Trampas y tú no controlas ninguna.",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Invoked
  {
    arquetipo: "Invoked",
    revisado: "2026-11",
    textos: {
      pt: {
        resumo:
          "Deck de Fusão em torno dos dois \"Aleister\": [[Aleister the Invoker]] busca a [[Invocation]] e [[Aleister the Reminiscent]] bane um \"Invoked\" do Extra Deck para buscar a [[Invocation - \"Sword\"]]. As duas Mágicas de Fusão alcançam matérias fora do comum (Cemitério dos dois jogadores, banidos), e o campo termina em negações e remoções de Fusões.",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "[[Invocation]] usa matérias da mão e, para um \"Invoked\", também bane matérias do seu campo e do Cemitério **de qualquer jogador**. Do Cemitério, ela volta ao Deck e devolve um [[Aleister the Invoker]] banido à mão.",
              "[[Invocation - \"Sword\"]] (Mágica Rápida) funde monstros que você controla e, para um \"Invoked\", devolve monstros banidos ao Cemitério para usar como matéria: o \"Invoked\" que o Reminiscent baniu como custo vira a 2ª matéria.",
              "As linhas maiores usam [[Endymion, the Crescent Magistus]] para equipar a [[Artemis, the Magistus Moon Maiden]]; a Artemis equipada busca o [[Crowley, the Gifted Magistus]], que se Invoca e faz mais uma Fusão (o nome dele conta como \"Aleister the Invoker\" como matéria).",
              "[[Aleister the Invoker of Madness]] busca outra Invocation descartando uma carta de verdade: conte esse custo ao planejar.",
            ],
          },
          {
            titulo: "Combo principal: 1 Aleister the Invoker",
            itens: [
              "1. Invocação-Normal do [[Aleister the Invoker]], que busca a [[Invocation]].",
              "2. Link da [[Artemis, the Magistus Moon Maiden]] com o Aleister (ela é de LUZ, o que o Mechaba pede).",
              "3. A Invocation faz o [[Invoked Mechaba]] banindo o Aleister do Cemitério e a Artemis do campo.",
              "4. A Invocation, no Cemitério, volta ao Deck e devolve o Aleister banido à mão. Esse Aleister é o monstro que o Mechaba descarta para negar um efeito de monstro.",
              "Só com o [[Aleister the Reminiscent]]: ele bane o Mechaba do Extra Deck para buscar a [[Invocation - \"Sword\"]], que funde o Reminiscent com o Mechaba banido no [[Invoked Baybarron]]; o Baybarron busca o [[Gamma Summon]], que fica baixado.",
              "Com os dois Aleister e uma carta para descartar (ou uma Mágica de Fusão já na mão), a rota do Endymion chega a [[Invoked Mechaba]], [[Invoked Augoeides]], [[Invoked Oceanus]] (na Zona de Monstros Extra), [[S:P Little Knight]] e [[Virakam, the Divine Spirit of Artifice]], com a Sword baixada e o Invoker na mão.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "O que o campo faz no turno do oponente",
            itens: [
              "[[Invoked Mechaba]]: 1 vez por turno, nega a ativação de uma Mágica/Armadilha ou efeito de monstro enviando da mão uma carta **do mesmo tipo** (monstro para monstro, Mágica para Mágica, Armadilha para Armadilha) e bane a carta negada. As listas jogam só 1 Armadilha.",
              "[[Gamma Summon]] bane um \"Aleister\" ou uma Fusão do Cemitério para Invocar qualquer \"Invoked\" do Extra Deck ignorando as condições (banido na End Phase): escolhe a resposta para o que o oponente está fazendo.",
              "[[Invoked Elysium]] tem todos os 6 Atributos; alvejando a si mesmo, bane todos os monstros do oponente com algum desses Atributos. Ele alveja o próprio \"Invoked\", não os monstros do oponente.",
              "[[Invoked Oceanus]] na Zona de Monstros Extra bane os monstros que iriam para o Cemitério do oponente; na Zona Principal, força os ataques nele. [[Invoked Augoeides]] destrói 1 monstro quando o oponente Invoca por Invocação-Especial.",
              "[[Virakam, the Divine Spirit of Artifice]] bane a si mesmo para negar e banir uma resposta do oponente a um efeito de Fusão. O [[Aleister the Invoker]] na mão dá +1000 de ATK/DEF a uma Fusão (Efeito Rápido).",
            ],
          },
          {
            titulo: "Contra o deck: onde parar",
            itens: [
              "[[Ash Blossom & Joyous Spring]], [[Effect Veiler]] ou [[Infinite Impermanence]] no primeiro Aleister: uma mão de 1 starter fica num Link só. Uma Invocation comprada, o Reminiscent ou outra Mágica de Fusão na mão mudam a resposta.",
              "[[Ghost Ogre & Snow Rabbit]] no Invoker **não** para a busca, e a Invocation pode usar o Invoker destruído e o próprio Ghost Ogre (de LUZ) do Cemitério como matérias.",
              "[[Droll & Lock Bird]] depois da primeira adição: as Mágicas de Fusão já na mão ainda funcionam, e a recuperação do Invoker pela Invocation não é busca no Deck.",
              "[[Mulcharmy Fuwalos]] e [[Mulcharmy Purulia]] fazem o deck parar num campo curto (Mechaba, Oceanus ou Sorath) em vez do campo grande.",
              "[[Nibiru, the Primal Being]]: a linha curta do Mechaba fica abaixo de 5 Invocações; a grande tenta ter o Mechaba pronto antes das extensões.",
            ],
          },
          {
            titulo: "Contra o deck: indo segundo",
            itens: [
              "O Mechaba precisa de uma carta do mesmo tipo na mão: conte a mão do oponente e abra com o tipo que ele provavelmente não tem.",
              "O Gamma Summon precisa de um \"Aleister\" ou uma Fusão no Cemitério como custo: banir o Cemitério antes desliga a carta baixada.",
              "[[Invocation - \"Grail\"]] com um Aleister pode usar um monstro de Extra Deck seu como matéria para o [[Invoked De Anima]], que destrói seus monstros do Extra Deck ou suas Mágicas/Armadilhas.",
              "O [[S:P Little Knight]], quando sua Invocação por Link usa o efeito de banir, impede ataques diretos naquele turno: conte o dano antes de estender.",
            ],
          },
        ],
      },
      en: {
        resumo:
          "A Fusion deck built around the two \"Aleister\" monsters: [[Aleister the Invoker]] searches [[Invocation]] and [[Aleister the Reminiscent]] banishes an \"Invoked\" from the Extra Deck to search [[Invocation - \"Sword\"]]. Both Fusion Spells reach unusual materials (either player's GY, banished monsters), and the board ends on negates and Fusion-based removal.",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "[[Invocation]] uses materials from the hand and, for an \"Invoked\", can also banish materials from your field and **either player's** GY. From the GY, it shuffles itself into the Deck and returns a banished [[Aleister the Invoker]] to the hand.",
              "[[Invocation - \"Sword\"]] (Quick-Play) fuses monsters you control and, for an \"Invoked\", returns banished monsters to the GY to use as material: the \"Invoked\" Reminiscent banished as a cost becomes the 2nd material.",
              "Bigger lines use [[Endymion, the Crescent Magistus]] to equip [[Artemis, the Magistus Moon Maiden]]; equipped Artemis searches [[Crowley, the Gifted Magistus]], which summons itself and makes another Fusion (its name counts as \"Aleister the Invoker\" as material).",
              "[[Aleister the Invoker of Madness]] searches another Invocation by discarding a real card: count that cost when planning.",
            ],
          },
          {
            titulo: "Main combo: 1 Aleister the Invoker",
            itens: [
              "1. Normal Summon [[Aleister the Invoker]], which searches [[Invocation]].",
              "2. Link Summon [[Artemis, the Magistus Moon Maiden]] with Aleister (she is LIGHT, which Mechaba needs).",
              "3. Invocation makes [[Invoked Mechaba]] by banishing Aleister from the GY and Artemis from the field.",
              "4. Invocation, in the GY, shuffles back into the Deck and returns the banished Aleister to the hand. That Aleister is the monster Mechaba discards to negate a monster effect.",
              "With only [[Aleister the Reminiscent]]: it banishes Mechaba from the Extra Deck to search [[Invocation - \"Sword\"]], which fuses Reminiscent with the banished Mechaba into [[Invoked Baybarron]]; Baybarron searches [[Gamma Summon]], which is Set.",
              "With both Aleisters and a card to discard (or a Fusion Spell already in hand), the Endymion route reaches [[Invoked Mechaba]], [[Invoked Augoeides]], [[Invoked Oceanus]] (in the Extra Monster Zone), [[S:P Little Knight]] and [[Virakam, the Divine Spirit of Artifice]], with Sword Set and the Invoker in hand.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "What the board does on your opponent's turn",
            itens: [
              "[[Invoked Mechaba]]: once per turn, negates a Spell/Trap or monster effect activation by sending a card **of the same type** from the hand (monster for monster, Spell for Spell, Trap for Trap) and banishes the negated card. Lists run only 1 Trap.",
              "[[Gamma Summon]] banishes an \"Aleister\" or a Fusion from the GY to summon any \"Invoked\" from the Extra Deck ignoring its conditions (banished in the End Phase): it picks the answer to what your opponent is doing.",
              "[[Invoked Elysium]] has all 6 Attributes; targeting itself, it banishes every opposing monster with any of them. It targets your own \"Invoked\", not your opponent's monsters.",
              "[[Invoked Oceanus]] in the Extra Monster Zone banishes monsters that would go to your opponent's GY; in a Main Monster Zone, it forces attacks onto itself. [[Invoked Augoeides]] destroys 1 monster when your opponent Special Summons.",
              "[[Virakam, the Divine Spirit of Artifice]] banishes itself to negate and banish an opponent's response to a Fusion effect. [[Aleister the Invoker]] in hand gives a Fusion +1000 ATK/DEF (Quick Effect).",
            ],
          },
          {
            titulo: "Against the deck: where to stop it",
            itens: [
              "[[Ash Blossom & Joyous Spring]], [[Effect Veiler]] or [[Infinite Impermanence]] on the first Aleister: a 1-starter hand ends on a single Link. A drawn Invocation, Reminiscent or another Fusion Spell in hand changes the answer.",
              "[[Ghost Ogre & Snow Rabbit]] on the Invoker does **not** stop the search, and Invocation can use the destroyed Invoker and the LIGHT Ghost Ogre itself from the GY as materials.",
              "[[Droll & Lock Bird]] after the first add: Fusion Spells already in hand still work, and Invocation's recovery of the Invoker is not a Deck search.",
              "[[Mulcharmy Fuwalos]] and [[Mulcharmy Purulia]] make the deck stop on a short board (Mechaba, Oceanus or Sorath) instead of the big one.",
              "[[Nibiru, the Primal Being]]: the short Mechaba line stays under 5 summons; the big one tries to have Mechaba ready before the extensions.",
            ],
          },
          {
            titulo: "Against the deck: going second",
            itens: [
              "Mechaba needs a card of the same type in hand: count your opponent's hand and open with the type they probably lack.",
              "Gamma Summon needs an \"Aleister\" or a Fusion in the GY as its cost: banishing the GY first turns the Set card off.",
              "[[Invocation - \"Grail\"]] with an Aleister can use one of your Extra Deck monsters as material for [[Invoked De Anima]], which destroys your Extra Deck monsters or your Spells/Traps.",
              "[[S:P Little Knight]], when its Link Summon banish is used, prevents direct attacks that turn: count damage before extending.",
            ],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Fusión en torno a los dos \"Aleister\": [[Aleister the Invoker]] busca [[Invocation]] y [[Aleister the Reminiscent]] destierra un \"Invoked\" del Deck Extra para buscar [[Invocation - \"Sword\"]]. Las dos Mágicas de Fusión alcanzan materiales poco comunes (Cementerio de ambos jugadores, desterrados), y el campo termina en negaciones y remoción con Fusiones.",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "[[Invocation]] usa materiales de la mano y, para un \"Invoked\", también destierra materiales de tu campo y del Cementerio **de cualquier jugador**. Desde el Cementerio, vuelve al Deck y devuelve a la mano un [[Aleister the Invoker]] desterrado.",
              "[[Invocation - \"Sword\"]] (Juego Rápido) fusiona monstruos que controlas y, para un \"Invoked\", devuelve monstruos desterrados al Cementerio para usarlos como material: el \"Invoked\" que Reminiscent desterró como coste pasa a ser el 2º material.",
              "Las líneas grandes usan [[Endymion, the Crescent Magistus]] para equipar a [[Artemis, the Magistus Moon Maiden]]; Artemis equipada busca a [[Crowley, the Gifted Magistus]], que se Invoca y hace otra Fusión (su nombre cuenta como \"Aleister the Invoker\" como material).",
              "[[Aleister the Invoker of Madness]] busca otra Invocation descartando una carta de verdad: cuenta ese coste al planear.",
            ],
          },
          {
            titulo: "Combo principal: 1 Aleister the Invoker",
            itens: [
              "1. Invoca de Modo Normal a [[Aleister the Invoker]], que busca [[Invocation]].",
              "2. Invoca por Enlace a [[Artemis, the Magistus Moon Maiden]] con Aleister (es de LUZ, lo que pide Mechaba).",
              "3. Invocation hace a [[Invoked Mechaba]] desterrando a Aleister del Cementerio y a Artemis del campo.",
              "4. Invocation, en el Cementerio, vuelve al Deck y devuelve a Aleister desterrado a la mano. Ese Aleister es el monstruo que Mechaba descarta para negar un efecto de monstruo.",
              "Solo con [[Aleister the Reminiscent]]: destierra a Mechaba del Deck Extra para buscar [[Invocation - \"Sword\"]], que fusiona a Reminiscent con el Mechaba desterrado en [[Invoked Baybarron]]; Baybarron busca [[Gamma Summon]], que se coloca.",
              "Con los dos Aleister y una carta para descartar (o una Mágica de Fusión ya en la mano), la ruta de Endymion llega a [[Invoked Mechaba]], [[Invoked Augoeides]], [[Invoked Oceanus]] (en la Zona de Monstruos Extra), [[S:P Little Knight]] y [[Virakam, the Divine Spirit of Artifice]], con Sword colocada y el Invoker en la mano.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Qué hace el campo en el turno rival",
            itens: [
              "[[Invoked Mechaba]]: 1 vez por turno, niega la activación de una Mágica/Trampa o efecto de monstruo enviando de la mano una carta **del mismo tipo** (monstruo por monstruo, Mágica por Mágica, Trampa por Trampa) y destierra la carta negada. Las listas juegan solo 1 Trampa.",
              "[[Gamma Summon]] destierra un \"Aleister\" o una Fusión del Cementerio para Invocar cualquier \"Invoked\" del Deck Extra ignorando sus condiciones (desterrado en la End Phase): elige la respuesta a lo que hace el rival.",
              "[[Invoked Elysium]] tiene los 6 Atributos; seleccionándose a sí mismo, destierra a todos los monstruos rivales con alguno de ellos. Selecciona a tu propio \"Invoked\", no a los monstruos rivales.",
              "[[Invoked Oceanus]] en la Zona de Monstruos Extra destierra los monstruos que irían al Cementerio rival; en la Zona Principal, obliga a atacarlo a él. [[Invoked Augoeides]] destruye 1 monstruo cuando el rival Invoca de Modo Especial.",
              "[[Virakam, the Divine Spirit of Artifice]] se destierra para negar y desterrar una respuesta rival a un efecto de Fusión. [[Aleister the Invoker]] en la mano da +1000 ATK/DEF a una Fusión (Efecto Rápido).",
            ],
          },
          {
            titulo: "Contra el deck: dónde pararlo",
            itens: [
              "[[Ash Blossom & Joyous Spring]], [[Effect Veiler]] o [[Infinite Impermanence]] sobre el primer Aleister: una mano de 1 iniciador se queda en un solo Enlace. Una Invocation robada, Reminiscent u otra Mágica de Fusión en la mano cambian la respuesta.",
              "[[Ghost Ogre & Snow Rabbit]] sobre el Invoker **no** para la búsqueda, e Invocation puede usar al Invoker destruido y al propio Ghost Ogre (de LUZ) del Cementerio como materiales.",
              "[[Droll & Lock Bird]] tras la primera adición: las Mágicas de Fusión ya en la mano siguen funcionando, y la recuperación del Invoker con Invocation no es búsqueda en el Deck.",
              "[[Mulcharmy Fuwalos]] y [[Mulcharmy Purulia]] hacen que el deck pare en un campo corto (Mechaba, Oceanus o Sorath) en vez del grande.",
              "[[Nibiru, the Primal Being]]: la línea corta de Mechaba queda por debajo de 5 Invocaciones; la grande intenta tener a Mechaba listo antes de las extensiones.",
            ],
          },
          {
            titulo: "Contra el deck: yendo segundo",
            itens: [
              "Mechaba necesita una carta del mismo tipo en la mano: cuenta la mano del rival y abre con el tipo que probablemente no tiene.",
              "Gamma Summon necesita un \"Aleister\" o una Fusión en el Cementerio como coste: desterrar el Cementerio antes apaga la carta colocada.",
              "[[Invocation - \"Grail\"]] con un Aleister puede usar uno de tus monstruos del Deck Extra como material para [[Invoked De Anima]], que destruye tus monstruos del Deck Extra o tus Mágicas/Trampas.",
              "[[S:P Little Knight]], cuando usa el destierro de su Invocación por Enlace, impide ataques directos ese turno: cuenta el daño antes de extender.",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Magistus (Fairy Tail)
  {
    arquetipo: "Magistus",
    revisado: "2026-11",
    textos: {
      pt: {
        resumo:
          "Nas listas atuais, Magistus joga junto com **Fairy Tail**: Feiticeiros de Nível 4 com 1850 de ATK que viram [[Fairy Tail - Wiccat]] (Xyz Rank 4). A Wiccat envia cartas \"Fairy Tail\" do Deck ao Cemitério, elas buscam o resto e o turno termina no [[Teller of Fairy Tails]], que nega qualquer carta ou efeito. Os Magistus transformam os monstros que sobram em Fusões e Links, como o [[Zoroa, the Magistus Verethragna]].",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "Cada starter é um jeito diferente de pôr 2 Feiticeiros de Nível 4 no campo, porque dois fazem a [[Fairy Tail - Wiccat]]. Ela desanexa até 2 matérias para enviar o mesmo número de cartas \"Fairy Tail\" do Deck ao Cemitério.",
              "Do Cemitério: [[Fairy Tail - Matchgiru]] se Invoca se houver um Feiticeiro de 1850 de ATK original no campo e busca; [[Tails of the Fairy Tails]] se equipa a um monstro \"Fairy Tail\" e dá uma Invocação-Normal extra de Feiticeiro de 1850 de ATK.",
              "\"Prince of Fairies\": o Matchgiru (pagando 500) e o [[Fairy Tail Ball]] trocam o nome de um Monstro de Efeito do oponente para \"Prince of Fairies\". Nenhuma carta tem esse nome, então o oponente não consegue parar a devolução da [[Fairy Tail - Luna]] nesse monstro, e o Tails pode usá-lo como matéria de um Teller que destrói o campo do oponente (500 de dano por carta).",
              "Enquanto a Wiccat estiver no campo, os monstros \"Fairy Tail\" de LUZ originais (Luna, Matchgiru, Snow) não são afetados pelos efeitos ativados do oponente.",
            ],
          },
          {
            titulo: "Combo principal: 1 Luna",
            itens: [
              "1. Invocação-Normal da [[Fairy Tail - Luna]], que busca [[Genia of the Ring]] (melhor que o Matchgiru: a Genia se Invoca ao lado de qualquer monstro virado para cima, então a linha passa por um [[Droll & Lock Bird]] nessa busca).",
              "2. A Genia se Invoca alvejando a Luna. A partir daqui, você só Invoca Feiticeiros do Extra Deck (Wiccat e Teller são).",
              "3. Xyz da [[Fairy Tail - Wiccat]] com Luna e Genia.",
              "4. A Wiccat desanexa as 2 matérias para enviar [[Fairy Tail - Matchgiru]] e [[Tails of the Fairy Tails]] do Deck ao Cemitério. É o passo que o oponente quer parar.",
              "5. O Matchgiru se Invoca do Cemitério e busca o [[Fairy Tail Ball]]; o Ball, ao ser ativado, busca outra Luna.",
              "6. O Tails se equipa ao Matchgiru e dá a Invocação-Normal da 2ª Luna, que busca [[Fairy Tail - Snow]].",
              "7. O Tails faz a Fusão do [[Teller of Fairy Tails]] com a Wiccat e a Snow da mão.",
              "Sem outras cartas, a Luna continua depois do Teller: Matchgiru e Luna viram Artemis e [[Endymion, the Crescent Magistus]], que buscam Spenta e depois o Crowley; [[Summon Sorceress]], [[Charmer Quartet in Bloom]] e a devolução da Luna levam ao [[Zoroa, the Magistus Verethragna]]. O turno deixa uns 13 cartas no Cemitério, incluindo Snow e Wiccat.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "O que o campo faz no turno do oponente",
            itens: [
              "[[Teller of Fairy Tails]]: bane 1 carta \"Fairy Tail\" da mão ou do Cemitério para negar a ativação de qualquer carta ou efeito e destruí-la (1 vez por turno). Com ele em campo, os monstros \"Fairy Tail\" não são destruídos em batalha.",
              "[[Zoroa, the Magistus Verethragna]]: envia 1 Carta de Monstro \"Magistus\" virada para cima que você controla para negar um efeito de monstro e depois destruir 1 carta (a [[Ninaruru, the Magistus Glass Goddess]] equipada ou um [[Magistus Chorozo]] gasto pagam o custo).",
              "[[Fairy Tail Ball]]: quando o oponente Invoca por Invocação-Especial, nega os efeitos de 1 Monstro de Efeito dele e muda o nome para \"Prince of Fairies\".",
              "[[Fairy Tail - Snow]] no Cemitério: bane 7 outras cartas suas para se Invocar e virar um monstro do oponente para baixo. Não tem limite por turno.",
              "Ordem habitual de uso: o Ball na primeira Invocação-Especial que vale negar, o Verethragna em efeito de monstro e o Teller guardado para Mágica/Armadilha.",
            ],
          },
          {
            titulo: "Contra o deck: onde parar",
            itens: [
              "**Bata no envio da Wiccat (passo 4) ou antes.** Uma negação nesse efeito tira o Matchgiru e o Tails de uma vez. Depois que a Wiccat resolve, Luna, Matchgiru e Snow ficam fora do alcance dos seus efeitos ativados enquanto ela estiver no campo.",
              "[[Ghost Ogre & Snow Rabbit]] na Luna, quando ela é o único monstro, é a parada mais limpa: a busca resolve, mas a Genia não tem alvo e a mão de 1 Luna para.",
              "[[Ash Blossom & Joyous Spring]] no envio da Wiccat: com só a Luna, o turno termina na Wiccat. Com o Matchgiru na mão ou [[Verre Magic - Lacrima of Light]] para encadear, o deck continua.",
              "[[Droll & Lock Bird]] depois da primeira adição: o envio da Wiccat e o Matchgiru ainda funcionam (enviar não é adicionar), mas nada mais é buscado: termina no Teller.",
              "[[Effect Veiler]] só pega a Luna antes da Wiccat. Contra mãos com 2 starters, guarde a 2ª interrupção para a metade Magistus (Summon Sorceress ou a Fusão do Crowley), que é o que impede o Verethragna.",
              "[[Nibiru, the Primal Being]] na linha principal (5ª Invocação: a 2ª Luna): com a Wiccat em campo, o Nibiru só consegue oferecer a Wiccat, e o Ball depois renomeia o Nibiru.",
            ],
          },
          {
            titulo: "Contra o deck: indo segundo",
            itens: [
              "O Ball reage à sua Invocação-Especial e nega 1 Monstro de Efeito; o Teller nega qualquer coisa e o Verethragna só efeitos de monstro. A primeira Invocação-Especial que valer a pena tende a encontrar o Ball, e a Mágica/Armadilha tende a encontrar o Teller.",
              "O custo do Teller é banir uma carta \"Fairy Tail\" da mão ou do Cemitério: banir o Cemitério do oponente desliga o Teller e a Snow (que precisa de 7 cartas para banir).",
              "No Side, as listas trazem [[Dark Magical Curtain]], [[Infinite Impermanence]] e [[Evenly Matched]].",
            ],
          },
        ],
      },
      en: {
        resumo:
          "In current lists, Magistus is played with **Fairy Tail**: Level 4 Spellcasters with 1850 ATK that become [[Fairy Tail - Wiccat]] (Rank 4 Xyz). Wiccat sends \"Fairy Tail\" cards from the Deck to the GY, they search the rest, and the turn ends on [[Teller of Fairy Tails]], which negates any card or effect. The Magistus cards turn the leftover monsters into Fusions and Links, such as [[Zoroa, the Magistus Verethragna]].",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "Every starter is a different way to put 2 Level 4 Spellcasters on the field, because two make [[Fairy Tail - Wiccat]]. It detaches up to 2 materials to send that many \"Fairy Tail\" cards from the Deck to the GY.",
              "From the GY: [[Fairy Tail - Matchgiru]] summons itself if a Spellcaster with 1850 original ATK is on the field and searches; [[Tails of the Fairy Tails]] equips itself to a \"Fairy Tail\" monster and grants an extra Normal Summon of a Spellcaster with 1850 ATK.",
              "\"Prince of Fairies\": Matchgiru (paying 500) and [[Fairy Tail Ball]] rename one of your opponent's Effect Monsters \"Prince of Fairies\". No card has that name, so your opponent cannot stop [[Fairy Tail - Luna]]'s bounce on it, and Tails can use it as material for a Teller that destroys their field (500 damage per card).",
              "While Wiccat is on the field, the original-LIGHT \"Fairy Tail\" monsters (Luna, Matchgiru, Snow) are unaffected by your opponent's activated effects.",
            ],
          },
          {
            titulo: "Main combo: 1 Luna",
            itens: [
              "1. Normal Summon [[Fairy Tail - Luna]], which searches [[Genia of the Ring]] (better than Matchgiru: Genia summons itself next to any face-up monster, so the line gets through a [[Droll & Lock Bird]] on this search).",
              "2. Genia summons itself targeting Luna. From here you can only Special Summon Spellcasters from the Extra Deck (Wiccat and Teller are).",
              "3. Xyz Summon [[Fairy Tail - Wiccat]] with Luna and Genia.",
              "4. Wiccat detaches both materials to send [[Fairy Tail - Matchgiru]] and [[Tails of the Fairy Tails]] from the Deck to the GY. This is the step your opponent wants to stop.",
              "5. Matchgiru summons itself from the GY and searches [[Fairy Tail Ball]]; Ball, when activated, searches another Luna.",
              "6. Tails equips itself to Matchgiru and grants the Normal Summon of the 2nd Luna, which searches [[Fairy Tail - Snow]].",
              "7. Tails Fusion Summons [[Teller of Fairy Tails]] with Wiccat and Snow from the hand.",
              "With nothing else, Luna keeps going after Teller: Matchgiru and Luna become Artemis and [[Endymion, the Crescent Magistus]], which search Spenta and then Crowley; [[Summon Sorceress]], [[Charmer Quartet in Bloom]] and Luna's bounce lead to [[Zoroa, the Magistus Verethragna]]. The turn leaves about 13 cards in the GY, Snow and Wiccat included.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "What the board does on your opponent's turn",
            itens: [
              "[[Teller of Fairy Tails]]: banishes 1 \"Fairy Tail\" card from the hand or GY to negate the activation of any card or effect and destroy it (once per turn). While it is on the field, \"Fairy Tail\" monsters cannot be destroyed by battle.",
              "[[Zoroa, the Magistus Verethragna]]: sends 1 face-up \"Magistus\" Monster Card you control to negate a monster effect and then destroy 1 card (an equipped [[Ninaruru, the Magistus Glass Goddess]] or a spent [[Magistus Chorozo]] pays the cost).",
              "[[Fairy Tail Ball]]: when your opponent Special Summons, it negates 1 of their Effect Monsters and renames it \"Prince of Fairies\".",
              "[[Fairy Tail - Snow]] in the GY: banishes 7 other cards of yours to summon itself and flip an opposing monster face-down. It has no once-per-turn limit.",
              "Usual order: Ball on the first Special Summon worth negating, Verethragna on a monster effect, and Teller saved for a Spell/Trap.",
            ],
          },
          {
            titulo: "Against the deck: where to stop it",
            itens: [
              "**Hit Wiccat's send (step 4) or earlier.** One negate on that effect stops Matchgiru and Tails at once. Once Wiccat resolves, Luna, Matchgiru and Snow are out of reach of your activated effects while it stays on the field.",
              "[[Ghost Ogre & Snow Rabbit]] on Luna, when she is the only monster, is the cleanest stop: the search resolves, but Genia has no target and a 1-Luna hand stops.",
              "[[Ash Blossom & Joyous Spring]] on Wiccat's send: with only Luna, the turn ends on Wiccat. With Matchgiru in hand or [[Verre Magic - Lacrima of Light]] to chain, the deck keeps going.",
              "[[Droll & Lock Bird]] after the first add: Wiccat's send and Matchgiru still work (sending is not adding), but nothing else is searched: it ends on Teller.",
              "[[Effect Veiler]] only catches Luna before Wiccat. Against 2-starter hands, save the 2nd interruption for the Magistus half (Summon Sorceress or Crowley's Fusion), which is what keeps Verethragna off the board.",
              "[[Nibiru, the Primal Being]] in the main line (5th summon: the 2nd Luna): with Wiccat on the field, Nibiru can only Tribute Wiccat, and Ball then renames Nibiru.",
            ],
          },
          {
            titulo: "Against the deck: going second",
            itens: [
              "Ball reacts to your Special Summon and negates 1 Effect Monster; Teller negates anything and Verethragna only monster effects. Your first worthwhile Special Summon tends to meet Ball, and your Spell/Trap tends to meet Teller.",
              "Teller's cost is banishing a \"Fairy Tail\" card from the hand or GY: banishing your opponent's GY turns Teller and Snow (which needs 7 cards to banish) off.",
              "Side Decks bring [[Dark Magical Curtain]], [[Infinite Impermanence]] and [[Evenly Matched]].",
            ],
          },
        ],
      },
      es: {
        resumo:
          "En las listas actuales, Magistus se juega con **Fairy Tail**: Lanzadores de Conjuros de Nivel 4 con 1850 ATK que se vuelven [[Fairy Tail - Wiccat]] (Xyz Rango 4). Wiccat envía cartas \"Fairy Tail\" del Deck al Cementerio, ellas buscan el resto y el turno termina en [[Teller of Fairy Tails]], que niega cualquier carta o efecto. Los Magistus convierten los monstruos sobrantes en Fusiones y Enlaces, como [[Zoroa, the Magistus Verethragna]].",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "Cada iniciador es una forma distinta de poner 2 Lanzadores de Conjuros de Nivel 4 en el campo, porque dos hacen a [[Fairy Tail - Wiccat]]. Ella desacopla hasta 2 materiales para enviar esa cantidad de cartas \"Fairy Tail\" del Deck al Cementerio.",
              "Desde el Cementerio: [[Fairy Tail - Matchgiru]] se Invoca si hay un Lanzador de Conjuros con 1850 ATK original en el campo y busca; [[Tails of the Fairy Tails]] se equipa a un monstruo \"Fairy Tail\" y da una Invocación Normal extra de un Lanzador de Conjuros de 1850 ATK.",
              "\"Prince of Fairies\": Matchgiru (pagando 500) y [[Fairy Tail Ball]] cambian el nombre de un Monstruo de Efecto rival a \"Prince of Fairies\". Ninguna carta tiene ese nombre, así que el rival no puede parar la devolución de [[Fairy Tail - Luna]] sobre él, y Tails puede usarlo como material de un Teller que destruye el campo rival (500 de daño por carta).",
              "Mientras Wiccat esté en el campo, los monstruos \"Fairy Tail\" de LUZ originales (Luna, Matchgiru, Snow) no son afectados por los efectos activados del rival.",
            ],
          },
          {
            titulo: "Combo principal: 1 Luna",
            itens: [
              "1. Invoca de Modo Normal a [[Fairy Tail - Luna]], que busca a [[Genia of the Ring]] (mejor que Matchgiru: Genia se Invoca junto a cualquier monstruo boca arriba, así la línea pasa un [[Droll & Lock Bird]] en esta búsqueda).",
              "2. Genia se Invoca seleccionando a Luna. Desde aquí solo puedes Invocar Lanzadores de Conjuros del Deck Extra (Wiccat y Teller lo son).",
              "3. Invoca por Xyz a [[Fairy Tail - Wiccat]] con Luna y Genia.",
              "4. Wiccat desacopla los 2 materiales para enviar a [[Fairy Tail - Matchgiru]] y [[Tails of the Fairy Tails]] del Deck al Cementerio. Es el paso que el rival quiere parar.",
              "5. Matchgiru se Invoca desde el Cementerio y busca [[Fairy Tail Ball]]; Ball, al activarse, busca otra Luna.",
              "6. Tails se equipa a Matchgiru y da la Invocación Normal de la 2ª Luna, que busca a [[Fairy Tail - Snow]].",
              "7. Tails Invoca por Fusión a [[Teller of Fairy Tails]] con Wiccat y Snow de la mano.",
              "Sin más cartas, Luna sigue tras Teller: Matchgiru y Luna se vuelven Artemis y [[Endymion, the Crescent Magistus]], que buscan a Spenta y luego a Crowley; [[Summon Sorceress]], [[Charmer Quartet in Bloom]] y la devolución de Luna llevan a [[Zoroa, the Magistus Verethragna]]. El turno deja unas 13 cartas en el Cementerio, incluidas Snow y Wiccat.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Qué hace el campo en el turno rival",
            itens: [
              "[[Teller of Fairy Tails]]: destierra 1 carta \"Fairy Tail\" de la mano o del Cementerio para negar la activación de cualquier carta o efecto y destruirla (1 vez por turno). Con él en el campo, los monstruos \"Fairy Tail\" no pueden ser destruidos en batalla.",
              "[[Zoroa, the Magistus Verethragna]]: envía 1 Carta de Monstruo \"Magistus\" boca arriba que controlas para negar un efecto de monstruo y luego destruir 1 carta (una [[Ninaruru, the Magistus Glass Goddess]] equipada o un [[Magistus Chorozo]] gastado pagan el coste).",
              "[[Fairy Tail Ball]]: cuando el rival Invoca de Modo Especial, niega los efectos de 1 de sus Monstruos de Efecto y lo renombra \"Prince of Fairies\".",
              "[[Fairy Tail - Snow]] en el Cementerio: destierra otras 7 cartas tuyas para Invocarse y poner boca abajo a un monstruo rival. No tiene límite por turno.",
              "Orden habitual: Ball en la primera Invocación Especial que valga la pena negar, Verethragna en un efecto de monstruo y Teller guardado para una Mágica/Trampa.",
            ],
          },
          {
            titulo: "Contra el deck: dónde pararlo",
            itens: [
              "**Golpea el envío de Wiccat (paso 4) o antes.** Una negación en ese efecto para a Matchgiru y Tails a la vez. Cuando Wiccat se resuelve, Luna, Matchgiru y Snow quedan fuera del alcance de tus efectos activados mientras ella siga en el campo.",
              "[[Ghost Ogre & Snow Rabbit]] sobre Luna, cuando es el único monstruo, es el corte más limpio: la búsqueda se resuelve, pero Genia no tiene objetivo y una mano de 1 Luna se detiene.",
              "[[Ash Blossom & Joyous Spring]] en el envío de Wiccat: con solo Luna, el turno termina en Wiccat. Con Matchgiru en la mano o [[Verre Magic - Lacrima of Light]] para encadenar, el deck sigue.",
              "[[Droll & Lock Bird]] tras la primera adición: el envío de Wiccat y Matchgiru siguen funcionando (enviar no es añadir), pero no se busca nada más: termina en Teller.",
              "[[Effect Veiler]] solo atrapa a Luna antes de Wiccat. Contra manos con 2 iniciadores, guarda la 2ª interrupción para la mitad Magistus (Summon Sorceress o la Fusión de Crowley), que es lo que deja fuera a Verethragna.",
              "[[Nibiru, the Primal Being]] en la línea principal (5ª Invocación: la 2ª Luna): con Wiccat en el campo, Nibiru solo puede Sacrificar a Wiccat, y Ball luego renombra a Nibiru.",
            ],
          },
          {
            titulo: "Contra el deck: yendo segundo",
            itens: [
              "Ball reacciona a tu Invocación Especial y niega 1 Monstruo de Efecto; Teller niega cualquier cosa y Verethragna solo efectos de monstruo. Tu primera Invocación Especial importante suele encontrarse con Ball, y tu Mágica/Trampa con Teller.",
              "El coste de Teller es desterrar una carta \"Fairy Tail\" de la mano o del Cementerio: desterrar el Cementerio rival apaga a Teller y a Snow (que necesita 7 cartas para desterrar).",
              "En el Side, las listas llevan [[Dark Magical Curtain]], [[Infinite Impermanence]] y [[Evenly Matched]].",
            ],
          },
        ],
      },
    },
  },
  // ------------------------------------------------------------------ Artmage
  {
    arquetipo: "Artmage",
    revisado: "2026-11",
    textos: {
      pt: {
        resumo:
          "Deck de Fusão que junta os \"Artmage\" aos Pêndulos \"Power Patron\", ao Medius e aos Ars Magna. Os Artmage fazem as Fusões, colocam cartas direto do Deck e recuperam recursos; os Power Patron dão corpos de Pêndulo; o Medius liga tudo e os Ars Magna trazem corpos extras e remoção. O campo tem vários tipos de interação, cada um com uma condição diferente.",
        iniciais: [
          {
            titulo: "Como o deck funciona",
            itens: [
              "A ordem importa: o [[Artmage Power Patron]] só deixa Invocar Fusões do Extra Deck enquanto o efeito contínuo dele se aplica, e o [[Beyond the Pendulum]] tem uma restrição que depende de fazer uma Invocação-Pêndulo depois.",
              "[[Medius the Pure]] escolhe entre buscar um monstro ou Invocá-lo do Deck: contra efeitos de compra do oponente (Mulcharmy), essa escolha muda o custo da linha.",
              "[[Artmage Litera]] recupera uma carta \"Artmage\" e volta à mão depois de se reviver no turno do oponente; o [[Artmage Academic Arcane Arts Acropolis]] transforma Mágicas/Armadilhas em outros nomes \"Artmage\", mas a busca dele impõe uma restrição de Invocação.",
              "Algumas listas não jogam hand traps no Main: as 15 cartas fora do motor são 3 de cada de [[Super Polymerization]], [[Dark Ruler No More]], [[Triple Tactics Thrust]], [[Pot of Sloth]] e uma carta de devolver à mão.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Cada interrupção responde a uma coisa",
            itens: [
              "[[Artmage Diactorus]] nega uma ativação **no campo** quando você tem 3 ou mais Tipos de Monstro diferentes no campo. Efeitos ativados na mão ou no Cemitério não estão ao alcance dele.",
              "[[Artmage Impasto -Recapture-]] (Contra-Armadilha) responde a efeitos de monstro banindo temporariamente uma Fusão sua; com 3 Tipos, ainda devolve à mão as Mágicas/Armadilhas do oponente. Tirar aquela Fusão do campo também muda quais outros efeitos ficam ativos.",
              "[[Superdreadnought Rail Cannon Gustav Rocket]] nega efeitos de monstro enquanto tem matéria. Ele também sai descartando 1 carta em cima de um [[Superdreadnought Rail Cannon Gustav Max]], não só com 3 monstros de Nível 10.",
              "[[Number 38: Hope Harbinger Dragon Titanic Galaxy]] nega uma **Mágica** (carta ou efeito) ativada no campo 1 vez por turno e a anexa a si. Não responde a Armadilhas nem a efeitos de monstro.",
              "[[Mediclius the Extraordinary Power Patron]] ganha efeitos pelo número de monstros para os quais aponta; mudar os monstros apontados muda a proteção dele.",
            ],
          },
          {
            titulo: "Contra o deck: jogando contra ele",
            itens: [
              "Veja o que já resolveu antes de interromper: uma busca completa não é desfeita por um [[Droll & Lock Bird]] posterior, e colocar uma carta direto do Deck não é busca.",
              "Tirar a Escala de Pêndulo pode afetar mais de uma Invocação: o [[Beyond the Pendulum]] e o Artmage Power Patron dependem dela.",
              "[[Mulcharmy Fuwalos]] e [[Mulcharmy Meowls]] não cobram as mesmas Invocações: a linha curta Artmage dá um número de compras diferente da longa com Pêndulo e Link.",
              "Quando a lista sem hand traps vai segundo, ela não interrompe o seu turno: ela responde no próprio turno. Nada pode responder à [[Super Polymerization]], que usa os seus monstros como matéria; o [[Dark Ruler No More]] nega os seus monstros virados para cima e efeitos de monstro não podem responder a ele; o [[Triple Tactics Thrust]] só funciona se você ativou um efeito de monstro naquele turno; o [[Pot of Sloth]] compra 1 carta para cada carta que você controla.",
              "Quebrar o primeiro campo e tirar os recursos de recuperação (Litera, Ars Magna banidos, Armadilhas já usadas) são trocas separadas: planeje as duas.",
            ],
          },
        ],
      },
      en: {
        resumo:
          "A Fusion deck that combines \"Artmage\" with the \"Power Patron\" Pendulums, Medius and Ars Magna. Artmage cards make the Fusions, Set cards straight from the Deck and recover resources; Power Patrons provide Pendulum bodies; Medius connects everything and Ars Magna adds bodies and removal. The board has several kinds of interaction, each with a different condition.",
        iniciais: [
          {
            titulo: "How the deck works",
            itens: [
              "Order matters: [[Artmage Power Patron]] only lets you Special Summon Fusions from the Extra Deck while its continuous effect applies, and [[Beyond the Pendulum]] has a restriction that depends on performing a Pendulum Summon afterwards.",
              "[[Medius the Pure]] chooses between adding a monster or summoning it from the Deck: against your opponent's draw effects (Mulcharmy), that choice changes the line's cost.",
              "[[Artmage Litera]] recovers an \"Artmage\" card and returns to the hand after reviving itself on your opponent's turn; [[Artmage Academic Arcane Arts Acropolis]] turns Spells/Traps into other \"Artmage\" names, but its search applies a summon restriction.",
              "Some lists run no hand traps in the Main Deck: the 15 cards outside the engine are 3 each of [[Super Polymerization]], [[Dark Ruler No More]], [[Triple Tactics Thrust]], [[Pot of Sloth]] and a bounce card.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Each interruption answers a different thing",
            itens: [
              "[[Artmage Diactorus]] negates an activation **on the field** when you have 3 or more different Monster Types on the field. Effects activated in the hand or GY are out of its reach.",
              "[[Artmage Impasto -Recapture-]] (Counter Trap) answers monster effects by temporarily banishing one of your Fusions; with 3 Types, it also returns your opponent's Spells/Traps to the hand. Removing that Fusion also changes which other effects stay live.",
              "[[Superdreadnought Rail Cannon Gustav Rocket]] negates monster effects while it has material. It can also come out by discarding 1 card on top of a [[Superdreadnought Rail Cannon Gustav Max]], not only with 3 Level 10 monsters.",
              "[[Number 38: Hope Harbinger Dragon Titanic Galaxy]] negates a **Spell** (card or effect) activated on the field once per turn and attaches it to itself. It does not answer Traps or monster effects.",
              "[[Mediclius the Extraordinary Power Patron]] gains effects by how many monsters it points to; changing the pointed monsters changes its protection.",
            ],
          },
          {
            titulo: "Against the deck: playing into it",
            itens: [
              "Check what has already resolved before interrupting: a completed search is not undone by a later [[Droll & Lock Bird]], and Setting a card straight from the Deck is not a search.",
              "Removing a Pendulum Scale can affect more than one summon: [[Beyond the Pendulum]] and Artmage Power Patron both depend on it.",
              "[[Mulcharmy Fuwalos]] and [[Mulcharmy Meowls]] do not charge the same summons: the short Artmage line gives a different number of draws than the long Pendulum and Link line.",
              "When the no-hand-trap list goes second, it does not interrupt your turn: it answers on its own. Nothing can respond to [[Super Polymerization]], which uses your monsters as material; [[Dark Ruler No More]] negates your face-up monsters and monster effects cannot respond to it; [[Triple Tactics Thrust]] only works if you activated a monster effect that turn; [[Pot of Sloth]] draws 1 card for each card you control.",
              "Breaking the first board and removing its recovery resources (Litera, banished Ars Magna, Traps already used) are separate exchanges: plan for both.",
            ],
          },
        ],
      },
      es: {
        resumo:
          "Deck de Fusión que une a los \"Artmage\" con los Péndulos \"Power Patron\", Medius y Ars Magna. Los Artmage hacen las Fusiones, colocan cartas directamente del Deck y recuperan recursos; los Power Patron dan cuerpos de Péndulo; Medius conecta todo y los Ars Magna aportan cuerpos y remoción. El campo tiene varios tipos de interacción, cada uno con una condición distinta.",
        iniciais: [
          {
            titulo: "Cómo funciona el deck",
            itens: [
              "El orden importa: [[Artmage Power Patron]] solo deja Invocar Fusiones del Deck Extra mientras se aplica su efecto continuo, y [[Beyond the Pendulum]] tiene una restricción que depende de hacer una Invocación por Péndulo después.",
              "[[Medius the Pure]] elige entre añadir un monstruo o Invocarlo del Deck: contra los efectos de robo del rival (Mulcharmy), esa elección cambia el coste de la línea.",
              "[[Artmage Litera]] recupera una carta \"Artmage\" y vuelve a la mano después de revivirse en el turno rival; [[Artmage Academic Arcane Arts Acropolis]] convierte Mágicas/Trampas en otros nombres \"Artmage\", pero su búsqueda impone una restricción de Invocación.",
              "Algunas listas no juegan hand traps en el Main: las 15 cartas fuera del motor son 3 de cada una de [[Super Polymerization]], [[Dark Ruler No More]], [[Triple Tactics Thrust]], [[Pot of Sloth]] y una carta para devolver a la mano.",
            ],
          },
        ],
        avancadas: [
          {
            titulo: "Cada interrupción responde a algo distinto",
            itens: [
              "[[Artmage Diactorus]] niega una activación **en el campo** cuando tienes 3 o más Tipos de Monstruo distintos en el campo. Los efectos activados en la mano o el Cementerio quedan fuera de su alcance.",
              "[[Artmage Impasto -Recapture-]] (Contra-Trampa) responde a efectos de monstruo desterrando temporalmente una de tus Fusiones; con 3 Tipos, además devuelve a la mano las Mágicas/Trampas rivales. Sacar esa Fusión del campo también cambia qué otros efectos siguen activos.",
              "[[Superdreadnought Rail Cannon Gustav Rocket]] niega efectos de monstruo mientras tenga material. También puede salir descartando 1 carta sobre un [[Superdreadnought Rail Cannon Gustav Max]], no solo con 3 monstruos de Nivel 10.",
              "[[Number 38: Hope Harbinger Dragon Titanic Galaxy]] niega una **Mágica** (carta o efecto) activada en el campo 1 vez por turno y la acopla a sí mismo. No responde a Trampas ni a efectos de monstruo.",
              "[[Mediclius the Extraordinary Power Patron]] gana efectos según cuántos monstruos apunta; cambiar los monstruos apuntados cambia su protección.",
            ],
          },
          {
            titulo: "Contra el deck: jugando contra él",
            itens: [
              "Mira lo que ya se resolvió antes de interrumpir: una búsqueda completa no se deshace con un [[Droll & Lock Bird]] posterior, y colocar una carta directamente del Deck no es búsqueda.",
              "Quitar una Escala de Péndulo puede afectar a más de una Invocación: [[Beyond the Pendulum]] y Artmage Power Patron dependen de ella.",
              "[[Mulcharmy Fuwalos]] y [[Mulcharmy Meowls]] no cobran las mismas Invocaciones: la línea corta Artmage da un número de robos distinto que la larga con Péndulo y Enlace.",
              "Cuando la lista sin hand traps va segunda, no interrumpe tu turno: responde en el suyo. Nada puede responder a [[Super Polymerization]], que usa tus monstruos como material; [[Dark Ruler No More]] niega tus monstruos boca arriba y los efectos de monstruo no pueden responderle; [[Triple Tactics Thrust]] solo funciona si activaste un efecto de monstruo ese turno; [[Pot of Sloth]] roba 1 carta por cada carta que controlas.",
              "Romper el primer campo y quitarle los recursos de recuperación (Litera, Ars Magna desterrados, Trampas ya usadas) son intercambios distintos: planea los dos.",
            ],
          },
        ],
      },
    },
  },
];
