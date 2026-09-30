-- MIGRATION: RPC para processamento automático de transferência com FEFO

CREATE OR REPLACE FUNCTION processar_transferencia(p_transferencia_id UUID, p_usuario_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_transf RECORD;
    v_lote RECORD;
    v_falta NUMERIC;
    v_retirar NUMERIC;
BEGIN
    -- Pegar dados da transferencia
    SELECT * INTO v_transf FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
    
    IF v_transf.status = 'Recebida' THEN 
        RAISE EXCEPTION 'Esta transferência já foi recebida.';
    END IF;

    v_falta := v_transf.quantidade;

    -- Aplicar FEFO na unidade de origem
    FOR v_lote IN 
        SELECT l.id, el.quantidade - el.quantidade_reservada AS disponivel
        FROM public.lotes l
        JOIN public.estoque_lote el ON l.id = el.lote_id
        WHERE l.produto_id = v_transf.produto_id 
          AND el.unidade_id = v_transf.unidade_origem 
          AND l.status = 'Normal'
          AND (el.quantidade - el.quantidade_reservada) > 0
        ORDER BY l.data_validade ASC NULLS LAST
    LOOP
        IF v_falta <= 0 THEN 
            EXIT; 
        END IF;

        IF v_lote.disponivel >= v_falta THEN
            v_retirar := v_falta;
            v_falta := 0;
        ELSE
            v_retirar := v_lote.disponivel;
            v_falta := v_falta - v_retirar;
        END IF;

        -- 1. Baixar da origem
        UPDATE public.estoque_lote 
        SET quantidade = quantidade - v_retirar 
        WHERE lote_id = v_lote.id AND unidade_id = v_transf.unidade_origem;
        
        INSERT INTO public.movimentacoes (tipo, lote_id, unidade_id, quantidade, usuario_id, documento_referencia) 
        VALUES ('transferencia_saida', v_lote.id, v_transf.unidade_origem, v_retirar, p_usuario_id, p_transferencia_id::text);

        -- 2. Dar entrada no destino
        INSERT INTO public.estoque_lote (lote_id, unidade_id, quantidade) 
        VALUES (v_lote.id, v_transf.unidade_destino, v_retirar)
        ON CONFLICT (lote_id, unidade_id) 
        DO UPDATE SET quantidade = public.estoque_lote.quantidade + EXCLUDED.quantidade;
        
        INSERT INTO public.movimentacoes (tipo, lote_id, unidade_id, quantidade, usuario_id, documento_referencia) 
        VALUES ('transferencia_entrada', v_lote.id, v_transf.unidade_destino, v_retirar, p_usuario_id, p_transferencia_id::text);
    END LOOP;

    -- Se não conseguiu retirar tudo, falha a transação inteira
    IF v_falta > 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente na origem para concluir a transferência. Faltaram % unidades.', v_falta;
    END IF;

    -- Atualizar status da transferência
    UPDATE public.transferencias SET status = 'Recebida', updated_at = now() WHERE id = p_transferencia_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir acesso para desenvolvimento
CREATE POLICY "Dev_All_Transferencias" ON public.transferencias FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.transferencias TO anon, authenticated;
