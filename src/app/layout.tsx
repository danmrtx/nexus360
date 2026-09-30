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

import { headers } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const headersList = headers();
  const pathname = headersList.get('x-pathname') || "";

  // Se o usuário não existe no banco, mas passou pelo middleware (ex: cookie fantasma de outro projeto),
  // forçamos o redirecionamento se não estiver na página de login.
  if (!user && !pathname.startsWith('/login')) {
    redirect("/login?error=Sessão inválida. Por favor, faça login novamente.");
  }

  let perfil = null;
  if (user) {
    const { data } = await supabase.from('perfis').select('*').eq('id', user.id).single();
    perfil = data;
  }

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
  }

  return (
    <html lang="pt-BR">
      <body className={`${inter.className} min-h-screen bg-slate-100`}>
        {user && (
          <header className="bg-slate-900 text-white p-3 shadow-md flex justify-between items-center px-8 sticky top-0 z-50">
            <Link href="/" className="font-bold tracking-wider text-xl hover:text-blue-400 transition">
              NEXUS360
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-300">Olá, {perfil?.nome || user.email}</span>
                <span className="bg-blue-600 px-2 py-0.5 rounded text-xs font-bold uppercase">{perfil?.papel || 'Usuário'}</span>
              </div>
              
              {perfil?.papel === 'Administrador' && (
                <Link href="/usuarios" className="text-slate-400 hover:text-white underline">
                  Controle de Usuários
                </Link>
              )}

              <form action={signOut}>
                <button type="submit" className="text-slate-400 hover:text-white underline">Sair</button>
              </form>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
