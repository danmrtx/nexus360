-- MIGRATION: Adicionar Custo Unitário no Lote e atualizar RPC

-- 1. Adicionar coluna na tabela lotes
ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(10,2) DEFAULT 0;

-- 2. Atualizar a RPC para receber o custo
CREATE OR REPLACE FUNCTION registrar_entrada(
    p_produto_id UUID, p_fornecedor_id UUID, p_unidade_id UUID,
    p_numero_lote TEXT, p_nota_fiscal TEXT, p_quantidade NUMERIC,
    p_validade DATE, p_fabricacao DATE, p_usuario_id UUID,
    p_custo_unitario NUMERIC DEFAULT 0
) RETURNS UUID AS $$
DECLARE
    v_lote_id UUID;
BEGIN
    -- Verifica se lote existe (na mesma NF/Fornecedor)
    SELECT id INTO v_lote_id FROM public.lotes 
    WHERE numero_lote = p_numero_lote AND produto_id = p_produto_id AND fornecedor_id = p_fornecedor_id;

    -- Se não existe, cria
    IF v_lote_id IS NULL THEN
        INSERT INTO public.lotes (
            produto_id, fornecedor_id, numero_lote, nota_fiscal, 
            data_entrada, data_fabricacao, data_validade, custo_unitario
        )
        VALUES (
            p_produto_id, p_fornecedor_id, p_numero_lote, p_nota_fiscal, 
            CURRENT_DATE, p_fabricacao, p_validade, p_custo_unitario
        )
        RETURNING id INTO v_lote_id;
    END IF;

    -- Atualiza estoque_lote
    INSERT INTO public.estoque_lote (lote_id, unidade_id, quantidade)
    VALUES (v_lote_id, p_unidade_id, p_quantidade)
    ON CONFLICT (lote_id, unidade_id) 
    DO UPDATE SET quantidade = public.estoque_lote.quantidade + EXCLUDED.quantidade;

    -- Registra movimentação
    INSERT INTO public.movimentacoes (tipo, lote_id, unidade_id, quantidade, usuario_id, documento_referencia)
    VALUES ('entrada', v_lote_id, p_unidade_id, p_quantidade, p_usuario_id, p_nota_fiscal);

    RETURN v_lote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
