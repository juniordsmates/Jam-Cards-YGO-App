import type { PerfilDeck } from "../db/metaCall";

// Meta Call: cartas usadas contra o meta e como cada uma pontua contra um deck (0 a 1), a partir do
// perfil dele (o que o motor do deck faz, lido do texto oficial, e as linhas do motor de regras).
// Os textos de "papel" e das condições seguem o texto oficial de cada carta (cartas.json da base).
// A banlist do formato decide se a carta entra e com quantas cópias.

export type CategoriaMeta = "hand-trap" | "resposta" | "segundo" | "side";

export const CATEGORIAS: { id: CategoriaMeta; label: string; hint: string }[] = [
  { id: "hand-trap", label: "Hand traps", hint: "Da mão, no turno do oponente: param o combo" },
  { id: "resposta", label: "Respostas", hint: "Armadilhas e Magias Rápidas baixadas que negam ou removem" },
  { id: "segundo", label: "Jogando em segundo", hint: "Quebram o campo final do oponente" },
  { id: "side", label: "Side e floodgates", hint: "Cartas específicas contra um tipo de deck" },
];

export interface ItemCatalogo {
  /** nome oficial em inglês */
  nome: string;
  categoria: CategoriaMeta;
  /** o que a carta faz, em uma linha */
  papel: string;
  nota: (p: PerfilDeck) => { nota: number; motivo: string };
  /** cuidado com o seu deck (a carta também atrapalha você) */
  aviso?: (meu?: PerfilDeck) => string | undefined;
  /** o que o seu deck precisa ter; sem isso a carta quase não serve */
  exige?: (meu: PerfilDeck) => string | undefined;
  /** o requisito em texto, mostrado quando o seu deck não foi escolhido */
  requisito?: string;
  /** peso da carta sem saber o seu deck (padrão 0,5) */
  fatorSemDeck?: number;
}

const L = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const n1 = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
/** soma das frações das listas que jogam hand traps (≈ hand traps por deck) */
const hts = (p: PerfilDeck) => p.handTraps.filter((h) => !h.side).reduce((s, h) => s + h.pct, 0);
const chefes = (p: PerfilDeck) => p.chefes.reduce((s, c) => s + c.pct, 0);
const atrib = (meu: PerfilDeck | undefined, lista: string[]) => (meu ? lista.reduce((s, a) => s + (meu.atribFrac[a] ?? 0), 0) : 0);
const travaAtributos = (lista: string[], nomes: string) => (meu?: PerfilDeck) => {
  const f = atrib(meu, lista);
  return f >= 0.2 ? `da mão, você não ativa mais efeitos de monstros ${nomes} no Duelo (${pct(f)} dos monstros do seu deck)` : undefined;
};

export const CATALOGO: ItemCatalogo[] = [
  // ------------------------------------------------------------------ hand traps
  {
    nome: "Ash Blossom & Joyous Spring",
    categoria: "hand-trap",
    papel: "nega efeitos que buscam, Invocam ou enviam do Deck",
    nota: (p) => ({
      nota: p.ash * 1.7 + (p.linhas ? Math.min(0.25, (p.linhas.buscas + p.linhas.envios) / 12) : 0),
      motivo: `${pct(p.ash)} do motor busca, Invoca ou envia do Deck`,
    }),
  },
  {
    nome: "Droll & Lock Bird",
    categoria: "hand-trap",
    papel: "depois da primeira busca, ninguém adiciona do Deck no turno",
    nota: (p) => ({
      nota: p.busca * 1.3 + (p.linhas ? Math.min(0.4, p.linhas.buscas / 5) : 0),
      motivo: `${pct(p.busca)} do motor busca no Deck${p.linhas ? `; ${n1(p.linhas.buscas)} buscas por combo` : ""}`,
    }),
  },
  {
    nome: "Infinite Impermanence",
    categoria: "hand-trap",
    papel: "nega os efeitos de um monstro (da mão, sem cartas no seu campo)",
    nota: (p) => ({ nota: p.efeitoCampo * 1.5, motivo: `${pct(p.efeitoCampo)} do deck depende de efeitos de monstro no campo` }),
  },
  {
    nome: "Effect Veiler",
    categoria: "hand-trap",
    papel: "nega os efeitos de um monstro (só na Main Phase do oponente)",
    nota: (p) => ({ nota: p.efeitoCampo * 1.4, motivo: `${pct(p.efeitoCampo)} do deck depende de efeitos de monstro no campo` }),
  },
  {
    nome: "Ghost Ogre & Snow Rabbit",
    categoria: "hand-trap",
    papel: "destrói a carta que ativou efeito no campo (não nega)",
    nota: (p) => ({ nota: (p.efeitoCampo + p.permanentes) * 1.0, motivo: `efeitos no campo em ${pct(p.efeitoCampo)} do deck e ${pct(p.permanentes)} de Magias/Armadilhas que ficam no campo` }),
  },
  {
    nome: "Ghost Belle & Haunted Mansion",
    categoria: "hand-trap",
    papel: "nega efeitos que tiram cartas do Cemitério",
    nota: (p) => ({ nota: p.usaGY * 1.9, motivo: `${pct(p.usaGY)} do motor adiciona, Invoca ou bane do Cemitério` }),
  },
  {
    nome: "Ghost Mourner & Moonlit Chill",
    categoria: "hand-trap",
    papel: "nega os efeitos de um monstro Invocado por Invocação-Especial",
    nota: (p) => ({
      nota: (p.invocaPorEfeito * 0.8 + (p.linhas ? Math.min(0.4, p.linhas.especiais / 15) : 0)) * 0.7,
      motivo: `${pct(p.invocaPorEfeito)} do motor Invoca por Invocação-Especial`,
    }),
  },
  {
    nome: "Nibiru, the Primal Being",
    categoria: "hand-trap",
    papel: "depois de 5 Invocações, troca o campo do oponente por uma Ficha",
    nota: (p) =>
      p.linhas
        ? { nota: (p.linhas.invocacoes - 3) / 6, motivo: `${n1(p.linhas.invocacoes)} Invocações por combo (Nibiru a partir de 5)` }
        : { nota: p.invocaExtra * 0.9, motivo: "estimado: muitas Invocações do Extra Deck" },
  },
  {
    nome: "D.D. Crow",
    categoria: "hand-trap",
    papel: "bane uma carta do Cemitério do oponente",
    nota: (p) => ({ nota: p.efeitoGY * 1.1, motivo: `${pct(p.efeitoGY)} do motor tem efeito no Cemitério` }),
  },
  {
    nome: "Bystial Magnamhut",
    categoria: "hand-trap",
    papel: "bane um monstro LUZ/TREVAS de um Cemitério e se Invoca",
    nota: (p) => ({ nota: p.luzTrevasGY * 1.8, motivo: `${pct(p.luzTrevasGY)} do motor são monstros LUZ/TREVAS que passam pelo Cemitério` }),
  },
  {
    nome: "Bystial Druiswurm",
    categoria: "hand-trap",
    papel: "bane um monstro LUZ/TREVAS de um Cemitério e se Invoca",
    nota: (p) => ({ nota: p.luzTrevasGY * 1.7, motivo: `${pct(p.luzTrevasGY)} do motor são monstros LUZ/TREVAS que passam pelo Cemitério` }),
  },
  {
    nome: "Mulcharmy Fuwalos",
    categoria: "hand-trap",
    papel: "compra 1 a cada Invocação-Especial do Deck ou do Extra Deck (sem cartas no seu campo)",
    nota: (p) =>
      p.linhas
        ? { nota: (p.linhas.doExtra + p.linhas.doDeck) / 4, motivo: `${n1(p.linhas.doExtra + p.linhas.doDeck)} Invocações do Deck/Extra Deck por combo` }
        : { nota: (p.invocaDeck + p.invocaExtra) * 1.3, motivo: `${pct(p.invocaDeck + p.invocaExtra)} do motor Invoca do Deck ou do Extra Deck` },
  },
  {
    nome: "Mulcharmy Purulia",
    categoria: "hand-trap",
    papel: "compra 1 a cada Invocação da mão (sem cartas no seu campo)",
    nota: (p) =>
      p.linhas
        ? { nota: p.linhas.daMao / 4, motivo: `${n1(p.linhas.daMao)} Invocações da mão por combo` }
        : { nota: p.invocaMao * 1.6, motivo: `${pct(p.invocaMao)} do motor Invoca da mão` },
  },
  {
    nome: "Mulcharmy Meowls",
    categoria: "hand-trap",
    papel: "compra 1 a cada Invocação-Especial do Cemitério ou das banidas (sem cartas no seu campo)",
    nota: (p) =>
      p.linhas && p.linhas.doGY > 0
        ? { nota: p.linhas.doGY / 3, motivo: `${n1(p.linhas.doGY)} Invocações do Cemitério/banidas por combo` }
        : { nota: p.invocaGY * 1.6, motivo: `${pct(p.invocaGY)} do motor Invoca do Cemitério ou das banidas` },
  },
  {
    nome: 'Maxx "C"',
    categoria: "hand-trap",
    papel: "compra 1 a cada Invocação-Especial do oponente no turno",
    nota: (p) =>
      p.linhas ? { nota: p.linhas.especiais / 8, motivo: `${n1(p.linhas.especiais)} Invocações-Especiais por combo` } : { nota: p.invocaPorEfeito * 1.3, motivo: `${pct(p.invocaPorEfeito)} do motor Invoca` },
  },
  {
    nome: "Dominus Impulse",
    categoria: "hand-trap",
    papel: "Armadilha (da mão se o oponente controlar carta): nega efeito que Invoca por Invocação-Especial",
    nota: (p) => ({ nota: p.invocaPorEfeito * 1.4, motivo: `${pct(p.invocaPorEfeito)} do motor tem efeito que Invoca` }),
    aviso: travaAtributos(["LIGHT", "EARTH", "WIND"], "LUZ, TERRA e VENTO"),
  },
  {
    nome: "Dominus Purge",
    categoria: "hand-trap",
    papel: "Armadilha (da mão se o oponente controlar carta): nega efeito que adiciona do Deck à mão",
    nota: (p) => ({ nota: p.busca * 1.5, motivo: `${pct(p.busca)} do motor busca no Deck` }),
    aviso: travaAtributos(["DARK", "WATER", "FIRE"], "TREVAS, ÁGUA e FOGO"),
  },
  {
    nome: "Dominus Spark",
    categoria: "hand-trap",
    papel: "Armadilha: depois de efeito de monstro na mão ou no Cemitério, bane 1 monstro do oponente",
    nota: (p) => ({ nota: p.efeitoMaoGY * 1.0, motivo: `${pct(p.efeitoMaoGY)} do motor ativa efeitos de monstro na mão ou no Cemitério` }),
    aviso: travaAtributos(["EARTH", "WATER", "FIRE", "WIND"], "TERRA, ÁGUA, FOGO e VENTO"),
  },
  {
    nome: "Skull Meister",
    categoria: "hand-trap",
    papel: "nega um efeito ativado no Cemitério",
    nota: (p) => ({ nota: p.efeitoGY * 0.9, motivo: `${pct(p.efeitoGY)} do motor ativa efeitos no Cemitério` }),
  },
  {
    nome: "PSY-Framegear Gamma",
    categoria: "hand-trap",
    papel: "nega a ativação de efeito de monstro (só sem monstros no seu campo)",
    nota: (p) => ({ nota: (p.efeitoCampo + p.efeitoMaoGY) * 0.6, motivo: "nega o primeiro efeito de monstro; melhor jogando em segundo, com o campo vazio" }),
  },
  {
    nome: "Herald of Orange Light",
    categoria: "hand-trap",
    papel: "nega a ativação de efeito de monstro (descarta outro monstro Fada)",
    nota: (p) => ({ nota: (p.efeitoCampo + p.efeitoMaoGY) * 0.7, motivo: "nega efeito de monstro em qualquer lugar" }),
    exige: (meu) => (meu.fadas < 0.15 ? "precisa de outro monstro Fada na mão: o seu deck quase não tem Fadas" : undefined),
    requisito: "precisa de outro monstro Fada na mão",
    fatorSemDeck: 0.4,
  },
  {
    nome: "Artifact Lancea",
    categoria: "hand-trap",
    papel: "no turno do oponente, ninguém pode banir cartas",
    nota: (p) => ({ nota: p.bane * 1.3, motivo: `${pct(p.bane)} do motor bane cartas (no efeito ou no custo)` }),
  },
  {
    nome: "Fydraulis Harmonia",
    categoria: "hand-trap",
    papel: "quando um monstro do oponente ativa efeito: se Invoca e, revelando 6 Sincros, destrói 1 monstro",
    nota: (p) => ({ nota: p.efeitoCampo * 0.9, motivo: `${pct(p.efeitoCampo)} do deck usa efeitos de monstro no campo` }),
    exige: (meu) => (meu.sincros < 0.3 ? "precisa de Monstros Sincro no Extra Deck para revelar" : undefined),
    requisito: "precisa de Monstros Sincro no Extra Deck",
    fatorSemDeck: 0.5,
  },
  {
    nome: 'Retaliating "C"',
    categoria: "hand-trap",
    papel: "contra Magia que Invoca: se Invoca e bane o que iria ao Cemitério",
    nota: (p) => ({ nota: p.magiaInvoca * 1.6, motivo: `${pct(p.magiaInvoca)} do motor são Magias que Invocam` }),
  },
  {
    nome: "Dimension Shifter",
    categoria: "hand-trap",
    papel: "sem cartas no seu Cemitério: até o fim do próximo turno, o que iria ao Cemitério é banido",
    nota: (p) => ({ nota: (p.efeitoGY + p.usaGY + p.enviaDeck) * 0.9, motivo: `o deck depende do Cemitério (${pct(p.efeitoGY)} com efeito lá)` }),
    aviso: (meu) => (meu && meu.efeitoGY >= 0.25 ? `também bane as suas cartas (${pct(meu.efeitoGY)} do seu motor usa o Cemitério)` : undefined),
  },

  // ------------------------------------------------------------------ respostas (baixadas)
  {
    nome: "Solemn Judgment",
    categoria: "resposta",
    papel: "nega uma Invocação ou a ativação de Magia/Armadilha (metade dos PV)",
    nota: (p) => ({ nota: 0.3 + p.invocaExtra * 0.3 + (p.magias + p.armadilhas) * 0.3, motivo: "para a Invocação do Extra Deck ou a Magia principal do combo" }),
  },
  {
    nome: "Solemn Strike",
    categoria: "resposta",
    papel: "nega uma Invocação-Especial ou ativação de efeito de monstro (1500 PV)",
    nota: (p) => ({ nota: 0.25 + (p.efeitoCampo + p.efeitoMaoGY) * 0.3, motivo: "para o primeiro monstro ou efeito de monstro importante" }),
  },
  {
    nome: "Solemn Warning",
    categoria: "resposta",
    papel: "nega Invocação ou efeito que Invoca (2000 PV)",
    nota: (p) => ({ nota: 0.25 + p.invocaPorEfeito * 0.4, motivo: `${pct(p.invocaPorEfeito)} do motor tem efeito que Invoca` }),
  },
  {
    nome: "Solemn Accusation",
    categoria: "resposta",
    papel: "nega a ativação de Magia/Armadilha (destrói ou bane, e trava o nome)",
    nota: (p) => ({ nota: (p.magias + p.armadilhas) * 1.4, motivo: `${pct(p.magias + p.armadilhas)} do motor são Magias/Armadilhas` }),
  },
  {
    nome: "Red Reboot",
    categoria: "resposta",
    papel: "nega uma Armadilha e o oponente não ativa mais Armadilhas no turno",
    nota: (p) => ({ nota: p.armadilhas * 2.2, motivo: `${pct(p.armadilhas)} do motor são Armadilhas` }),
  },
  {
    nome: "Called by the Grave",
    categoria: "resposta",
    papel: "bane um monstro do Cemitério e nega os efeitos das cópias (vence hand traps)",
    nota: (p) => ({
      nota: hts(p) * 0.22 + p.efeitoGY * 0.5,
      motivo: `o deck joga ~${n1(hts(p))} hand traps no Main${p.efeitoGY > 0.2 ? ` e ${pct(p.efeitoGY)} do motor usa o Cemitério` : ""}`,
    }),
  },
  {
    nome: "Crossout Designator",
    categoria: "resposta",
    papel: "declara um nome e nega as cópias até o fim do turno (precisa de uma no seu Deck)",
    nota: (p) => ({ nota: hts(p) * 0.22, motivo: `o deck joga ~${n1(hts(p))} hand traps; declare uma que você também joga` }),
  },
  {
    nome: "Cosmic Cyclone",
    categoria: "resposta",
    papel: "bane uma Magia/Armadilha (1000 PV)",
    nota: (p) => ({ nota: p.permanentes * 1.6 + p.armadilhas * 0.5, motivo: `${pct(p.permanentes)} de Magias/Armadilhas que ficam no campo` }),
  },
  {
    nome: "Twin Twisters",
    categoria: "resposta",
    papel: "descarta 1 e destrói até 2 Magias/Armadilhas",
    nota: (p) => ({ nota: p.permanentes * 1.5 + p.armadilhas * 0.6, motivo: `${pct(p.permanentes)} de Magias/Armadilhas que ficam no campo` }),
  },
  {
    nome: "Mystical Space Typhoon",
    categoria: "resposta",
    papel: "destrói uma Magia/Armadilha",
    nota: (p) => ({ nota: (p.permanentes * 1.5 + p.armadilhas * 0.5) * 0.9, motivo: `${pct(p.permanentes)} de Magias/Armadilhas que ficam no campo` }),
  },
  {
    nome: "Typhoon",
    categoria: "resposta",
    papel: "destrói uma Magia/Armadilha virada para cima (da mão, se o oponente tiver 2+ e você nenhuma)",
    nota: (p) => ({ nota: p.permanentes * 1.5, motivo: `${pct(p.permanentes)} de Magias/Armadilhas que ficam no campo` }),
  },
  {
    nome: "Book of Moon",
    categoria: "resposta",
    papel: "vira um monstro para baixo",
    nota: (p) => ({ nota: (p.efeitoCampo * 0.8 + Math.min(1, chefes(p)) * 0.2) * 0.6, motivo: "tira os efeitos de campo de um monstro" }),
  },
  {
    nome: "Skill Drain",
    categoria: "resposta",
    papel: "nega os efeitos de todos os monstros virados para cima no campo (1000 PV)",
    nota: (p) => ({ nota: p.efeitoCampo * 0.8, motivo: `${pct(p.efeitoCampo)} do deck depende de efeitos de monstro no campo` }),
    aviso: (meu) => (meu && meu.efeitoCampo >= 0.3 ? `também nega os seus monstros (${pct(meu.efeitoCampo)} do seu deck usa efeitos no campo)` : undefined),
  },

  // ------------------------------------------------------------------ jogando em segundo
  {
    nome: "Dark Ruler No More",
    categoria: "segundo",
    papel: "nega os efeitos de todos os monstros do oponente no turno (sem resposta de monstros)",
    nota: (p) =>
      p.linhas
        ? { nota: p.linhas.monstrosFinais / 4 + Math.min(1, chefes(p)) * 0.1, motivo: `${n1(p.linhas.monstrosFinais)} monstros no campo final` }
        : { nota: chefes(p) * 0.3, motivo: "monstros com negação no campo final" },
  },
  {
    nome: "Evenly Matched",
    categoria: "segundo",
    papel: "no fim da Battle Phase, o oponente bane virado para baixo até ficar com o mesmo número de cartas",
    nota: (p) =>
      p.linhas
        ? { nota: (p.linhas.monstrosFinais + p.linhas.magiasFinais - 1) / 5, motivo: `${n1(p.linhas.monstrosFinais + p.linhas.magiasFinais)} cartas no campo final` }
        : { nota: 0.5, motivo: "contra campos grandes" },
  },
  {
    nome: "Lightning Storm",
    categoria: "segundo",
    papel: "sem cartas viradas para cima: destrói os monstros em ataque ou as Magias/Armadilhas do oponente",
    nota: (p) =>
      p.linhas
        ? { nota: Math.max(p.linhas.monstrosFinais, p.linhas.magiasFinais * 1.3) / 4, motivo: `campo final: ${n1(p.linhas.monstrosFinais)} monstros, ${n1(p.linhas.magiasFinais)} Magias/Armadilhas` }
        : { nota: 0.45 + p.armadilhas * 0.5, motivo: "contra campo de monstros ou de Armadilhas" },
  },
  {
    nome: "Harpie's Feather Duster",
    categoria: "segundo",
    papel: "destrói todas as Magias/Armadilhas do oponente",
    nota: (p) => ({
      nota: p.armadilhas * 1.5 + p.permanentes + (p.linhas ? p.linhas.magiasFinais / 4 : 0),
      motivo: `${pct(p.armadilhas)} do motor são Armadilhas${p.linhas ? `; ${n1(p.linhas.magiasFinais)} Magias/Armadilhas no campo final` : ""}`,
    }),
  },
  {
    nome: "Raigeki",
    categoria: "segundo",
    papel: "destrói todos os monstros do oponente",
    nota: (p) => (p.linhas ? { nota: p.linhas.monstrosFinais / 4, motivo: `${n1(p.linhas.monstrosFinais)} monstros no campo final` } : { nota: 0.4, motivo: "contra campos de monstros" }),
  },
  {
    nome: "Forbidden Droplet",
    categoria: "segundo",
    papel: "nega e corta o ATK de vários monstros; o oponente não responde com o mesmo tipo de carta",
    nota: (p) => ({ nota: Math.min(1, chefes(p)) * 0.35 + p.efeitoCampo * 0.4, motivo: p.chefes.length ? "contra os monstros com negação do campo final" : "contra efeitos de monstro no campo" }),
  },
  {
    nome: "Gameciel, the Sea Turtle Kaiju",
    categoria: "segundo",
    papel: "oferece um monstro do oponente para Invocar no campo dele (tira um chefe)",
    nota: (p) => ({ nota: Math.min(1, chefes(p)) * 0.55 * (p.linhas && p.linhas.monstrosFinais > 3 ? 0.7 : 1), motivo: p.chefes.length ? "tira um chefe que nega sem destruí-lo nem mirá-lo" : "tira um monstro do campo" }),
  },
  {
    nome: "Dogoran, the Mad Flame Kaiju",
    categoria: "segundo",
    papel: "oferece um monstro do oponente; depois, pode destruir todos os monstros dele",
    nota: (p) => ({ nota: Math.min(1, chefes(p)) * 0.45, motivo: "tira um chefe sem destruí-lo nem mirá-lo" }),
  },
  {
    nome: "Super Polymerization",
    categoria: "segundo",
    papel: "Fusão com monstros do campo do oponente, sem resposta",
    nota: (p) => ({ nota: (Math.min(1, chefes(p)) * 0.3 + (p.linhas ? p.linhas.monstrosFinais / 8 : 0.2)) * 0.8, motivo: "usa os monstros do oponente como matéria" }),
    exige: (meu) => (meu.fusoes < 0.15 ? "precisa de Monstros de Fusão no seu Extra Deck" : undefined),
    requisito: "precisa de Monstros de Fusão no Extra Deck",
    fatorSemDeck: 0.6,
  },
  {
    nome: "Triple Tactics Talent",
    categoria: "segundo",
    papel: "se o oponente ativou efeito de monstro no seu turno: compra 2, rouba um monstro ou tira uma carta da mão",
    nota: (p) => ({ nota: hts(p) * 0.25, motivo: `o deck joga ~${n1(hts(p))} hand traps (ativados no seu turno)` }),
  },
  {
    nome: "Triple Tactics Thrust",
    categoria: "segundo",
    papel: "se o oponente ativou efeito de monstro no turno: baixa uma Magia/Armadilha Normal do Deck",
    nota: (p) => ({ nota: hts(p) * 0.2, motivo: `o deck joga ~${n1(hts(p))} hand traps (ativados no seu turno)` }),
  },

  // ------------------------------------------------------------------ side e floodgates
  {
    nome: "Thunder King Rai-Oh",
    categoria: "side",
    papel: "no campo: ninguém busca no Deck; nega uma Invocação-Especial",
    nota: (p) => ({ nota: (p.busca * 0.9 + p.invocaExtra * 0.3) * 0.7, motivo: `${pct(p.busca)} do motor busca no Deck` }),
  },
  {
    nome: "Imperial Order",
    categoria: "side",
    papel: "nega os efeitos das Magias no campo",
    nota: (p) => ({ nota: p.magias * 1.8, motivo: `${pct(p.magias)} do motor são Magias` }),
    aviso: (meu) => (meu && meu.magias >= 0.25 ? `também nega as suas Magias (${pct(meu.magias)} do seu motor)` : undefined),
  },
  {
    nome: "Anti-Spell Fragrance",
    categoria: "side",
    papel: "Magias precisam ser baixadas e esperar um turno",
    nota: (p) => ({ nota: p.magias * 1.6, motivo: `${pct(p.magias)} do motor são Magias` }),
    aviso: (meu) => (meu && meu.magias >= 0.25 ? `também trava as suas Magias (${pct(meu.magias)} do seu motor)` : undefined),
  },
  {
    nome: "Macro Cosmos",
    categoria: "side",
    papel: "no campo, o que iria ao Cemitério é banido",
    nota: (p) => ({ nota: (p.efeitoGY + p.usaGY) * 1.1, motivo: `o deck depende do Cemitério (${pct(p.efeitoGY)} com efeito lá)` }),
    aviso: (meu) => (meu && meu.efeitoGY >= 0.25 ? `também bane as suas cartas (${pct(meu.efeitoGY)} do seu motor usa o Cemitério)` : undefined),
  },
  {
    nome: "Dimensional Barrier",
    categoria: "side",
    papel: "declara Fusão, Sincro, Xyz, Ritual ou Pêndulo: ninguém Invoca desse tipo no turno",
    nota: (p) => ({
      nota: p.extraPrincipal.fracao * (p.linhas ? Math.min(1, p.linhas.doExtra / 2) : p.invocaExtra) * 1.1,
      motivo: `${pct(p.extraPrincipal.fracao)} do Extra Deck é ${TIPO_EXTRA[p.extraPrincipal.tipo] ?? p.extraPrincipal.tipo}`,
    }),
  },
  {
    nome: "There Can Be Only One",
    categoria: "side",
    papel: "cada jogador só controla 1 monstro de cada Tipo",
    nota: (p) => ({ nota: (p.tipoPrincipal.fracao - 0.45) * 1.8, motivo: `${pct(p.tipoPrincipal.fracao)} dos monstros são ${p.tipoPrincipal.race}` }),
    aviso: (meu) => (meu && meu.tipoPrincipal.fracao >= 0.5 ? `também limita você (${pct(meu.tipoPrincipal.fracao)} dos seus monstros são ${meu.tipoPrincipal.race})` : undefined),
  },
  {
    nome: "Rivalry of Warlords",
    categoria: "side",
    papel: "cada jogador só controla monstros de 1 Tipo",
    nota: (p) => ({ nota: (p.tipos - 1) * 0.3, motivo: `${p.tipos} Tipos de monstro no deck` }),
    aviso: (meu) => (meu && meu.tipos > 1 ? `também limita você (${meu.tipos} Tipos de monstro no seu deck)` : undefined),
  },
  {
    nome: "Gozen Match",
    categoria: "side",
    papel: "cada jogador só controla monstros de 1 Atributo",
    nota: (p) => ({ nota: (p.atributos - 1) * 0.3, motivo: `${p.atributos} Atributos de monstro no deck` }),
    aviso: (meu) => (meu && meu.atributos > 1 ? `também limita você (${meu.atributos} Atributos no seu deck)` : undefined),
  },
  {
    nome: "System Down",
    categoria: "side",
    papel: "bane todos os monstros Máquina do campo e do Cemitério do oponente",
    nota: (p) => ({ nota: p.maquinas * 1.4, motivo: `${pct(p.maquinas)} dos monstros são Máquina` }),
  },
];

const TIPO_EXTRA: Record<string, string> = { fusion: "Fusão", synchro: "Sincro", xyz: "Xyz", link: "Link" };

/** Notas do catálogo sempre entre 0 e 1 */
for (const item of CATALOGO) {
  const f = item.nota;
  item.nota = (p) => {
    const r = f(p);
    return { ...r, nota: L(r.nota) };
  };
}
