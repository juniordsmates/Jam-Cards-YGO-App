import { nomeDoEvento, type Analise, type Evento, type Indicacao, type Regra, type Situacao } from "../db/indicacoes";
import { t } from "../i18n";

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
        a.acoes.has("busca") && t("adiciona do Deck à mão"),
        a.acoes.has("compra") && t("compra do Deck"),
        a.acoes.has("invoca-deck") && t("Invoca do Deck"),
        a.acoes.has("envia-deck") && t("envia do Deck ao Cemitério"),
      ].filter(Boolean);
      return o.length ? { motivo: t("nega o efeito de {0}, que {1}", [nomeDoEvento(ev), o.join(" e ")]) } : null;
    },
  },
  {
    nome: "Effect Veiler",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      monstroNoCampo(ev, a)
        ? {
            motivo: t("nega os efeitos de {0} no campo até o fim do turno{1}", [nomeDoEvento(ev), a.noCampo ? t(" (inclusive o efeito que acabou de ativar)") : ""]),
            ...sem(mainPhase(s) && s.turno === ev.lado, t("só na Main Phase do turno de quem joga a carta")),
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
            motivo: t("nega os efeitos de {0} até o fim do turno{1}", [nomeDoEvento(ev), a.noCampo ? t(" (inclusive o efeito que acabou de ativar)") : ""]),
            condicao: semCartas(s) ? undefined : t("da mão só sem cartas no seu campo; senão, precisa estar baixada"),
          }
        : null,
  },
  {
    nome: "Ghost Ogre & Snow Rabbit",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      ev.tipo === "ativa" && a.noCampo && (a.monstro || !ev.cartaAtivada)
        ? { motivo: t("destrói {0} no campo (não nega: o efeito ainda resolve)", [nomeDoEvento(ev)]) }
        : null,
  },
  {
    nome: "Ghost Belle & Haunted Mansion",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) => {
      if (ev.tipo !== "ativa") return null;
      const o = [
        a.acoes.has("gy-mao") && t("tira cartas do Cemitério"),
        a.acoes.has("invoca-gy") && t("Invoca do Cemitério"),
        a.acoes.has("gy-bane") && t("bane do Cemitério"),
      ].filter(Boolean);
      return o.length ? { motivo: t("nega a ativação de {0}, que {1}", [nomeDoEvento(ev), o.join(" e ")]) } : null;
    },
  },
  {
    nome: "Ghost Mourner & Moonlit Chill",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      a.especial && ev.tipo !== "baixa" ? { motivo: t("nega os efeitos de {0}, que acabou de ser Invocado por Invocação-Especial, até o fim do turno", [nomeDoEvento(ev)]) } : null,
  },
  {
    nome: "Droll & Lock Bird",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) => {
      if (ev.tipo === "move" && ev.de === "deck" && ev.para === "mao") return { motivo: t("uma carta saiu do Deck para a mão: a partir de agora, ninguém adiciona cartas do Deck à mão neste turno") };
      if (ev.tipo === "compra" && s.fase !== "DP") return { motivo: t("compra fora da Draw Phase: depois dela, ninguém adiciona cartas do Deck à mão neste turno") };
      if (ev.tipo === "ativa" && (a.acoes.has("busca") || a.acoes.has("compra")))
        return { motivo: t("depois que {0} adicionar a carta, impede as próximas adições do Deck neste turno", [nomeDoEvento(ev)]), condicao: t("só depois que a busca resolver (não nega esta)") };
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
            motivo: t("já são {0} Invocações neste turno: oferece todos os monstros e deixa uma Ficha para quem joga", [s.invocacoes]),
            ...sem(mainPhase(s), t("só na Main Phase")),
          }
        : null,
  },
  {
    nome: "D.D. Crow",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      foiAoCemiterio(ev, a) || (ev.tipo === "ativa" && ev.de === "cemiterio")
        ? { motivo: t("bane {0} do Cemitério{1}", [nomeDoEvento(ev), ev.tipo === "ativa" && ev.de === "cemiterio" ? t(" (efeitos que usam a própria carta deixam de resolver)") : ""]) }
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
        ? { motivo: t("compra 1 carta a cada Invocação-Especial deste turno{0}", [s.especiais <= 1 ? t(" (melhor agora, no começo do combo)") : ""]) }
        : null,
  },
  {
    nome: "Mulcharmy Purulia",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (a.invocacao && ev.de === "mao") || (ev.tipo === "ativa" && a.acoes.has("invoca-mao"))
        ? { motivo: t("compra 1 carta a cada Invocação (Normal ou Especial) da mão neste turno"), ...sem(semCartas(s), t("só sem cartas no seu campo")) }
        : null,
  },
  {
    nome: "Mulcharmy Fuwalos",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (a.especial && (ev.de === "deck" || ev.de === "extra")) || (ev.tipo === "ativa" && (a.acoes.has("invoca-deck") || a.acoes.has("invoca-extra")))
        ? { motivo: t("compra 1 carta a cada Invocação-Especial do Deck ou do Extra Deck neste turno"), ...sem(semCartas(s), t("só sem cartas no seu campo")) }
        : null,
  },
  {
    nome: "Mulcharmy Meowls",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (a.especial && (ev.de === "cemiterio" || ev.de === "banido")) || (ev.tipo === "ativa" && (a.acoes.has("invoca-gy") || a.acoes.has("invoca-banido")))
        ? { motivo: t("compra 1 carta a cada Invocação-Especial do Cemitério ou das banidas neste turno"), ...sem(semCartas(s), t("só sem cartas no seu campo")) }
        : null,
  },
  {
    nome: "Skull Meister",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev) => (ev.tipo === "ativa" && ev.de === "cemiterio" ? { motivo: t("nega o efeito de {0} ativado no Cemitério", [nomeDoEvento(ev)]) } : null),
  },
  {
    nome: "PSY-Framegear Gamma",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      ativaMonstro(ev, a)
        ? { motivo: t("nega a ativação de {0} e destrói o monstro", [nomeDoEvento(ev)]), ...sem(s.respondente.monstros === 0, t("só sem monstros no seu campo")) }
        : null,
  },
  {
    nome: "PSY-Framegear Delta",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      ativaCartaMT(ev, a) && a.magia
        ? { motivo: t("nega a ativação de {0} (Magia) e a destrói", [nomeDoEvento(ev)]), ...sem(s.respondente.monstros === 0, t("só sem monstros no seu campo")) }
        : null,
  },
  {
    nome: "Herald of Orange Light",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      ativaMonstro(ev, a)
        ? {
            motivo: t("nega a ativação de {0} e destrói o monstro", [nomeDoEvento(ev)]),
            condicao: t("precisa de outro monstro Fada na mão"),
            ...(s.respondente.fadasNaMao === 0 ? { impedida: t("sem outro monstro Fada na mão") } : {}),
          }
        : null,
  },
  {
    nome: "Fydraulis Harmonia",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      ativaMonstro(ev, a) && a.noCampo
        ? { motivo: t("Invoca-se ao revelar Monstros Sincro; revelando 6, destrói 1 monstro do oponente"), condicao: t("precisa de Monstros Sincro no Extra Deck") }
        : null,
  },
  {
    nome: "Kuriboh - Multiply!",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) => (ativaMonstro(ev, a) ? { motivo: t("Invoca-se da mão (no campo, busca ou Invoca um apoio e zera o ATK de um monstro)") } : null),
  },
  {
    nome: "Artifact Lancea",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      (ev.tipo === "ativa" && (a.acoes.has("bane") || a.acoes.has("gy-bane") || a.custoBane)) || (ev.tipo === "move" && ev.para === "banido")
        ? {
            motivo: t("ninguém pode banir cartas pelo resto do turno{0}", [a.custoBane ? t(" (o custo já pago fica; vale para as próximas)") : ""]),
            ...sem(s.turno === ev.lado, t("só no turno do oponente")),
          }
        : null,
  },
  {
    nome: 'Retaliating "C"',
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a) =>
      ativaCartaMT(ev, a) && a.magia && a.acoes.has("invoca")
        ? { motivo: t("Invoca-se: enquanto estiver no campo, cartas que iriam ao Cemitério são banidas") }
        : null,
  },
  {
    nome: "Dimension Shifter",
    origem: "mao",
    tipo: "hand-trap",
    quando: (ev, a, s) =>
      foiAoCemiterio(ev, a) || a.acoes.has("envia-deck") || (ev.tipo === "ativa" && ev.de === "cemiterio")
        ? { motivo: t("até o fim do próximo turno, cartas que iriam ao Cemitério são banidas"), ...sem(!s.respondente.cemiterio, t("só sem cartas no seu Cemitério")) }
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
            motivo: t("nega o efeito de {0}, que Invoca por Invocação-Especial (destrói a carta se você tiver Armadilha no Cemitério)", [nomeDoEvento(ev)]),
            condicao: s.agente.cartas > 0 ? t("da mão: você não ativa mais efeitos de monstros LUZ, TERRA e VENTO no Duelo") : t("da mão só se o oponente controlar uma carta"),
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
            motivo: t("nega o efeito de {0}, que adiciona do Deck à mão (destrói a carta se você tiver Armadilha no Cemitério)", [nomeDoEvento(ev)]),
            condicao: s.agente.cartas > 0 ? t("da mão: você não ativa mais efeitos de monstros TREVAS, ÁGUA e FOGO no Duelo") : t("da mão só se o oponente controlar uma carta"),
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
            motivo: t("o oponente já ativou efeito de monstro na mão ou no Cemitério neste turno: bane 1 monstro dele"),
            condicao: t("da mão: você não ativa mais efeitos de monstros TERRA, ÁGUA, FOGO e VENTO no Duelo"),
          }
        : null,
  },
  {
    nome: "Solemn Judgment",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => {
      if (a.procedimento) return { motivo: t("nega a Invocação de {0} e destrói o monstro (paga metade dos PV)", [nomeDoEvento(ev)]) };
      if (a.invocacao && !a.procedimento && ev.tipo === "invoca" && ev.de === "mao")
        return { motivo: t("nega a Invocação de {0} (paga metade dos PV)", [nomeDoEvento(ev)]), condicao: t("só se for Invocação por procedimento, não por efeito") };
      if (ativaCartaMT(ev, a)) return { motivo: t("nega a ativação de {0} e destrói a carta (paga metade dos PV)", [nomeDoEvento(ev)]) };
      return null;
    },
  },
  {
    nome: "Solemn Strike",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => {
      if (a.especial && a.procedimento) return { motivo: t("nega a Invocação-Especial de {0} e destrói o monstro (paga 1500 PV)", [nomeDoEvento(ev)]) };
      if (ativaMonstro(ev, a)) return { motivo: t("nega a ativação de {0} e destrói o monstro (paga 1500 PV)", [nomeDoEvento(ev)]) };
      return null;
    },
  },
  {
    nome: "Solemn Warning",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => {
      if (a.procedimento) return { motivo: t("nega a Invocação de {0} e destrói o monstro (paga 2000 PV)", [nomeDoEvento(ev)]) };
      if (ev.tipo === "ativa" && a.acoes.has("invoca") && (a.monstro || ev.cartaAtivada))
        return { motivo: t("nega a ativação de {0}, que Invoca por Invocação-Especial (paga 2000 PV)", [nomeDoEvento(ev)]) };
      return null;
    },
  },
  {
    nome: "Solemn Accusation",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ativaCartaMT(ev, a)
        ? { motivo: t("nega a ativação de {0}: destrói (1500 PV, trava o nome no turno) ou bane (3000 PV, e as cópias da mão e do Deck)", [nomeDoEvento(ev)]) }
        : null,
  },
  {
    nome: "Red Reboot",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ativaCartaMT(ev, a) && a.armadilha
        ? { motivo: t("nega a ativação de {0} e a baixa de novo; o oponente não ativa mais Armadilhas no turno", [nomeDoEvento(ev)]), condicao: t("da mão: paga metade dos PV") }
        : null,
  },
  {
    nome: "Typhoon",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, a, s) =>
      ev.tipo === "ativa" && !a.monstro && a.noCampo && (a.permanente || !ev.cartaAtivada)
        ? {
            motivo: t("destrói {0} antes de resolver{1}", [nomeDoEvento(ev), a.permanente && ev.cartaAtivada ? t(" (a ativação fica sem efeito)") : ""]),
            condicao: s.agente.magias >= 2 && s.respondente.magias === 0 ? undefined : t("da mão só se o oponente tiver 2+ Magias/Armadilhas e você nenhuma"),
          }
        : null,
  },
  {
    nome: "Skill Drain",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ativaMonstro(ev, a) && a.noCampo ? { motivo: t("em corrente, nega o efeito de {0} (e de todos os monstros virados para cima no campo)", [nomeDoEvento(ev)]), condicao: t("paga 1000 PV; afeta os seus monstros também") } : null,
  },
  {
    nome: "Imperial Order",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) => (ev.tipo === "ativa" && a.magia ? { motivo: t("nega os efeitos de Magias no campo, inclusive {0}", [nomeDoEvento(ev)]) } : null),
  },
  {
    nome: "Evenly Matched",
    origem: "mao-ou-baixada",
    tipo: "armadilha",
    quando: (ev, _a, s) =>
      s.fase === "BP" && s.agente.cartas > s.respondente.cartas
        ? {
            motivo: t("no fim da Battle Phase, quem joga bane cartas virado para baixo até ficar com o mesmo número que você"),
            condicao: s.respondente.cartas === 0 ? undefined : t("da mão só sem cartas no seu campo"),
            ...(s.turno === ev.lado ? {} : { impedida: t("só no fim da Battle Phase do oponente") }),
          }
        : null,
  },
  {
    nome: "Torrential Tribute",
    origem: "baixada",
    tipo: "armadilha",
    quando: (_ev, a) => (a.invocacao ? { motivo: t("um monstro foi Invocado: destrói todos os monstros do campo") } : null),
  },
  {
    nome: "Dimensional Barrier",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      (a.especial && ev.de === "extra" && ev.metodo) || (ev.tipo === "ativa" && a.acoes.has("invoca-extra"))
        ? { motivo: t("declara o tipo (Fusão, Sincro, Xyz, Ritual ou Pêndulo): ninguém Invoca desse tipo no turno e os do campo têm os efeitos negados") }
        : null,
  },
  {
    nome: "Macro Cosmos",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      foiAoCemiterio(ev, a) || a.acoes.has("envia-deck") ? { motivo: t("enquanto estiver no campo, cartas que iriam ao Cemitério são banidas") } : null,
  },
  {
    nome: "Anti-Spell Fragrance",
    origem: "baixada",
    tipo: "armadilha",
    quando: (ev, a) =>
      ev.tipo === "ativa" && a.magia && ev.cartaAtivada ? { motivo: t("não para esta Magia, mas as próximas precisam ser baixadas e só podem ser ativadas no turno seguinte") } : null,
  },

  // ------------------------------------------------------------------ Magias Rápidas (no turno do oponente, baixadas)
  {
    nome: "Called by the Grave",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) =>
      a.monstro && a.vaiAoCemiterio
        ? { motivo: t("bane {0} do Cemitério e nega os efeitos de cartas com o mesmo nome (inclusive este, se ainda não resolveu)", [nomeDoEvento(ev)]) }
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
        motivo: t("declara {0} e nega os efeitos de todas as cópias até o fim do turno", [nomeDoEvento(ev)]),
        condicao: temNoDeck ? t("bane uma cópia do seu Deck") : t("precisa de uma cópia de {0} no seu Main Deck", [nomeDoEvento(ev)]),
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
            motivo: t("envia cartas suas ao Cemitério e nega os efeitos (e corta o ATK pela metade) de outros tantos monstros do oponente"),
            condicao: t("o oponente não responde com cartas do mesmo tipo (Monstro/Magia/Armadilha) das enviadas"),
          }
        : null,
  },
  {
    nome: "Book of Moon",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) => (monstroNoCampo(ev, a) ? { motivo: t("vira {0} para baixo em defesa (os efeitos no campo param)", [nomeDoEvento(ev)]) } : null),
  },
  {
    nome: "Super Polymerization",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a, s) =>
      s.agente.monstros > 0 && monstroNoCampo(ev, a)
        ? { motivo: t("descarta 1 e Invoca por Fusão usando monstros do campo do oponente como matéria, sem resposta"), condicao: t("precisa do Monstro de Fusão certo no Extra Deck") }
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
    quando: (ev, a) => removeMT(ev, a, t("destrói")),
  },
  {
    nome: "Mystical Space Typhoon",
    origem: "mao-ou-baixada",
    tipo: "magia-rapida",
    quando: (ev, a) => removeMT(ev, a, t("destrói")),
  },

  // ------------------------------------------------------------------ monstros no campo
  {
    nome: "Thunder King Rai-Oh",
    origem: "campo",
    tipo: "campo",
    quando: (ev, a) => {
      if (a.especial && a.procedimento) return { motivo: t("enviando-se ao Cemitério, nega a Invocação-Especial de {0} e o destrói", [nomeDoEvento(ev)]) };
      if (ev.tipo === "ativa" && a.acoes.has("busca")) return { motivo: t("enquanto estiver no campo, ninguém adiciona cartas do Deck à mão (exceto comprando): a busca não acontece") };
      return null;
    },
  },
  {
    nome: "Gameciel, the Sea Turtle Kaiju",
    origem: "campo",
    tipo: "campo",
    quando: (ev) => (ev.tipo === "ativa" ? { motivo: t("nega a ativação de {0} e a bane", [nomeDoEvento(ev)]), condicao: t("precisa remover 2 Marcadores Kaiju") } : null),
  },
];

function bystial(ev: Evento, a: Analise, s: Situacao): Indicacao | null {
  const luzTrevas = ev.card?.attribute === "LIGHT" || ev.card?.attribute === "DARK";
  const noGY = (foiAoCemiterio(ev, a) && a.monstro) || (ev.tipo === "ativa" && ev.de === "cemiterio" && a.monstro);
  if (!luzTrevas || !noGY) return null;
  return {
    motivo: t("bane {0} (LUZ/TREVAS) do Cemitério e se Invoca{1}", [nomeDoEvento(ev), ev.tipo === "ativa" && ev.de === "cemiterio" ? t("; efeitos que usam a própria carta deixam de resolver") : ""]),
    ...sem(s.agente.monstros > 0 || s.turno !== ev.lado, t("efeito rápido só se o oponente controlar um monstro")),
  };
}

/** Remoção de Magia/Armadilha: só adianta contra cartas que ficam no campo ou efeitos de cartas já viradas */
function removeMT(ev: Evento, a: Analise, verbo: string): Indicacao | null {
  if (ev.tipo !== "ativa" || a.monstro || !a.noCampo) return null;
  if (ev.cartaAtivada && !a.permanente) return null;
  return {
    motivo: t("{0} {1} antes de resolver{2}", [verbo, nomeDoEvento(ev), ev.cartaAtivada ? t(" (Contínua/de Campo ativada fica sem efeito)") : ""]),
  };
}

/** Regra pelo nome oficial */
export const REGRA_POR_NOME = new Map(REGRAS.map((r) => [r.nome, r]));
