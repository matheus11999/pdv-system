import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  product_name: string;
  product_barcode?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount?: number;
  tax_amount?: number;
  total_price: number;
  product?: {
    name: string;
    barcode?: string;
    stock_current: number;
  };
}

export interface Sale {
  id: string;
  sale_number: string;
  customer_id?: string;
  cashier_id?: string;
  total_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT' | 'OTHER';
  payment_details?: Record<string, any>;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  notes?: string;
  requires_receipt?: boolean;
  is_credit_sale?: boolean;
  due_date?: string;
  payment_gateway?: string;
  change_amount?: number;
  created_at: string;
  updated_at: string;
  customer?: {
    name: string;
    cpf?: string;
    cnpj?: string;
  };
  cashier?: {
    name: string;
    role: string;
  };
  sale_items: SaleItem[];
  items_count?: number; // Count of items for display without loading all items
}

export interface SaleInput {
  customer_id?: string;
  total_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT' | 'OTHER';
  payment_details?: Record<string, any>;
  notes?: string;
  requires_receipt?: boolean;
  is_credit_sale?: boolean;
  due_date?: string;
  payment_gateway?: string;
  change_amount?: number;
  items: Omit<SaleItem, 'id' | 'sale_id'>[];
}

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const fetchSales = async (page = 1, searchTerm = '', employeeFilter = 'all', filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Get current user to filter sales if funcionario
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) throw new Error('Profile do usuário não encontrado');

      // Calculate offset for pagination
      const offset = (page - 1) * pageSize;

      // Build base query
      let countQuery = supabase
        .from('sales')
        .select('id', { count: 'exact', head: true });
      
      let dataQuery = supabase
        .from('sales')
        .select(`
          id, 
          sale_number, 
          customer_id, 
          total_amount, 
          discount_amount, 
          tax_amount, 
          payment_method, 
          status, 
          notes, 
          is_credit_sale,
          due_date,
          payment_details,
          requires_receipt,
          payment_gateway,
          change_amount,
          cashier_id,
          user_id,
          created_at, 
          updated_at
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Apply user role filter
      if (profile.role === 'FUNCIONARIO') {
        countQuery = countQuery.eq('user_id', profile.id);
        dataQuery = dataQuery.eq('user_id', profile.id);
      }

      // Apply employee filter for admin users
      if (profile.role === 'ADMIN' && employeeFilter !== 'all') {
        countQuery = countQuery.eq('user_id', employeeFilter);
        dataQuery = dataQuery.eq('user_id', employeeFilter);
      }

      // Apply search filter if provided
      if (searchTerm.trim()) {
        countQuery = countQuery.ilike('sale_number', `%${searchTerm}%`);
        dataQuery = dataQuery.ilike('sale_number', `%${searchTerm}%`);
      }

      // Execute queries
      const [{ count }, { data: salesData, error: salesError }] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      if (salesError) throw salesError;

      setTotalCount(count || 0);
      setCurrentPage(page);

      // Fetch customers and cashiers separately for better performance
      const salesWithCustomers = await Promise.all(
        (salesData || []).map(async (sale) => {
          let customer = null;
          if (sale.customer_id) {
            const { data: customerData } = await supabase
              .from('customers')
              .select('name, cpf, cnpj')
              .eq('id', sale.customer_id)
              .single();
            customer = customerData;
          }

          // Fetch cashier information
          let cashier = null;
          if (sale.cashier_id) {
            const { data: cashierData } = await supabase
              .from('users')
              .select('name, role')
              .eq('id', sale.cashier_id)
              .single();
            cashier = cashierData;
          }

          // Fetch item count for display
          const { count: itemCount } = await supabase
            .from('sale_items')
            .select('*', { count: 'exact', head: true })
            .eq('sale_id', sale.id);

          return {
            ...sale,
            customer,
            cashier,
            sale_items: [], // Will be loaded separately when needed
            items_count: itemCount || 0 // Add item count for display
          };
        })
      );

      setSales(salesWithCustomers);
    } catch (err) {
      console.error('Erro detalhado ao carregar vendas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  };

  const createSale = async (saleData: SaleInput) => {
    setLoading(true);
    try {
      // Get current user for cashier_id
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) throw new Error('Profile do usuário não encontrado');

      // Inicia transação
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_id: saleData.customer_id,
          cashier_id: profile.id,
          user_id: profile.id, // For commission calculation
          total_amount: saleData.total_amount,
          discount_amount: saleData.discount_amount || 0,
          tax_amount: saleData.tax_amount || 0,
          payment_method: saleData.payment_method,
          payment_details: saleData.payment_details || {},
          status: 'COMPLETED', // All sales are completed, credit sales just have debt_balance
          notes: saleData.notes,
          requires_receipt: saleData.requires_receipt || false,
          is_credit_sale: saleData.is_credit_sale || false,
          due_date: saleData.due_date,
          payment_gateway: saleData.payment_gateway || 'direct',
          change_amount: saleData.change_amount || 0,
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Insere os itens da venda
      const saleItemsWithSaleId = saleData.items.map(item => ({
        ...item,
        sale_id: sale.id,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsWithSaleId);

      if (itemsError) throw itemsError;

      // Apply loyalty points if customer exists
      if (saleData.customer_id) {
        try {
          // Skip loyalty points for now as fields don't exist in company_settings
          // TODO: Add loyalty points configuration when needed
          const pointsToAdd = Math.floor(saleData.total_amount * 0.01); // 1 point per real for now
            
          if (pointsToAdd > 0) {
            // Update customer loyalty points
            const { error: loyaltyError } = await supabase
              .from('customers')
              .update({
                loyalty_points: supabase.sql`loyalty_points + ${pointsToAdd}`
              })
              .eq('id', saleData.customer_id);

            if (loyaltyError) {
              console.error('Error updating loyalty points:', loyaltyError);
            }
          }
        } catch (loyaltyError) {
          // Don't fail the sale if loyalty points update fails
          console.error('Error processing loyalty points:', loyaltyError);
        }
      }

      await fetchSales();
      return sale;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao criar venda');
    } finally {
      setLoading(false);
    }
  };

  const cancelSale = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sales')
        .update({ status: 'CANCELLED' })
        .eq('id', id);

      if (error) throw error;
      await fetchSales();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao cancelar venda');
    }
  };

  const fetchSaleItems = async (saleId: string) => {
    try {
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select('id, product_id, product_name, quantity, unit_price, total_price')
        .eq('sale_id', saleId);

      if (error) throw error;
      return saleItems || [];
    } catch (err) {
      console.error('Error fetching sale items:', err);
      return [];
    }
  };

  const getTodaysSales = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(name, document),
          sale_items(
            *,
            product:products(name, barcode)
          )
        `)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao carregar vendas de hoje');
    }
  };

  // Don't auto-fetch on mount - let the component control when to fetch
  // useEffect(() => {
  //   fetchSales();
  // }, []);

  return {
    sales,
    loading,
    error,
    totalCount,
    currentPage,
    pageSize,
    fetchSales,
    fetchSaleItems,
    createSale,
    cancelSale,
    getTodaysSales,
    setCurrentPage,
  };
}