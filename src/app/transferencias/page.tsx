import { createClient } from "@/utils/supabase-server";
import { requireAuth, isOperador, isGerente, canCreateTransfers, canApproveTransfers } from "@/utils/permissions";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function TransferenciasPage() {
  const supabase = createClient();
  const { user, perfil } = await requireAuth();

  const userUnidadeId = perfil.unidade_id;
  const userUnidade = perfil.unidades;
  const isOperadorRole = isOperador(perfil.papel);
  const isGerenteRole = isGerente(perfil.papel);
  const isScoped = (isOperadorRole || isGerenteRole) && !!userUnidadeId;
  const canCreate = canCreateTransfers(perfil.papel) && !isOperadorRole;
  const canApprove = canApproveTransfers(perfil.papel) && !isOperadorRole;
  
  // 1. Dados para formulário manual
  const { data: produtos } = await supabase.from("produtos").select("id, nome, sku, estoque_minimo, estoque_maximo").order("nome");
  const { data: unidades } = await supabase.from("unidades").select("id, nome, tipo").order("nome");

  // 2. Histórico e pendências de transferências (filtrado por unidade se for escopado)
  let transfQuery = supabase
    .from("transferencias")
    .select(`
      id, quantidade, status, created_at, unidade_origem, unidade_destino,
      produtos ( nome, sku ),
      origem:unidade_origem ( id, nome ),
      destino:unidade_destino ( id, nome )
    `)
    .order("created_at", { ascending: false });

  if (isScoped && userUnidadeId) {
    transfQuery = transfQuery.or(`unidade_origem.eq.${userUnidadeId},unidade_destino.eq.${userUnidadeId}`);
  }

  const { data: transferencias } = await transfQuery;

  // ACTIONS

  async function solicitarTransferencia(formData: FormData) {
    "use server";
    const { perfil: actionPerfil } = await requireAuth();
    if (isOperador(actionPerfil.papel)) {
      throw new Error("Operadores não têm permissão para criar transferências.");
    }

    const produto_id = formData.get("produto_id") as string;
    let unidade_origem = formData.get("unidade_origem") as string;
    let unidade_destino = formData.get("unidade_destino") as string;
    const quantidade = Number(formData.get("quantidade"));

    if (unidade_origem === unidade_destino) throw new Error("A origem e o destino devem ser diferentes.");

    const supabase = createClient();
    const { error } = await supabase.from("transferencias").insert([{
      produto_id,
      unidade_origem,
      unidade_destino,
      quantidade,
      status: 'Sugerida'
    }]);

    if (error) throw new Error(error.message);
    revalidatePath("/transferencias");
  }

  async function aprovarTransferencia(formData: FormData) {
    "use server";
    const { perfil: actionPerfil } = await requireAuth();
    if (isOperador(actionPerfil.papel)) {
      throw new Error("Operadores não têm permissão para aprovar transferências.");
    }

    const id = formData.get("id") as string;
    const supabase = createClient();
    await supabase.from("transferencias").update({ status: 'Aprovada' }).eq("id", id);
    revalidatePath("/transferencias");
  }

  async function receberTransferencia(formData: FormData) {
    "use server";
    const { user: actionUser, perfil: actionPerfil } = await requireAuth();
    if (isOperador(actionPerfil.papel)) {
      throw new Error("Operadores não têm permissão para concluir transferências.");
    }

    const id = formData.get("id") as string;
    const supabase = createClient();
    
    const { error } = await supabase.rpc("processar_transferencia", {
      p_transferencia_id: id,
      p_usuario_id: actionUser.id
    });

    if (error) throw new Error("Falha ao concluir transferência (Falta de estoque na origem?): " + error.message);
    
    revalidatePath("/transferencias");
    revalidatePath("/estoque");
  }

  async function cancelarTransferencia(formData: FormData) {
    "use server";
    const { perfil: actionPerfil } = await requireAuth();
    if (isOperador(actionPerfil.papel)) {
      throw new Error("Operadores não têm permissão para cancelar transferências.");
    }

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
            <p className="text-gray-500 mt-1">
              {isOperadorRole 
                ? "Consulta de movimentações e transferências da sua unidade" 
                : isGerenteRole 
                ? "Solicitações e aprovações de transferências da sua loja" 
                : "Movimentação estratégica e balanceamento de mercadorias entre a rede"}
            </p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline px-4 py-2">Voltar à Home</Link>
        </div>

        <div className={`grid grid-cols-1 ${canCreate ? 'lg:grid-cols-3' : ''} gap-8`}>
          
          {/* Lado Esquerdo: Formulário Manual (Apenas para quem pode criar) */}
          {canCreate && (
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-indigo-500 sticky top-10">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Nova Transferência</h2>
                <form action={solicitarTransferencia} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Unidade Origem</label>
                    <select name="unidade_origem" required className="w-full border rounded p-2 bg-gray-50 text-sm">
                      <option value="">De onde sai?</option>
                      {unidades?.map(u => <option key={u.id} value={u.id}>{u.tipo}: {u.nome}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Unidade Destino</label>
                    {isGerenteRole && userUnidade ? (
                      <>
                        <input type="hidden" name="unidade_destino" value={userUnidade.id} />
                        <div className="w-full border rounded p-2 bg-indigo-50 text-indigo-800 font-semibold text-sm">
                          📍 {userUnidade.nome} (Sua Loja)
                        </div>
                      </>
                    ) : (
                      <select name="unidade_destino" required className="w-full border rounded p-2 bg-gray-50 text-sm">
                        <option value="">Para onde vai?</option>
                        {unidades?.map(u => <option key={u.id} value={u.id}>{u.tipo}: {u.nome}</option>)}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Produto</label>
                    <select name="produto_id" required className="w-full border rounded p-2 bg-gray-50 text-sm">
                      <option value="">Selecione o produto</option>
                      {produtos?.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.nome}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Quantidade</label>
                    <input type="number" name="quantidade" required min="1" step="0.01" className="w-full border rounded p-2 text-sm" placeholder="Ex: 50" />
                  </div>

                  <button type="submit" className="mt-2 bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-indigo-700 transition">
                    Solicitar Transferência
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Lado Direito: Lista de Transferências */}
          <div className={canCreate ? "lg:col-span-2" : "w-full"}>
            <div className="bg-white rounded-xl shadow border overflow-hidden">
              <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700 text-lg">Solicitações e Histórico</h3>
                <span className="text-xs text-gray-500">
                  {transferencias?.length || 0} movimentações
                </span>
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
                            {canApprove ? (
                              <>
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
                                  <span className="text-green-600 text-xl font-bold">✓ Concluída</span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400 font-medium">Apenas consulta</span>
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
