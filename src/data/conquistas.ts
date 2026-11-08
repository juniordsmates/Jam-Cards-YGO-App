import { t } from "../i18n";

// Catálogo das conquistas desbloqueáveis (como os troféus do PS5 e as conquistas da Steam).
// O banco tem a mesma lista (tabela conquistas, supabase/migrations/20261108000000_conquistas_desbloqueaveis.sql)
// com quem pode conceder cada uma; aqui ficam o nome, a descrição e o ícone (arte da carta).
//
// Para acrescentar uma conquista: uma entrada aqui, a linha no banco e o evento que a concede
// (gatilho no banco ou conquistar("id") no app, src/db/minhasConquistas.ts).

export type NivelConquista = "bronze" | "prata" | "ouro" | "platina";

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  /** carta cuja arte (recorte quadrado) é o ícone */
  cartaId: number;
  nivel: NivelConquista;
  /** secreta: nome e descrição escondidos até desbloquear */
  secreta?: boolean;
}

export const CONQUISTAS: Conquista[] = [
  { id: "compartilhar", nome: t("Compartilhar"), descricao: t("Obtida após compartilhar o primeiro combo"), cartaId: 90359458, nivel: "bronze" },
  { id: "entrando_comunidade", nome: t("Entrando na Comunidade"), descricao: t("Obtida após entrar na aba Comunidade e acessar qualquer arquétipo"), cartaId: 712559, nivel: "bronze" },
  { id: "meu_primeiro_deck", nome: t("Meu Primeiro Deck"), descricao: t("Obtida após salvar o primeiro deck"), cartaId: 12183332, nivel: "bronze" },
];

export type IdConquista = "compartilhar" | "entrando_comunidade" | "meu_primeiro_deck";

export const conquistaPorId = (id: string) => CONQUISTAS.find((c) => c.id === id);

export const NIVEL_LABEL: Record<NivelConquista, string> = {
  bronze: t("Bronze"),
  prata: t("Prata"),
  ouro: t("Ouro"),
  platina: t("Platina"),
};
