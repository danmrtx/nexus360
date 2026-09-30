import { createClient } from "@/utils/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function LoginPage({ searchParams }: { searchParams: { message?: string, error?: string, mode?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Se já estiver logado E não houver parâmetro de erro ou cadastro, vai para a Home
  if (user && !searchParams?.error && !searchParams?.mode) {
    return redirect("/");
  }

  
  async function signIn(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      return redirect("/login?error=Credenciais inválidas ou e-mail não confirmado.");
    }
    
    revalidatePath("/", "layout");
    return redirect("/");
  }

  async function signUp(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const nome = formData.get("nome") as string;
    const perfil = formData.get("perfil") as string;
    
    const supabase = createClient();
    
    // 1. Cria o usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) {
      return redirect(`/login?mode=signup&error=${authError.message}`);
    }

    // 2. Registra o perfil na tabela pública
    if (authData.user) {
      const { error: perfilError } = await supabase.from('perfis').insert([{
        id: authData.user.id,
        nome,
        papel: perfil // mapeia para a coluna correta no banco
      }]);

      if (perfilError) {
        console.error("Erro ao criar perfil:", perfilError);
      }
    }
    
    revalidatePath("/", "layout");
    return redirect("/login?message=Conta criada com sucesso! Faça seu login abaixo.");
  }

  const isSignup = searchParams?.mode === 'signup';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">Nexus360</h1>
          <p className="text-slate-500 mt-2">Sistema de Gestão de Estoque</p>
        </div>

        {searchParams?.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-medium text-center">
            {searchParams.error}
          </div>
        )}
        
        {searchParams?.message && (
          <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm font-medium text-center">
            {searchParams.message}
          </div>
        )}

        {!isSignup ? (
          <div className="mb-4">
            <h2 className="text-xl font-bold border-b pb-2 mb-4 text-slate-700">Fazer Login</h2>
            <form action={signIn} className="flex flex-col gap-4">
              <input type="email" name="email" required placeholder="Seu e-mail" className="border p-3 rounded bg-slate-50" />
              <input type="password" name="password" required placeholder="Sua senha" className="border p-3 rounded bg-slate-50" />
              <button type="submit" className="bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition shadow-md mt-2">
                Entrar no Sistema
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              Não possui uma conta?{' '}
              <Link href="/login?mode=signup" className="text-blue-600 font-bold hover:underline">
                Cadastre-se aqui
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <h2 className="text-xl font-bold border-b pb-2 mb-4 text-slate-700">Nova Conta</h2>
            <form action={signUp} className="flex flex-col gap-4">
              <input type="text" name="nome" required placeholder="Nome Completo" className="border p-3 rounded bg-slate-50 text-sm" />
              <input type="email" name="email" required placeholder="E-mail" className="border p-3 rounded bg-slate-50 text-sm" />
              <input type="password" name="password" required placeholder="Senha (mín 6 carac.)" minLength={6} className="border p-3 rounded bg-slate-50 text-sm" />
              
              <input type="hidden" name="perfil" value="Operador" />
              <div className="bg-blue-50 text-blue-800 p-3 rounded text-xs border border-blue-100">
                Sua conta será criada com o cargo de <strong>Operador</strong> por padrão. O Administrador poderá alterar seu nível de acesso depois.
              </div>

              <button type="submit" className="bg-slate-800 text-white font-bold py-3 rounded hover:bg-slate-900 transition shadow-md mt-2">
                Registrar Conta
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              Já possui uma conta?{' '}
              <Link href="/login" className="text-blue-600 font-bold hover:underline">
                Voltar para o Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
