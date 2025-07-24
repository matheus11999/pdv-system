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
  sound_effects_enabled?: boolean;
  allow_credit_sales?: boolean;
  updated_at: string;
  
  // PWA Settings
  pwa_name?: string;
  pwa_short_name?: string;
  pwa_description?: string;
  pwa_theme_color?: string;
  pwa_background_color?: string;
  pwa_icon_url?: string;
  
  // Fiscal Settings
  enable_nfce?: boolean;
  fiscal_environment?: string;
  certificate_path?: string;
  
  // Payment Settings
  mercadopago_token?: string;
  mercadopago_enabled?: boolean;
  pix_key?: string;
  enable_cash_discount?: boolean;
  cash_discount_percentage?: number;
  
  // PDV Settings
  auto_print_receipt?: boolean;
  require_customer?: boolean;
  allow_negative_stock?: boolean;
  auto_backup_frequency?: string;
  
  // Notification Settings
  low_stock_alerts?: boolean;
  email_notifications?: boolean;
  whatsapp_notifications?: boolean;
  
  // Interface Settings
  theme?: string;
  date_format?: string;
  
  // Loyalty Settings
  loyalty_points_enabled?: boolean;
  loyalty_points_per_real?: number;
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
        timezone: 'America/Sao_Paulo',
        sound_effects_enabled: true,
        allow_credit_sales: true,
        
        // PWA defaults
        pwa_name: 'PDV - Sistema de Vendas',
        pwa_short_name: 'PDV System',
        pwa_description: 'Sistema completo de Ponto de Venda com controle de estoque',
        pwa_theme_color: '#2563eb',
        pwa_background_color: '#ffffff',
        
        // System defaults
        enable_nfce: false,
        fiscal_environment: 'test',
        mercadopago_enabled: false,
        enable_cash_discount: false,
        cash_discount_percentage: 5.00,
        auto_print_receipt: false,
        require_customer: false,
        allow_negative_stock: false,
        auto_backup_frequency: 'daily',
        low_stock_alerts: true,
        email_notifications: false,
        whatsapp_notifications: false,
        theme: 'light',
        date_format: 'DD/MM/YYYY',
        loyalty_points_enabled: true,
        loyalty_points_per_real: 1.00
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

      // Campos válidos que existem na tabela store_settings
      const validFields = [
        'store_name', 'store_address', 'store_phone', 'store_logo_url',
        'company_name', 'company_document', 'company_email', 'company_website',
        'address_street', 'address_number', 'address_complement', 'address_neighborhood',
        'address_city', 'address_state', 'address_zipcode', 'max_discount_percentage',
        'allow_discount', 'receipt_header', 'receipt_message', 'receipt_footer',
        'currency', 'timezone', 'sound_effects_enabled', 'allow_credit_sales',
        'pwa_name', 'pwa_short_name', 'pwa_description', 'pwa_theme_color',
        'pwa_background_color', 'pwa_icon_url', 'enable_nfce', 'fiscal_environment',
        'certificate_path', 'mercadopago_token', 'mercadopago_enabled', 'pix_key',
        'enable_cash_discount', 'cash_discount_percentage', 'auto_print_receipt',
        'require_customer', 'allow_negative_stock', 'auto_backup_frequency',
        'low_stock_alerts', 'email_notifications', 'whatsapp_notifications',
        'theme', 'date_format', 'loyalty_points_enabled', 'loyalty_points_per_real'
      ];

      // Filtrar apenas campos válidos
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => validFields.includes(key))
      );

      const { data, error } = await supabase
        .from('store_settings')
        .update({
          ...filteredUpdates,
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