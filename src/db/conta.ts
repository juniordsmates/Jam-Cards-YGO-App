import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { isDesktop } from "../platform";
import { getConfigDe, iaConfigurada, setConfigIA, type ConfigIA, type ProvedorId } from "./ia";

// Conta do usuário (Supabase Auth): sessão e nome de usuário público.

export interface Conta {
  id: string;
  email: string;
  usuario: string;
  /** pode pedir recálculos (tabela admins no banco) */
  admin: boolean;
  /** nível definido pelo administrador (Padrão, Avançado ou Mentor) */
  nivel: Nivel;
}

export type Nivel = "padrao" | "avancado" | "mentor";

export const NIVEIS: { id: Nivel; label: string; hint: string }[] = [
  { id: "padrao", label: "Usuário Padrão", hint: "Sem Teste Avançado; os combos que cria ficam só no aparelho" },
  { id: "avancado", label: "Usuário Avançado", hint: "Todos os recursos" },
  { id: "mentor", label: "Usuário Mentor", hint: "Todos os recursos" },
];

/** Avançado e Mentor (e o administrador) têm todos os recursos: Teste Avançado e combos na base */
export const temRecursosAvancados = (c: Conta | null) =>
  (!!c && (c.admin || c.nivel !== "padrao")) ||
  // só no servidor de desenvolvimento: as imagens do manual (scripts/manual-imagens.mjs) mostram o Teste Avançado sem login
  (import.meta.env.DEV && localStorage.getItem("cartas-dev-avancado") === "1");

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
    // todas as colunas: funciona com ou sem a coluna "nivel" (migração dos níveis de usuário)
    sb.from("perfis").select("*").eq("id", session.user.id).maybeSingle(),
    sb.rpc("sou_admin"),
  ]);
  conta = { id: session.user.id, email: session.user.email ?? "", usuario: data?.usuario ?? "", admin: admin === true, nivel: (data?.nivel as Nivel | undefined) ?? "padrao" };
  emit();
  // IAs guardadas na conta: valem neste computador onde aqui ainda não houver configuração
  for (const cfg of await lerConfigsIANaConta()) if (!iaConfigurada(getConfigDe(cfg.provedor))) setConfigIA(cfg);
}

/** Restaura a sessão salva e acompanha entrar/sair (idempotente) */
export function iniciarConta() {
  const sb = supabase();
  if (iniciado || !sb) return;
  iniciado = true;
  void sb.auth.getSession().then(({ data }) => carregarPerfil(data.session));
  sb.auth.onAuthStateChange((evento, session) => {
    void carregarPerfil(session);
    // chegou pelo link de "Esqueci a senha": pede a senha nova
    if (evento === "PASSWORD_RECOVERY") {
      recuperando = true;
      ouvintesRecuperacao.forEach((l) => l());
    }
  });
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

/**
 * Cadastro de usuário (só o administrador): o banco cria a conta já confirmada e o perfil com o
 * nome de usuário. O cadastro público por e-mail fica bloqueado no banco.
 */
export async function criarUsuarioComoAdmin(usuario: string, email: string, senha: string) {
  const nome = usuario.trim().toLowerCase();
  if (!USUARIO.test(nome)) throw new Error("Usuário: 3 a 20 letras minúsculas, números ou _.");
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const { error } = await exigirCliente().rpc("admin_criar_usuario", { p_usuario: nome, p_email: email.trim(), p_senha: senha });
  if (error) throw new Error(error.message);
}

/** Conta como o administrador vê na lista de usuários */
export interface UsuarioCadastrado {
  id: string;
  usuario: string;
  email: string;
  nivel: Nivel;
  admin: boolean;
  criado_em: string;
  ultimo_acesso: string | null;
}

/** Todas as contas (só o administrador) */
export async function listarUsuarios(): Promise<UsuarioCadastrado[]> {
  const { data, error } = await exigirCliente().rpc("admin_listar_usuarios");
  if (error) throw new Error(error.message);
  return (data ?? []) as UsuarioCadastrado[];
}

/** Define o nível de uma conta (só o administrador) */
export async function definirNivel(id: string, nivel: Nivel) {
  const { error } = await exigirCliente().rpc("admin_definir_nivel", { p_id: id, p_nivel: nivel });
  if (error) throw new Error(error.message);
  // o próprio nível mudou: atualiza a conta aberta
  if (conta?.id === id) {
    conta = { ...conta, nivel };
    emit();
  }
}

export async function recuperarSenha(email: string) {
  // no site, o link do e-mail volta para o próprio site (no app desktop, vale o endereço padrão do projeto)
  const redirectTo = isDesktop ? undefined : `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { error } = await exigirCliente().auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw new Error(traduzir(error.message));
}

// ---------------------------------------------------------------- nova senha (link de recuperação)

let recuperando = false;
const ouvintesRecuperacao = new Set<() => void>();
/** A pessoa chegou pelo link de "Esqueci a senha" e ainda não definiu a senha nova */
export const emRecuperacao = () => recuperando;
export function aoRecuperarSenha(l: () => void) {
  ouvintesRecuperacao.add(l);
  return () => ouvintesRecuperacao.delete(l);
}

export async function definirNovaSenha(senha: string) {
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const { error } = await exigirCliente().auth.updateUser({ password: senha });
  if (error) throw new Error(traduzir(error.message));
  recuperando = false;
}

export async function sair() {
  await supabase()?.auth.signOut();
}

// ---------------------------------------------------------------- configuração de IA na conta (opcional)

/** IAs guardadas na conta (uma por provedor) */
export async function lerConfigsIANaConta(): Promise<ConfigIA[]> {
  const sb = supabase();
  if (!sb || !conta) return [];
  const { data } = await sb.from("config_ia").select("provedor, modelo, url, chave").eq("usuario_id", conta.id);
  return (data ?? []).map((d) => ({ provedor: d.provedor as ProvedorId, modelo: d.modelo, url: d.url, chave: d.chave }));
}

export async function salvarConfigIANaConta(cfg: ConfigIA) {
  const sb = exigirCliente();
  if (!conta) throw new Error("Entre na sua conta.");
  const { error } = await sb
    .from("config_ia")
    .upsert({ usuario_id: conta.id, ...cfg, atualizado_em: new Date().toISOString() }, { onConflict: "usuario_id,provedor" });
  if (error) throw new Error(error.message);
}

export async function removerConfigIADaConta(provedor: ProvedorId) {
  const sb = supabase();
  if (!sb || !conta) return;
  await sb.from("config_ia").delete().eq("usuario_id", conta.id).eq("provedor", provedor);
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
