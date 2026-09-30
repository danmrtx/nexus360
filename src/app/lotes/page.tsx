import { createClient } from "@/utils/supabase-server";
import { requireAuth, isOperador, isGerente } from "@/utils/permissions";
import Link from "next/link";

export default async function LotesPage() {
  const supabase = createClient();
  const { user, perfil } = await requireAuth();

  const isScoped = (isOperador(perfil.papel) || isGerente(perfil.papel)) && !!perfil.unidade_id;
  
  // Buscar o histórico de todos os lotes com seus relacionamentos
  const { data: todosLotes } = await supabase
    .from("lotes")
    .select(`
      id,
      numero_lote,
      nota_fiscal,
      data_entrada,
      data_fabricacao,
      data_validade,
      custo_unitario,
      status,
      produtos ( nome, sku ),
      fornecedores ( razao_social ),
      estoque_lote ( quantidade, unidade_id, unidades ( nome ) )
    `)
    .order("data_entrada", { ascending: false });

  const lotes = isScoped
    ? todosLotes?.filter((l: any) => l.estoque_lote?.some((el: any) => el.unidade_id === perfil.unidade_id))
    : todosLotes;

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Controle e Rastreabilidade de Lotes</h1>
            <p className="text-gray-500 mt-1">Visão completa de todos os lotes inseridos no sistema</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline px-4 py-2">Voltar à Home</Link>
        </div>

        <div className="bg-white rounded-xl shadow border overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-100 border-b text-gray-700">
                <th className="p-3 font-semibold text-xs uppercase">Produto</th>
                <th className="p-3 font-semibold text-xs uppercase">Número Lote</th>
                <th className="p-3 font-semibold text-xs uppercase">Fornecedor</th>
                <th className="p-3 font-semibold text-xs uppercase text-center">Data Entrada</th>
                <th className="p-3 font-semibold text-xs uppercase text-center">Fab / Validade</th>
                <th className="p-3 font-semibold text-xs uppercase">Distribuição (Saldo Físico)</th>
                <th className="p-3 font-semibold text-xs uppercase">NF</th>
                <th className="p-3 font-semibold text-xs uppercase text-right">Custo Un.</th>
                <th className="p-3 font-semibold text-xs uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {lotes && lotes.length > 0 ? (
                lotes.map((l: any) => {
                  const prod = l.produtos;
                  const forn = l.fornecedores;
                  
                  // Verificar onde o lote está
                  const distribuicao = l.estoque_lote?.filter((el: any) => el.quantidade > 0);

                  return (
                    <tr key={l.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">{prod?.nome}</div>
                        <div className="font-mono text-xs text-blue-700">{prod?.sku}</div>
                      </td>
                      <td className="p-3 font-mono font-bold">{l.numero_lote}</td>
                      <td className="p-3 text-gray-600">{forn?.razao_social || "-"}</td>
                      <td className="p-3 text-center text-gray-500">
                        {l.data_entrada ? new Date(l.data_entrada).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="text-xs text-gray-400">F: {l.data_fabricacao ? new Date(l.data_fabricacao).toLocaleDateString('pt-BR') : '-'}</div>
                        <div className="font-medium">V: {l.data_validade ? new Date(l.data_validade).toLocaleDateString('pt-BR') : '-'}</div>
                      </td>
                      <td className="p-3">
                        {distribuicao && distribuicao.length > 0 ? (
                          distribuicao.map((el: any, i: number) => (
                            <div key={i} className="text-xs">
                              <span className="font-bold">{el.quantidade}</span> em <span className="text-gray-500">{el.unidades.nome}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-red-500 font-medium">Lote Esgotado</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 font-mono text-xs">{l.nota_fiscal}</td>
                      <td className="p-3 text-right font-medium">
                        R$ {Number(l.custo_unitario || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          l.status === 'Normal' ? 'bg-green-100 text-green-700' 
                          : l.status === 'Vencido' ? 'bg-red-100 text-red-700' 
                          : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">
                    Nenhum lote registrado.
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
