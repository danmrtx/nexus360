import { createClient } from "@/utils/supabase-server";
import { requireAuth, isOperador, isGerente } from "@/utils/permissions";
import Link from "next/link";

export default async function RelatoriosPage() {
  const supabase = createClient();
  const { user, perfil } = await requireAuth();

  // Operador não tem acesso a relatórios
  if (isOperador(perfil.papel)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10 bg-slate-50">
        <div className="text-center max-w-md bg-white p-8 rounded-xl shadow border">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Acesso Restrito</h1>
          <p className="text-slate-600 mb-6">
            O perfil de Operador executa operações físicas e não possui permissão para acessar os relatórios e inteligência gerencial.
          </p>
          <Link href="/" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition">
            Voltar ao Painel
          </Link>
        </div>
      </div>
    );
  }

  const isGerenteRole = isGerente(perfil.papel);
  const userUnidadeId = perfil.unidade_id;

  // 1. Coleta de Dados Básicos (Filtrado por unidade se for Gerente de Loja)
  const { data: produtos } = await supabase.from("produtos").select("id, nome, estoque_minimo, estoque_maximo, preco_custo");
  const { data: lotes } = await supabase.from("lotes").select("id, data_validade, status, custo_unitario, produtos(nome)");
  
  let estoqueQuery = supabase.from("estoque_lote").select("quantidade, quantidade_reservada, unidade_id, lotes(produto_id)");
  if (isGerenteRole && userUnidadeId) {
    estoqueQuery = estoqueQuery.eq("unidade_id", userUnidadeId);
  }
  const { data: estoque } = await estoqueQuery;

  let movQuery = supabase.from("movimentacoes").select("tipo, quantidade, created_at, unidade_id, lotes(produto_id, custo_unitario, produtos(nome))");
  if (isGerenteRole && userUnidadeId) {
    movQuery = movQuery.eq("unidade_id", userUnidadeId);
  }
  const { data: movimentacoes } = await movQuery;

  let repoQuery = supabase.from("reposicoes").select("status, quantidade, unidade_id, produtos(preco_custo)");
  if (isGerenteRole && userUnidadeId) {
    repoQuery = repoQuery.eq("unidade_id", userUnidadeId);
  }
  const { data: reposicoes } = await repoQuery;

  // --- PROCESSAMENTO: ESTOQUE ---
  const estoquePorProduto = new Map<string, number>();
  estoque?.forEach((e: any) => {
    const prodId = e.lotes?.produto_id;
    if (prodId) {
      estoquePorProduto.set(prodId, (estoquePorProduto.get(prodId) || 0) + (Number(e.quantidade) - Number(e.quantidade_reservada)));
    }
  });

  let produtosSemEstoque = 0;
  let produtosComExcesso = 0;
  produtos?.forEach(p => {
    const saldo = estoquePorProduto.get(p.id) || 0;
    if (saldo === 0) produtosSemEstoque++;
    if (p.estoque_maximo > 0 && saldo > p.estoque_maximo) produtosComExcesso++;
  });

  // --- PROCESSAMENTO: VALIDADE ---
  const hoje = new Date().getTime();
  const DAY_MS = 1000 * 3600 * 24;
  let vencidos = 0;
  let vencendo7 = 0;
  let vencendo15 = 0;

  lotes?.forEach((l: any) => {
    if (l.data_validade) {
      const dias = Math.ceil((new Date(l.data_validade).getTime() - hoje) / DAY_MS);
      if (dias < 0) vencidos++;
      else if (dias <= 7) vencendo7++;
      else if (dias <= 15) vencendo15++;
    }
  });

  // Valor Perdido por Vencimento/Perda (Pega das movimentações de saída)
  let valorPerdido = 0;
  movimentacoes?.forEach((m: any) => {
    if (m.tipo === 'vencimento' || m.tipo === 'perda' || m.tipo === 'avaria') {
      valorPerdido += Number(m.quantidade) * Number(m.lotes?.custo_unitario || 0);
    }
  });

  // --- PROCESSAMENTO: MOVIMENTAÇÃO E COMPRAS ---
  const contagemMovs = { entradas: 0, saidas: 0, transferencias: 0, devolucoes: 0 };
  const vendasPorProduto = new Map<string, { nome: string, qtd: number }>();
  
  movimentacoes?.forEach((m: any) => {
    const qtd = Number(m.quantidade);
    if (m.tipo === 'entrada') contagemMovs.entradas += qtd;
    if (m.tipo === 'venda') {
      contagemMovs.saidas += qtd;
      const prodId = m.lotes?.produto_id;
      const prodNome = m.lotes?.produtos?.nome || 'Desconhecido';
      if (prodId) {
        const atual = vendasPorProduto.get(prodId) || { nome: prodNome, qtd: 0 };
        atual.qtd += qtd;
        vendasPorProduto.set(prodId, atual);
      }
    }
    if (m.tipo.includes('transferencia')) contagemMovs.transferencias += qtd;
    if (m.tipo === 'devolucao') contagemMovs.devolucoes += qtd;
  });

  let comprasRealizadas = 0;
  let reposicoesPendentes = 0;
  let valorComprado = 0;
  reposicoes?.forEach((r: any) => {
    if (r.status === 'Recebida') {
      comprasRealizadas++;
      valorComprado += Number(r.quantidade) * Number(r.produtos?.preco_custo || 0);
    } else if (r.status !== 'Cancelada') {
      reposicoesPendentes++;
    }
  });

  // --- PROCESSAMENTO: DESEMPENHO ---
  const rankingVendas = Array.from(vendasPorProduto.values()).sort((a, b) => b.qtd - a.qtd);
  const topVendas = rankingVendas.slice(0, 3);
  
  // Produtos menos movimentados (os que não aparecem nas vendas ou tem menos)
  const produtosMenosMovimentados = produtos?.filter(p => !vendasPorProduto.has(p.id)).slice(0, 3) || [];

  return (
    <main className="min-h-screen p-10 bg-slate-50 text-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Relatórios Gerenciais</h1>
            <p className="text-slate-500 mt-1">Métricas de Estoque, Validades, Movimentações e Desempenho</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline px-4 py-2">Voltar à Home</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-semibold mb-2">Produtos sem Estoque (Ruptura)</h3>
            <p className="text-4xl font-bold text-red-600">{produtosSemEstoque}</p>
          </div>
          {/* Card 2 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-semibold mb-2">Produtos em Excesso</h3>
            <p className="text-4xl font-bold text-yellow-600">{produtosComExcesso}</p>
          </div>
          {/* Card 3 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-semibold mb-2">Pedidos de Compra Pendentes</h3>
            <p className="text-4xl font-bold text-blue-600">{reposicoesPendentes}</p>
          </div>
          {/* Card 4 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-semibold mb-2">Prejuízo com Perdas/Validade</h3>
            <p className="text-4xl font-bold text-red-700">R$ {valorPerdido.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* BLOCO: CONTROLE DE VALIDADE */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-4 border-b">
              <h2 className="font-bold text-slate-700">Controle de Validade</h2>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-500 mb-1">Vencendo em 7 dias</p>
                <p className="text-3xl font-bold text-orange-600">{vencendo7} <span className="text-sm font-normal text-slate-400">lotes</span></p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Vencendo em 15 dias</p>
                <p className="text-3xl font-bold text-yellow-600">{vencendo15} <span className="text-sm font-normal text-slate-400">lotes</span></p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Lotes Vencidos</p>
                <p className="text-3xl font-bold text-red-600">{vencidos} <span className="text-sm font-normal text-slate-400">lotes</span></p>
              </div>
            </div>
          </div>

          {/* BLOCO: MOVIMENTAÇÃO GERAL */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-4 border-b">
              <h2 className="font-bold text-slate-700">Volume de Movimentações Físicas</h2>
            </div>
            <div className="p-6 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-500 mb-1">Entradas</p>
                <p className="text-2xl font-bold text-green-600">{contagemMovs.entradas}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Saídas (Vendas)</p>
                <p className="text-2xl font-bold text-blue-600">{contagemMovs.saidas}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Transferências</p>
                <p className="text-2xl font-bold text-indigo-600">{contagemMovs.transferencias}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Devoluções</p>
                <p className="text-2xl font-bold text-gray-600">{contagemMovs.devolucoes}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* BLOCO: DESEMPENHO E GIRO */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-4 border-b">
              <h2 className="font-bold text-slate-700">Desempenho (Curva ABC de Vendas)</h2>
            </div>
            <div className="p-0">
              <table className="w-full text-left">
                <tbody>
                  <tr className="bg-slate-50 text-xs text-slate-500"><th className="p-3 font-semibold">Produtos Mais Vendidos</th><th className="p-3 font-semibold text-right">Qtd</th></tr>
                  {topVendas.length > 0 ? topVendas.map((v, i) => (
                    <tr key={i} className="border-b"><td className="p-3 font-medium">{v.nome}</td><td className="p-3 text-right text-green-700 font-bold">{v.qtd}</td></tr>
                  )) : <tr><td colSpan={2} className="p-4 text-center text-sm text-slate-400">Nenhuma venda registrada ainda.</td></tr>}
                  
                  <tr className="bg-slate-50 text-xs text-slate-500"><th className="p-3 font-semibold pt-4">Produtos Menos Movimentados</th><th className="p-3 font-semibold text-right pt-4">Status</th></tr>
                  {produtosMenosMovimentados.length > 0 ? produtosMenosMovimentados.map((p, i) => (
                    <tr key={i} className="border-b"><td className="p-3 text-gray-600">{p.nome}</td><td className="p-3 text-right text-red-500 text-xs font-bold">Sem vendas</td></tr>
                  )) : <tr><td colSpan={2} className="p-4 text-center text-sm text-slate-400">Todos os produtos estão girando.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* BLOCO: COMPRAS E FORNECEDORES */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-4 border-b">
              <h2 className="font-bold text-slate-700">Indicadores de Compras</h2>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 pb-6 border-b">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Total de Pedidos Recebidos</p>
                  <p className="text-3xl font-bold text-slate-800">{comprasRealizadas}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500 mb-1">Capital Investido (Valor Comprado)</p>
                  <p className="text-3xl font-bold text-green-700">R$ {valorComprado.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-sm text-slate-600">
                <p><strong>Giro de Estoque da Rede:</strong> <span className="text-blue-600 font-bold">{contagemMovs.saidas > 0 ? ((contagemMovs.saidas / (produtos?.length || 1)) * 100).toFixed(1) : 0}%</span> (Volume médio rodado por SKU ativo).</p>
                <p className="mt-2"><strong>Taxa de Ruptura atual:</strong> <span className="text-red-600 font-bold">{produtos?.length ? ((produtosSemEstoque / produtos.length) * 100).toFixed(1) : 0}%</span> do catálogo está zerado.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
