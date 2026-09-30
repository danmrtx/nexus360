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

  const { data: perfil } = await supabase
    .from("perfis")
    .select("*, unidades(id, nome, tipo)")
    .eq("id", user.id)
    .single();

  return { user, perfil: perfil as PerfilUsuario | null };
}

export async function requireAuth(): Promise<{ user: any; perfil: PerfilUsuario }> {
  const { user, perfil } = await getSessionAndProfile();
  if (!user || !perfil) {
    redirect("/login");
  }
  if (perfil.status === 'Inativo') {
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
