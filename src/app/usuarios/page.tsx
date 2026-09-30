import { createClient } from "@/utils/supabase-server";
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { requireAuth, canManageUsers } from "@/utils/permissions";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function UsuariosPage() {
  const supabase = createClient();
  const { user, perfil: meuPerfil } = await requireAuth();

  // 1. Validar se é administrador
  if (!canManageUsers(meuPerfil.papel)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10 bg-slate-50">
        <div className="text-center max-w-md bg-white p-8 rounded-xl shadow border">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Acesso Negado</h1>
          <p className="text-slate-600 mb-6">Apenas o Administrador pode acessar o controle e cadastro de usuários.</p>
          <Link href="/" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition">
            Voltar para o Início
          </Link>
        </div>
      </div>
    );
  }

  // 2. Buscar usuários e unidades de forma robusta e desacoplada
  let rawUsuarios: any[] = [];
  const { data: perfisData } = await supabase
    .from("perfis")
    .select("*")
    .order("created_at", { ascending: false });

  if (perfisData && perfisData.length > 0) {
    rawUsuarios = [...perfisData];
  }

  const adminClient = getSupabaseAdmin();
  const emailMap = new Map<string, string>();
  if (user?.id && user?.email) {
    emailMap.set(user.id, user.email);
  }

  if (adminClient) {
    if (rawUsuarios.length === 0) {
      const { data: adminPerfis } = await adminClient
        .from("perfis")
        .select("*")
        .order("created_at", { ascending: false });
      if (adminPerfis && adminPerfis.length > 0) {
        rawUsuarios = [...adminPerfis];
      }
    }

    try {
      const { data: authData } = await adminClient.auth.admin.listUsers();
      if (authData?.users) {
        for (const u of authData.users) {
          if (u.id && u.email) {
            emailMap.set(u.id, u.email);
          }
          const exists = rawUsuarios.some((p: any) => p.id === u.id);
          if (!exists) {
            const nome = u.user_metadata?.nome || u.user_metadata?.full_name || (u.email === 'danielmartins30@icloud.com' ? 'Daniel Martins' : u.email?.split('@')[0]) || "Usuário";
            const papel = (u.email === 'danielmartins30@icloud.com' || u.email?.includes('admin')) ? 'Administrador' : (u.user_metadata?.papel || 'Operador');
            const { data: createdP } = await adminClient.from("perfis").insert([{
              id: u.id,
              nome,
              papel,
              status: 'Ativo'
            }]).select("*").maybeSingle();
            if (createdP) {
              rawUsuarios.push(createdP);
            }
          }
        }
      }
    } catch (e) {
      console.error("Erro ao sincronizar contas com auth.users:", e);
    }
  }

  // Garante que o perfil do usuário atual esteja presente
  if (meuPerfil && !rawUsuarios.some((p: any) => p.id === meuPerfil.id)) {
    rawUsuarios.unshift(meuPerfil);
  }

  const { data: unidades } = await supabase
    .from("unidades")
    .select("id, nome, tipo")
    .order("nome");

  const unidadesMap = new Map((unidades || []).map((u: any) => [u.id, u]));

  const usuarios = rawUsuarios.map((u: any) => ({
    ...u,
    email: emailMap.get(u.id) || u.email || null,
    unidades: u.unidade_id ? (unidadesMap.get(u.unidade_id) || null) : null
  }));

  // 3. Action para cadastrar novo usuário
  async function criarUsuario(formData: FormData) {
    "use server";
    const { perfil: actionPerfil } = await requireAuth();
    if (!canManageUsers(actionPerfil.papel)) {
      throw new Error("Apenas o Administrador pode criar usuários.");
    }

    const nome = formData.get("nome") as string;
    const email = formData.get("email") as string;
    const senha = formData.get("senha") as string;
    const papel = formData.get("papel") as string;
    const unidade_id = (formData.get("unidade_id") as string) || null;

    if (!nome || !email || !senha || !papel) {
      throw new Error("Preencha todos os campos obrigatórios.");
    }

    if (senha.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres.");
    }

    if ((papel === 'Gerente de Loja' || papel === 'Operador') && !unidade_id) {
      throw new Error("Para Gerente de Loja e Operador, a seleção de uma Unidade é obrigatória.");
    }

    const adminClient = getSupabaseAdmin();
    if (adminClient) {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome, papel }
      });

      if (authError) {
        throw new Error("Erro ao criar autenticação: " + authError.message);
      }

      if (authData?.user) {
        const { error: perfilError } = await adminClient.from("perfis").upsert({
          id: authData.user.id,
          nome,
          papel,
          unidade_id: unidade_id,
          status: 'Ativo'
        });

        if (perfilError) {
          throw new Error("Erro ao criar perfil: " + perfilError.message);
        }
      }
    } else {
      const supabaseClient = createClient();
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome, papel }
        }
      });

      if (authError) {
        throw new Error("Erro ao registrar: " + authError.message);
      }

      if (authData?.user) {
        await supabaseClient.from("perfis").upsert({
          id: authData.user.id,
          nome,
          papel,
          unidade_id: unidade_id,
          status: 'Ativo'
        });
      }
    }

    revalidatePath("/usuarios");
  }

  // 4. Action para atualizar cargo e unidade
  async function atualizarUsuario(formData: FormData) {
    "use server";
    const { perfil: actionPerfil, user: actionUser } = await requireAuth();
    if (!canManageUsers(actionPerfil.papel)) {
      throw new Error("Apenas o Administrador pode alterar usuários.");
    }

    const userId = formData.get("user_id") as string;
    const novoPapel = formData.get("papel") as string;
    const novaUnidade = (formData.get("unidade_id") as string) || null;

    if (userId === actionUser.id) {
      throw new Error("Você não pode alterar seu próprio cargo.");
    }

    const supabaseAction = createClient();
    await supabaseAction
      .from("perfis")
      .update({ papel: novoPapel, unidade_id: novaUnidade })
      .eq("id", userId);
    
    revalidatePath("/usuarios");
  }

  // 5. Action para alternar status (Ativar / Bloquear)
  async function alternarStatus(formData: FormData) {
    "use server";
    const { perfil: actionPerfil, user: actionUser } = await requireAuth();
    if (!canManageUsers(actionPerfil.papel)) {
      throw new Error("Apenas o Administrador pode bloquear usuários.");
    }

    const userId = formData.get("user_id") as string;
    const statusAtual = formData.get("status_atual") as string;

    if (userId === actionUser.id) {
      throw new Error("Você não pode inativar sua própria conta de Administrador.");
    }

    const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';

    const supabaseAction = createClient();
    await supabaseAction
      .from("perfis")
      .update({ status: novoStatus })
      .eq("id", userId);

    revalidatePath("/usuarios");
  }

  return (
    <main className="min-h-screen p-8 md:p-10 bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Controle de Usuários e Permissões</h1>
            <p className="text-slate-500 mt-1">Gerencie os acessos, cargos e lotação por unidade dos funcionários</p>
          </div>
          <Link href="/" className="text-blue-600 hover:underline px-4 py-2 font-medium">← Voltar à Home</Link>
        </div>

        {/* FORMULÁRIO DE CADASTRO DE NOVO FUNCIONÁRIO */}
        <div className="bg-white rounded-xl shadow border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b flex items-center gap-2">
            <span>👤</span> Cadastrar Novo Funcionário
          </h2>
          <form action={criarUsuario} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo *</label>
              <input type="text" name="nome" required placeholder="Ex: Carlos Silva" className="w-full border rounded p-2 text-sm bg-slate-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email de Acesso *</label>
              <input type="email" name="email" required placeholder="carlos@empresa.com" className="w-full border rounded p-2 text-sm bg-slate-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Senha Inicial * (mín. 6 dígitos)</label>
              <input type="password" name="senha" required minLength={6} placeholder="••••••" className="w-full border rounded p-2 text-sm bg-slate-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo / Nível de Acesso *</label>
              <select name="papel" required className="w-full border rounded p-2 text-sm bg-slate-50 font-medium">
                <option value="Operador">Operador (Apenas movimentações da unidade)</option>
                <option value="Gerente de Loja">Gerente de Loja (Gestão da própria loja)</option>
                <option value="Gestor de Estoque">Gestor de Estoque (Decisões de rede)</option>
                <option value="Administrador">Administrador (Controle total)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Unidade de Lotação (Obrigatório para Gerente e Operador)
              </label>
              <select name="unidade_id" className="w-full border rounded p-2 text-sm bg-slate-50">
                <option value="">Nenhuma / Visão Geral da Rede</option>
                {unidades?.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.tipo}: {u.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition text-sm shadow">
                Criar Usuário
              </button>
            </div>
          </form>
        </div>

        {/* TABELA DE USUÁRIOS EXISTENTES */}
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-100 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Funcionários Cadastrados ({usuarios?.length || 0})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-600 text-xs uppercase">
                  <th className="p-4 font-semibold">Funcionário</th>
                  <th className="p-4 font-semibold">Cargo</th>
                  <th className="p-4 font-semibold">Unidade de Lotação</th>
                  <th className="p-4 font-semibold text-center">Status</th>
                  <th className="p-4 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios?.map((u: any) => {
                  const isCurrentUser = u.id === user.id;
                  const roleColor = 
                    u.papel === 'Administrador' ? 'bg-red-50 text-red-700 border-red-200' :
                    u.papel === 'Gestor de Estoque' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    u.papel === 'Gerente de Loja' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200';

                  return (
                    <tr key={u.id} className="border-b hover:bg-slate-50 transition text-sm">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {u.nome}
                          {isCurrentUser && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold">
                              Você
                            </span>
                          )}
                        </div>
                        {u.email && (
                          <div className="text-xs text-slate-500 font-medium">
                            {u.email}
                          </div>
                        )}
                        <div className="text-xs text-slate-400">
                          {u.created_at ? `Cadastrado em: ${new Date(u.created_at).toLocaleDateString('pt-BR')}` : ''}
                        </div>
                      </td>

                      <td className="p-4">
                        <form action={atualizarUsuario} className="flex items-center gap-2">
                          <input type="hidden" name="user_id" value={u.id} />
                          <select 
                            name="papel" 
                            defaultValue={u.papel} 
                            disabled={isCurrentUser}
                            className={"border rounded p-1.5 text-xs font-semibold " + roleColor}
                          >
                            <option value="Administrador">Administrador</option>
                            <option value="Gestor de Estoque">Gestor de Estoque</option>
                            <option value="Gerente de Loja">Gerente de Loja</option>
                            <option value="Operador">Operador</option>
                          </select>

                          <select
                            name="unidade_id"
                            defaultValue={u.unidade_id || ""}
                            disabled={isCurrentUser}
                            className="border rounded p-1.5 text-xs bg-slate-50 text-slate-700 max-w-[150px]"
                          >
                            <option value="">Rede (Sem loja fixa)</option>
                            {unidades?.map((un: any) => (
                              <option key={un.id} value={un.id}>{un.nome}</option>
                            ))}
                          </select>

                          {!isCurrentUser && (
                            <button type="submit" className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 px-2.5 py-1.5 rounded font-bold transition">
                              Salvar
                            </button>
                          )}
                        </form>
                      </td>

                      <td className="p-4 text-xs font-medium text-slate-600">
                        {u.unidades?.nome ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            📍 {u.unidades.nome} ({u.unidades.tipo})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">🌐 Global (Todas)</span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className={"px-2 py-1 rounded text-xs font-bold " + (u.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {u.status}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {!isCurrentUser ? (
                          <form action={alternarStatus}>
                            <input type="hidden" name="user_id" value={u.id} />
                            <input type="hidden" name="status_atual" value={u.status} />
                            <button 
                              type="submit" 
                              className={"text-xs px-3 py-1 rounded font-bold transition " + (
                                u.status === 'Ativo' 
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                                  : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                              )}
                            >
                              {u.status === 'Ativo' ? 'Inativar' : 'Ativar'}
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
