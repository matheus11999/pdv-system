import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface StoreSettings {
  id: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  company_name: string;
  company_document?: string;
  company_email?: string;
  company_website?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zipcode?: string;
  max_discount_percentage: number;
  allow_discount: boolean;
  receipt_header?: string;
  receipt_message: string;
  receipt_footer: string;
  currency: string;
  timezone: string;
  updated_at: string;
}

export const useStoreSettings = () => {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuthStore();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        // Se não existir configuração, criar uma padrão
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
          return;
        }
        throw error;
      }

      setSettings(data);
    } catch (err) {
      console.error('Erro ao buscar configurações:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!profile?.id) return;

    try {
      const defaultSettings = {
        store_name: 'PDV SYSTEM',
        store_address: 'Rua das Vendas, 123 - São Paulo, SP',
        store_phone: '(11) 99999-9999',
        updated_by: profile.id,
        company_name: 'PDV SYSTEM',
        company_document: '12.345.678/0001-90',
        company_email: 'contato@pdvsystem.com.br',
        address_street: 'Rua das Vendas, 123',
        address_city: 'São Paulo',
        address_state: 'SP',
        max_discount_percentage: 10.00,
        allow_discount: true,
        receipt_message: 'Obrigado pela preferência!',
        receipt_footer: 'Volte sempre!',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo'
      };

      const { data, error } = await supabase
        .from('store_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (err) {
      console.error('Erro ao criar configurações padrão:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar configurações');
    }
  };

  const updateSettings = async (updates: Partial<StoreSettings>) => {
    if (!settings || !profile?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('store_settings')
        .update({
          ...updates,
          updated_by: profile.id,
        })
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
      return data;
    } catch (err) {
      console.error('Erro ao atualizar configurações:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchSettings();
    }
  }, [profile]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings
  };
};