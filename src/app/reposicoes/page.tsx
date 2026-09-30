import { createClient } from "@/utils/supabase-server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function ReposicoesPage() {
  const supabase = createClient();

  // 1. Busca dados do Banco
  const { data: produtos } = await supabase.from("produtos").select("*, fornecedores(razao_social)");
  const { data: unidades } = await supabase.from("unidades").select("*");
  const { data: reposicoes } = await supabase.from("reposicoes").select("*, produtos(nome, sku), fornecedores(razao_social), unidades(nome)").order("created_at", { ascending: false });
  const { data: transferencias } = await supabase.from("transferencias").select("produto_id, unidade_destino, quantidade").in("status", ["Sugerida", "Aprovada", "Em transito"]);

  const { data: saldosLotes } = await supabase
    .from("estoque_lote")
    .select(`quantidade, quantidade_reservada, unidade_id, lotes ( produto_id )`)
    .gt("quantidade", 0);

  // 2. Inteligência de Reposição (Cálculo em Memória)
  const estoquePorUnidadeProduto = new Map<string, number>(); // key: unidade_id + "_" + produto_id
  const estoqueGlobalPorProduto = new Map<string, { unidade_id: string, excedente: number }[]>();

  // Agrupar saldos físicos
  saldosLotes?.forEach((item: any) => {
    const prodId = item.lotes?.produto_id;
    if (!prodId) return;
    const key = `${item.unidade_id}_${prodId}`;
    const disponivel = Number(item.quantidade) - Number(item.quantidade_reservada);
    estoquePorUnidadeProduto.set(key, (estoquePorUnidadeProduto.get(key) || 0) + disponivel);
  });

  // Calcular excedentes
  unidades?.forEach(u => {
    produtos?.forEach(p => {
      const key = `${u.id}_${p.id}`;
      const saldo = estoquePorUnidadeProduto.get(key) || 0;
      if (saldo > p.estoque_minimo) {
        const excedentesArray = estoqueGlobalPorProduto.get(p.id) || [];
        excedentesArray.push({ unidade_id: u.id, excedente: saldo - p.estoque_minimo });
        estoqueGlobalPorProduto.set(p.id, excedentesArray);
      }
    });
  });

  // Gerar Sugestões de Ação
  const alertas: any[] = [];
  unidades?.forEach(u => {
    produtos?.forEach(p => {
      const key = `${u.id}_${p.id}`;
      const saldoAtual = estoquePorUnidadeProduto.get(key) || 0;

      // Somar pedidos/transferencias a caminho para não duplicar sugestão
      const pendenteTranf = transferencias?.filter(t => t.produto_id === p.id && t.unidade_destino === u.id).reduce((acc, t) => acc + Number(t.quantidade), 0) || 0;
      const pendenteCompra = reposicoes?.filter(r => r.produto_id === p.id && r.unidade_id === u.id && r.status !== 'Recebida' && r.status !== 'Cancelada').reduce((acc, r) => acc + Number(r.quantidade), 0) || 0;
      
      const saldoProjetado = saldoAtual + pendenteTranf + pendenteCompra;

      if (saldoProjetado < p.estoque_minimo) {
        const qtdSugerida = (p.estoque_maximo > 0 ? p.estoque_maximo : p.estoque_minimo * 2) - saldoProjetado;
        
        // Verifica se há excedente em outra unidade
        const excedentes = estoqueGlobalPorProduto.get(p.id)?.filter(e => e.unidade_id !== u.id) || [];
        
        if (excedentes.length > 0) {
          // Tem excesso em outra unidade -> Sugerir Transferência
          const origem = unidades.find(un => un.id === excedentes[0].unidade_id);
          const qtdPossivel = Math.min(qtdSugerida, excedentes[0].excedente);
          alertas.push({
            tipo: 'transferencia',
            produto: p,
            unidadeDestino: u,
            unidadeOrigem: origem,
            saldo: saldoAtual,
            projetado: saldoProjetado,
            sugerido: qtdPossivel,
            motivo: `Abaixo do mínimo. Unidade ${origem?.nome} possui excedente.`
          });
        } else {
          // Não tem excesso -> Sugerir Compra
          alertas.push({
            tipo: 'compra',
            produto: p,
            unidadeDestino: u,
            fornecedor: p.fornecedor_principal,
            nomeFornecedor: p.fornecedores?.razao_social || 'Sem fornecedor padrão',
            saldo: saldoAtual,
            projetado: saldoProjetado,
            sugerido: qtdSugerida,
            motivo: `Abaixo do mínimo. Nenhum excedente na rede.`
          });
        }
      }
    });
  });

  // ACTIONS

  async function aprovarTransferencia(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("transferencias").insert([{
      produto_id: formData.get("produto_id"),
      unidade_origem: formData.get("origem_id"),
      unidade_destino: formData.get("destino_id"),
      quantidade: Number(formData.get("quantidade")),
      status: 'Sugerida'
    }]);
    revalidatePath("/reposicoes");
  }

  async function aprovarCompra(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("reposicoes").insert([{
      produto_id: formData.get("produto_id"),
      fornecedor_id: formData.get("fornecedor_id"),
      unidade_id: formData.get("unidade_id"),
      quantidade: Number(formData.get("quantidade")),
      status: 'Aprovada'
    }]);
    revalidatePath("/reposicoes");
  }

  async function mudarStatusCompra(formData: FormData) {
    "use server";
    const id = formData.get("id");
    const novoStatus = formData.get("status");
    const supabase = createClient();
    await supabase.from("reposicoes").update({ status: novoStatus }).eq("id", id);
    revalidatePath("/reposicoes");
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-orange-600">Central de Reposição Automática</h1>
            <p className="text-gray-500 mt-1">Análise inteligente de rupturas e sugestões de abastecimento</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline px-4 py-2">Voltar à Home</Link>
        </div>

        {/* 1. Alertas e Sugestões Automáticas */}
        <div className="bg-white rounded-xl shadow-lg border-t-4 border-orange-500 mb-8 overflow-hidden">
          <div className="p-4 bg-orange-50 border-b">
            <h2 className="font-bold text-orange-800 text-lg">⚠️ Alertas de Ruptura (Sugestões do Sistema)</h2>
            <p className="text-sm text-orange-600">O sistema calculou o Saldo Atual + Pedidos em Andamento e identificou os itens abaixo do mínimo.</p>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b text-gray-600 text-sm">
                <th className="p-4 font-semibold">Local de Falta</th>
                <th className="p-4 font-semibold">Produto</th>
                <th className="p-4 font-semibold text-center">Físico / Mín</th>
                <th className="p-4 font-semibold">Diagnóstico & Origem</th>
                <th className="p-4 font-semibold text-right">Qtd Sugerida</th>
                <th className="p-4 font-semibold text-center">Ação Recomendada</th>
              </tr>
            </thead>
            <tbody>
              {alertas.length > 0 ? (
                alertas.map((a, i) => (
                  <tr key={i} className="border-b hover:bg-orange-50 transition">
                    <td className="p-4 font-medium">{a.unidadeDestino?.nome}</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{a.produto?.nome}</div>
                      <div className="text-xs text-gray-500">{a.produto?.sku}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-red-600 font-bold">{a.saldo}</span> / <span className="text-gray-500">{a.produto?.estoque_minimo}</span>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-medium text-gray-700">{a.motivo}</div>
                      {a.tipo === 'compra' && <div className="text-xs text-blue-600 font-bold mt-1">Cotar com: {a.nomeFornecedor}</div>}
                    </td>
                    <td className="p-4 text-right font-bold text-lg">{a.sugerido}</td>
                    <td className="p-4 text-center">
                      {a.tipo === 'transferencia' ? (
                        <form action={aprovarTransferencia}>
                          <input type="hidden" name="produto_id" value={a.produto.id} />
                          <input type="hidden" name="origem_id" value={a.unidadeOrigem.id} />
                          <input type="hidden" name="destino_id" value={a.unidadeDestino.id} />
                          <input type="hidden" name="quantidade" value={a.sugerido} />
                          <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded text-xs font-bold shadow hover:bg-indigo-700">
                            Aprovar Transf.
                          </button>
                        </form>
                      ) : (
                        <form action={aprovarCompra}>
                          <input type="hidden" name="produto_id" value={a.produto.id} />
                          <input type="hidden" name="fornecedor_id" value={a.fornecedor || ""} />
                          <input type="hidden" name="unidade_id" value={a.unidadeDestino.id} />
                          <input type="hidden" name="quantidade" value={a.sugerido} />
                          <button type="submit" disabled={!a.fornecedor} className="bg-green-600 text-white px-3 py-2 rounded text-xs font-bold shadow hover:bg-green-700 disabled:bg-gray-400">
                            {a.fornecedor ? 'Gerar Pedido Compra' : 'Falta Fornecedor'}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 bg-gray-50">
                    <span className="text-2xl block mb-2">🎉</span>
                    Todos os estoques estão saudáveis e acima do mínimo! Nenhuma reposição necessária.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Pedidos de Compra Aprovados */}
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="p-4 bg-gray-100 border-b">
            <h3 className="font-bold text-gray-700 text-lg">Pedidos de Compra em Andamento</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 text-sm">
                <th className="p-4 font-semibold">Data Pedido</th>
                <th className="p-4 font-semibold">Produto</th>
                <th className="p-4 font-semibold">Fornecedor</th>
                <th className="p-4 font-semibold">Destino</th>
                <th className="p-4 font-semibold text-right">Qtd</th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-center">Mover Etapa</th>
              </tr>
            </thead>
            <tbody>
              {reposicoes && reposicoes.length > 0 ? (
                reposicoes.map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-4 text-gray-600">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 font-bold text-gray-900">{r.produtos?.nome}</td>
                    <td className="p-4 text-gray-600">{r.fornecedores?.razao_social}</td>
                    <td className="p-4">{r.unidades?.nome}</td>
                    <td className="p-4 text-right font-bold text-green-700">{r.quantidade}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        r.status === 'Aprovada' ? 'bg-blue-100 text-blue-700'
                        : r.status === 'Enviada' ? 'bg-purple-100 text-purple-700'
                        : r.status === 'Recebida' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <form action={mudarStatusCompra} className="flex flex-col gap-1 items-center">
                        <input type="hidden" name="id" value={r.id} />
                        {r.status === 'Aprovada' && (
                          <button type="submit" name="status" value="Enviada" className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded font-bold">Marcar p/ Enviada</button>
                        )}
                        {r.status === 'Enviada' && (
                          <button type="submit" name="status" value="Recebida" className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded font-bold">Concluir (NF Recebida)</button>
                        )}
                        {r.status !== 'Recebida' && r.status !== 'Cancelada' && (
                          <button type="submit" name="status" value="Cancelada" className="text-[10px] text-red-500 hover:underline mt-1">Cancelar</button>
                        )}
                        {r.status === 'Recebida' && <span className="text-xs text-gray-400">Finalizado</span>}
                      </form>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">Nenhum pedido de compra gerado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
