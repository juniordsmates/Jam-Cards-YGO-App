// Interrupções de mão usadas no cálculo das respostas (Database-Cards-Ygo, dados/respostas.json):
// o pipeline rejoga cada linha com estas cartas na mão do oponente e marca, em cada passo, quais o
// motor de regras deixaria ativar. Aqui fica só o que cada uma faz, para exibir no app.
// Chave: nome oficial em inglês.

export const RESPOSTAS: Record<string, string> = {
  "Ash Blossom & Joyous Spring": "nega o efeito que busca, Invoca ou envia cartas do Deck",
  "Effect Veiler": "nega os efeitos de um monstro no campo",
  "Infinite Impermanence": "nega os efeitos de um monstro no campo (ou de uma Magia/Armadilha na coluna)",
  "Ghost Ogre & Snow Rabbit": "destrói a carta no campo que ativou o efeito",
  "Ghost Belle & Haunted Mansion": "nega o efeito que usa o Cemitério",
  "Ghost Mourner & Moonlit Chill": "nega os efeitos de um monstro Invocado por Invocação-Especial",
  "Droll & Lock Bird": "impede adicionar mais cartas do Deck à mão no turno",
  "Nibiru, the Primal Being": "depois de 5 Invocações, troca os monstros do campo por uma Ficha",
  "D.D. Crow": "bane uma carta do Cemitério",
  "Dimension Shifter": "cartas que iriam ao Cemitério são banidas",
  'Maxx "C"': "compra 1 carta a cada Invocação-Especial",
  "Mulcharmy Purulia": "compra cartas com Invocações da mão",
  "Mulcharmy Fuwalos": "compra cartas com Invocações do Deck ou Extra Deck",
  "Mulcharmy Meowls": "compra cartas com Invocações do Extra Deck",
  "Bystial Magnamhut": "bane um monstro LUZ/TREVAS do Cemitério",
  "Bystial Druiswurm": "bane um monstro LUZ/TREVAS do Cemitério",
  "Dominus Impulse": "nega o efeito de monstro ativado",
  "Dominus Purge": "nega o efeito de monstro ativado na mão ou no Cemitério",
  "Skull Meister": "nega o efeito ativado no Cemitério",
  "PSY-Framegear Gamma": "nega a ativação de efeito de monstro e destrói o monstro",
  "Artifact Lancea": "impede banir cartas no turno",
  "Herald of Orange Light": "nega a ativação de efeito de monstro e destrói o monstro",
  'Retaliating "C"': "cartas que iriam ao Cemitério são banidas",
};
