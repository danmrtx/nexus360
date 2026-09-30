import { createClient } from "@/utils/supabase-server";
import { requireAuth, isOperador } from "@/utils/permissions";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function EntradasPage() {
  const supabase = createClient();
  const { user, perfil } = await requireAuth();
  
  // Buscar dados para popular os selects
  const { data: produtos } = await supabase.from("produtos").select("id, nome, sku").order("nome");
  const { data: unidades } = await supabase.from("unidades").select("id, nome").order("nome");
  const { data: fornecedores } = await supabase.from("fornecedores").select("id, razao_social").order("razao_social");

  const userUnidade = perfil.unidades;
  const isOperadorRole = isOperador(perfil.papel);

  async function receberMercadoria(formData: FormData) {
    "use server";
    const { user: actionUser, perfil: actionPerfil } = await requireAuth();

    const produto_id = formData.get("produto_id") as string;
    const fornecedor_id = formData.get("fornecedor_id") as string;
    
    // Se for operador, força a unidade de lotação
    let unidade_id = formData.get("unidade_id") as string;
    if (isOperador(actionPerfil.papel) && actionPerfil.unidade_id) {
      unidade_id = actionPerfil.unidade_id;
    }

    const numero_lote = formData.get("numero_lote") as string;
    const nota_fiscal = formData.get("nota_fiscal") as string;
    const quantidade = Number(formData.get("quantidade"));
    const custo_unitario = Number(formData.get("custo_unitario") || 0);
    const fabricacao = formData.get("fabricacao") as string;
    const validade = formData.get("validade") as string;

    const supabase = createClient();
    
    // Chamada da Função RPC Transacional (banco de dados)
    const { error } = await supabase.rpc("registrar_entrada", {
      p_produto_id: produto_id,
      p_fornecedor_id: fornecedor_id,
      p_unidade_id: unidade_id,
      p_numero_lote: numero_lote,
      p_nota_fiscal: nota_fiscal,
      p_quantidade: quantidade,
      p_validade: validade || null,
      p_fabricacao: fabricacao || null,
      p_usuario_id: actionUser.id,
      p_custo_unitario: custo_unitario
    });

    if (error) {
      console.error("Erro na entrada:", error);
      throw new Error("Erro no banco de dados: " + error.message);
    }
    
    revalidatePath("/estoque");
    revalidatePath("/lotes");
    redirect("/estoque");
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-green-700">Entrada de Mercadorias</h1>
            <p className="text-sm text-gray-500 mt-1">
              {isOperadorRole ? "Registro físico de mercadorias da sua unidade" : "Recebimento de mercadorias com geração de Lote"}
            </p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline">← Voltar</Link>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-green-500">
          <p className="text-gray-500 mb-6 border-b pb-4">Registre o recebimento físico com Nota Fiscal. O lote será criado e o saldo atualizado instantaneamente.</p>
          
          <form action={receberMercadoria} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Unidade de Destino (CD/Loja)</label>
                {isOperadorRole && userUnidade ? (
                  <>
                    <input type="hidden" name="unidade_id" value={userUnidade.id} />
                    <div className="w-full border rounded p-2 bg-emerald-50 text-emerald-800 font-semibold text-sm">
                      📍 {userUnidade.nome} (Sua Unidade)
                    </div>
                  </>
                ) : (
                  <select name="unidade_id" required className="w-full border rounded p-2 bg-gray-50">
                    <option value="">Selecione...</option>
                    {unidades?.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Fornecedor</label>
                <select name="fornecedor_id" required className="w-full border rounded p-2 bg-gray-50">
                  <option value="">Selecione...</option>
                  {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.razao_social}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Produto</label>
                <select name="produto_id" required className="w-full border rounded p-2 bg-gray-50">
                  <option value="">Selecione...</option>
                  {produtos?.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.nome}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade</label>
                <input type="number" name="quantidade" required min="1" step="0.01" className="w-full border rounded p-2" placeholder="Ex: 100" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t pt-4 mt-2">
              <div>
                <label className="block text-sm font-medium mb-1">Nº Nota Fiscal</label>
                <input type="text" name="nota_fiscal" required className="w-full border rounded p-2" placeholder="NF-00123" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Número do Lote</label>
                <input type="text" name="numero_lote" required className="w-full border rounded p-2" placeholder="LOTE-A1" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Custo (R$)</label>
                <input type="number" name="custo_unitario" step="0.01" required className="w-full border rounded p-2 bg-gray-50" placeholder="0.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data de Fabricação</label>
                <input type="date" name="fabricacao" className="w-full border rounded p-2" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-red-600">Data de Validade (Crítico)</label>
                <input type="date" name="validade" required className="w-full border border-red-300 rounded p-2 bg-red-50" />
              </div>
            </div>

            <button type="submit" className="mt-4 bg-green-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition">
              Confirmar Recebimento (Gerar Lote)
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
