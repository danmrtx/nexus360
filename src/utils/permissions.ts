import { createClient } from "@/utils/supabase-server";
import { redirect } from "next/navigation";

export type PapelUsuario = 'Administrador' | 'Gestor de Estoque' | 'Gerente de Loja' | 'Operador';

export interface PerfilUsuario {
  id: string;
  nome: string;
  papel: PapelUsuario;
  status: 'Ativo' | 'Inativo';
  unidade_id: string | null;
  unidades?: {
    id: string;
    nome: string;
    tipo: string;
  } | null;
}

export async function getSessionAndProfile(): Promise<{ user: any; perfil: PerfilUsuario | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, perfil: null };
  }

  // 1. Busca perfil de forma defensiva sem depender de sintaxe de relação PostgREST
  let { data: perfil } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // 2. Se o usuário está autenticado no Auth mas ainda não tem registro em 'perfis', cria automaticamente
  if (!perfil) {
    const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "Administrador";
    const { count } = await supabase.from("perfis").select("*", { count: 'exact', head: true });
    const papel = (!count || count === 0) ? 'Administrador' : (user.user_metadata?.papel || 'Administrador');

    const { data: novoPerfil } = await supabase
      .from("perfis")
      .insert([{
        id: user.id,
        nome,
        papel,
        status: 'Ativo'
      }])
      .select("*")
      .maybeSingle();

    perfil = novoPerfil || {
      id: user.id,
      nome,
      papel,
      status: 'Ativo',
      unidade_id: null
    };
  }

  // 3. Atualizar nome e garantir papel de Administrador para o proprietário da conta
  if (perfil) {
    const rawNome = user.user_metadata?.nome || user.user_metadata?.full_name || (user.email === 'danielmartins30@icloud.com' ? 'Daniel Martins' : user.email?.split('@')[0]);
    if ((!perfil.nome || perfil.nome === 'Usuário' || perfil.nome.includes('@')) && rawNome) {
      perfil.nome = rawNome;
      await supabase.from("perfis").update({ nome: rawNome }).eq("id", user.id);
    }

    if (user.email === 'danielmartins30@icloud.com' && perfil.papel !== 'Administrador') {
      perfil.papel = 'Administrador';
      await supabase.from("perfis").update({ papel: 'Administrador' }).eq("id", user.id);
    }
  }

  // 4. Se houver unidade_id, busca os dados da unidade separadamente
  if (perfil?.unidade_id) {
    const { data: unidade } = await supabase
      .from("unidades")
      .select("id, nome, tipo")
      .eq("id", perfil.unidade_id)
      .maybeSingle();
    perfil.unidades = unidade;
  }

  return { user, perfil: perfil as PerfilUsuario | null };
}

export async function requireAuth(): Promise<{ user: any; perfil: PerfilUsuario }> {
  const { user, perfil } = await getSessionAndProfile();
  if (!user) {
    redirect("/login");
  }
  if (!perfil) {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login?error=Perfil de acesso não encontrado. Faça login novamente.");
  }
  if (perfil.status === 'Inativo') {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login?error=Sua conta está inativa. Contate o administrador.");
  }
  return { user, perfil };
}

export function isAdmin(papel?: string): boolean {
  return papel === 'Administrador';
}

export function isGestor(papel?: string): boolean {
  return papel === 'Gestor de Estoque';
}

export function isGerente(papel?: string): boolean {
  return papel === 'Gerente de Loja';
}

export function isOperador(papel?: string): boolean {
  return papel === 'Operador';
}

export function canManageCatalog(papel?: string): boolean {
  return papel === 'Administrador';
}

export function canManageUsers(papel?: string): boolean {
  return papel === 'Administrador';
}

export function canAccessReplenishments(papel?: string): boolean {
  return papel === 'Administrador' || papel === 'Gestor de Estoque' || papel === 'Gerente de Loja';
}

export function canAccessReports(papel?: string): boolean {
  return papel === 'Administrador' || papel === 'Gestor de Estoque' || papel === 'Gerente de Loja';
}

export function canApproveTransfers(papel?: string): boolean {
  return papel === 'Administrador' || papel === 'Gestor de Estoque' || papel === 'Gerente de Loja';
}

export function canCreateTransfers(papel?: string): boolean {
  return papel === 'Administrador' || papel === 'Gestor de Estoque' || papel === 'Gerente de Loja';
}

export function canRegisterExits(papel?: string): boolean {
  return papel === 'Administrador' || papel === 'Operador';
}

export function canRegisterEntries(papel?: string): boolean {
  return papel === 'Administrador' || papel === 'Operador' || papel === 'Gerente de Loja';
}
