-- MIGRATION: Políticas liberadas temporariamente para ambiente de desenvolvimento (Fase 2)

-- Unidades
CREATE POLICY "Dev_All_Unidades" ON public.unidades FOR ALL USING (true) WITH CHECK (true);
-- Fornecedores
CREATE POLICY "Dev_All_Fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);
-- Produtos
CREATE POLICY "Dev_All_Produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

-- Garantir que anon (usuários não logados) e authenticated tenham acesso
GRANT ALL ON public.unidades TO anon, authenticated;
GRANT ALL ON public.fornecedores TO anon, authenticated;
GRANT ALL ON public.produtos TO anon, authenticated;
