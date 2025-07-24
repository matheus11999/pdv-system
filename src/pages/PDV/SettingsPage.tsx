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
import { useStoreSettings } from '../../hooks/useStoreSettings';
import { supabase } from '../../lib/supabase';
import { updatePWAManifest } from '../../utils/pwaUtils';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'store' | 'company' | 'receipt' | 'pwa' | 'system'>('store');
  const { settings: storeSettings, loading, error, updateSettings } = useStoreSettings();
  const { profile } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Initialize form data when settings load
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (storeSettings) {
      setFormData(storeSettings);
    }
  }, [storeSettings]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!storeSettings) return;
    
    setSaving(true);
    setSuccessMessage('');
    
    try {
      await updateSettings(formData);
      
      // Update PWA manifest if PWA settings changed
      if (activeTab === 'pwa' && formData.pwa_name) {
        updatePWAManifest({
          pwa_name: formData.pwa_name,
          pwa_short_name: formData.pwa_short_name,
          pwa_description: formData.pwa_description,
          pwa_theme_color: formData.pwa_theme_color,
          pwa_background_color: formData.pwa_background_color,
          pwa_icon_url: formData.pwa_icon_url
        });
      }
      
      setSuccessMessage('Configurações salvas com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-red-600">Erro ao carregar configurações: {error}</p>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'store', label: 'Loja', icon: Store },
    { id: 'company', label: 'Empresa', icon: Package },
    { id: 'receipt', label: 'Cupom', icon: FileText },
    { id: 'pwa', label: 'PWA', icon: Smartphone },
    { id: 'system', label: 'Sistema', icon: Settings }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Gerencie as configurações do sistema</p>
        </div>
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md">
            {successMessage}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        {/* Store Tab */}
        {activeTab === 'store' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Store className="w-5 h-5 mr-2" />
              Informações da Loja
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Loja
                </label>
                <Input
                  value={formData.store_name || ''}
                  onChange={(e) => handleInputChange('store_name', e.target.value)}
                  placeholder="Nome da sua loja"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <Input
                  value={formData.store_phone || ''}
                  onChange={(e) => handleInputChange('store_phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço
                </label>
                <Input
                  value={formData.store_address || ''}
                  onChange={(e) => handleInputChange('store_address', e.target.value)}
                  placeholder="Endereço completo da loja"
                />
              </div>
            </div>
          </div>
        )}

        {/* Company Tab */}
        {activeTab === 'company' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Dados da Empresa
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razão Social
                </label>
                <Input
                  value={formData.company_name || ''}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Razão social da empresa"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ
                </label>
                <Input
                  value={formData.company_document || ''}
                  onChange={(e) => handleInputChange('company_document', e.target.value)}
                  placeholder="12.345.678/0001-90"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.company_email || ''}
                  onChange={(e) => handleInputChange('company_email', e.target.value)}
                  placeholder="contato@empresa.com.br"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <Input
                  value={formData.company_website || ''}
                  onChange={(e) => handleInputChange('company_website', e.target.value)}
                  placeholder="https://www.empresa.com.br"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço Completo
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    value={formData.address_street || ''}
                    onChange={(e) => handleInputChange('address_street', e.target.value)}
                    placeholder="Rua, número"
                  />
                  <Input
                    value={formData.address_city || ''}
                    onChange={(e) => handleInputChange('address_city', e.target.value)}
                    placeholder="Cidade"
                  />
                  <Input
                    value={formData.address_state || ''}
                    onChange={(e) => handleInputChange('address_state', e.target.value)}
                    placeholder="Estado"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Tab */}
        {activeTab === 'receipt' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Configurações do Cupom
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cabeçalho do Cupom
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={formData.receipt_header || ''}
                  onChange={(e) => handleInputChange('receipt_header', e.target.value)}
                  placeholder="Texto que aparece no topo do cupom"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem de Agradecimento
                </label>
                <Input
                  value={formData.receipt_message || ''}
                  onChange={(e) => handleInputChange('receipt_message', e.target.value)}
                  placeholder="Obrigado pela preferência!"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rodapé do Cupom
                </label>
                <Input
                  value={formData.receipt_footer || ''}
                  onChange={(e) => handleInputChange('receipt_footer', e.target.value)}
                  placeholder="Volte sempre!"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Desconto Máximo (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.max_discount_percentage || ''}
                    onChange={(e) => handleInputChange('max_discount_percentage', parseFloat(e.target.value))}
                    placeholder="10.00"
                  />
                </div>
                
                <div className="flex items-center space-x-2 mt-6">
                  <input
                    type="checkbox"
                    id="allow_discount"
                    checked={formData.allow_discount || false}
                    onChange={(e) => handleInputChange('allow_discount', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="allow_discount" className="text-sm font-medium text-gray-700">
                    Permitir desconto nas vendas
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PWA Tab */}
        {activeTab === 'pwa' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Smartphone className="w-5 h-5 mr-2" />
              Configurações PWA
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do App
                </label>
                <Input
                  value={formData.pwa_name || ''}
                  onChange={(e) => handleInputChange('pwa_name', e.target.value)}
                  placeholder="PDV - Sistema de Vendas"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Curto
                </label>
                <Input
                  value={formData.pwa_short_name || ''}
                  onChange={(e) => handleInputChange('pwa_short_name', e.target.value)}
                  placeholder="PDV System"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={formData.pwa_description || ''}
                  onChange={(e) => handleInputChange('pwa_description', e.target.value)}
                  placeholder="Sistema completo de Ponto de Venda com controle de estoque"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor do Tema
                </label>
                <div className="flex space-x-2">
                  <input
                    type="color"
                    value={formData.pwa_theme_color || '#2563eb'}
                    onChange={(e) => handleInputChange('pwa_theme_color', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.pwa_theme_color || ''}
                    onChange={(e) => handleInputChange('pwa_theme_color', e.target.value)}
                    placeholder="#2563eb"
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor de Fundo
                </label>
                <div className="flex space-x-2">
                  <input
                    type="color"
                    value={formData.pwa_background_color || '#ffffff'}
                    onChange={(e) => handleInputChange('pwa_background_color', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.pwa_background_color || ''}
                    onChange={(e) => handleInputChange('pwa_background_color', e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Configurações do Sistema
            </h3>
            
            <div className="space-y-6">
              {/* General Settings */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">Configurações Gerais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="auto_print_receipt"
                      checked={formData.auto_print_receipt || false}
                      onChange={(e) => handleInputChange('auto_print_receipt', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="auto_print_receipt" className="text-sm font-medium text-gray-700">
                      Imprimir cupom automaticamente
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="require_customer"
                      checked={formData.require_customer || false}
                      onChange={(e) => handleInputChange('require_customer', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="require_customer" className="text-sm font-medium text-gray-700">
                      Exigir cliente nas vendas
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allow_negative_stock"
                      checked={formData.allow_negative_stock || false}
                      onChange={(e) => handleInputChange('allow_negative_stock', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="allow_negative_stock" className="text-sm font-medium text-gray-700">
                      Permitir estoque negativo
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="low_stock_alerts"
                      checked={formData.low_stock_alerts || false}
                      onChange={(e) => handleInputChange('low_stock_alerts', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="low_stock_alerts" className="text-sm font-medium text-gray-700">
                      Alertas de estoque baixo
                    </label>
                  </div>
                </div>
              </div>

              {/* Loyalty Program */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">Programa de Fidelidade</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="loyalty_points_enabled"
                      checked={formData.loyalty_points_enabled || false}
                      onChange={(e) => handleInputChange('loyalty_points_enabled', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="loyalty_points_enabled" className="text-sm font-medium text-gray-700">
                      Ativar programa de fidelidade
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pontos por Real (R$)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.loyalty_points_per_real || ''}
                      onChange={(e) => handleInputChange('loyalty_points_per_real', parseFloat(e.target.value))}
                      placeholder="1.00"
                      disabled={!formData.loyalty_points_enabled}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-6 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </Card>
    </div>
  );
};