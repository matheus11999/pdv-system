-- Script para criar tabelas de comissão no Supabase

-- 1. Adicionar campos de comissão à tabela users (se não existirem)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS commission_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_commission_earned DECIMAL(10,2) DEFAULT 0.00;

-- 2. Criar tabela de configurações de comissão por categoria para usuários
CREATE TABLE IF NOT EXISTS user_commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category_id)
);

-- 3. Criar tabela de comissões calculadas por venda
CREATE TABLE IF NOT EXISTS sale_commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    sale_item_id UUID REFERENCES sale_items(id) ON DELETE CASCADE,
    commission_percentage DECIMAL(5,2) NOT NULL,
    sale_amount DECIMAL(10,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'PAID', 'CANCELLED')),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Adicionar campos de comissão à tabela sales (se não existirem)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS total_commission DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS commission_calculated BOOLEAN DEFAULT FALSE;

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_commissions_user_id ON user_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_commissions_category_id ON user_commissions(category_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_sale_id ON sale_commissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_user_id ON sale_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_status ON sale_commissions(status);

-- 6. Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger às tabelas
DROP TRIGGER IF EXISTS update_user_commissions_updated_at ON user_commissions;
CREATE TRIGGER update_user_commissions_updated_at
    BEFORE UPDATE ON user_commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sale_commissions_updated_at ON sale_commissions;
CREATE TRIGGER update_sale_commissions_updated_at
    BEFORE UPDATE ON sale_commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Função para calcular comissões de uma venda
CREATE OR REPLACE FUNCTION calculate_sale_commission(sale_id_param UUID)
RETURNS VOID AS $$
DECLARE
    sale_record RECORD;
    sale_item_record RECORD;
    user_commission_record RECORD;
    commission_amount DECIMAL(10,2);
    total_commission DECIMAL(10,2) := 0;
BEGIN
    -- Buscar dados da venda
    SELECT * INTO sale_record FROM sales WHERE id = sale_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale not found: %', sale_id_param;
    END IF;
    
    -- Verificar se o usuário tem comissão habilitada
    SELECT commission_enabled INTO user_commission_record 
    FROM users WHERE id = sale_record.cashier_id;
    
    IF NOT user_commission_record.commission_enabled THEN
        RETURN;
    END IF;
    
    -- Limpar comissões existentes para esta venda
    DELETE FROM sale_commissions WHERE sale_id = sale_id_param;
    
    -- Iterar pelos itens da venda
    FOR sale_item_record IN 
        SELECT si.*, p.category_id, p.name as product_name
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = sale_id_param
    LOOP
        -- Buscar configuração de comissão para esta categoria
        SELECT * INTO user_commission_record
        FROM user_commissions uc
        WHERE uc.user_id = sale_record.cashier_id 
        AND uc.category_id = sale_item_record.category_id
        AND uc.is_active = TRUE;
        
        IF FOUND THEN
            -- Calcular comissão
            commission_amount := (sale_item_record.total_price * user_commission_record.commission_percentage / 100);
            
            -- Inserir registro de comissão
            INSERT INTO sale_commissions (
                sale_id,
                user_id,
                category_id,
                sale_item_id,
                commission_percentage,
                sale_amount,
                commission_amount
            ) VALUES (
                sale_id_param,
                sale_record.cashier_id,
                sale_item_record.category_id,
                sale_item_record.id,
                user_commission_record.commission_percentage,
                sale_item_record.total_price,
                commission_amount
            );
            
            total_commission := total_commission + commission_amount;
        END IF;
    END LOOP;
    
    -- Atualizar total de comissão na venda
    UPDATE sales 
    SET total_commission = total_commission,
        commission_calculated = TRUE
    WHERE id = sale_id_param;
    
    -- Atualizar total acumulado do usuário
    UPDATE users 
    SET total_commission_earned = COALESCE(total_commission_earned, 0) + total_commission
    WHERE id = sale_record.cashier_id;
    
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger para calcular comissão automaticamente quando uma venda for concluída
CREATE OR REPLACE FUNCTION trigger_calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular comissão apenas quando status muda para COMPLETED
    IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
        PERFORM calculate_sale_commission(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger na tabela sales
DROP TRIGGER IF EXISTS sales_commission_trigger ON sales;
CREATE TRIGGER sales_commission_trigger
    AFTER INSERT OR UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_commission();

-- 9. Função para obter relatório de comissões de um usuário
CREATE OR REPLACE FUNCTION get_user_commission_report(
    user_id_param UUID,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    sale_id UUID,
    sale_number VARCHAR,
    sale_date TIMESTAMP WITH TIME ZONE,
    customer_name VARCHAR,
    category_name VARCHAR,
    commission_percentage DECIMAL,
    sale_amount DECIMAL,
    commission_amount DECIMAL,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.sale_id,
        s.sale_number,
        s.sale_date,
        c.name as customer_name,
        cat.name as category_name,
        sc.commission_percentage,
        sc.sale_amount,
        sc.commission_amount,
        sc.status
    FROM sale_commissions sc
    JOIN sales s ON s.id = sc.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    JOIN categories cat ON cat.id = sc.category_id
    WHERE sc.user_id = user_id_param
    AND (start_date IS NULL OR s.sale_date::DATE >= start_date)
    AND (end_date IS NULL OR s.sale_date::DATE <= end_date)
    ORDER BY s.sale_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. RLS (Row Level Security) Policies
ALTER TABLE user_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_commissions ENABLE ROW LEVEL SECURITY;

-- Policy para user_commissions - usuários só veem suas próprias configurações
CREATE POLICY "Users can view their own commission settings" ON user_commissions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT auth_user_id FROM users WHERE id = user_id
        ) OR
        auth.uid() IN (
            SELECT auth_user_id FROM users WHERE role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage commission settings" ON user_commissions
    FOR ALL USING (
        auth.uid() IN (
            SELECT auth_user_id FROM users WHERE role = 'ADMIN'
        )
    );

-- Policy para sale_commissions - usuários só veem suas próprias comissões
CREATE POLICY "Users can view their own commissions" ON sale_commissions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT auth_user_id FROM users WHERE id = user_id
        ) OR
        auth.uid() IN (
            SELECT auth_user_id FROM users WHERE role = 'ADMIN'
        )
    );

CREATE POLICY "System can insert commission records" ON sale_commissions
    FOR INSERT WITH CHECK (true);

-- 11. Função para obter resumo de comissões por período
CREATE OR REPLACE FUNCTION get_commission_summary(
    user_id_param UUID,
    period_type VARCHAR DEFAULT 'month' -- 'day', 'week', 'month'
)
RETURNS TABLE (
    total_commission DECIMAL,
    total_sales INTEGER,
    avg_commission_per_sale DECIMAL,
    period_start DATE,
    period_end DATE
) AS $$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    -- Definir período baseado no tipo
    CASE period_type
        WHEN 'day' THEN
            start_date := CURRENT_DATE;
            end_date := CURRENT_DATE;
        WHEN 'week' THEN
            start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
            end_date := (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE;
        WHEN 'month' THEN
            start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
            end_date := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
        ELSE
            start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
            end_date := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    END CASE;
    
    RETURN QUERY
    SELECT 
        COALESCE(SUM(sc.commission_amount), 0)::DECIMAL as total_commission,
        COUNT(DISTINCT sc.sale_id)::INTEGER as total_sales,
        CASE 
            WHEN COUNT(DISTINCT sc.sale_id) > 0 
            THEN (COALESCE(SUM(sc.commission_amount), 0) / COUNT(DISTINCT sc.sale_id))::DECIMAL
            ELSE 0::DECIMAL
        END as avg_commission_per_sale,
        start_date as period_start,
        end_date as period_end
    FROM sale_commissions sc
    JOIN sales s ON s.id = sc.sale_id
    WHERE sc.user_id = user_id_param
    AND s.sale_date::DATE BETWEEN start_date AND end_date
    AND sc.status = 'CALCULATED';
END;
$$ LANGUAGE plpgsql;