import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Conta do usuário (Supabase Auth): sessão e nome de usuário público.

export interface Conta {
  id: string;
  email: string;
  usuario: string;
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
  const { data } = await sb.from("perfis").select("usuario").eq("id", session.user.id).maybeSingle();
  conta = { id: session.user.id, email: session.user.email ?? "", usuario: data?.usuario ?? "" };
  emit();
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
