-- MIGRATION: Liberar leitura e escrita da tabela de reposicoes para desenvolvimento

CREATE POLICY "Dev_All_Reposicoes" ON public.reposicoes FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.reposicoes TO anon, authenticated;
