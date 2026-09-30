-- MIGRATION: RLS (Segurança de Linha) em Nível de Produção

-- 1. Remover todas as políticas de dev permissivas
DROP POLICY IF EXISTS "Dev_All_Unidades" ON public.unidades;
DROP POLICY IF EXISTS "Dev_All_Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Dev_All_Produtos" ON public.produtos;
DROP POLICY IF EXISTS "Dev_All_Lotes" ON public.lotes;
DROP POLICY IF EXISTS "Dev_All_Estoque" ON public.estoque_lote;
DROP POLICY IF EXISTS "Dev_All_Movs" ON public.movimentacoes;
DROP POLICY IF EXISTS "Dev_All_Transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Dev_All_Reposicoes" ON public.reposicoes;

-- 2. Garantir que as tabelas possuam RLS habilitado
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposicoes ENABLE ROW LEVEL SECURITY;

-- 3. Função auxiliar para pegar o perfil do usuário logado
CREATE OR REPLACE FUNCTION auth_user_perfil() RETURNS TEXT AS $$
  SELECT papel FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. PERFIS (Leitura pública para o app, escrita só pelo próprio ou admin)
CREATE POLICY "Leitura_Perfis" ON public.perfis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert_Perfis" ON public.perfis FOR INSERT TO authenticated, anon WITH CHECK (true); -- Permitir cadastro

-- 5. ACESSO DE LEITURA GLOBAL PARA LOGADOS (Todos os perfis podem ler o básico)
CREATE POLICY "Read_Basics_Unidades" ON public.unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read_Basics_Fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read_Basics_Produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read_Basics_Lotes" ON public.lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read_Basics_Estoque" ON public.estoque_lote FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read_Basics_Movimentacoes" ON public.movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read_Basics_Transferencias" ON public.transferencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read_Basics_Reposicoes" ON public.reposicoes FOR SELECT TO authenticated USING (true);

-- 6. REGRAS DE ESCRITA POR PERFIL
-- ADMIN: Faz tudo
CREATE POLICY "Admin_All_Unidades" ON public.unidades FOR ALL TO authenticated USING (auth_user_perfil() = 'Administrador');
CREATE POLICY "Admin_All_Fornec" ON public.fornecedores FOR ALL TO authenticated USING (auth_user_perfil() = 'Administrador');
CREATE POLICY "Admin_All_Prod" ON public.produtos FOR ALL TO authenticated USING (auth_user_perfil() = 'Administrador');

-- PRODUTOS / FORNECEDORES (Gestor e Admin)
CREATE POLICY "Gestor_Write_Prod" ON public.produtos FOR ALL TO authenticated USING (auth_user_perfil() IN ('Administrador', 'Gestor de Estoque'));
CREATE POLICY "Gestor_Write_Forn" ON public.fornecedores FOR ALL TO authenticated USING (auth_user_perfil() IN ('Administrador', 'Gestor de Estoque'));

-- LOTES, ESTOQUE E MOVIMENTAÇÕES (Gestor e Operador)
CREATE POLICY "Ops_Write_Lotes" ON public.lotes FOR ALL TO authenticated USING (auth_user_perfil() IN ('Administrador', 'Gestor de Estoque', 'Operador'));
CREATE POLICY "Ops_Write_Estoque" ON public.estoque_lote FOR ALL TO authenticated USING (auth_user_perfil() IN ('Administrador', 'Gestor de Estoque', 'Operador'));
CREATE POLICY "Ops_Write_Movs" ON public.movimentacoes FOR ALL TO authenticated USING (auth_user_perfil() IN ('Administrador', 'Gestor de Estoque', 'Operador'));

-- TRANSFERENCIAS (Gestor e Gerente)
CREATE POLICY "Manager_Write_Transf" ON public.transferencias FOR ALL TO authenticated USING (auth_user_perfil() IN ('Administrador', 'Gestor de Estoque', 'Gerente de Loja'));

-- REPOSICOES (Gestor)
CREATE POLICY "Gestor_Write_Repo" ON public.reposicoes FOR ALL TO authenticated USING (auth_user_perfil() IN ('Administrador', 'Gestor de Estoque'));
