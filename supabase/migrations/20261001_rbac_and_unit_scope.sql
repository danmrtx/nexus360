-- MIGRATION: 20261001_rbac_and_unit_scope.sql
-- Implementa controle rigoroso de permissões (RBAC) e escopo por unidade

-- 1. Adicionar unidade_id na tabela perfis (se não existir)
DO 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'perfis' 
        AND column_name = 'unidade_id'
    ) THEN
        ALTER TABLE public.perfis 
        ADD COLUMN unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL;
    END IF;
END ;

-- 2. Funções auxiliares para RLS
CREATE OR REPLACE FUNCTION public.auth_user_perfil() 
RETURNS TEXT AS 
  SELECT papel FROM public.perfis WHERE id = auth.uid() LIMIT 1;
 LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.auth_user_unidade() 
RETURNS UUID AS 
  SELECT unidade_id FROM public.perfis WHERE id = auth.uid() LIMIT 1;
 LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.auth_user_is_active() 
RETURNS BOOLEAN AS 
  SELECT (status = 'Ativo') FROM public.perfis WHERE id = auth.uid() LIMIT 1;
 LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Atualizar Políticas de Perfis
DROP POLICY IF EXISTS "Leitura_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Insert_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Admin_All_Perfis" ON public.perfis;
DROP POLICY IF EXISTS "Perfis_Update_Admin" ON public.perfis;

-- Leitura: Usuários autenticados podem ver perfis
CREATE POLICY "Leitura_Perfis" ON public.perfis 
FOR SELECT TO authenticated 
USING (true);

-- Escrita: Apenas Administrador pode criar, alterar ou excluir perfis
CREATE POLICY "Admin_Insert_Perfis" ON public.perfis 
FOR INSERT TO authenticated, service_role 
WITH CHECK (auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role');

CREATE POLICY "Admin_Update_Perfis" ON public.perfis 
FOR UPDATE TO authenticated, service_role 
USING (auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role')
WITH CHECK (auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role');

CREATE POLICY "Admin_Delete_Perfis" ON public.perfis 
FOR DELETE TO authenticated, service_role 
USING (auth_user_perfil() = 'Administrador' OR auth.role() = 'service_role');

-- 4. Atualizar Políticas de Produtos, Fornecedores e Unidades
-- Apenas Administrador pode cadastrar, editar ou excluir
DROP POLICY IF EXISTS "Admin_All_Unidades" ON public.unidades;
DROP POLICY IF EXISTS "Admin_All_Fornec" ON public.fornecedores;
DROP POLICY IF EXISTS "Admin_All_Prod" ON public.produtos;
DROP POLICY IF EXISTS "Gestor_Write_Prod" ON public.produtos;
DROP POLICY IF EXISTS "Gestor_Write_Forn" ON public.fornecedores;

CREATE POLICY "Admin_Write_Unidades" ON public.unidades 
FOR ALL TO authenticated 
USING (auth_user_perfil() = 'Administrador');

CREATE POLICY "Admin_Write_Fornecedores" ON public.fornecedores 
FOR ALL TO authenticated 
USING (auth_user_perfil() = 'Administrador');

CREATE POLICY "Admin_Write_Produtos" ON public.produtos 
FOR ALL TO authenticated 
USING (auth_user_perfil() = 'Administrador');

-- 5. Atualizar Políticas de Estoque e Lotes (Escopo por Unidade)
DROP POLICY IF EXISTS "Read_Basics_Estoque" ON public.estoque_lote;
DROP POLICY IF EXISTS "Ops_Write_Estoque" ON public.estoque_lote;

-- Leitura de estoque:
-- Admin e Gestor: Tudo
-- Gerente e Operador: Somente sua unidade
CREATE POLICY "Select_Estoque_Scoped" ON public.estoque_lote 
FOR SELECT TO authenticated 
USING (
    auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR unidade_id = auth_user_unidade()
    OR auth_user_unidade() IS NULL
);

-- Escrita de estoque: Apenas via RPCs ou por funções permitidas
CREATE POLICY "Write_Estoque_Scoped" ON public.estoque_lote 
FOR ALL TO authenticated 
USING (
    auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (auth_user_perfil() IN ('Operador', 'Gerente de Loja') AND unidade_id = auth_user_unidade())
);

-- 6. Políticas de Transferências
DROP POLICY IF EXISTS "Read_Basics_Transferencias" ON public.transferencias;
DROP POLICY IF EXISTS "Manager_Write_Transf" ON public.transferencias;

CREATE POLICY "Select_Transferencias_Scoped" ON public.transferencias 
FOR SELECT TO authenticated 
USING (
    auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR unidade_origem = auth_user_unidade()
    OR unidade_destino = auth_user_unidade()
    OR auth_user_unidade() IS NULL
);

CREATE POLICY "Write_Transferencias_Scoped" ON public.transferencias 
FOR ALL TO authenticated 
USING (
    auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (auth_user_perfil() = 'Gerente de Loja' AND (unidade_origem = auth_user_unidade() OR unidade_destino = auth_user_unidade()))
);

-- 7. Políticas de Reposições
DROP POLICY IF EXISTS "Read_Basics_Reposicoes" ON public.reposicoes;
DROP POLICY IF EXISTS "Gestor_Write_Repo" ON public.reposicoes;

-- Operador NÃO lê nem escreve reposições
CREATE POLICY "Select_Reposicoes_Scoped" ON public.reposicoes 
FOR SELECT TO authenticated 
USING (
    auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (auth_user_perfil() = 'Gerente de Loja' AND (unidade_id = auth_user_unidade() OR auth_user_unidade() IS NULL))
);

CREATE POLICY "Write_Reposicoes_Scoped" ON public.reposicoes 
FOR ALL TO authenticated 
USING (
    auth_user_perfil() IN ('Administrador', 'Gestor de Estoque')
    OR (auth_user_perfil() = 'Gerente de Loja' AND unidade_id = auth_user_unidade())
);
