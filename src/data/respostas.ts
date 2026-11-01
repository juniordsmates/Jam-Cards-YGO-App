import { t } from "../i18n";
// Interrupções de mão usadas no cálculo das respostas (Database-Cards-Ygo, dados/respostas.json):
// o pipeline rejoga cada linha com estas cartas na mão do oponente e marca, em cada passo, quais o
// motor de regras deixaria ativar. Aqui fica só o que cada uma faz, para exibir no app.
// Chave: nome oficial em inglês.

export const RESPOSTAS: Record<string, string> = {
  "Ash Blossom & Joyous Spring": t("nega o efeito que busca, Invoca ou envia cartas do Deck"),
  "Effect Veiler": t("nega os efeitos de um monstro no campo"),
  "Infinite Impermanence": t("nega os efeitos de um monstro no campo (ou de uma Magia/Armadilha na coluna)"),
  "Ghost Ogre & Snow Rabbit": t("destrói a carta no campo que ativou o efeito"),
  "Ghost Belle & Haunted Mansion": t("nega o efeito que usa o Cemitério"),
  "Ghost Mourner & Moonlit Chill": t("nega os efeitos de um monstro Invocado por Invocação-Especial"),
  "Droll & Lock Bird": t("impede adicionar mais cartas do Deck à mão no turno"),
  "Nibiru, the Primal Being": t("depois de 5 Invocações, troca os monstros do campo por uma Ficha"),
  "D.D. Crow": t("bane uma carta do Cemitério"),
  "Dimension Shifter": t("cartas que iriam ao Cemitério são banidas (até o fim do próximo turno)"),
  'Maxx "C"': t("compra 1 carta a cada Invocação-Especial"),
  "Mulcharmy Purulia": t("compra cartas com Invocações da mão"),
  "Mulcharmy Fuwalos": t("compra cartas com Invocações do Deck ou Extra Deck"),
  "Mulcharmy Meowls": t("compra cartas com Invocações do Cemitério ou das banidas"),
  "Bystial Magnamhut": t("bane um monstro LUZ/TREVAS do Cemitério"),
  "Bystial Druiswurm": t("bane um monstro LUZ/TREVAS do Cemitério"),
  "Dominus Impulse": t("nega o efeito que Invoca por Invocação-Especial"),
  "Dominus Purge": t("nega o efeito que adiciona cartas do Deck à mão"),
  "Skull Meister": t("nega o efeito ativado no Cemitério"),
  "PSY-Framegear Gamma": t("nega a ativação de efeito de monstro e destrói o monstro"),
  "Artifact Lancea": t("impede banir cartas no turno"),
  "Herald of Orange Light": t("nega a ativação de efeito de monstro e destrói o monstro"),
  'Retaliating "C"': t("cartas que iriam ao Cemitério são banidas"),
};
