import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/utils/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexus360 - Gestão de Operações",
  description: "Sistema integrado de gestão de estoque e operações",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let perfil: any = null;
  if (user) {
    const { data } = await supabase
      .from('perfis')
      .select('*, unidades(id, nome, tipo)')
      .eq('id', user.id)
      .single();
    perfil = data;
  }

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
  }

  // Cores de destaque por cargo
  const badgeColor = 
    perfil?.papel === 'Administrador' ? 'bg-red-600' :
    perfil?.papel === 'Gestor de Estoque' ? 'bg-purple-600' :
    perfil?.papel === 'Gerente de Loja' ? 'bg-blue-600' : 'bg-emerald-600';

  return (
    <html lang="pt-BR">
      <body className={`${inter.className} min-h-screen bg-slate-100`}>
        {user && (
          <header className="bg-slate-900 text-white p-3 shadow-md flex justify-between items-center px-8 sticky top-0 z-50">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-bold tracking-wider text-xl hover:text-blue-400 transition">
                NEXUS360
              </Link>
              {perfil?.unidades?.nome ? (
                <span className="bg-slate-800 border border-slate-700 text-emerald-400 px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {perfil.unidades.nome} ({perfil.unidades.tipo})
                </span>
              ) : (
                <span className="bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-md text-xs font-medium">
                  🌐 Rede Geral (Todas as Unidades)
                </span>
              )}
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-300">Olá, {perfil?.nome || user.email}</span>
                <span className={`${badgeColor} text-white px-2 py-0.5 rounded text-xs font-bold uppercase shadow-sm`}>
                  {perfil?.papel || 'Usuário'}
                </span>
              </div>
              
              {perfil?.papel === 'Administrador' && (
                <Link href="/usuarios" className="text-slate-300 hover:text-white hover:underline flex items-center gap-1 font-medium">
                  ⚙️ Gestão de Usuários
                </Link>
              )}

              <form action={signOut}>
                <button type="submit" className="text-slate-400 hover:text-red-400 transition underline text-xs font-semibold">
                  Sair
                </button>
              </form>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
