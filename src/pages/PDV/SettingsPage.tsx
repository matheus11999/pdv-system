import React, { useState, useEffect } from 'react';
import { 
  Save, Upload, Settings, Store, Phone, MapPin, Camera, 
  CreditCard, Printer, Database, Shield, Bell, Clock,
  DollarSign, Percent, FileText, Users, Package, Wifi,
  Monitor, Volume2, Smartphone, Globe, Key, Mail, Palette
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { updatePWAManifest } from '../../utils/pwaUtils';

interface SystemSettings {
  // Loja
  store_name: string;
  store_address: string;
  store_phone: string;
  store_email: string;
  store_cnpj: string;
  store_logo_url: string;
  
  // Fiscal
  enable_nfce: boolean;
  fiscal_environment: 'production' | 'test';
  certificate_path: string;
  
  // Pagamentos
  mercadopago_token: string;
  mercadopago_enabled: boolean;
  pix_key: string;
  enable_cash_discount: boolean;
  cash_discount_percentage: number;
  
  // PDV
  auto_print_receipt: boolean;
  require_customer: boolean;
  allow_negative_stock: boolean;
  auto_backup_frequency: 'daily' | 'weekly' | 'monthly';
  
  // Notificações
  low_stock_alerts: boolean;
  email_notifications: boolean;
  whatsapp_notifications: boolean;
  
  // Interface
  theme: 'light' | 'dark' | 'auto';
  currency: 'BRL' | 'USD' | 'EUR';
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timezone: string;
  
  // Fidelidade
  loyalty_points_enabled: boolean;
  loyalty_points_per_real: number;
  
  // PWA
  pwa_name: string;
  pwa_short_name: string;
  pwa_description: string;
  pwa_theme_color: string;
  pwa_background_color: string;
  pwa_icon_url: string;
}

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'store' | 'fiscal' | 'payments' | 'pdv' | 'notifications' | 'interface' | 'loyalty' | 'pwa'>('loyalty');
  const [settings, setSettings] = useState<SystemSettings>({
    // Valores padrão
    store_name: '',
    store_address: '',
    store_phone: '',
    store_email: '',
    store_cnpj: '',
    store_logo_url: '',
    
    enable_nfce: false,
    fiscal_environment: 'test',
    certificate_path: '',
    
    mercadopago_token: '',
    mercadopago_enabled: false,
    pix_key: '',
    enable_cash_discount: false,
    cash_discount_percentage: 5,
    
    auto_print_receipt: false,
    require_customer: false,
    allow_negative_stock: false,
    auto_backup_frequency: 'daily',
    
    low_stock_alerts: true,
    email_notifications: false,
    whatsapp_notifications: false,
    
    theme: 'light',
    currency: 'BRL',
    date_format: 'DD/MM/YYYY',
    timezone: 'America/Sao_Paulo',
    
    // Fidelidade
    loyalty_points_enabled: true,
    loyalty_points_per_real: 1,
    
    // PWA
    pwa_name: 'PDV - Sistema de Vendas',
    pwa_short_name: 'PDV System',
    pwa_description: 'Sistema completo de Ponto de Venda com controle de estoque',
    pwa_theme_color: '#2563eb',
    pwa_background_color: '#ffffff',
    pwa_icon_url: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [pwaIconPreview, setPwaIconPreview] = useState<string>('');
  const { profile } = useAuthStore();
  
  const isAdmin = profile?.role === 'ADMIN';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erro ao carregar configurações:', error);
        return;
      }
      
      if (data) {
        // Map company_settings to store_settings format
        setSettings(prev => ({
          ...prev,
          store_name: data.company_name || '',
          store_cnpj: data.company_document || '',
          store_phone: data.company_phone || '',
          store_email: data.company_email || '',
          store_address: `${data.address_street || ''} ${data.address_number || ''}, ${data.address_neighborhood || ''}, ${data.address_city || ''} - ${data.address_state || ''} ${data.address_zipcode || ''}`.trim(),
          store_logo_url: data.logo_url || '',
          mercadopago_enabled: data.mercadopago_enabled || false,
          mercadopago_token: data.mercadopago_access_token || '',
          pix_key: data.pix_key || '',
          pwa_name: data.pwa_name || data.company_name || 'PDV - Sistema de Vendas',
          pwa_short_name: data.pwa_short_name || 'PDV System',
          pwa_description: data.pwa_description || 'Sistema completo de Ponto de Venda com controle de estoque',
          pwa_theme_color: data.pwa_theme_color || '#2563eb',
          pwa_background_color: data.pwa_background_color || '#ffffff',
          pwa_icon_url: data.pwa_icon_url || ''
        }));
        
        // Update PWA manifest if PWA settings exist
        if (data.pwa_name || data.pwa_theme_color) {
          updatePWAManifest({
            pwa_name: data.pwa_name || data.company_name || 'PDV - Sistema de Vendas',
            pwa_short_name: data.pwa_short_name || 'PDV System',
            pwa_description: data.pwa_description || 'Sistema completo de Ponto de Venda com controle de estoque',
            pwa_theme_color: data.pwa_theme_color || '#2563eb',
            pwa_background_color: data.pwa_background_color || '#ffffff',
            pwa_icon_url: data.pwa_icon_url
          });
        }
        setLogoPreview(data.logo_url || '');
        setPwaIconPreview(data.pwa_icon_url || '');
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  };

  const saveSettings = async () => {
    if (!isAdmin) {
      alert('Apenas administradores podem alterar as configurações');
      return;
    }

    setLoading(true);
    try {
      // Parse address back into components (simplified for now)
      const addressParts = settings.store_address.split(',').map(s => s.trim());
      
      const companyData = {
        company_name: settings.store_name,
        company_document: settings.store_cnpj,
        company_phone: settings.store_phone,
        company_email: settings.store_email,
        address_street: addressParts[0] || '',
        address_city: addressParts[1] || '',
        address_state: addressParts[2] || '',
        logo_url: settings.store_logo_url,
        mercadopago_enabled: settings.mercadopago_enabled,
        mercadopago_access_token: settings.mercadopago_token,
        pix_key: settings.pix_key,
        pwa_name: settings.pwa_name,
        pwa_short_name: settings.pwa_short_name,
        pwa_description: settings.pwa_description,
        pwa_theme_color: settings.pwa_theme_color,
        pwa_background_color: settings.pwa_background_color,
        pwa_icon_url: settings.pwa_icon_url,
        user_id: profile?.id
      };

      const { error } = await supabase
        .from('company_settings')
        .upsert([companyData], { onConflict: 'id' });

      if (error) throw error;
      
      // Update PWA manifest with new settings
      updatePWAManifest({
        pwa_name: settings.pwa_name || settings.store_name,
        pwa_short_name: settings.pwa_short_name || (settings.pwa_name ? settings.pwa_name.substring(0, 12) : ''),
        pwa_description: settings.pwa_description,
        pwa_theme_color: settings.pwa_theme_color,
        pwa_background_color: settings.pwa_background_color,
        pwa_icon_url: settings.pwa_icon_url
      });
      
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogoPreview(result);
        setSettings({ ...settings, store_logo_url: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePwaIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For now, use base64 encoding like the logo upload
    // TODO: Set up Supabase Storage bucket with proper policies
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      // Validate image dimensions
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio < 0.8 || ratio > 1.2) {
          alert('O ícone deve ser aproximadamente quadrado. Recomendamos 512x512 pixels.');
          return;
        }
        
        setPwaIconPreview(result);
        setSettings({ ...settings, pwa_icon_url: result });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'loyalty', label: 'Fidelidade', icon: DollarSign },
    { id: 'store', label: 'Loja', icon: Store },
    { id: 'fiscal', label: 'Fiscal', icon: FileText },
    { id: 'payments', label: 'Pagamentos', icon: CreditCard },
    { id: 'pdv', label: 'PDV', icon: Monitor },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'interface', label: 'Interface', icon: Settings },
    { id: 'pwa', label: 'PWA', icon: Smartphone }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center mb-6">
        <Settings className="w-8 h-8 text-blue-600 mr-3" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
          <p className="text-gray-600">Configure todos os aspectos do seu sistema PDV</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Store Settings */}
      {activeTab === 'store' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Store className="w-5 h-5 mr-2" />
                Informações da Loja
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nome da Loja"
                  placeholder="Minha Loja LTDA"
                  value={settings.store_name}
                  onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                  disabled={!isAdmin}
                />
                
                <Input
                  label="CNPJ"
                  placeholder="00.000.000/0001-00"
                  value={settings.store_cnpj}
                  onChange={(e) => setSettings({ ...settings, store_cnpj: e.target.value })}
                  disabled={!isAdmin}
                />
                
                <Input
                  label="Telefone"
                  placeholder="(11) 99999-9999"
                  value={settings.store_phone}
                  onChange={(e) => setSettings({ ...settings, store_phone: e.target.value })}
                  disabled={!isAdmin}
                />
                
                <Input
                  label="Email"
                  type="email"
                  placeholder="contato@loja.com"
                  value={settings.store_email}
                  onChange={(e) => setSettings({ ...settings, store_email: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço Completo
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none disabled:bg-gray-100"
                  rows={3}
                  placeholder="Rua, número, bairro, cidade - CEP"
                  value={settings.store_address}
                  onChange={(e) => setSettings({ ...settings, store_address: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
            </Card>
          </div>

          {/* Logo Section */}
          <div>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Camera className="w-5 h-5 mr-2" />
                Logomarca
              </h3>
              
              <div className="text-center">
                <div className="mb-4">
                  {logoPreview ? (
                    <div className="w-32 h-32 mx-auto border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Sem logo</p>
                      </div>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Alterar Logo
                    </label>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Fiscal Settings */}
      {activeTab === 'fiscal' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Configurações Fiscais
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enable_nfce}
                  onChange={(e) => setSettings({ ...settings, enable_nfce: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Habilitar emissão de NFC-e
                </label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ambiente Fiscal
                  </label>
                  <select
                    value={settings.fiscal_environment}
                    onChange={(e) => setSettings({ ...settings, fiscal_environment: e.target.value as 'production' | 'test' })}
                    disabled={!isAdmin}
                    className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                  >
                    <option value="test">Homologação</option>
                    <option value="production">Produção</option>
                  </select>
                </div>
                
                <Input
                  label="Caminho do Certificado"
                  placeholder="/path/to/certificate.pfx"
                  value={settings.certificate_path}
                  onChange={(e) => setSettings({ ...settings, certificate_path: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Payment Settings */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              Integrações de Pagamento
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.mercadopago_enabled}
                  onChange={(e) => setSettings({ ...settings, mercadopago_enabled: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Usar gateway do Mercado Pago para pagamentos
                </label>
              </div>
              
              <Input
                label="Token do Mercado Pago"
                placeholder="TEST-..."
                value={settings.mercadopago_token}
                onChange={(e) => setSettings({ ...settings, mercadopago_token: e.target.value })}
                disabled={!isAdmin || !settings.mercadopago_enabled}
                type="password"
              />
              
              <Input
                label="Chave PIX"
                placeholder="email@exemplo.com ou telefone ou chave aleatória"
                value={settings.pix_key}
                onChange={(e) => setSettings({ ...settings, pix_key: e.target.value })}
                disabled={!isAdmin}
              />
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enable_cash_discount}
                    onChange={(e) => setSettings({ ...settings, enable_cash_discount: e.target.checked })}
                    disabled={!isAdmin}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Desconto para pagamento à vista
                  </label>
                </div>
                
                {settings.enable_cash_discount && (
                  <Input
                    placeholder="5"
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={settings.cash_discount_percentage}
                    onChange={(e) => setSettings({ ...settings, cash_discount_percentage: parseFloat(e.target.value) || 0 })}
                    disabled={!isAdmin}
                    className="w-20"
                  />
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* PDV Settings */}
      {activeTab === 'pdv' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Monitor className="w-5 h-5 mr-2" />
              Configurações do PDV
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.auto_print_receipt}
                  onChange={(e) => setSettings({ ...settings, auto_print_receipt: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Imprimir cupom automaticamente
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.require_customer}
                  onChange={(e) => setSettings({ ...settings, require_customer: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Exigir seleção de cliente
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allow_negative_stock}
                  onChange={(e) => setSettings({ ...settings, allow_negative_stock: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Permitir estoque negativo
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequência de Backup Automático
                </label>
                <select
                  value={settings.auto_backup_frequency}
                  onChange={(e) => setSettings({ ...settings, auto_backup_frequency: e.target.value as any })}
                  disabled={!isAdmin}
                  className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100 max-w-xs"
                >
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Notifications Settings */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Configurações de Notificações
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.low_stock_alerts}
                  onChange={(e) => setSettings({ ...settings, low_stock_alerts: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Alertas de estoque baixo
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.email_notifications}
                  onChange={(e) => setSettings({ ...settings, email_notifications: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Notificações por email
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.whatsapp_notifications}
                  onChange={(e) => setSettings({ ...settings, whatsapp_notifications: e.target.checked })}
                  disabled={!isAdmin}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Notificações por WhatsApp
                </label>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Interface Settings */}
      {activeTab === 'interface' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Configurações da Interface
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tema
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value as any })}
                  disabled={!isAdmin}
                  className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                >
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                  <option value="auto">Automático</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moeda
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value as any })}
                  disabled={!isAdmin}
                  className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                >
                  <option value="BRL">Real (R$)</option>
                  <option value="USD">Dólar ($)</option>
                  <option value="EUR">Euro (€)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Formato de Data
                </label>
                <select
                  value={settings.date_format}
                  onChange={(e) => setSettings({ ...settings, date_format: e.target.value as any })}
                  disabled={!isAdmin}
                  className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fuso Horário
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                >
                  <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
                </select>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Loyalty Settings */}
      {activeTab === 'loyalty' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-yellow-500" />
              Sistema de Pontos de Fidelidade
            </h3>
            
            <div className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="loyalty-enabled"
                  checked={settings.loyalty_points_enabled}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    loyalty_points_enabled: e.target.checked 
                  })}
                  disabled={!isAdmin}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <label htmlFor="loyalty-enabled" className="text-sm font-medium text-gray-700">
                  Habilitar sistema de pontos de fidelidade
                </label>
              </div>

              {settings.loyalty_points_enabled && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pontos por Real Gasto
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.loyalty_points_per_real}
                        onChange={(e) => setSettings({ 
                          ...settings, 
                          loyalty_points_per_real: parseFloat(e.target.value) || 0 
                        })}
                        placeholder="1"
                        disabled={!isAdmin}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Quantos pontos o cliente ganha para cada R$ 1,00 gasto
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border shadow-sm">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                        <Users className="w-4 h-4 mr-2 text-green-500" />
                        Simulação de Pontos
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-600">Compra de R$ 10,00:</span>
                          <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                            {(settings.loyalty_points_per_real * 10).toFixed(1)} pts
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-600">Compra de R$ 50,00:</span>
                          <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                            {(settings.loyalty_points_per_real * 50).toFixed(1)} pts
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-600">Compra de R$ 100,00:</span>
                          <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                            {(settings.loyalty_points_per_real * 100).toFixed(1)} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex">
                      <Package className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Como funciona o sistema</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>• <strong>Automático:</strong> A cada venda finalizada, o cliente ganha pontos automaticamente</li>
                          <li>• <strong>Proporcional:</strong> Os pontos são calculados com base no valor total da compra</li>
                          <li>• <strong>Todas as vendas:</strong> Vendas à vista e fiado também geram pontos</li>
                          <li>• <strong>Visível no PDV:</strong> Os pontos aparecem no perfil do cliente durante as vendas</li>
                          <li>• <strong>Histórico:</strong> Cliente pode acompanhar o acúmulo de pontos no seu perfil</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">✓</span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-green-800">
                          Sistema Configurado
                        </h4>
                        <p className="text-sm text-green-700 mt-1">
                          Com a configuração atual, seus clientes ganharão <strong>{settings.loyalty_points_per_real} ponto{settings.loyalty_points_per_real !== 1 ? 's' : ''}</strong> a cada R$ 1,00 gasto. 
                          Isso incentiva a fidelização e o retorno dos clientes à sua loja.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!settings.loyalty_points_enabled && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sistema de Fidelidade Desabilitado</h3>
                  <p className="text-gray-600 mb-4">
                    Habilite o sistema para começar a recompensar seus clientes com pontos a cada compra.
                  </p>
                  <p className="text-sm text-gray-500">
                    Os pontos de fidelidade ajudam a manter seus clientes engajados e aumentam a frequência de compras.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* PWA Settings */}
      {activeTab === 'pwa' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Smartphone className="w-5 h-5 mr-2 text-blue-500" />
              Progressive Web App (PWA)
            </h3>
            
            <div className="space-y-6">
              {/* App Basic Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <Globe className="w-4 h-4 mr-2 text-blue-500" />
                  Informações do Aplicativo
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nome do App"
                    placeholder="PDV - Sistema de Vendas"
                    value={settings.pwa_name || settings.store_name || ''}
                    onChange={(e) => setSettings({ ...settings, pwa_name: e.target.value })}
                    disabled={!isAdmin}
                  />
                  
                  <Input
                    label="Nome Curto"
                    placeholder="PDV System"
                    value={settings.pwa_short_name || (settings.pwa_name ? settings.pwa_name.substring(0, 12) : '')}
                    onChange={(e) => setSettings({ ...settings, pwa_short_name: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição do App
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none disabled:bg-gray-100"
                    rows={2}
                    placeholder="Sistema completo de Ponto de Venda com controle de estoque"
                    value={settings.pwa_description}
                    onChange={(e) => setSettings({ ...settings, pwa_description: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              {/* Theme Colors */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <Palette className="w-4 h-4 mr-2 text-purple-500" />
                  Cores do Tema
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cor Principal (Theme Color)
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={settings.pwa_theme_color}
                        onChange={(e) => setSettings({ ...settings, pwa_theme_color: e.target.value })}
                        disabled={!isAdmin}
                        className="h-10 w-16 border border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed"
                      />
                      <Input
                        value={settings.pwa_theme_color}
                        onChange={(e) => setSettings({ ...settings, pwa_theme_color: e.target.value })}
                        disabled={!isAdmin}
                        className="flex-1 font-mono text-sm"
                        placeholder="#2563eb"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Cor da barra de status e elementos do sistema
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cor de Fundo (Background)
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={settings.pwa_background_color}
                        onChange={(e) => setSettings({ ...settings, pwa_background_color: e.target.value })}
                        disabled={!isAdmin}
                        className="h-10 w-16 border border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed"
                      />
                      <Input
                        value={settings.pwa_background_color}
                        onChange={(e) => setSettings({ ...settings, pwa_background_color: e.target.value })}
                        disabled={!isAdmin}
                        className="flex-1 font-mono text-sm"
                        placeholder="#ffffff"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Cor de fundo quando o app carrega
                    </p>
                  </div>
                </div>
              </div>

              {/* App Icon */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <Camera className="w-4 h-4 mr-2 text-green-500" />
                  Ícone do Aplicativo
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-center">
                      <div className="mb-4">
                        {pwaIconPreview || settings.pwa_icon_url ? (
                          <div className="w-24 h-24 mx-auto border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                            <img
                              src={pwaIconPreview || settings.pwa_icon_url}
                              alt="PWA Icon preview"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-24 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white">
                            <div className="text-center">
                              <Smartphone className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                              <p className="text-xs text-gray-500">512x512</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {isAdmin && (
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="pwa-icon-upload"
                            onChange={handlePwaIconUpload}
                          />
                          <label
                            htmlFor="pwa-icon-upload"
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Alterar Ícone
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="text-sm font-medium text-blue-800 mb-2">Requisitos do Ícone</h5>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• <strong>Formato:</strong> PNG, JPG ou SVG</li>
                        <li>• <strong>Tamanho:</strong> 512x512 pixels (recomendado)</li>
                        <li>• <strong>Fundo:</strong> Transparente ou sólido</li>
                        <li>• <strong>Design:</strong> Simples e reconhecível</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h5 className="text-sm font-medium text-green-800 mb-2">Preview do Ícone</h5>
                      <p className="text-xs text-green-700">
                        O ícone aparecerá na tela inicial do dispositivo quando o usuário 
                        instalar o PWA, funcionando como um app nativo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PWA Status */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <Monitor className="w-4 h-4 mr-2 text-gray-500" />
                  Status do PWA
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white text-sm font-bold">✓</span>
                    </div>
                    <h5 className="text-sm font-medium text-green-800">Manifest</h5>
                    <p className="text-xs text-green-600">Configurado</p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white text-sm font-bold">✓</span>
                    </div>
                    <h5 className="text-sm font-medium text-green-800">Service Worker</h5>
                    <p className="text-xs text-green-600">Registrado</p>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white text-sm font-bold">i</span>
                    </div>
                    <h5 className="text-sm font-medium text-blue-800">HTTPS</h5>
                    <p className="text-xs text-blue-600">Necessário</p>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Como Instalar o PWA</h5>
                  <ol className="text-sm text-gray-600 space-y-1">
                    <li>1. Acesse o sistema pelo navegador (Chrome, Safari, Edge)</li>
                    <li>2. Procure pela opção "Instalar App" ou "Adicionar à tela inicial"</li>
                    <li>3. Confirme a instalação</li>
                    <li>4. O app aparecerá como um ícone na tela inicial</li>
                  </ol>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Save Button */}
      {isAdmin && (
        <div className="flex justify-end pt-6">
          <Button 
            onClick={saveSettings} 
            disabled={loading}
            className="min-w-[160px]"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </div>
      )}

      {/* Warning for non-admin users */}
      {!isAdmin && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-center">
            <Shield className="w-6 h-6 text-yellow-600 mr-2" />
            <p className="text-yellow-800 text-sm">
              Apenas administradores podem alterar as configurações do sistema.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};