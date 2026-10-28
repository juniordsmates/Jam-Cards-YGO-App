import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getConfigIA, iaConfigurada, setConfigIA, type ConfigIA, type ProvedorId } from "./ia";

// Conta do usuário (Supabase Auth): sessão e nome de usuário público.

export interface Conta {
  id: string;
  email: string;
  usuario: string;
  /** pode pedir recálculos (tabela admins no banco) */
  admin: boolean;
}

let conta: Conta | null = null;
let iniciado = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function carregarPerfil(session: Session | null) {
  const sb = supabase();
  if (!sb || !session) {
    conta = null;
    return emit();
  }
  const [{ data }, { data: admin }] = await Promise.all([
    sb.from("perfis").select("usuario").eq("id", session.user.id).maybeSingle(),
    sb.rpc("sou_admin"),
  ]);
  conta = { id: session.user.id, email: session.user.email ?? "", usuario: data?.usuario ?? "", admin: admin === true };
  emit();
  // configuração de IA guardada na conta: vale neste computador se aqui ainda não houver uma
  if (!iaConfigurada(getConfigIA())) {
    const cfg = await lerConfigIANaConta();
    if (cfg) setConfigIA(cfg);
  }
}

/** Restaura a sessão salva e acompanha entrar/sair (idempotente) */
export function iniciarConta() {
  const sb = supabase();
  if (iniciado || !sb) return;
  iniciado = true;
  void sb.auth.getSession().then(({ data }) => carregarPerfil(data.session));
  sb.auth.onAuthStateChange((_event, session) => void carregarPerfil(session));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useConta = () => useSyncExternalStore(subscribe, () => conta);
export const contaAtual = () => conta;

const USUARIO = /^[a-z0-9_]{3,20}$/;

/** Mensagens do Supabase Auth em português (as mais comuns) */
function traduzir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme o cadastro pelo link enviado ao seu e-mail.";
  if (/already registered|already exists/i.test(msg)) return "Já existe uma conta com este e-mail.";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter pelo menos 8 caracteres.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  return msg;
}

function exigirCliente() {
  const sb = supabase();
  if (!sb) throw new Error("Contas ainda não configuradas neste app.");
  return sb;
}

export async function entrar(email: string, senha: string) {
  const { error } = await exigirCliente().auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw new Error(traduzir(error.message));
}

/** Cadastro: o perfil (nome de usuário) é criado no banco pelo gatilho do cadastro */
export async function cadastrar(email: string, usuario: string, senha: string): Promise<"confirmar" | "pronto"> {
  const sb = exigirCliente();
  const nome = usuario.trim().toLowerCase();
  if (!USUARIO.test(nome)) throw new Error("Usuário: 3 a 20 letras minúsculas, números ou _.");
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const { data: livre } = await sb.rpc("usuario_disponivel", { nome });
  if (livre === false) throw new Error("Este nome de usuário já está em uso.");
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password: senha, options: { data: { usuario: nome } } });
  if (error) throw new Error(traduzir(error.message));
  // sem sessão: o projeto pede confirmação por e-mail antes do primeiro acesso
  return data.session ? "pronto" : "confirmar";
}

export async function recuperarSenha(email: string) {
  const { error } = await exigirCliente().auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(traduzir(error.message));
}

export async function sair() {
  await supabase()?.auth.signOut();
}

// ---------------------------------------------------------------- configuração de IA na conta (opcional)

export async function lerConfigIANaConta(): Promise<ConfigIA | null> {
  const sb = supabase();
  if (!sb || !conta) return null;
  const { data } = await sb.from("config_ia").select("provedor, modelo, url, chave").eq("usuario_id", conta.id).maybeSingle();
  return data ? { provedor: data.provedor as ProvedorId, modelo: data.modelo, url: data.url, chave: data.chave } : null;
}

export async function salvarConfigIANaConta(cfg: ConfigIA) {
  const sb = exigirCliente();
  if (!conta) throw new Error("Entre na sua conta.");
  const { error } = await sb.from("config_ia").upsert({ usuario_id: conta.id, ...cfg, atualizado_em: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function removerConfigIADaConta() {
  const sb = supabase();
  if (!sb || !conta) return;
  await sb.from("config_ia").delete().eq("usuario_id", conta.id);
}

// ---------------------------------------------------------------- recálculos (só administradores)

export type TipoRecalculo = "combos" | "respostas" | "tudo";

export interface Recalculo {
  id: string;
  tipo: TipoRecalculo;
  forcar: boolean;
  status: string;
  criado_em: string;
  /** resposta do GitHub ao pedido (204 = Action iniciada) */
  http?: number | null;
  resposta?: string | null;
}

/** Situação do pedido em texto, a partir da resposta do GitHub */
export function situacao(r: Recalculo): { ok: boolean; texto: string } {
  if (r.http === 204) return { ok: true, texto: "Action iniciada no GitHub" };
  if (r.http === 403 || r.http === 404)
    return { ok: false, texto: "o GitHub recusou: o token precisa de acesso ao repositório Database-Cards-Ygo com a permissão Actions (leitura e escrita)" };
  if (r.http) return { ok: false, texto: `o GitHub respondeu ${r.http}: ${r.resposta ?? ""}` };
  return { ok: !r.status.startsWith("sem token"), texto: r.status };
}

/** Pede um recálculo: o banco dispara a Action "Atualizar base" do Database-Cards-Ygo */
export async function pedirRecalculo(tipo: TipoRecalculo, forcar: boolean): Promise<Recalculo> {
  const { data, error } = await exigirCliente().from("recalculos").insert({ tipo, forcar }).select("id, tipo, forcar, status, criado_em").single();
  if (error) throw new Error(error.message);
  return data as Recalculo;
}

export async function listarRecalculos(): Promise<Recalculo[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data } = await sb.rpc("meus_recalculos");
  return (data ?? []) as Recalculo[];
}
