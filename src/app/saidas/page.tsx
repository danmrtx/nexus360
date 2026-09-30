import { createClient } from "@/utils/supabase-server";
import { requireAuth, isOperador, isGerente, canRegisterExits } from "@/utils/permissions";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SaidasPage() {
  const supabase = createClient();
  const { user, perfil } = await requireAuth();

  const userUnidade = perfil.unidades;
  const isOperadorRole = isOperador(perfil.papel);
  const isGerenteRole = isGerente(perfil.papel);
  const canRegister = canRegisterExits(perfil.papel);
  const isScoped = (isOperadorRole || isGerenteRole) && !!perfil.unidade_id;
  
  // Buscar dados para popular os selects
  const { data: produtos } = await supabase.from("produtos").select("id, nome, sku").order("nome");
  const { data: unidades } = await supabase.from("unidades").select("id, nome").order("nome");

  // Buscar histórico de saídas recentes (filtrado por unidade se for gerente ou operador)
  let movQuery = supabase
    .from("movimentacoes")
    .select(`
      id, tipo, quantidade, justificativa, created_at,
      unidades (nome),
      lotes (numero_lote, data_validade, produtos(nome, sku))
    `)
    .in("tipo", ['venda', 'perda', 'avaria', 'consumo', 'devolucao', 'ajuste', 'vencimento'])
    .order("created_at", { ascending: false })
    .limit(10);

  if (isScoped && perfil.unidade_id) {
    movQuery = movQuery.eq("unidade_id", perfil.unidade_id);
  }

  const { data: ultimasMovimentacoes } = await movQuery;

  async function registrarSaidaFefo(formData: FormData) {
    "use server";
    const { user: actionUser, perfil: actionPerfil } = await requireAuth();

    if (!canRegisterExits(actionPerfil.papel)) {
      throw new Error("Apenas Operadores ou Administradores podem registrar saídas operacionais.");
    }

    const produto_id = formData.get("produto_id") as string;
    
    // Forçar a unidade do operador caso seja operador
    let unidade_id = formData.get("unidade_id") as string;
    if (isOperador(actionPerfil.papel) && actionPerfil.unidade_id) {
      unidade_id = actionPerfil.unidade_id;
    }

    const quantidade_solicitada = Number(formData.get("quantidade"));
    const tipo = formData.get("tipo") as string;
    const justificativa = formData.get("justificativa") as string;

    const supabase = createClient();
    
    // 1. O Sistema (Banco de Dados) faz a inteligência FEFO
    const { data: lotesFefo, error: fefoError } = await supabase.rpc("selecionar_lotes_fefo", {
      p_produto_id: produto_id,
      p_unidade_id: unidade_id,
      p_quantidade: quantidade_solicitada
    });

    if (fefoError || !lotesFefo || lotesFefo.length === 0) {
      console.error("Erro no FEFO:", fefoError);
      throw new Error("Estoque insuficiente na unidade ou erro no FEFO: " + (fefoError?.message || "Sem saldo disponível."));
    }

    // 2. Com a lista de lotes ideal retornada pelo FEFO, processa a baixa
    for (const item of lotesFefo) {
      const { error: saidaError } = await supabase.rpc("registrar_saida", {
        p_tipo: tipo,
        p_lote_id: item.lote_id,
        p_unidade_id: unidade_id,
        p_quantidade: item.quantidade_a_retirar,
        p_usuario_id: actionUser.id,
        p_justificativa: justificativa || `Baixa FEFO automática. Solicitado: ${quantidade_solicitada}`
      });

      if (saidaError) {
        console.error("Erro ao registrar saída de um dos lotes:", saidaError);
        throw new Error("Erro ao baixar do lote FEFO: " + saidaError.message);
      }
    }
    
    revalidatePath("/estoque");
    revalidatePath("/saidas");
    redirect("/estoque");
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-red-700">Saída de Mercadorias (FEFO)</h1>
            <p className="text-sm text-gray-500 mt-1">
              {canRegister ? "Registro operacional de baixas pelo método FEFO" : "Consulta de movimentações de saída recentes (Somente Leitura)"}
            </p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline">← Voltar</Link>
        </div>

        {canRegister && (
          <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-red-500 mb-8">
            <div className="mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800">Registrar Baixa Inteligente</h2>
              <p className="text-gray-500 mt-1">
                Você seleciona o **Produto** e a **Quantidade Total**. O sistema cuidará automaticamente de aplicar o 
                <strong className="text-blue-700"> FEFO (First-Expired, First-Out)</strong>, descontando primeiro do lote que vence mais cedo.
              </p>
            </div>
            
            <form action={registrarSaidaFefo} className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Unidade de Origem</label>
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
                  <label className="block text-sm font-medium mb-1">Motivo / Tipo da Saída</label>
                  <select name="tipo" required className="w-full border rounded p-2 bg-gray-50">
                    <option value="venda">Venda (Ponto de Venda)</option>
                    <option value="perda">Perda</option>
                    <option value="avaria">Avaria (Produto quebrado/danificado)</option>
                    <option value="consumo">Consumo Interno</option>
                    <option value="devolucao">Devolução ao Fornecedor</option>
                    <option value="vencimento">Baixa por Vencimento</option>
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
                  <label className="block text-sm font-medium mb-1">Qtd Total a Baixar</label>
                  <input type="number" name="quantidade" required min="1" step="0.01" className="w-full border rounded p-2" placeholder="Ex: 5" />
                </div>
              </div>

              <div className="mt-2">
                <label className="block text-sm font-medium mb-1">Justificativa / Observação</label>
                <textarea name="justificativa" rows={2} className="w-full border rounded p-2" placeholder="Ex: Produto avariado durante transporte, ou Número do cupom fiscal..." />
              </div>

              <button type="submit" className="mt-4 bg-red-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-red-700 transition">
                Processar Saída Automática
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="p-4 bg-gray-100 border-b">
            <h3 className="font-bold text-gray-700">Últimas 10 Movimentações de Saída</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 text-sm">
                <th className="p-3 font-semibold">Data</th>
                <th className="p-3 font-semibold">Tipo</th>
                <th className="p-3 font-semibold">Produto</th>
                <th className="p-3 font-semibold">Lote Afetado</th>
                <th className="p-3 font-semibold text-right">Qtd Retirada</th>
                <th className="p-3 font-semibold">Local</th>
              </tr>
            </thead>
            <tbody>
              {ultimasMovimentacoes && ultimasMovimentacoes.length > 0 ? (
                ultimasMovimentacoes.map((mov: any) => {
                  const lote = mov.lotes;
                  const prod = lote?.produtos;
                  return (
                    <tr key={mov.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3 text-gray-600">{new Date(mov.created_at).toLocaleString('pt-BR')}</td>
                      <td className="p-3">
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase">{mov.tipo}</span>
                      </td>
                      <td className="p-3 font-medium">{prod?.nome}</td>
                      <td className="p-3 font-mono text-gray-600">{lote?.numero_lote}</td>
                      <td className="p-3 text-right font-bold text-red-600">-{mov.quantidade}</td>
                      <td className="p-3 text-gray-500">{mov.unidades?.nome}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">Nenhuma saída registrada recentemente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
