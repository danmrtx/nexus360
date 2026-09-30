import { createClient } from "@/utils/supabase-server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function TransferenciasPage() {
  const supabase = createClient();
  
  // 1. Dados para formulário manual
  const { data: produtos } = await supabase.from("produtos").select("id, nome, sku, estoque_minimo, estoque_maximo").order("nome");
  const { data: unidades } = await supabase.from("unidades").select("id, nome, tipo").order("nome");

  // 2. Histórico e pendências de transferências
  const { data: transferencias } = await supabase
    .from("transferencias")
    .select(`
      id, quantidade, status, created_at,
      produtos ( nome, sku ),
      origem:unidade_origem ( nome ),
      destino:unidade_destino ( nome )
    `)
    .order("created_at", { ascending: false });

  // ACTIONS

  async function solicitarTransferencia(formData: FormData) {
    "use server";
    const produto_id = formData.get("produto_id") as string;
    const unidade_origem = formData.get("unidade_origem") as string;
    const unidade_destino = formData.get("unidade_destino") as string;
    const quantidade = Number(formData.get("quantidade"));

    if (unidade_origem === unidade_destino) throw new Error("A origem e o destino devem ser diferentes.");

    const supabase = createClient();
    const { error } = await supabase.from("transferencias").insert([{
      produto_id,
      unidade_origem,
      unidade_destino,
      quantidade,
      status: 'Sugerida' // Status inicial de uma transferência manual/sistema
    }]);

    if (error) throw new Error(error.message);
    revalidatePath("/transferencias");
  }

  async function aprovarTransferencia(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const supabase = createClient();
    await supabase.from("transferencias").update({ status: 'Aprovada' }).eq("id", id);
    revalidatePath("/transferencias");
  }

  async function receberTransferencia(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const supabase = createClient();
    
    // Chama a RPC que fisicamente remove do estoque origem (FEFO) e insere no destino
    const { error } = await supabase.rpc("processar_transferencia", {
      p_transferencia_id: id,
      p_usuario_id: null
    });

    if (error) throw new Error("Falha ao concluir transferência (Falta de estoque na origem?): " + error.message);
    
    revalidatePath("/transferencias");
    revalidatePath("/estoque");
  }

  async function cancelarTransferencia(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const supabase = createClient();
    await supabase.from("transferencias").update({ status: 'Cancelada' }).eq("id", id);
    revalidatePath("/transferencias");
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-700">Painel de Transferências</h1>
            <p className="text-gray-500 mt-1">Movimentação de mercadorias entre CDs e Lojas</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline px-4 py-2">Voltar à Home</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Lado Esquerdo: Formulário Manual */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-indigo-500 sticky top-10">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Nova Transferência</h2>
              <form action={solicitarTransferencia} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Unidade Origem</label>
                  <select name="unidade_origem" required className="w-full border rounded p-2 bg-gray-50">
                    <option value="">De onde sai?</option>
                    {unidades?.map(u => <option key={u.id} value={u.id}>{u.tipo}: {u.nome}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Unidade Destino</label>
                  <select name="unidade_destino" required className="w-full border rounded p-2 bg-gray-50">
                    <option value="">Para onde vai?</option>
                    {unidades?.map(u => <option key={u.id} value={u.id}>{u.tipo}: {u.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Produto</label>
                  <select name="produto_id" required className="w-full border rounded p-2 bg-gray-50">
                    <option value="">Selecione o produto</option>
                    {produtos?.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Quantidade</label>
                  <input type="number" name="quantidade" required min="1" step="0.01" className="w-full border rounded p-2" placeholder="Ex: 50" />
                </div>

                <button type="submit" className="mt-2 bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-indigo-700 transition">
                  Sugerir Transferência
                </button>
              </form>
            </div>
          </div>

          {/* Lado Direito: Lista de Transferências */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow border overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-bold text-gray-700 text-lg">Solicitações e Histórico</h3>
              </div>
              <div className="p-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-600 text-sm">
                      <th className="p-4 font-semibold">Produto / Qtd</th>
                      <th className="p-4 font-semibold">Rota</th>
                      <th className="p-4 font-semibold text-center">Status</th>
                      <th className="p-4 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferencias && transferencias.length > 0 ? (
                      transferencias.map((t: any) => (
                        <tr key={t.id} className="border-b hover:bg-gray-50 transition">
                          <td className="p-4">
                            <div className="font-bold text-gray-900">{t.produtos?.nome}</div>
                            <div className="text-sm text-gray-500">Qtd: <span className="font-bold text-indigo-600">{t.quantidade}</span></div>
                          </td>
                          <td className="p-4 text-sm">
                            <div className="text-gray-500 text-xs">Origem:</div>
                            <div className="font-medium text-gray-800 mb-1">{t.origem?.nome}</div>
                            <div className="text-gray-500 text-xs">Destino:</div>
                            <div className="font-medium text-gray-800">{t.destino?.nome}</div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              t.status === 'Sugerida' ? 'bg-yellow-100 text-yellow-700'
                              : t.status === 'Aprovada' ? 'bg-blue-100 text-blue-700'
                              : t.status === 'Recebida' ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-600'
                            }`}>
                              {t.status}
                            </span>
                            <div className="text-[10px] text-gray-400 mt-1">{new Date(t.created_at).toLocaleDateString('pt-BR')}</div>
                          </td>
                          <td className="p-4 text-right">
                            {t.status === 'Sugerida' && (
                              <div className="flex flex-col gap-2 items-end">
                                <form action={aprovarTransferencia}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <button type="submit" className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 font-bold">Aprovar</button>
                                </form>
                                <form action={cancelarTransferencia}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <button type="submit" className="text-xs text-red-500 hover:underline">Recusar</button>
                                </form>
                              </div>
                            )}
                            
                            {t.status === 'Aprovada' && (
                              <form action={receberTransferencia}>
                                <input type="hidden" name="id" value={t.id} />
                                <button type="submit" className="text-xs bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 font-bold shadow">
                                  Concluir & Receber
                                </button>
                                <p className="text-[9px] text-gray-400 mt-1 text-center max-w-[100px]">Aplica FEFO e move saldo físico</p>
                              </form>
                            )}

                            {t.status === 'Recebida' && (
                              <span className="text-green-600 text-xl">✓</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">Nenhuma transferência solicitada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
