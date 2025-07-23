import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  cpf?: string;
  cnpj?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  birth_date?: string;
  customer_type: 'INDIVIDUAL' | 'BUSINESS';
  loyalty_points: number;
  total_purchases: number;
  last_purchase_date?: string;
  credit_limit: number;
  credit_balance: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CreditTransaction {
  id: string;
  customer_id: string;
  type: 'PURCHASE' | 'PAYMENT';
  amount: number;
  description?: string;
  sale_id?: string;
  created_by: string;
  created_at: string;
}

interface StoreSettings {
  id: string;
  store_name: string;
  store_address?: string;
  store_phone?: string;
  store_logo_url?: string;
  updated_by: string;
  updated_at: string;
}

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select()
        .single();

      if (error) throw error;
      await fetchCustomers();
      return data;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchCustomers();
      return data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return { customers, loading, createCustomer, updateCustomer, refetch: fetchCustomers };
};

export const useCreditTransactions = (customerId?: string) => {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      let query = supabase.from('credit_transactions').select('*');
      
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching credit transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTransaction = async (transaction: Omit<CreditTransaction, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .insert([transaction])
        .select()
        .single();

      if (error) throw error;

      // Update customer credit balance
      const { error: updateError } = await supabase.rpc('update_customer_credit', {
        customer_id: transaction.customer_id,
        amount: transaction.type === 'PURCHASE' ? transaction.amount : -transaction.amount
      });

      if (updateError) throw updateError;

      await fetchTransactions();
      return data;
    } catch (error) {
      console.error('Error creating credit transaction:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [customerId]);

  return { transactions, loading, createTransaction, refetch: fetchTransactions };
};

export const useStoreSettings = () => {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching store settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<StoreSettings>) => {
    try {
      if (settings) {
        const { data, error } = await supabase
          .from('store_settings')
          .update(updates)
          .eq('id', settings.id)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        return data;
      }
    } catch (error) {
      console.error('Error updating store settings:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, updateSettings, refetch: fetchSettings };
};