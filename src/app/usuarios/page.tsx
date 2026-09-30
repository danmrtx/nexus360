import { createClient } from "@/utils/supabase-server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function UsuariosPage() {
  const supabase = createClient();
  
  // 1. Validar se é administrador
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: meuPerfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  
  if (meuPerfil?.papel !== 'Administrador') {
    return (
      <div className="min-h-screen flex items-center justify-center p-10 bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Acesso Negado</h1>
          <p className="text-slate-600 mb-4">Apenas o Administrador pode acessar o controle de usuários.</p>
          <Link href="/" className="text-blue-600 underline">Voltar para a tela inicial</Link>
        </div>
      </div>
    );
  }

  // 2. Buscar todos os usuários
  const { data: usuarios } = await supabase.from("perfis").select("*").order("created_at", { ascending: false });

  // 3. Action para atualizar papel
  async function atualizarPapel(formData: FormData) {
    "use server";
    const userId = formData.get("user_id") as string;
    const novoPapel = formData.get("papel") as string;
    
    const supabaseAction = createClient();
    await supabaseAction.from("perfis").update({ papel: novoPapel }).eq("id", userId);
    
    revalidatePath("/usuarios");
  }

  return (
    <main className="min-h-screen p-10 bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Controle de Acessos</h1>
            <p className="text-slate-500 mt-1">Gerencie as permissões dos funcionários do sistema</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline px-4 py-2">Voltar à Home</Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b text-slate-700">
                <th className="p-4 font-semibold text-sm">Nome do Funcionário</th>
                <th className="p-4 font-semibold text-sm">Data de Ingresso</th>
                <th className="p-4 font-semibold text-sm">Cargo / Permissão Atual</th>
                <th className="p-4 font-semibold text-sm text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((u: any) => (
                <tr key={u.id} className="border-b hover:bg-slate-50 transition">
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{u.nome}</div>
                    {u.id === user.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 rounded-full uppercase font-bold tracking-wider">Você</span>}
                  </td>
                  <td className="p-4 text-slate-500 text-sm">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-4">
                    <form action={atualizarPapel} className="flex gap-2 items-center">
                      <input type="hidden" name="user_id" value={u.id} />
                      <select 
                        name="papel" 
                        defaultValue={u.papel} 
                        className={`border rounded p-2 text-sm font-semibold w-48 ${
                          u.papel === 'Administrador' ? 'bg-red-50 text-red-700 border-red-200'
                          : u.papel === 'Gestor de Estoque' ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                        disabled={u.id === user.id} // Não pode alterar o próprio nível
                      >
                        <option value="Administrador">Administrador</option>
                        <option value="Gestor de Estoque">Gestor de Estoque</option>
                        <option value="Gerente de Loja">Gerente de Loja</option>
                        <option value="Operador">Operador (Básico)</option>
                      </select>
                      {u.id !== user.id && (
                        <button type="submit" className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded font-bold transition">
                          Salvar
                        </button>
                      )}
                    </form>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
