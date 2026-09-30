import { createClient } from "@/utils/supabase-server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function UnidadesPage() {
  const supabase = createClient();
  const { data: unidades } = await supabase.from("unidades").select("*").order("created_at", { ascending: false });

  async function addUnidade(formData: FormData) {
    "use server";
    const nome = formData.get("nome") as string;
    const tipo = formData.get("tipo") as string;
    const endereco = formData.get("endereco") as string;

    const supabase = createClient();
    await supabase.from("unidades").insert([{ nome, tipo, endereco }]);
    
    revalidatePath("/unidades");
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Gerenciar Unidades</h1>
          <Link href="/" className="text-blue-600 hover:underline">← Voltar</Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Nova Unidade</h2>
          <form action={addUnidade} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input type="text" name="nome" required className="w-full border rounded p-2" placeholder="Ex: Loja Centro" />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select name="tipo" required className="w-full border rounded p-2">
                <option value="LOJA">Loja</option>
                <option value="CD">Centro de Distribuição</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input type="text" name="endereco" className="w-full border rounded p-2" placeholder="Rua..." />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">
              Salvar
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-4 font-semibold text-sm">Nome</th>
                <th className="p-4 font-semibold text-sm">Tipo</th>
                <th className="p-4 font-semibold text-sm">Endereço</th>
              </tr>
            </thead>
            <tbody>
              {unidades && unidades.length > 0 ? (
                unidades.map((u: any) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">{u.nome}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${u.tipo === 'CD' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {u.tipo}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500">{u.endereco || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    Nenhuma unidade cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
