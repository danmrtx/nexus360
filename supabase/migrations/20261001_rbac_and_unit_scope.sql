-- ==============================================================================
-- MIGRATION: 20261001_rbac_and_unit_scope.sql
-- Implementa matriz completa de permissões (RBAC) e escopo de acesso por unidade
-- ==============================================================================

-- 1. Adicionar unidade_id na tabela perfis (se não existir)
ALTER TABLE public.perfis 
ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL;

-- 2. Garantir RLS habilitado em todas as tabelas principais
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposicoes ENABLE ROW LEVEL SECURITY;

-- 3. Funções auxiliares de contexto de usuário para RLS
CREATE OR REPLACE FUNCTION public.auth_user_perfil() 
RETURNS TEXT 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_unidade() 
RETURNS UUID 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unidade_id FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_is_active() 
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((status = 'Ativo'), false) FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$;

-- Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.auth_user_perfil() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.auth_user_unidade() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.auth_user_is_active() TO authenticated, service_role, anon;

-- 4. Limpar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Leitura_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Insert_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Admin_All_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Perfis_Update_Admin" ON public.perfis;
DROP POLICY IF EXISTS "Admin_Insert_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Admin_Update_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Admin_Delete_Perfis" ON public.perfis;

DROP POLICY IF EXISTS "Admin_All_Unidades" ON public.unidades;
DROP POLICY IF EXISTS "Admin_All_Fornec" ON public.fornecedores;
DROP POLICY IF EXISTS "Admin_All_Prod" ON public.produtos;
DROP POLICY IF EXISTS "Gestor_Write_Prod" ON public.produtos;
DROP POLICY IF EXISTS "Gestor_Write_Forn" ON public.fornecedores;
DROP POLICY IF EXISTS "Admin_Write_Unidades" ON public.unidades;
DROP POLICY IF EXISTS "Admin_Write_Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admin_Write_Produtos" ON public.produtos;
DROP POLICY IF EXISTS "Dev_All_Unidades" ON public.unidades;
DROP POLICY IF EXISTS "Dev_All_Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Dev_All_Produtos" ON public.produtos;

DROP POLICY IF EXISTS "Read_Basics_Estoque" ON public.estoque_lote;
DROP POLICY IF EXISTS "Ops_Write_Estoque" ON public.estoque_lote;
DROP POLICY IF EXISTS "Dev_All_Estoque" ON public.estoque_lote;
DROP POLICY IF EXISTS "Select_Estoque_Scoped" ON public.estoque_lote;
DROP POLICY IF EXISTS "Write_Estoque_Scoped" ON public.estoque_lote;

DROP POLICY IF EXISTS "Read_Basics_Transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Manager_Write_Transf" ON public.transferencias;
DROP POLICY IF EXISTS "Dev_All_Transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Select_Transferencias_Scoped" ON public.transferencias;
DROP POLICY IF EXISTS "Write_Transferencias_Scoped" ON public.transferencias;

DROP POLICY IF EXISTS "Read_Basics_Reposicoes" ON public.reposicoes;
DROP POLICY IF EXISTS "Gestor_Write_Repo" ON public.reposicoes;
DROP POLICY IF EXISTS "Dev_All_Reposicoes" ON public.reposicoes;
DROP POLICY IF EXISTS "Select_Reposicoes_Scoped" ON public.reposicoes;
DROP POLICY IF EXISTS "Write_Reposicoes_Scoped" ON public.reposicoes;

-- 5. Políticas da tabela PERFIS
-- Leitura para autenticados
CREATE POLICY "Leitura_Perfis" ON public.perfis 
FOR SELECT TO authenticated 
USING (true);

-- Inserção: apenas Administrador ou service_role (criação de usuários)
CREATE POLICY "Admin_Insert_Perfis" ON public.perfis 
FOR INSERT TO authenticated, service_role 
WITH CHECK (public.auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role');

-- Atualização: apenas Administrador ou service_role
CREATE POLICY "Admin_Update_Perfis" ON public.perfis 
FOR UPDATE TO authenticated, service_role 
USING (public.auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role')
WITH CHECK (public.auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role');

-- Exclusão: apenas Administrador ou service_role
CREATE POLICY "Admin_Delete_Perfis" ON public.perfis 
FOR DELETE TO authenticated, service_role 
USING (public.auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role');

-- 6. Políticas de leitura para tabelas de apoio
DROP POLICY IF EXISTS "Read_Basics_Unidades" ON public.unidades;
CREATE POLICY "Read_Basics_Unidades" ON public.unidades FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Read_Basics_Fornecedores" ON public.fornecedores;
CREATE POLICY "Read_Basics_Fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Read_Basics_Produtos" ON public.produtos;
CREATE POLICY "Read_Basics_Produtos" ON public.produtos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Read_Basics_Lotes" ON public.lotes;
CREATE POLICY "Read_Basics_Lotes" ON public.lotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Read_Basics_Movimentacoes" ON public.movimentacoes;
CREATE POLICY "Read_Basics_Movimentacoes" ON public.movimentacoes FOR SELECT TO authenticated USING (true);

-- 7. Políticas de escrita para Cadastros Mestres (Unidades, Fornecedores, Produtos)
-- Exclusivo para Administrador
CREATE POLICY "Admin_Write_Unidades" ON public.unidades 
FOR ALL TO authenticated 
USING (public.auth_user_perfil() = 'Administrador');

CREATE POLICY "Admin_Write_Fornecedores" ON public.fornecedores 
FOR ALL TO authenticated 
USING (public.auth_user_perfil() = 'Administrador');

CREATE POLICY "Admin_Write_Produtos" ON public.produtos 
FOR ALL TO authenticated 
USING (public.auth_user_perfil() = 'Administrador');

-- 8. Políticas para ESTOQUE_LOTE (Escopo por Unidade)
CREATE POLICY "Select_Estoque_Scoped" ON public.estoque_lote 
FOR SELECT TO authenticated 
USING (
    public.auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR unidade_id = public.auth_user_unidade()
    OR public.auth_user_unidade() IS NULL
);

CREATE POLICY "Write_Estoque_Scoped" ON public.estoque_lote 
FOR ALL TO authenticated 
USING (
    public.auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (public.auth_user_perfil() IN ('Operador', 'Gerente de Loja') AND (unidade_id = public.auth_user_unidade() OR public.auth_user_unidade() IS NULL))
);

-- 9. Políticas para TRANSFERENCIAS (Escopo por Unidade)
CREATE POLICY "Select_Transferencias_Scoped" ON public.transferencias 
FOR SELECT TO authenticated 
USING (
    public.auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR unidade_origem = public.auth_user_unidade()
    OR unidade_destino = public.auth_user_unidade()
    OR public.auth_user_unidade() IS NULL
);

CREATE POLICY "Write_Transferencias_Scoped" ON public.transferencias 
FOR ALL TO authenticated 
USING (
    public.auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (public.auth_user_perfil() = 'Gerente de Loja' AND (unidade_origem = public.auth_user_unidade() OR unidade_destino = public.auth_user_unidade()))
);

-- 10. Políticas para REPOSICOES (Escopo por Unidade e Bloqueio de Operador)
CREATE POLICY "Select_Reposicoes_Scoped" ON public.reposicoes 
FOR SELECT TO authenticated 
USING (
    public.auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (public.auth_user_perfil() = 'Gerente de Loja' AND (unidade_id = public.auth_user_unidade() OR public.auth_user_unidade() IS NULL))
);

CREATE POLICY "Write_Reposicoes_Scoped" ON public.reposicoes 
FOR ALL TO authenticated 
USING (
    public.auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (public.auth_user_perfil() = 'Gerente de Loja' AND (unidade_id = public.auth_user_unidade() OR public.auth_user_unidade() IS NULL))
);

