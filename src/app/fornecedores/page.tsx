import { createClient } from "@/utils/supabase-server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function FornecedoresPage() {
  const supabase = createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("*").order("created_at", { ascending: false });

  async function addFornecedor(formData: FormData) {
    "use server";
    const razao_social = formData.get("razao_social") as string;
    const cnpj = formData.get("cnpj") as string;
    const prazo_medio = Number(formData.get("prazo_medio"));

    const supabase = createClient();
    await supabase.from("fornecedores").insert([{ razao_social, cnpj, prazo_medio }]);
    
    revalidatePath("/fornecedores");
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Gerenciar Fornecedores</h1>
          <Link href="/" className="text-blue-600 hover:underline">← Voltar</Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Novo Fornecedor</h2>
          <form action={addFornecedor} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Razão Social</label>
              <input type="text" name="razao_social" required className="w-full border rounded p-2" placeholder="Empresa XYZ" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">CNPJ</label>
              <input type="text" name="cnpj" required className="w-full border rounded p-2" placeholder="00.000.000/0001-00" />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium mb-1">Prazo (Dias)</label>
              <input type="number" name="prazo_medio" required defaultValue={0} className="w-full border rounded p-2" />
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
                <th className="p-4 font-semibold text-sm">Razão Social</th>
                <th className="p-4 font-semibold text-sm">CNPJ</th>
                <th className="p-4 font-semibold text-sm">Prazo Médio</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores && fornecedores.length > 0 ? (
                fornecedores.map((f: any) => (
                  <tr key={f.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">{f.razao_social}</td>
                    <td className="p-4 text-gray-600">{f.cnpj}</td>
                    <td className="p-4">{f.prazo_medio} dias</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    Nenhum fornecedor cadastrado.
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
