-- MIGRATION: Fase 1 - Arquitetura e Banco de Dados (Nexus360)

-- Extensão para UUIDs (se não ativada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Perfis (vinculada a auth.users)
CREATE TABLE public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('Administrador', 'Gestor de Estoque', 'Operador', 'Gerente de Loja')),
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Unidades (CDs e Lojas)
CREATE TABLE public.unidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('CD', 'LOJA')),
    endereco TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Usuário Unidade (quais unidades cada usuário pode acessar)
CREATE TABLE public.usuario_unidade (
    user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, unidade_id)
);

-- 4. Fornecedores
CREATE TABLE public.fornecedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT UNIQUE NOT NULL,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    prazo_medio INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Produtos
CREATE TABLE public.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    ean TEXT UNIQUE,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    subcategoria TEXT,
    marca TEXT,
    unidade_medida TEXT NOT NULL,
    preco_custo NUMERIC(10,2) NOT NULL DEFAULT 0,
    preco_venda NUMERIC(10,2) NOT NULL DEFAULT 0,
    estoque_minimo INT NOT NULL DEFAULT 0,
    estoque_maximo INT NOT NULL DEFAULT 0,
    fornecedor_principal UUID REFERENCES public.fornecedores(id),
    status TEXT NOT NULL DEFAULT 'Ativo',
    perecivel BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Produto Fornecedor (relação N:M com custo e prazo)
CREATE TABLE public.produto_fornecedor (
    produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    custo NUMERIC(10,2) NOT NULL,
    prazo_entrega INT,
    PRIMARY KEY (produto_id, fornecedor_id)
);

-- 7. Lotes
CREATE TABLE public.lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id),
    fornecedor_id UUID REFERENCES public.fornecedores(id),
    numero_lote TEXT NOT NULL,
    nota_fiscal TEXT,
    data_entrada DATE NOT NULL,
    data_fabricacao DATE,
    data_validade DATE,
    status TEXT NOT NULL DEFAULT 'Normal' CHECK (status IN ('Normal', 'Bloqueado', 'Vencido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX idx_lotes_validade ON public.lotes(data_validade);

-- 8. Estoque Lote (Saldo por lote e unidade)
CREATE TABLE public.estoque_lote (
    lote_id UUID REFERENCES public.lotes(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
    quantidade NUMERIC NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    quantidade_reservada NUMERIC NOT NULL DEFAULT 0 CHECK (quantidade_reservada >= 0),
    PRIMARY KEY (lote_id, unidade_id)
);
CREATE INDEX idx_estoque_lote_unidade ON public.estoque_lote(unidade_id);

-- 9. Movimentações (Livro-razão)
CREATE TABLE public.movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'venda', 'transferencia_saida', 'transferencia_entrada', 'perda', 'vencimento', 'avaria', 'consumo', 'devolucao', 'ajuste')),
    lote_id UUID NOT NULL REFERENCES public.lotes(id),
    unidade_id UUID NOT NULL REFERENCES public.unidades(id),
    quantidade NUMERIC NOT NULL,
    usuario_id UUID REFERENCES public.perfis(id),
    documento_referencia TEXT,
    justificativa TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX idx_movimentacoes_lote ON public.movimentacoes(lote_id, created_at);
CREATE INDEX idx_movimentacoes_unidade ON public.movimentacoes(unidade_id, created_at);

-- 10. Transferências
CREATE TABLE public.transferencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_origem UUID NOT NULL REFERENCES public.unidades(id),
    unidade_destino UUID NOT NULL REFERENCES public.unidades(id),
    produto_id UUID NOT NULL REFERENCES public.produtos(id),
    quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
    status TEXT NOT NULL DEFAULT 'Sugerida' CHECK (status IN ('Sugerida', 'Aprovada', 'Em transito', 'Recebida', 'Rejeitada', 'Cancelada')),
    usuario_solicitante UUID REFERENCES public.perfis(id),
    usuario_aprovador UUID REFERENCES public.perfis(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Reposições / Pedidos de Compra
CREATE TABLE public.reposicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id),
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id),
    unidade_id UUID NOT NULL REFERENCES public.unidades(id),
    quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
    status TEXT NOT NULL DEFAULT 'Sugerida' CHECK (status IN ('Sugerida', 'Aprovada', 'Enviada', 'Recebida', 'Cancelada')),
    usuario_solicitante UUID REFERENCES public.perfis(id),
    usuario_aprovador UUID REFERENCES public.perfis(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Auditoria
CREATE TABLE public.auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela TEXT NOT NULL,
    registro_id UUID NOT NULL,
    operacao TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id),
    dados_anteriores JSONB,
    dados_novos JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

----------------------------------------------------------
-- FUNÇÕES DE BANCO (RPC) PARA TRANSAÇÕES SEGURAS
----------------------------------------------------------

-- 1. Registrar Entrada
CREATE OR REPLACE FUNCTION registrar_entrada(
    p_produto_id UUID, p_fornecedor_id UUID, p_unidade_id UUID,
    p_numero_lote TEXT, p_nota_fiscal TEXT, p_quantidade NUMERIC,
    p_validade DATE, p_fabricacao DATE, p_usuario_id UUID
) RETURNS UUID AS $$
DECLARE
    v_lote_id UUID;
BEGIN
    -- Verifica ou cria lote
    SELECT id INTO v_lote_id FROM public.lotes 
    WHERE numero_lote = p_numero_lote AND produto_id = p_produto_id AND fornecedor_id = p_fornecedor_id;

    IF v_lote_id IS NULL THEN
        INSERT INTO public.lotes (produto_id, fornecedor_id, numero_lote, nota_fiscal, data_entrada, data_fabricacao, data_validade)
        VALUES (p_produto_id, p_fornecedor_id, p_numero_lote, p_nota_fiscal, CURRENT_DATE, p_fabricacao, p_validade)
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

-- 2. Registrar Saída
CREATE OR REPLACE FUNCTION registrar_saida(
    p_tipo TEXT, p_lote_id UUID, p_unidade_id UUID,
    p_quantidade NUMERIC, p_usuario_id UUID, p_justificativa TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_estoque_atual NUMERIC;
    v_lote_status TEXT;
BEGIN
    -- Bloqueia a linha para evitar condição de corrida
    SELECT quantidade, status INTO v_estoque_atual, v_lote_status
    FROM public.lotes l
    JOIN public.estoque_lote el ON l.id = el.lote_id
    WHERE el.lote_id = p_lote_id AND el.unidade_id = p_unidade_id
    FOR UPDATE OF el;

    IF v_estoque_atual IS NULL OR v_estoque_atual < p_quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para este lote na unidade.';
    END IF;

    IF v_lote_status = 'Vencido' AND p_tipo NOT IN ('perda', 'vencimento') THEN
        RAISE EXCEPTION 'Lote vencido não pode ser vendido ou transferido.';
    END IF;

    -- Atualiza estoque
    UPDATE public.estoque_lote
    SET quantidade = quantidade - p_quantidade
    WHERE lote_id = p_lote_id AND unidade_id = p_unidade_id;

    -- Registra movimentação
    INSERT INTO public.movimentacoes (tipo, lote_id, unidade_id, quantidade, usuario_id, justificativa)
    VALUES (p_tipo, p_lote_id, p_unidade_id, p_quantidade, p_usuario_id, p_justificativa);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função FEFO para selecionar lotes
CREATE OR REPLACE FUNCTION selecionar_lotes_fefo(
    p_produto_id UUID, p_unidade_id UUID, p_quantidade NUMERIC
) RETURNS TABLE (lote_id UUID, quantidade_a_retirar NUMERIC) AS $$
DECLARE
    v_lote RECORD;
    v_falta NUMERIC := p_quantidade;
    v_retirar NUMERIC;
BEGIN
    FOR v_lote IN 
        SELECT l.id, el.quantidade - el.quantidade_reservada AS disponivel
        FROM public.lotes l
        JOIN public.estoque_lote el ON l.id = el.lote_id
        WHERE l.produto_id = p_produto_id 
          AND el.unidade_id = p_unidade_id 
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

        RETURN QUERY SELECT v_lote.id, v_retirar;
    END LOOP;

    IF v_falta > 0 THEN
        RAISE EXCEPTION 'Estoque total disponível insuficiente para o produto.';
    END IF;
END;
$$ LANGUAGE plpgsql;

----------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) E POLÍTICAS
----------------------------------------------------------
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposicoes ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para permissões (RLS)
CREATE OR REPLACE FUNCTION user_has_role(role_name TEXT) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND papel = role_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_unit(p_unidade_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.usuario_unidade WHERE user_id = auth.uid() AND unidade_id = p_unidade_id)
        OR EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND papel = 'Administrador');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas de Exemplo para Lotes (Leitura: todos. Escrita: Admin e Gestores)
CREATE POLICY "Leitura_Lotes_Todos" ON public.lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita_Lotes_Admin" ON public.lotes FOR ALL TO authenticated USING (user_has_role('Administrador') OR user_has_role('Gestor de Estoque'));

-- Políticas de Exemplo para Estoque Lote (Filtrado por unidade)
CREATE POLICY "Ver_Estoque_Unidade_Permitida" ON public.estoque_lote FOR SELECT TO authenticated USING (user_has_unit(unidade_id));
