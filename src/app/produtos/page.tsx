import { createClient } from "@/utils/supabase-server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function ProdutosPage() {
  const supabase = createClient();
  const { data: produtos } = await supabase.from("produtos").select("*, fornecedores(razao_social)").order("created_at", { ascending: false });
  const { data: fornecedores } = await supabase.from("fornecedores").select("id, razao_social");

  async function addProduto(formData: FormData) {
    "use server";
    const supabase = createClient();
    
    await supabase.from("produtos").insert([{ 
      sku: formData.get("sku"),
      ean: formData.get("ean") || null,
      nome: formData.get("nome"),
      categoria: formData.get("categoria"),
      subcategoria: formData.get("subcategoria") || null,
      marca: formData.get("marca") || null,
      unidade_medida: formData.get("unidade_medida"),
      preco_custo: Number(formData.get("preco_custo") || 0),
      preco_venda: Number(formData.get("preco_venda") || 0),
      estoque_minimo: Number(formData.get("estoque_minimo") || 0),
      estoque_maximo: Number(formData.get("estoque_maximo") || 0),
      fornecedor_principal: formData.get("fornecedor_principal") || null,
      status: formData.get("status") || "Ativo"
    }]);
    
    revalidatePath("/produtos");
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Catálogo Completo de Produtos</h1>
          <Link href="/" className="text-blue-600 hover:underline">← Voltar</Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg border-t-4 border-blue-500 mb-8">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Cadastrar Novo Produto</h2>
          <form action={addProduto} className="flex flex-col gap-4">
            {/* Linha 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Código/SKU *</label>
                <input type="text" name="sku" required className="w-full border rounded p-2 text-sm" placeholder="PROD-01" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Código de Barras (EAN)</label>
                <input type="text" name="ean" className="w-full border rounded p-2 text-sm" placeholder="7890000000000" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 text-gray-600">Nome do Produto *</label>
                <input type="text" name="nome" required className="w-full border rounded p-2 text-sm" placeholder="Descrição completa" />
              </div>
            </div>

            {/* Linha 2 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Categoria *</label>
                <input type="text" name="categoria" required className="w-full border rounded p-2 text-sm" placeholder="Ex: Alimentos" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Subcategoria</label>
                <input type="text" name="subcategoria" className="w-full border rounded p-2 text-sm" placeholder="Ex: Grãos" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Marca</label>
                <input type="text" name="marca" className="w-full border rounded p-2 text-sm" placeholder="Marca XYZ" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Unidade Medida (UM) *</label>
                <input type="text" name="unidade_medida" required className="w-full border rounded p-2 text-sm" placeholder="UN, KG, CX" />
              </div>
            </div>

            {/* Linha 3 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Preço Custo (R$)</label>
                <input type="number" step="0.01" name="preco_custo" className="w-full border rounded p-2 text-sm bg-gray-50" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Preço Venda (R$)</label>
                <input type="number" step="0.01" name="preco_venda" className="w-full border rounded p-2 text-sm bg-gray-50" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600 text-red-600">Estoque Mínimo</label>
                <input type="number" name="estoque_minimo" className="w-full border rounded p-2 text-sm" placeholder="Alerta de falta" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600 text-blue-600">Estoque Máximo</label>
                <input type="number" name="estoque_maximo" className="w-full border rounded p-2 text-sm" placeholder="Teto" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Status</label>
                <select name="status" className="w-full border rounded p-2 text-sm">
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
            </div>

            {/* Linha 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">Fornecedor Principal</label>
                <select name="fornecedor_principal" className="w-full border rounded p-2 text-sm">
                  <option value="">Nenhum / Selecionar depois</option>
                  {fornecedores?.map(f => (
                    <option key={f.id} value={f.id}>{f.razao_social}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end justify-end">
                <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded font-medium hover:bg-blue-700 w-full md:w-auto transition">
                  Salvar Produto
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-100 border-b text-gray-700">
                <th className="p-3 font-semibold text-xs uppercase">SKU / EAN</th>
                <th className="p-3 font-semibold text-xs uppercase">Produto</th>
                <th className="p-3 font-semibold text-xs uppercase">Categoria/Marca</th>
                <th className="p-3 font-semibold text-xs uppercase text-right">Custo / Venda</th>
                <th className="p-3 font-semibold text-xs uppercase text-center">Margem</th>
                <th className="p-3 font-semibold text-xs uppercase text-center">Mín/Máx</th>
                <th className="p-3 font-semibold text-xs uppercase">Fornecedor</th>
                <th className="p-3 font-semibold text-xs uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {produtos && produtos.length > 0 ? (
                produtos.map((p: any) => {
                  const custo = Number(p.preco_custo) || 0;
                  const venda = Number(p.preco_venda) || 0;
                  const margem = venda > 0 ? (((venda - custo) / venda) * 100).toFixed(1) : "0.0";
                  
                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3">
                        <div className="font-mono text-blue-700 font-bold">{p.sku}</div>
                        <div className="text-xs text-gray-400">{p.ean || "Sem EAN"}</div>
                      </td>
                      <td className="p-3 font-medium text-gray-900">{p.nome}</td>
                      <td className="p-3">
                        <div>{p.categoria}</div>
                        <div className="text-xs text-gray-500">{p.subcategoria ? `${p.subcategoria} - ` : ''}{p.marca || ''}</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="text-gray-500 text-xs">R$ {custo.toFixed(2)}</div>
                        <div className="font-bold text-green-700">R$ {venda.toFixed(2)}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${Number(margem) < 20 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {margem}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="text-red-600 text-xs font-bold">Min: {p.estoque_minimo}</div>
                        <div className="text-blue-600 text-xs font-bold">Máx: {p.estoque_maximo}</div>
                      </td>
                      <td className="p-3 text-gray-600 text-xs truncate max-w-[150px]">
                        {p.fornecedores?.razao_social || "-"}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    Nenhum produto cadastrado.
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
