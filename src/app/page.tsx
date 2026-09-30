import { createClient } from "@/utils/supabase-server";
import { requireAuth, isOperador, isGerente, canAccessReplenishments, canAccessReports } from "@/utils/permissions";
import Link from "next/link";

export default async function Home() {
  const supabase = createClient();
  const { user, perfil } = await requireAuth();

  const userUnidadeId = perfil.unidade_id;
  const isScoped = (isOperador(perfil.papel) || isGerente(perfil.papel)) && !!userUnidadeId;

  // Buscar dados para o Dashboard
  const { data: lotes } = await supabase
    .from("lotes")
    .select("data_validade, status, custo_unitario, estoque_lote(quantidade, quantidade_reservada, unidade_id)");

  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, estoque_minimo, estoque_lote(quantidade, quantidade_reservada, unidade_id)");

  // Transferências pendentes (filtradas se estiver no escopo da loja)
  let transfQuery = supabase
    .from("transferencias")
    .select("*", { count: "exact", head: true })
    .in("status", ["Sugerida", "Aprovada"]);

  if (isScoped) {
    transfQuery = transfQuery.or(`unidade_origem.eq.${userUnidadeId},unidade_destino.eq.${userUnidadeId}`);
  }
  const { count: transferenciasPendentes } = await transfQuery;

  // Reposições pendentes (filtradas se estiver no escopo da loja)
  let repoQuery = supabase
    .from("reposicoes")
    .select("*", { count: "exact", head: true })
    .in("status", ["Sugerida", "Aprovada"]);

  if (isScoped) {
    repoQuery = repoQuery.eq("unidade_id", userUnidadeId);
  }
  const { count: reposicoesPendentes } = await repoQuery;

  let valorTotalEstoque = 0;
  let valorEmRisco = 0;
  let lotesProximosVencimento = 0;
  let lotesVencidos = 0;
  let estoqueCritico = 0;

  const hoje = new Date().getTime();
  const DAY_MS = 1000 * 3600 * 24;

  lotes?.forEach((l: any) => {
    let qtdLote = 0;
    l.estoque_lote?.forEach((el: any) => {
      if (!isScoped || el.unidade_id === userUnidadeId) {
        qtdLote += Number(el.quantidade);
      }
    });
    const valorLote = qtdLote * Number(l.custo_unitario || 0);
    valorTotalEstoque += valorLote;

    if (l.data_validade && qtdLote > 0) {
      const dias = Math.ceil((new Date(l.data_validade).getTime() - hoje) / DAY_MS);
      if (dias < 0 || l.status === 'Vencido') {
        lotesVencidos++;
        valorEmRisco += valorLote;
      } else if (dias <= 15) {
        lotesProximosVencimento++;
        valorEmRisco += valorLote;
      }
    }
  });

  produtos?.forEach((p: any) => {
    let saldoTotal = 0;
    p.estoque_lote?.forEach((el: any) => {
      if (!isScoped || el.unidade_id === userUnidadeId) {
        saldoTotal += (Number(el.quantidade) - Number(el.quantidade_reservada));
      }
    });
    if (saldoTotal < p.estoque_minimo) {
      estoqueCritico++;
    }
  });

  return (
    <main className="min-h-screen p-8 bg-slate-100 font-[family-name:var(--font-geist-sans)]">
      
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Painel Principal</h1>
        <p className="text-slate-500">Resumo da operação Nexus360</p>
      </div>

      {/* DASHBOARD INDICADORES (Item 12 do PDF) */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">📦 Estoque total</p>
          <p className="text-2xl font-bold text-slate-800">R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-red-600">
          <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">🔴 Estoque crítico</p>
          <p className="text-2xl font-bold text-slate-800">{estoqueCritico} <span className="text-sm font-normal text-slate-400">produtos</span></p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-yellow-400">
          <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">🟡 Próximos do vencimento</p>
          <p className="text-2xl font-bold text-slate-800">{lotesProximosVencimento} <span className="text-sm font-normal text-slate-400">lotes</span></p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-black">
          <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">⚫ Produtos vencidos</p>
          <p className="text-2xl font-bold text-slate-800">{lotesVencidos} <span className="text-sm font-normal text-slate-400">lotes</span></p>
        </div>

        {!isOperador(perfil.papel) && (
          <>
            <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-indigo-500">
              <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">🚚 Transferências pendentes</p>
              <p className="text-2xl font-bold text-slate-800">{transferenciasPendentes || 0}</p>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-orange-500">
              <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">🛒 Reposições pendentes</p>
              <p className="text-2xl font-bold text-slate-800">{reposicoesPendentes || 0}</p>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-l-red-800 col-span-2">
              <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">💰 Valor em risco (Vencendo/Vencido)</p>
              <p className="text-2xl font-bold text-red-700">R$ {valorEmRisco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-700">Módulos Disponíveis para seu Perfil</h2>
          <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-semibold">
            {perfil.papel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/estoque" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-blue-300">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-blue-700">Visão de Estoque</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {isOperador(perfil.papel) ? '👁️ Consultar' : '✅ Gerenciar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Acompanhe saldos e consolidação {isScoped ? 'da sua unidade' : 'por CD e Lojas'}.</p>
          </Link>

          <Link href="/lotes" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-purple-300">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-purple-700">Controle de Lotes</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                {isOperador(perfil.papel) ? '✅ Registrar' : '✅ Gerenciar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Rastreabilidade, validade e relação com Notas Fiscais.</p>
          </Link>

          <Link href="/entradas" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-green-300">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-green-700">Nova Entrada</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-700">
                {isOperador(perfil.papel) ? '✅ Registrar' : isGerente(perfil.papel) ? '✅ Aprovar' : '👁️ Visualizar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Recebimento físico de mercadorias com geração de Lote.</p>
          </Link>

          <Link href="/saidas" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-red-300">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-red-700">Saída FEFO (Vendas)</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700">
                {isOperador(perfil.papel) ? '✅ Registrar' : '👁️ Consultar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Baixa inteligente automática priorizando o vencimento.</p>
          </Link>

          {canAccessReplenishments(perfil.papel) && (
            <Link href="/reposicoes" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-orange-300">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold text-orange-700">Central de Reposição</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-700">
                  {isGerente(perfil.papel) ? '✅ Solicitar' : '✅ Gerenciar'}
                </span>
              </div>
              <p className="text-sm text-slate-500">Gestão de compras automáticas e alertas de ruptura.</p>
            </Link>
          )}

          {canAccessReports(perfil.papel) && (
            <Link href="/relatorios" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-pink-300">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold text-pink-700">Relatórios</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-50 text-pink-700">
                  {isGerente(perfil.papel) ? '✅ Da Loja' : '✅ Completo'}
                </span>
              </div>
              <p className="text-sm text-slate-500">Métricas de validade, perdas, giro e desempenho ABC.</p>
            </Link>
          )}

          <Link href="/transferencias" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-indigo-300">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-indigo-700">Transferências</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                {isOperador(perfil.papel) ? '👁️ Consultar' : '✅ Gerenciar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Movimentação física de mercadorias entre unidades.</p>
          </Link>

          <Link href="/produtos" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-slate-500">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-slate-700">Produtos</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {perfil.papel === 'Administrador' ? '✅ Total' : '👁️ Consultar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Cadastro de produtos, categorias, marcas, margens e mínimos.</p>
          </Link>

          <Link href="/fornecedores" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-teal-400">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-teal-700">Fornecedores</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700">
                {perfil.papel === 'Administrador' ? '✅ Total' : '👁️ Consultar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Cadastro e gestão de empresas parceiras e prazos de entrega.</p>
          </Link>

          <Link href="/unidades" className="group rounded-xl p-6 transition-all hover:shadow-md bg-white shadow-sm border border-slate-200 hover:border-cyan-400">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-cyan-700">CDs e Lojas</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-700">
                {perfil.papel === 'Administrador' ? '✅ Total' : '👁️ Consultar'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Gestão da rede, Centros de Distribuição e Pontos de Venda.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
