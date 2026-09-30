import { createClient } from "@/utils/supabase-server";
import Link from "next/link";

export default async function EstoquePage() {
  const supabase = createClient();
  
  // 1. Busca os saldos detalhados por lote
  const { data: saldosLotes } = await supabase
    .from("estoque_lote")
    .select(`
      quantidade,
      quantidade_reservada,
      unidades ( id, nome, tipo ),
      lotes (
        numero_lote,
        data_validade,
        status,
        produtos ( id, nome, sku, unidade_medida, estoque_minimo, estoque_maximo )
      )
    `)
    .gt("quantidade", 0);

  // 2. Agrupa saldos por Produto + Unidade
  const estoqueAgregado = new Map<string, any>();

  saldosLotes?.forEach((item: any) => {
    const unidade = item.unidades;
    const lote = item.lotes;
    const prod = lote?.produtos;
    if (!prod || !unidade) return;

    const key = `${unidade.id}_${prod.id}`;
    
    if (!estoqueAgregado.has(key)) {
      estoqueAgregado.set(key, {
        unidade,
        produto: prod,
        quantidade_total: 0,
        quantidade_reservada: 0,
        lotes: []
      });
    }

    const agg = estoqueAgregado.get(key);
    agg.quantidade_total += Number(item.quantidade);
    agg.quantidade_reservada += Number(item.quantidade_reservada);
    agg.lotes.push({
      numero: lote.numero_lote,
      validade: lote.data_validade,
      qtd: Number(item.quantidade)
    });
  });

  const visaoAgregada = Array.from(estoqueAgregado.values());

  // Calcular Indicadores Gerais
  let produtosEmFalta = 0;
  let produtosEmExcesso = 0;

  visaoAgregada.forEach(agg => {
    const disponivel = agg.quantidade_total - agg.quantidade_reservada;
    if (disponivel < agg.produto.estoque_minimo) produtosEmFalta++;
    if (agg.produto.estoque_maximo > 0 && disponivel > agg.produto.estoque_maximo) produtosEmExcesso++;
  });

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Visão Analítica de Estoque</h1>
            <p className="text-gray-500 mt-1">Gestão consolidada por Unidade (Lojas e CDs)</p>
          </div>
          <div className="flex gap-4">
            <Link href="/entradas" className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 font-medium">
              + Receber Mercadoria
            </Link>
            <Link href="/" className="text-blue-600 hover:underline px-4 py-2">Voltar à Home</Link>
          </div>
        </div>

        {/* Indicadores (Dashboard Header) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <p className="text-sm text-gray-500 font-medium">Total de Itens em Estoque</p>
            <h3 className="text-2xl font-bold text-gray-900">{visaoAgregada.length} <span className="text-sm font-normal text-gray-400">referências</span></h3>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <p className="text-sm text-gray-500 font-medium">Produtos em Falta (Abaixo do Mín)</p>
            <h3 className="text-2xl font-bold text-red-600">{produtosEmFalta}</h3>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <p className="text-sm text-gray-500 font-medium">Produtos em Excesso (Acima do Máx)</p>
            <h3 className="text-2xl font-bold text-yellow-600">{produtosEmExcesso}</h3>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <p className="text-sm text-gray-500 font-medium">Lotes Perto do Vencimento</p>
            <h3 className="text-2xl font-bold text-purple-600">Ver painel Lotes</h3>
          </div>
        </div>

        {/* Tabela Agregada */}
        <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h2 className="font-semibold text-lg text-gray-800">Saldo Consolidado por Unidade</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-blue-50 border-b border-blue-100 text-blue-900">
                <th className="p-4 font-semibold text-sm">Local (Unidade)</th>
                <th className="p-4 font-semibold text-sm">Produto</th>
                <th className="p-4 font-semibold text-sm text-center">Mín/Máx</th>
                <th className="p-4 font-semibold text-sm text-right">Saldo Físico (Atual)</th>
                <th className="p-4 font-semibold text-sm text-right">Reservado</th>
                <th className="p-4 font-semibold text-sm text-right">Disponível</th>
                <th className="p-4 font-semibold text-sm text-center">Status Automático</th>
              </tr>
            </thead>
            <tbody>
              {visaoAgregada.length > 0 ? (
                visaoAgregada.sort((a,b) => a.produto.nome.localeCompare(b.produto.nome)).map((agg, idx) => {
                  const disponivel = agg.quantidade_total - agg.quantidade_reservada;
                  const min = agg.produto.estoque_minimo;
                  const max = agg.produto.estoque_maximo;
                  
                  let status = { label: "ESTOQUE NORMAL", color: "bg-green-100 text-green-700" };
                  if (disponivel < min) status = { label: "EM FALTA (Abaixo Mín)", color: "bg-red-100 text-red-700 font-bold" };
                  else if (max > 0 && disponivel > max) status = { label: "EM EXCESSO (Acima Máx)", color: "bg-yellow-100 text-yellow-700 font-bold" };

                  return (
                    <tr key={idx} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{agg.unidade.nome}</div>
                        <div className="text-xs text-gray-400">{agg.unidade.tipo}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{agg.produto.nome}</div>
                        <div className="text-xs font-mono text-gray-500">SKU: {agg.produto.sku}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-xs font-medium text-red-600">Mín: {min}</div>
                        <div className="text-xs font-medium text-blue-600">Máx: {max > 0 ? max : '∞'}</div>
                      </td>
                      <td className="p-4 text-right font-bold text-gray-700 text-lg">
                        {agg.quantidade_total} <span className="text-xs font-normal text-gray-400">{agg.produto.unidade_medida}</span>
                      </td>
                      <td className="p-4 text-right text-orange-600 font-medium">{agg.quantidade_reservada}</td>
                      <td className="p-4 text-right font-bold text-green-700 text-xl">{disponivel}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs inline-block text-center ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 bg-gray-50">
                    O estoque está completamente vazio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          Nota: O <strong>Giro de Estoque</strong> e <strong>Produtos Sem Movimentação</strong> requerem dados históricos (vendas/saídas). Serão gerados na aba Relatórios assim que rodarmos as primeiras saídas.
        </div>
      </div>
    </main>
  );
}
