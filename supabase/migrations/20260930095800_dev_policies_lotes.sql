-- MIGRATION: Liberar leitura de lotes e estoques para dev

CREATE POLICY "Dev_All_Lotes" ON public.lotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev_All_Estoque" ON public.estoque_lote FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev_All_Movs" ON public.movimentacoes FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.lotes TO anon, authenticated;
GRANT ALL ON public.estoque_lote TO anon, authenticated;
GRANT ALL ON public.movimentacoes TO anon, authenticated;
