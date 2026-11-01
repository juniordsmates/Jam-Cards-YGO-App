import { supabase } from "./supabase";
import type { Idioma } from "../data/guias";
import { t } from "../i18n";

// Guia de Deck → Artigos de Jogadores (tabela artigos): o jogador envia, o administrador aprova ou
// recusa, e os aprovados aparecem para todos no guia do deck.

export type TipoArtigo = "tatica" | "jogada" | "ideia" | "combo" | "side";
export type StatusArtigo = "pendente" | "aprovado" | "recusado";

export interface Artigo {
  id: string;
  autor_id: string;
  autor_nome: string;
  arquetipo: string;
  idioma: Idioma;
  tipo: TipoArtigo;
  titulo: string;
  resumo: string;
  conteudo: string;
  status: StatusArtigo;
  motivo: string;
  criado_em: string;
}

const COLS = "id, autor_id, autor_nome, arquetipo, idioma, tipo, titulo, resumo, conteudo, status, motivo, criado_em";

const cliente = () => {
  const sb = supabase();
  if (!sb) throw new Error(t("Contas ainda não configuradas neste app."));
  return sb;
};

/** Artigos do deck: os aprovados e, para quem está logado, os seus (e todos, para o administrador) */
export async function listarArtigos(arquetipo: string): Promise<Artigo[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.from("artigos").select(COLS).eq("arquetipo", arquetipo).order("criado_em", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Artigo[];
}

/** Envia um artigo (fica pendente até o administrador aprovar) */
export async function enviarArtigo(a: Pick<Artigo, "autor_nome" | "arquetipo" | "idioma" | "tipo" | "titulo" | "resumo" | "conteudo">): Promise<Artigo> {
  const { data, error } = await cliente()
    .from("artigos")
    .insert({ ...a, titulo: a.titulo.trim(), resumo: a.resumo.trim(), conteudo: a.conteudo.trim(), autor_nome: a.autor_nome.trim() })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Artigo;
}

/** Administrador: aprova ou recusa (com o motivo, que o autor vê) */
export async function moderarArtigo(id: string, status: Exclude<StatusArtigo, "pendente">, motivo = ""): Promise<void> {
  const { error } = await cliente().from("artigos").update({ status, motivo: motivo.trim() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** O autor (ou o administrador) apaga */
export async function apagarArtigo(id: string): Promise<void> {
  const { error } = await cliente().from("artigos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
