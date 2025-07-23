import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  document?: string;  // compatibility alias
  document_type: 'CPF' | 'CNPJ';
  company_name?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  // Compatibility aliases for address fields
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zipcode?: string;
  birth_date?: string;
  customer_type?: string;
  loyalty_points: number;
  total_purchases?: number;
  last_purchase_date?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  whatsapp?: string;
  credit_limit?: number;
  credit_balance?: number;
  debt_balance?: number;
  last_payment_date?: string;
}

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  document?: string;  // compatibility alias
  document_type: 'CPF' | 'CNPJ';
  company_name?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  // Compatibility aliases for address fields
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zipcode?: string;
  birth_date?: string;
  customer_type?: string;
  is_active?: boolean;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          customer_payments!customer_payments_customer_id_fkey(payment_date)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Process customers to add last payment date
      const customersWithPayments = (data || []).map(customer => {
        const payments = customer.customer_payments || [];
        const lastPaymentDate = payments.length > 0 
          ? payments.reduce((latest: any, payment: any) => 
              new Date(payment.payment_date) > new Date(latest.payment_date) ? payment : latest
            ).payment_date 
          : null;
        
        return {
          ...customer,
          last_payment_date: lastPaymentDate,
          customer_payments: undefined // Remove from final object
        };
      });
      
      setCustomers(customersWithPayments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async (customerData: CustomerInput) => {
    try {
      // Get current user for created_by field
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) throw new Error('Profile do usuário não encontrado');

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          cpf: customerData.document_type === 'CPF' ? (customerData.document || customerData.cpf) : customerData.cpf,
          cnpj: customerData.document_type === 'CNPJ' ? (customerData.document || customerData.cnpj) : customerData.cnpj,
          street: customerData.address_street || customerData.street,
          number: customerData.address_number || customerData.number,
          complement: customerData.address_complement || customerData.complement,
          neighborhood: customerData.address_district || customerData.neighborhood,
          city: customerData.address_city || customerData.city,
          state: customerData.address_state || customerData.state,
          zipcode: customerData.address_zipcode || customerData.zipcode,
          customer_type: customerData.customer_type || 'INDIVIDUAL',
          loyalty_points: 0,
          is_active: customerData.is_active ?? true,
          created_by: profile.id,
          user_id: profile.id
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchCustomers();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao criar cliente');
    }
  };

  const updateCustomer = async (id: string, customerData: Partial<CustomerInput>) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchCustomers();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao atualizar cliente');
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await fetchCustomers();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao deletar cliente');
    }
  };

  const searchCustomers = async (query: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,cpf.ilike.%${query}%,cnpj.ilike.%${query}%`)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pesquisar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return {
    customers,
    loading,
    error,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomers,
  };
}