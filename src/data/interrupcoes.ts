import { nomeDoEvento, type Analise, type Evento, type Indicacao, type Regra, type Situacao } from "../db/indicacoes";

// Interrupções conhecidas e quando cada uma pode responder, escritas a partir do texto oficial
// (cartas.json da base). Chave: nome oficial em inglês. A banlist do formato decide se aparecem
// (proibidas ficam de fora), e o uso em torneios decide a ordem.
//
// Cada regra recebe a ação (Evento), o que o efeito faz (Analise, lida do texto da carta) e a
// situação dos campos (Situacao), e devolve o motivo — ou null quando a carta não responde.

const mainPhase = (s: Situacao) => s.fase === "M1" || s.fase === "M2";
const ativaMonstro = (ev: Evento, a: Analise) => ev.tipo === "ativa" && a.monstro;
const ativaCartaMT = (ev: Evento, a: Analise) => ev.tipo === "ativa" && !a.monstro && !!ev.cartaAtivada;
/** monstro com efeito que ficou virado para cima no campo (Invocado agora ou ativando no campo) */
const monstroNoCampo = (ev: Evento, a: Analise) =>
  (a.invocacao && ev.card?.frame !== "normal" && ev.tipo !== "baixa") || (ev.tipo === "ativa" && a.monstro && a.noCampo);
/** carta que acabou de ir para o Cemitério de quem agiu */
const foiAoCemiterio = (ev: Evento, a: Analise) => (ev.tipo === "move" && ev.para === "cemiterio") || a.vaiAoCemiterio;
const semCartas = (s: Situacao) => s.respondente.cartas === 0;

const sem = (cond: boolean, texto: string): Pick<Indicacao, "impedida"> => (cond ? {} : { impedida: texto });

export const REGRAS: Regra[] = [
  // ------------------------------------------------------------------ hand traps
  {
    nome: "Ash Blossom & Joyous Spring",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) => {
      if (ev.tipo !== "ativa") return null;
      const o = [
        a.acoes.has("busca") && "adiciona do Deck à mão",
        a.acoes.has("compra") && "compra do Deck",
        a.acoes.has("invoca-deck") && "Invoca do Deck",
        a.acoes.has("envia-deck") && "envia do Deck ao Cemitério",
      ].filter(Boolean);
      return o.length ? { motivo: `nega o efeito de ${nomeDoEvento(ev)}, que ${o.join(" e ")}` } : null;
    },
  },
  {
    nome: "Effect Veiler",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      monstroNoCampo(ev, a)
        ? {
            motivo: `nega os efeitos de ${nomeDoEvento(ev)} no campo até o fim do turno${a.noCampo ? " (inclusive o efeito que acabou de ativar)" : ""}`,
            ...sem(mainPhase(s) && s.turno === ev.lado, "só na Main Phase do turno de quem joga a carta"),
          }
        : null,
  },
  {
    nome: "Infinite Impermanence",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a, s) =>
      monstroNoCampo(ev, a)
        ? {
            motivo: `nega os efeitos de ${nomeDoEvento(ev)} até o fim do turno${a.noCampo ? " (inclusive o efeito que acabou de ativar)" : ""}`,
            condicao: semCartas(s) ? undefined : "da mão só sem cartas no seu campo; senão, precisa estar baixada",
          }
        : null,
  },
  {
    nome: "Ghost Ogre & Snow Rabbit",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      ev.tipo === "ativa" && a.noCampo && (a.monstro || !ev.cartaAtivada)
        ? { motivo: `destrói ${nomeDoEvento(ev)} no campo (não nega: o efeito ainda resolve)` }
        : null,
  },
  {
    nome: "Ghost Belle & Haunted Mansion",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) => {
      if (ev.tipo !== "ativa") return null;
      const o = [
        a.acoes.has("gy-mao") && "tira cartas do Cemitério",
        a.acoes.has("invoca-gy") && "Invoca do Cemitério",
        a.acoes.has("gy-bane") && "bane do Cemitério",
      ].filter(Boolean);
      return o.length ? { motivo: `nega a ativação de ${nomeDoEvento(ev)}, que ${o.join(" e ")}` } : null;
    },
  },
  {
    nome: "Ghost Mourner & Moonlit Chill",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      a.especial && ev.tipo !== "baixa" ? { motivo: `nega os efeitos de ${nomeDoEvento(ev)}, que acabou de ser Invocado por Invocação-Especial, até o fim do turno` } : null,
  },
  {
    nome: "Droll & Lock Bird",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) => {
      if (ev.tipo === "move" && ev.de === "deck" && ev.para === "mao") return { motivo: "uma carta saiu do Deck para a mão: a partir de agora, ninguém adiciona cartas do Deck à mão neste turno" };
      if (ev.tipo === "compra" && s.fase !== "DP") return { motivo: "compra fora da Draw Phase: depois dela, ninguém adiciona cartas do Deck à mão neste turno" };
      if (ev.tipo === "ativa" && (a.acoes.has("busca") || a.acoes.has("compra")))
        return { motivo: `depois que ${nomeDoEvento(ev)} adicionar a carta, impede as próximas adições do Deck neste turno`, condicao: "só depois que a busca resolver (não nega esta)" };
      return null;
    },
  },
  {
    nome: "Nibiru, the Primal Being",
    origem: "mao",
    tipo: "hand-trap",
    quando: (_ev, a, s) =>
      a.invocacao && s.invocacoes >= 5
        ? {
            motivo: `já são ${s.invocacoes} Invocações neste turno: oferece todos os monstros e deixa uma Ficha para quem joga`,
            ...sem(mainPhase(s), "só na Main Phase"),
          }
        : null,
  },
  {
    nome: "D.D. Crow",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      foiAoCemiterio(ev, a) || (ev.tipo === "ativa" && ev.de === "cemiterio")
        ? { motivo: `bane ${nomeDoEvento(ev)} do Cemitério${ev.tipo === "ativa" && ev.de === "cemiterio" ? " (efeitos que usam a própria carta deixam de resolver)" : ""}` }
        : null,
  },
  {
    nome: "Bystial Magnamhut",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) => bystial(ev, a, s),
  },
  {
    nome: "Bystial Druiswurm",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) => bystial(ev, a, s),
  },
  {
    nome: 'Maxx "C"',
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      a.especial || (ev.tipo === "ativa" && a.acoes.has("invoca"))
        ? { motivo: `compra 1 carta a cada Invocação-Especial deste turno${s.especiais <= 1 ? " (melhor agora, no começo do combo)" : ""}` }
        : null,
  },
  {
    nome: "Mulcharmy Purulia",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (a.invocacao && ev.de === "mao") || (ev.tipo === "ativa" && a.acoes.has("invoca-mao"))
        ? { motivo: "compra 1 carta a cada Invocação (Normal ou Especial) da mão neste turno", ...sem(semCartas(s), "só sem cartas no seu campo") }
        : null,
  },
  {
    nome: "Mulcharmy Fuwalos",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (a.especial && (ev.de === "deck" || ev.de === "extra")) || (ev.tipo === "ativa" && (a.acoes.has("invoca-deck") || a.acoes.has("invoca-extra")))
        ? { motivo: "compra 1 carta a cada Invocação-Especial do Deck ou do Extra Deck neste turno", ...sem(semCartas(s), "só sem cartas no seu campo") }
        : null,
  },
  {
    nome: "Mulcharmy Meowls",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (a.especial && (ev.de === "cemiterio" || ev.de === "banido")) || (ev.tipo === "ativa" && (a.acoes.has("invoca-gy") || a.acoes.has("invoca-banido")))
        ? { motivo: "compra 1 carta a cada Invocação-Especial do Cemitério ou das banidas neste turno", ...sem(semCartas(s), "só sem cartas no seu campo") }
        : null,
  },
  {
    nome: "Skull Meister",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev) => (ev.tipo === "ativa" && ev.de === "cemiterio" ? { motivo: `nega o efeito de ${nomeDoEvento(ev)} ativado no Cemitério` } : null),
  },
  {
    nome: "PSY-Framegear Gamma",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      ativaMonstro(ev, a)
        ? { motivo: `nega a ativação de ${nomeDoEvento(ev)} e destrói o monstro`, ...sem(s.respondente.monstros === 0, "só sem monstros no seu campo") }
        : null,
  },
  {
    nome: "PSY-Framegear Delta",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      ativaCartaMT(ev, a) && a.magia
        ? { motivo: `nega a ativação de ${nomeDoEvento(ev)} (Magia) e a destrói`, ...sem(s.respondente.monstros === 0, "só sem monstros no seu campo") }
        : null,
  },
  {
    nome: "Herald of Orange Light",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      ativaMonstro(ev, a)
        ? {
            motivo: `nega a ativação de ${nomeDoEvento(ev)} e destrói o monstro`,
            condicao: "precisa de outro monstro Fada na mão",
            ...(s.respondente.fadasNaMao === 0 ? { impedida: "sem outro monstro Fada na mão" } : {}),
          }
        : null,
  },
  {
    nome: "Fydraulis Harmonia",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      ativaMonstro(ev, a) && a.noCampo
        ? { motivo: `Invoca-se ao revelar Monstros Sincro; revelando 6, destrói 1 monstro do oponente`, condicao: "precisa de Monstros Sincro no Extra Deck" }
        : null,
  },
  {
    nome: "Kuriboh - Multiply!",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) => (ativaMonstro(ev, a) ? { motivo: "Invoca-se da mão (no campo, busca ou Invoca um apoio e zera o ATK de um monstro)" } : null),
  },
  {
    nome: "Artifact Lancea",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (ev.tipo === "ativa" && (a.acoes.has("bane") || a.acoes.has("gy-bane") || a.custoBane)) || (ev.tipo === "move" && ev.para === "banido")
        ? {
            motivo: `ninguém pode banir cartas pelo resto do turno${a.custoBane ? " (o custo já pago fica; vale para as próximas)" : ""}`,
            ...sem(s.turno === ev.lado, "só no turno do oponente"),
          }
        : null,
  },
  {
    nome: 'Retaliating "C"',
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      ativaCartaMT(ev, a) && a.magia && a.acoes.has("invoca")
        ? { motivo: "Invoca-se: enquanto estiver no campo, cartas que iriam ao Cemitério são banidas" }
        : null,
  },
  {
    nome: "Dimension Shifter",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      foiAoCemiterio(ev, a) || a.acoes.has("envia-deck") || (ev.tipo === "ativa" && ev.de === "cemiterio")
        ? { motivo: "até o fim do próximo turno, cartas que iriam ao Cemitério são banidas", ...sem(!s.respondente.cemiterio, "só sem cartas no seu Cemitério") }
        : null,
  },

  // ------------------------------------------------------------------ armadilhas (da mão quando o texto deixa)
  {
    nome: "Dominus Impulse",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a, s) =>
      ev.tipo === "ativa" && a.acoes.has("invoca")
        ? {
            motivo: `nega o efeito de ${nomeDoEvento(ev)}, que Invoca por Invocação-Especial (destrói a carta se você tiver Armadilha no Cemitério)`,
            condicao: s.agente.cartas > 0 ? "da mão: você não ativa mais efeitos de monstros LUZ, TERRA e VENTO no Duelo" : "da mão só se o oponente controlar uma carta",
          }
        : null,
  },
  {
    nome: "Dominus Purge",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a, s) =>
      ev.tipo === "ativa" && a.acoes.has("busca")
        ? {
            motivo: `nega o efeito de ${nomeDoEvento(ev)}, que adiciona do Deck à mão (destrói a carta se você tiver Armadilha no Cemitério)`,
            condicao: s.agente.cartas > 0 ? "da mão: você não ativa mais efeitos de monstros TREVAS, ÁGUA e FOGO no Duelo" : "da mão só se o oponente controlar uma carta",
          }
        : null,
  },
  {
    nome: "Dominus Spark",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a, s) =>
      s.ativouMaoOuGY && s.agente.monstros > 0 && (ev.tipo === "ativa" || a.invocacao)
        ? {
            motivo: "o oponente já ativou efeito de monstro na mão ou no Cemitério neste turno: bane 1 monstro dele",
            condicao: "da mão: você não ativa mais efeitos de monstros TERRA, ÁGUA, FOGO e VENTO no Duelo",
          }
        : null,
  },
  {
    nome: "Solemn Judgment",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => {
      if (a.procedimento) return { motivo: `nega a Invocação de ${nomeDoEvento(ev)} e destrói o monstro (paga metade dos PV)` };
      if (a.invocacao && !a.procedimento && ev.tipo === "invoca" && ev.de === "mao")
        return { motivo: `nega a Invocação de ${nomeDoEvento(ev)} (paga metade dos PV)`, condicao: "só se for Invocação por procedimento, não por efeito" };
      if (ativaCartaMT(ev, a)) return { motivo: `nega a ativação de ${nomeDoEvento(ev)} e destrói a carta (paga metade dos PV)` };
      return null;
    },
  },
  {
    nome: "Solemn Strike",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => {
      if (a.especial && a.procedimento) return { motivo: `nega a Invocação-Especial de ${nomeDoEvento(ev)} e destrói o monstro (paga 1500 PV)` };
      if (ativaMonstro(ev, a)) return { motivo: `nega a ativação de ${nomeDoEvento(ev)} e destrói o monstro (paga 1500 PV)` };
      return null;
    },
  },
  {
    nome: "Solemn Warning",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => {
      if (a.procedimento) return { motivo: `nega a Invocação de ${nomeDoEvento(ev)} e destrói o monstro (paga 2000 PV)` };
      if (ev.tipo === "ativa" && a.acoes.has("invoca") && (a.monstro || ev.cartaAtivada))
        return { motivo: `nega a ativação de ${nomeDoEvento(ev)}, que Invoca por Invocação-Especial (paga 2000 PV)` };
      return null;
    },
  },
  {
    nome: "Solemn Accusation",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ativaCartaMT(ev, a)
        ? { motivo: `nega a ativação de ${nomeDoEvento(ev)}: destrói (1500 PV, trava o nome no turno) ou bane (3000 PV, e as cópias da mão e do Deck)` }
        : null,
  },
  {
    nome: "Red Reboot",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ativaCartaMT(ev, a) && a.armadilha
        ? { motivo: `nega a ativação de ${nomeDoEvento(ev)} e a baixa de novo; o oponente não ativa mais Armadilhas no turno`, condicao: "da mão: paga metade dos PV" }
        : null,
  },
  {
    nome: "Typhoon",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a, s) =>
      ev.tipo === "ativa" && !a.monstro && a.noCampo && (a.permanente || !ev.cartaAtivada)
        ? {
            motivo: `destrói ${nomeDoEvento(ev)} antes de resolver${a.permanente && ev.cartaAtivada ? " (a ativação fica sem efeito)" : ""}`,
            condicao: s.agente.magias >= 2 && s.respondente.magias === 0 ? undefined : "da mão só se o oponente tiver 2+ Magias/Armadilhas e você nenhuma",
          }
        : null,
  },
  {
    nome: "Skill Drain",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ativaMonstro(ev, a) && a.noCampo ? { motivo: `em corrente, nega o efeito de ${nomeDoEvento(ev)} (e de todos os monstros virados para cima no campo)`, condicao: "paga 1000 PV; afeta os seus monstros também" } : null,
  },
  {
    nome: "Imperial Order",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => (ev.tipo === "ativa" && a.magia ? { motivo: `nega os efeitos de Magias no campo, inclusive ${nomeDoEvento(ev)}` } : null),
  },
  {
    nome: "Evenly Matched",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, _a, s) =>
      s.fase === "BP" && s.agente.cartas > s.respondente.cartas
        ? {
            motivo: "no fim da Battle Phase, quem joga bane cartas virado para baixo até ficar com o mesmo número que você",
            condicao: s.respondente.cartas === 0 ? undefined : "da mão só sem cartas no seu campo",
            ...(s.turno === ev.lado ? {} : { impedida: "só no fim da Battle Phase do oponente" }),
          }
        : null,
  },
  {
    nome: "Torrential Tribute",
    origem: "baixada",
    tipo: "armadilha",
    quando: (_ev, a) => (a.invocacao ? { motivo: "um monstro foi Invocado: destrói todos os monstros do campo" } : null),
  },
  {
    nome: "Dimensional Barrier",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      (a.especial && ev.de === "extra" && ev.metodo) || (ev.tipo === "ativa" && a.acoes.has("invoca-extra"))
        ? { motivo: "declara o tipo (Fusão, Sincro, Xyz, Ritual ou Pêndulo): ninguém Invoca desse tipo no turno e os do campo têm os efeitos negados" }
        : null,
  },
  {
    nome: "Macro Cosmos",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      foiAoCemiterio(ev, a) || a.acoes.has("envia-deck") ? { motivo: "enquanto estiver no campo, cartas que iriam ao Cemitério são banidas" } : null,
  },
  {
    nome: "Anti-Spell Fragrance",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ev.tipo === "ativa" && a.magia && ev.cartaAtivada ? { motivo: "não para esta Magia, mas as próximas precisam ser baixadas e só podem ser ativadas no turno seguinte" } : null,
  },

  // ------------------------------------------------------------------ Magias Rápidas (no turno do oponente, baixadas)
  {
    nome: "Called by the Grave",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) =>
      a.monstro && a.vaiAoCemiterio
        ? { motivo: `bane ${nomeDoEvento(ev)} do Cemitério e nega os efeitos de cartas com o mesmo nome (inclusive este, se ainda não resolveu)` }
        : null,
  },
  {
    nome: "Crossout Designator",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, _a, s) => {
      if (ev.tipo !== "ativa") return null;
      const temNoDeck = s.respondente.deck?.includes(ev.id);
      if (s.respondente.deck && !temNoDeck) return null;
      return {
        motivo: `declara ${nomeDoEvento(ev)} e nega os efeitos de todas as cópias até o fim do turno`,
        condicao: temNoDeck ? "bane uma cópia do seu Deck" : `precisa de uma cópia de ${nomeDoEvento(ev)} no seu Main Deck`,
      };
    },
  },
  {
    nome: "Forbidden Droplet",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a, s) =>
      monstroNoCampo(ev, a) && s.agente.monstrosEfeito > 0
        ? {
            motivo: "envia cartas suas ao Cemitério e nega os efeitos (e corta o ATK pela metade) de outros tantos monstros do oponente",
            condicao: "o oponente não responde com cartas do mesmo tipo (Monstro/Magia/Armadilha) das enviadas",
          }
        : null,
  },
  {
    nome: "Book of Moon",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) => (monstroNoCampo(ev, a) ? { motivo: `vira ${nomeDoEvento(ev)} para baixo em defesa (os efeitos no campo param)` } : null),
  },
  {
    nome: "Super Polymerization",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a, s) =>
      s.agente.monstros > 0 && monstroNoCampo(ev, a)
        ? { motivo: "descarta 1 e Invoca por Fusão usando monstros do campo do oponente como matéria, sem resposta", condicao: "precisa do Monstro de Fusão certo no Extra Deck" }
        : null,
  },
  {
    nome: "Cosmic Cyclone",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) => removeMT(ev, a, "bane"),
  },
  {
    nome: "Twin Twisters",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) => removeMT(ev, a, "destrói"),
  },
  {
    nome: "Mystical Space Typhoon",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) => removeMT(ev, a, "destrói"),
  },

  // ------------------------------------------------------------------ monstros no campo
  {
    nome: "Thunder King Rai-Oh",
    origem: "campo",
    tipo: "campo",
    quando: (ev, a) => {
      if (a.especial && a.procedimento) return { motivo: `enviando-se ao Cemitério, nega a Invocação-Especial de ${nomeDoEvento(ev)} e o destrói` };
      if (ev.tipo === "ativa" && a.acoes.has("busca")) return { motivo: "enquanto estiver no campo, ninguém adiciona cartas do Deck à mão (exceto comprando): a busca não acontece" };
      return null;
    },
  },
  {
    nome: "Gameciel, the Sea Turtle Kaiju",
    origem: "campo",
    tipo: "campo",
    quando: (ev) => (ev.tipo === "ativa" ? { motivo: `nega a ativação de ${nomeDoEvento(ev)} e a bane`, condicao: "precisa remover 2 Marcadores Kaiju" } : null),
  },
];

function bystial(ev: Evento, a: Analise, s: Situacao): Indicacao | null {
  const luzTrevas = ev.card?.attribute === "LIGHT" || ev.card?.attribute === "DARK";
  const noGY = (foiAoCemiterio(ev, a) && a.monstro) || (ev.tipo === "ativa" && ev.de === "cemiterio" && a.monstro);
  if (!luzTrevas || !noGY) return null;
  return {
    motivo: `bane ${nomeDoEvento(ev)} (LUZ/TREVAS) do Cemitério e se Invoca${ev.tipo === "ativa" && ev.de === "cemiterio" ? "; efeitos que usam a própria carta deixam de resolver" : ""}`,
    ...sem(s.agente.monstros > 0 || s.turno !== ev.lado, "efeito rápido só se o oponente controlar um monstro"),
  };
}

/** Remoção de Magia/Armadilha: só adianta contra cartas que ficam no campo ou efeitos de cartas já viradas */
function removeMT(ev: Evento, a: Analise, verbo: string): Indicacao | null {
  if (ev.tipo !== "ativa" || a.monstro || !a.noCampo) return null;
  if (ev.cartaAtivada && !a.permanente) return null;
  return {
    motivo: `${verbo} ${nomeDoEvento(ev)} antes de resolver${ev.cartaAtivada ? " (Contínua/de Campo ativada fica sem efeito)" : ""}`,
  };
}

/** Regra pelo nome oficial */
export const REGRA_POR_NOME = new Map(REGRAS.map((r) => [r.nome, r]));
