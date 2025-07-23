import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign, User, Download, Calculator, ArrowLeft, LogOut, ShoppingCart, X, QrCode, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useProducts } from '../../hooks/useProducts';
import { useCustomers } from '../../hooks/useCustomers';
import { useSales } from '../../hooks/useSales';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { generateReceiptPDF, generateReceiptHTML, openReceiptInNewTab } from '../../utils/receiptPDF';
import { useAlert } from '../../components/AlertProvider';
import { useStoreSettings } from '../../hooks/useStoreSettings';

interface CartItem {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  quantity: number;
  total: number;
  current_stock: number;
}

export const PDVInterface: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'CREDIT'>('CASH');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [requiresReceipt, setRequiresReceipt] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  const { products, loading: productsLoading, searchProducts } = useProducts();
  const { customers, loading: customersLoading, searchCustomers } = useCustomers();
  const { createSale, loading: salesLoading } = useSales();
  const { profile } = useAuthStore();
  const { success, warning, error, info } = useAlert();
  const { settings: storeSettings, loading: settingsLoading } = useStoreSettings();
  
  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    (customer.phone && customer.phone.includes(customerSearchTerm)) ||
    (customer.cpf && customer.cpf.includes(customerSearchTerm)) ||
    (customer.cnpj && customer.cnpj.includes(customerSearchTerm))
  );

  // Carregar configurações da empresa
  useEffect(() => {
    const loadCompanySettings = async () => {
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('*')
          .single();
        setCompanySettings(data);
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      }
    };
    
    loadCompanySettings();
  }, []);

  // Buscar produtos quando searchTerm mudar
  useEffect(() => {
    if (searchTerm.trim()) {
      searchProducts(searchTerm);
    }
  }, [searchTerm]);

  const addToCart = (product: typeof products[0]) => {
    if (product.current_stock <= 0) {
      warning('Produto sem estoque!', 'Estoque Esgotado');
      return;
    }
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;
      if (newQuantity > product.current_stock) {
        warning(`Estoque insuficiente! Disponível: ${product.current_stock}`, 'Estoque Limitado');
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.sale_price || 0,
        cost_price: product.cost_price || 0,
        quantity: 1,
        total: product.sale_price || 0,
        current_stock: product.current_stock
      }]);
    }
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + change);
        if (newQuantity === 0) return null;
        
        if (change > 0 && item.current_stock > 0 && newQuantity > item.current_stock) {
          warning(`Estoque insuficiente! Disponível: ${item.current_stock}`, 'Estoque Limitado');
          return item;
        }
        
        return { ...item, quantity: newQuantity, total: newQuantity * item.price };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };



  const printReceipt = () => {
    if (!lastSale) {
      error('Dados da venda não encontrados', 'Erro no Comprovante');
      return;
    }

    try {
      const selectedCustomerData = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : null;
      const currentDebt = selectedCustomerData?.debt_balance || 0;
      const newDebt = paymentType === 'CREDIT' ? currentDebt + cart.reduce((sum, item) => sum + item.total, 0) : currentDebt;
      
      // Preparar dados do comprovante
      const receiptData = {
        sale_number: lastSale.sale_number || `VENDA-${Date.now()}`,
        customer: {
          name: selectedCustomerData?.name,
          current_debt: currentDebt,
          new_debt: newDebt
        },
        payment_method: paymentType,
        payment_details: paymentType === 'CASH' ? {
          cash_received: cashReceived ? parseFloat(cashReceived) : getCartTotal(),
          change_given: getChangeAmount()
        } : undefined,
        total_amount: getCartTotal(),
        subtotal_amount: getSubtotal(),
        discount_percentage: discountPercentage,
        discount_amount: getDiscountAmount(),
        change_amount: paymentType === 'CASH' ? getChangeAmount() : 0,
        cash_received: paymentType === 'CASH' ? (cashReceived ? parseFloat(cashReceived) : getCartTotal()) : undefined,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total
        })),
        created_at: new Date().toISOString(),
        is_credit_sale: paymentType === 'CREDIT',
        due_date: paymentType === 'CREDIT' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        company: {
          company_name: storeSettings?.company_name || storeSettings?.store_name || 'PDV SYSTEM',
          company_document: storeSettings?.company_document || '',
          company_phone: storeSettings?.company_phone || storeSettings?.store_phone || '',
          company_email: storeSettings?.company_email || '',
          company_website: storeSettings?.company_website || '',
          address_street: storeSettings?.address_street || storeSettings?.store_address || '',
          address_number: storeSettings?.address_number || '',
          address_complement: storeSettings?.address_complement || '',
          address_neighborhood: storeSettings?.address_neighborhood || '',
          address_city: storeSettings?.address_city || '',
          address_state: storeSettings?.address_state || '',
          address_zipcode: storeSettings?.address_zipcode || '',
          receipt_header: storeSettings?.receipt_header || '',
          receipt_message: storeSettings?.receipt_message || 'Obrigado pela preferência!',
          receipt_footer: storeSettings?.receipt_footer || 'Volte sempre!'
        }
      };

      // Abrir comprovante em nova aba com impressão automática
      openReceiptInNewTab(receiptData);
      
      success('Comprovante aberto em nova aba para impressão!', '🖨️ Comprovante Aberto');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      error('Erro ao gerar comprovante: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), 'Erro no Comprovante');
    }
    
    clearCart();
    setShowReceiptModal(false);
  };

  const skipReceipt = () => {
    const total = cart.reduce((sum, item) => sum + item.total, 0);
    const message = `Venda finalizada com sucesso!\n\nValor: R$ ${total.toFixed(2)}\nPagamento: ${paymentType}\n${paymentType === 'CASH' ? `Troco: R$ ${getChangeAmount().toFixed(2)}` : ''}\n\n(Sem comprovante)`;
    
    clearCart();
    setShowReceiptModal(false);
    info('Venda finalizada sem comprovante', '✅ Venda Concluída');
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const processSale = async () => {
    if (!profile || cart.length === 0) return;
    
    // Verificar se é venda fiado e se cliente está selecionado
    if (paymentType === 'CREDIT' && !selectedCustomer) {
      warning('Para venda fiado é necessário selecionar um cliente.', 'Cliente Obrigatório');
      return;
    }
    
    try {
      const today = new Date();
      const dueDate = paymentType === 'CREDIT' ? new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) : undefined; // 30 dias
      
      // Commission calculation handled server-side
      
      const saleData = {
        customer_id: selectedCustomer || undefined,
        total_amount: getCartTotal(),
        discount_amount: 0,
        tax_amount: 0,
        // commission calculated server-side
        payment_method: paymentType,
        payment_details: paymentType === 'CASH' ? { 
          cash_received: cashReceived ? parseFloat(cashReceived) : getCartTotal(),
          change_given: getChangeAmount()
        } : paymentType === 'CREDIT' ? {
          credit_sale: true,
          customer_id: selectedCustomer,
          due_date: dueDate?.toISOString()
        } : {},
        notes: paymentType === 'CREDIT' ? 'Venda fiado - criar débito para cliente' : undefined,
        requires_receipt: requiresReceipt,
        is_credit_sale: paymentType === 'CREDIT',
        due_date: dueDate?.toISOString().split('T')[0],
        payment_gateway: 'direct', // TODO: Usar configuração do sistema
        change_amount: paymentType === 'CASH' ? getChangeAmount() : 0,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          product_barcode: undefined,
          quantity: item.quantity,
          unit_price: item.price,
          unit_cost: item.cost_price,
          discount_amount: 0,
          tax_amount: 0,
          total_price: item.total
        }))
      };

      const sale = await createSale(saleData);
      setLastSale(sale);
      
      // Commission handled server-side
      
      // If it's a credit sale, update customer debt
      if (paymentType === 'CREDIT' && selectedCustomer) {
        const customer = customers.find(c => c.id === selectedCustomer);
        const currentDebt = customer?.debt_balance || 0;
        const newDebt = currentDebt + getCartTotal();
        
        await supabase
          .from('customers')
          .update({ debt_balance: newDebt })
          .eq('id', selectedCustomer);
      }
      
      // Perguntar sobre comprovante
      setShowPaymentModal(false);
      if (requiresReceipt) {
        setShowReceiptModal(true);
      } else {
        // Notificação de sucesso melhorada
        const selectedCustomerData = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : null;
        const currentDebt = selectedCustomerData?.debt_balance || 0;
        const newTotalDebt = paymentType === 'CREDIT' ? currentDebt + getCartTotal() : currentDebt;
        
        if (paymentType === 'CREDIT') {
          success(
            `Valor da compra: R$ ${getCartTotal().toFixed(2)}\nCliente: ${selectedCustomerData?.name || 'N/A'}\nVencimento: 30 dias\n\nSaldo Devedor: R$ ${newTotalDebt.toFixed(2)}`,
            '✅ Venda Fiado Realizada!',
            6000
          );
        } else {
          const paymentLabel = paymentType === 'CASH' ? 'Dinheiro' : paymentType === 'PIX' ? 'PIX' : 'Cartão';
          const details = paymentType === 'CASH' && cashReceived ? 
            `\nRecebido: R$ ${parseFloat(cashReceived).toFixed(2)}\nTroco: R$ ${getChangeAmount().toFixed(2)}` : '';
          
          success(
            `Valor: R$ ${getCartTotal().toFixed(2)}\nPagamento: ${paymentLabel}${details}`,
            '✅ Venda Realizada!',
            5000
          );
        }
        
        clearCart();
      }
      
    } catch (err) {
      console.error('Erro ao processar venda:', err);
      error(
        err instanceof Error ? err.message : 'Erro desconhecido ao processar venda',
        'Erro na Venda'
      );
    }
  };

  const getChangeAmount = () => {
    const received = parseFloat(cashReceived) || 0;
    const total = getCartTotal();
    // If no cash received value, assume exact payment (no change)
    if (!cashReceived || cashReceived === '') {
      return 0;
    }
    return Math.max(0, received - total);
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();
    return (subtotal * discountPercentage) / 100;
  };

  const getTotalWithDiscount = () => {
    return getSubtotal() - getDiscountAmount();
  };

  const getCartTotal = () => {
    return getTotalWithDiscount();
  };

  const handleDiscountChange = (value: string) => {
    const percentage = parseFloat(value) || 0;
    const maxDiscount = storeSettings?.max_discount_percentage || 10;
    
    if (percentage > maxDiscount) {
      warning(`Desconto máximo permitido: ${maxDiscount}%`, 'Desconto Limitado');
      setDiscountPercentage(maxDiscount);
    } else {
      setDiscountPercentage(Math.max(0, percentage));
    }
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setPaymentType('CASH');
    setCashReceived('');
    setRequiresReceipt(true);
    setLastSale(null);
    setDiscountPercentage(0);
    setShowDiscountInput(false);
  };

  const startScanner = async () => {
    try {
      // Verificar se o navegador suporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        error('Scanner não suportado neste dispositivo', 'Erro do Scanner');
        return;
      }

      setShowScanner(true);
    } catch (err) {
      console.error('Erro ao iniciar scanner:', err);
      error('Erro ao acessar câmera', 'Erro do Scanner');
    }
  };

  const handleScanResult = (result: string) => {
    setShowScanner(false);
    setSearchTerm(result);
    
    // Buscar produto automaticamente
    if (result.trim()) {
      searchProducts(result);
      success(`Código escaneado: ${result}`, '📷 Scanner');
    }
  };

  const stopScanner = () => {
    setShowScanner(false);
  };

  const displayProducts = searchTerm.trim() ? products : products.slice(0, 12);

  return (
    <>
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* PDV Header - Responsivo e Intuitivo */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg border-b p-3 sm:p-4">
        <div className="flex justify-between items-center">
          {/* Left section */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-white hover:text-blue-100 p-2 rounded-md hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Voltar</span>
            </button>
            
            <div className="h-8 w-px bg-white/20"></div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">PDV Sistema</h1>
                <p className="text-blue-100 text-xs">Ponto de Venda</p>
              </div>
            </div>
          </div>
          
          {/* Right section - only show on desktop */}
          <div className="hidden sm:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-white font-semibold text-sm">{profile?.name}</p>
              <p className="text-blue-100 text-xs">Operador de Caixa</p>
            </div>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {profile?.name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Fixed Search Bar - Mobile Only */}
      <div className="lg:hidden bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg p-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar produto ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border-0 rounded-xl text-base font-medium placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <button
            onClick={startScanner}
            className="bg-white/20 hover:bg-white/30 p-3 rounded-xl transition-colors backdrop-blur-sm"
            title="Scanner de código de barras"
          >
            <QrCode className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* PDV Main Content - Responsivo */}
      <div className="flex-1 flex flex-col lg:flex-row bg-gray-50 overflow-hidden">
      {/* Product Search Section */}
      <div className="flex-1 p-3 sm:p-6 overflow-y-auto pb-32 lg:pb-6">
        {/* Desktop Search */}
        <div className="hidden lg:block mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Sparkles className="w-6 h-6 mr-3 text-blue-500" />
              Ponto de Venda
            </h2>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar produto por nome ou código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl text-lg font-medium placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-300"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Title */}
        <div className="lg:hidden mb-3">
          <h2 className="text-lg font-bold text-gray-900">Produtos</h2>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
            {displayProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                {searchTerm ? 'Nenhum produto encontrado' : 'Cadastre produtos para começar as vendas'}
              </div>
            ) : (
              displayProducts.map(product => (
                <div
                  key={product.id}
                  className={`
                    relative bg-gradient-to-br from-white via-slate-50 to-blue-50 
                    border-2 rounded-xl p-3 cursor-pointer 
                    transition-all duration-200 shadow-sm
                    ${product.current_stock <= 0 
                      ? 'opacity-60 border-gray-200 bg-gray-50' 
                      : 'border-slate-200 hover:shadow-lg hover:scale-[1.02] hover:border-blue-300 hover:from-blue-50 hover:to-indigo-50'
                    }
                    active:scale-95 select-none min-h-[120px] lg:min-h-[140px]
                  `}
                  onClick={() => addToCart(product)}
                >
                  {/* Stock status indicator */}
                  <div className="absolute top-2 right-2">
                    {product.current_stock > 0 ? (
                      <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-sm"></div>
                    ) : (
                      <div className="w-2 h-2 bg-red-400 rounded-full shadow-sm"></div>
                    )}
                  </div>

                  {/* Product icon */}
                  <div className="flex items-center justify-center mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                      <span className="text-white text-sm">📦</span>
                    </div>
                  </div>

                  {/* Stock quantity - prominente no topo */}
                  <div className="text-center mb-2">
                    {product.current_stock > 0 ? (
                      <span className="text-emerald-600 text-xs font-bold">
                        {product.current_stock} disp
                      </span>
                    ) : (
                      <span className="text-red-600 text-xs font-bold">
                        Sem estoque
                      </span>
                    )}
                  </div>

                  {/* Product name - maior e mais destacado */}
                  <div className="text-center mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm lg:text-base leading-tight line-clamp-2 min-h-[2rem] lg:min-h-[2.5rem] flex items-center justify-center px-1">
                      {product.name}
                    </h3>
                  </div>

                  {/* Category badge - menor e discreta */}
                  {product.category?.name && (
                    <div className="flex justify-center mb-2 lg:mb-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium border">
                        {product.category.name}
                      </span>
                    </div>
                  )}

                  {/* Price - maior e mais destacado */}
                  <div className="text-center absolute bottom-2 lg:bottom-3 left-2 lg:left-3 right-2 lg:right-3">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm lg:text-base py-1 lg:py-2 px-2 rounded-md shadow-sm">
                      R$ {(product.sale_price || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-500/0 hover:from-blue-500/5 hover:to-indigo-500/5 rounded-xl pointer-events-none transition-all duration-200"></div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cart Section - Desktop */}
      <div className="hidden lg:flex lg:w-96 bg-white shadow-lg border-l flex-col">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Carrinho de Compras</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔍 Cliente (opcional para venda fiado)
              </label>
              <div className="space-y-2">
                <Input
                  placeholder="Digite o nome, telefone ou documento do cliente..."
                  value={customerSearchTerm}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    // Auto-select first matching customer if exact match
                    if (e.target.value.trim()) {
                      const exactMatch = filteredCustomers.find(c => 
                        c.name.toLowerCase() === e.target.value.toLowerCase() ||
                        c.phone === e.target.value ||
                        c.cpf === e.target.value ||
                        c.cnpj === e.target.value
                      );
                      if (exactMatch) {
                        setSelectedCustomer(exactMatch.id);
                      } else if (filteredCustomers.length === 1) {
                        setSelectedCustomer(filteredCustomers[0].id);
                      } else {
                        setSelectedCustomer(null);
                      }
                    } else {
                      setSelectedCustomer(null);
                    }
                  }}
                  className="text-base h-12"
                />
                
                {/* Show matching customers as larger clickable cards - only when no customer is selected */}
                {customerSearchTerm && !selectedCustomer && filteredCustomers.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                    {filteredCustomers.slice(0, 5).map(customer => {
                      const customerAddress = [
                        customer.street,
                        customer.number,
                        customer.neighborhood,
                        customer.city
                      ].filter(Boolean).join(', ');
                      
                      return (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(customer.id);
                            setCustomerSearchTerm(customer.name);
                          }}
                          className="w-full text-left p-4 hover:bg-blue-50 transition-colors border-b last:border-b-0 border-gray-100"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 text-base mb-1">
                                {customer.name}
                              </div>
                              
                              {/* Address */}
                              {customerAddress && (
                                <div className="text-sm text-gray-600 mb-1">
                                  📍 {customerAddress}
                                </div>
                              )}
                              
                              {/* Contact Info */}
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                {customer.phone && (
                                  <span>📞 {customer.phone}</span>
                                )}
                                {customer.cpf && (
                                  <span>CPF: {customer.cpf}</span>
                                )}
                                {customer.cnpj && (
                                  <span>CNPJ: {customer.cnpj}</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Debt info */}
                            {customer.debt_balance > 0 && (
                              <div className="ml-3 text-right">
                                <div className="text-xs text-orange-600 font-medium mb-1">Deve:</div>
                                <div className="text-base font-bold text-red-600">
                                  R$ {customer.debt_balance.toFixed(2)}
                                </div>
                              </div>
                            )}
                            
                            {customer.debt_balance === 0 && (
                              <div className="ml-3 text-right">
                                <div className="text-xs text-green-600 font-medium">
                                  ✓ Em dia
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    
                    {filteredCustomers.length > 5 && (
                      <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                        E mais {filteredCustomers.length - 5} cliente(s)... Continue digitando para refinar
                      </div>
                    )}
                  </div>
                )}
                
                {/* Selected customer info - clean single display */}
                {selectedCustomer && (() => {
                  const customer = customers.find(c => c.id === selectedCustomer);
                  if (!customer) return null;
                  
                  return (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
                      {/* Main customer info */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <h4 className="font-semibold text-blue-900 text-base mr-2">
                              {customer.name}
                            </h4>
                            {customer.loyalty_points > 0 && (
                              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                                🏆 {customer.loyalty_points} pts
                              </span>
                            )}
                          </div>
                          
                          {/* Contact info */}
                          <div className="text-sm text-blue-700 space-y-1">
                            {customer.phone && (
                              <div>📞 {customer.phone}</div>
                            )}
                            {customer.cpf && (
                              <div>CPF: {customer.cpf}</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Debt status */}
                        <div className="text-right">
                          {customer.debt_balance > 0 ? (
                            <div>
                              <div className="text-xs text-orange-600 font-medium">Deve:</div>
                              <div className="text-lg font-bold text-red-600">
                                R$ {customer.debt_balance.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              ✓ Em dia
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearchTerm('');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        ✕ Remover cliente
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">Carrinho vazio</p>
              <p className="text-sm text-gray-400 mt-1">Escaneie ou clique nos produtos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.id} className="bg-gradient-to-r from-white to-blue-50 border border-blue-100 rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-800 text-sm leading-tight flex-1 pr-2">{item.name}</h4>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    {/* Quantity controls */}
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-2 hover:bg-gray-50 text-gray-600 hover:text-gray-800 rounded-l-lg transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-10 text-center font-bold text-gray-800 text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-2 hover:bg-gray-50 text-gray-600 hover:text-gray-800 rounded-r-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    
                    {/* Prices */}
                    <div className="text-right">
                      <p className="text-xs text-gray-500">R$ {item.price.toFixed(2)} × {item.quantity}</p>
                      <p className="font-bold text-emerald-600 text-lg">R$ {item.total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-4">
            {/* Discount section */}
            {storeSettings?.allow_discount && (
              <div className="bg-white border border-orange-200 rounded-xl p-4 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Desconto</span>
                  <button
                    onClick={() => setShowDiscountInput(!showDiscountInput)}
                    className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                  >
                    {showDiscountInput ? 'Ocultar' : 'Aplicar'}
                  </button>
                </div>
                
                {showDiscountInput && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        max={storeSettings.max_discount_percentage}
                        min="0"
                        step="0.1"
                        placeholder="0"
                        value={discountPercentage}
                        onChange={(e) => handleDiscountChange(e.target.value)}
                        className="flex-1 text-center"
                      />
                      <span className="text-gray-600">%</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Máximo: {storeSettings.max_discount_percentage}% • 
                      Valor: R$ {getDiscountAmount().toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Total display */}
            <div className="bg-white border border-emerald-200 rounded-xl p-4 mb-4 shadow-sm">
              {discountPercentage > 0 && (
                <div className="space-y-2 mb-3 pb-3 border-b border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>R$ {getSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600">Desconto ({discountPercentage}%):</span>
                    <span className="text-orange-600">-R$ {getDiscountAmount().toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-gray-600">Total da compra</span>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-emerald-600">R$ {getCartTotal().toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>
                  <p className="text-xs text-gray-500">{cart.reduce((sum, item) => sum + item.quantity, 0)} unidades</p>
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="space-y-2">
              <Button 
                onClick={handleFinalizeSale} 
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold py-3 text-lg shadow-lg" 
                disabled={salesLoading}
              >
                {salesLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <Calculator className="w-5 h-5 mr-2" />
                    Finalizar Venda
                  </>
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={clearCart} 
                className="w-full text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Carrinho
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cart - Fixed Bottom */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <ShoppingCart className="w-5 h-5 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">
                  {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  R$ {getCartTotal().toFixed(2)}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleFinalizeSale} 
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold py-3 text-sm shadow-lg" 
                disabled={salesLoading}
              >
                {salesLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Finalizar Venda
                  </>
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={clearCart} 
                className="px-3 text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart Items - Bottom Sheet Style */}
      <div className="lg:hidden">
        {/* Cart Items Quick View */}
        {cart.length > 0 && (
          <div className="fixed bottom-20 left-3 right-3 bg-white rounded-xl shadow-lg border max-h-48 overflow-y-auto z-10">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Itens no Carrinho</h4>
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  Limpar
                </button>
              </div>
              
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.quantity}x R$ {item.price.toFixed(2)}</p>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center hover:bg-red-200 ml-1"
                      >
                        <X className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="w-full max-w-sm mx-4">
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="mb-4">
                <QrCode className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Scanner de Código de Barras</h3>
                <p className="text-gray-600 text-sm">
                  Posicione o código de barras na frente da câmera
                </p>
              </div>

              {/* Camera Preview Area */}
              <div className="bg-gray-100 rounded-xl h-48 mb-4 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-2 border-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <QrCode className="w-8 h-8 text-blue-500" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Câmera inicializando...
                  </p>
                </div>
              </div>

              {/* Test Buttons - Para desenvolvimento */}
              <div className="space-y-2 mb-4">
                <p className="text-xs text-gray-500 mb-2">Modo de desenvolvimento:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScanResult('7891234567890')}
                    className="flex-1 bg-blue-100 text-blue-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    Simular Código 1
                  </button>
                  <button
                    onClick={() => handleScanResult('1234567890123')}
                    className="flex-1 bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                  >
                    Simular Código 2
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={stopScanner}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    // Entrada manual do código
                    const code = prompt('Digite o código de barras:');
                    if (code) {
                      handleScanResult(code);
                    }
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  Digitar Código
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg bg-white rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-4 sm:p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold">Finalizar Venda</h3>
                  <p className="text-emerald-100 text-xs sm:text-sm">{cart.length} {cart.length === 1 ? 'item' : 'itens'} • {cart.reduce((sum, item) => sum + item.quantity, 0)} unidades</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-white hover:bg-emerald-700 p-2 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {/* Total display */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 mb-4 sm:mb-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Total da compra</p>
                  <p className="text-2xl sm:text-4xl font-bold text-emerald-600">R$ {getCartTotal().toFixed(2)}</p>
                </div>
              </div>
              
              {selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex items-center">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mr-2" />
                    <div>
                      <p className="font-semibold text-blue-800 text-sm sm:text-base">Cliente selecionado</p>
                      <p className="text-blue-600 text-sm">{customers.find(c => c.id === selectedCustomer)?.name}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                    Escolha a forma de pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentType('CASH')}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                        paymentType === 'CASH' 
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-green-400 shadow-lg' 
                          : 'bg-gradient-to-br from-white to-gray-50 text-gray-700 hover:from-green-50 hover:to-green-100 border-gray-200 hover:border-green-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <DollarSign className="w-6 h-6 mx-auto mb-2" />
                      <span className="font-semibold">Dinheiro</span>
                      {paymentType === 'CASH' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                          <span className="text-xs">✓</span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('CREDIT_CARD')}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                        paymentType === 'CREDIT_CARD' 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400 shadow-lg' 
                          : 'bg-gradient-to-br from-white to-gray-50 text-gray-700 hover:from-blue-50 hover:to-blue-100 border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <CreditCard className="w-6 h-6 mx-auto mb-2" />
                      <span className="font-semibold">Cartão</span>
                      {paymentType === 'CREDIT_CARD' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                          <span className="text-xs">✓</span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('PIX')}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                        paymentType === 'PIX' 
                          ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white border-purple-400 shadow-lg' 
                          : 'bg-gradient-to-br from-white to-gray-50 text-gray-700 hover:from-purple-50 hover:to-purple-100 border-gray-200 hover:border-purple-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="w-6 h-6 mx-auto mb-2 text-2xl">📱</div>
                      <span className="font-semibold">PIX</span>
                      {paymentType === 'PIX' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                          <span className="text-xs">✓</span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('DEBIT_CARD')}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                        paymentType === 'DEBIT_CARD' 
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-400 shadow-lg' 
                          : 'bg-gradient-to-br from-white to-gray-50 text-gray-700 hover:from-indigo-50 hover:to-indigo-100 border-gray-200 hover:border-indigo-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <CreditCard className="w-6 h-6 mx-auto mb-2" />
                      <span className="font-semibold">Débito</span>
                      {paymentType === 'DEBIT_CARD' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                          <span className="text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  </div>
                  
                  {/* Credit/Fiado Button - only show when customer is selected */}
                  {selectedCustomer && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setPaymentType('CREDIT')}
                        className={`relative w-full p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                          paymentType === 'CREDIT' 
                            ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white border-orange-400 shadow-lg' 
                            : 'bg-gradient-to-br from-orange-50 to-orange-100 text-orange-700 hover:from-orange-100 hover:to-orange-200 border-orange-200 hover:border-orange-300 shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <User className="w-6 h-6" />
                          <span className="text-xl">🏪</span>
                          <span className="font-bold text-lg">Venda Fiado</span>
                        </div>
                        {paymentType === 'CREDIT' && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                            <span className="text-xs">✓</span>
                          </div>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                
                {paymentType === 'CASH' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor Recebido
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="text-lg py-3 px-4 text-center font-semibold"
                    />
                    {cashReceived && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">Troco:</span>
                          <span className="font-bold text-xl text-green-600">
                            R$ {getChangeAmount().toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {paymentType === 'CREDIT' && selectedCustomer && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                    <div className="flex items-center">
                      <User className="w-5 h-5 text-orange-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-orange-800">Venda Fiado</p>
                        <p className="text-xs text-orange-600">
                          O valor será adicionado ao débito do cliente
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-4 pt-6">
                  <button
                    onClick={processSale}
                    disabled={
                      salesLoading || 
                      (paymentType === 'CREDIT' && !selectedCustomer)
                    }
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {salesLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processando...
                      </>
                    ) : (
                      'Confirmar Venda'
                    )}
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-6 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all duration-200 transform hover:scale-105"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal - Melhorada */}
      {showReceiptModal && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header com gradiente */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <div className="text-3xl">✅</div>
              </div>
              <h3 className="text-xl font-bold mb-2">Venda Realizada!</h3>
              <p className="text-green-100 text-sm">#{lastSale?.sale_number || 'VENDA-' + Date.now()}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Resumo da venda */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="text-center">
                  {discountPercentage > 0 && (
                    <div className="space-y-1 mb-3 pb-3 border-b border-green-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span>R$ {getSubtotal().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600">Desconto ({discountPercentage}%):</span>
                        <span className="text-orange-600">-R$ {getDiscountAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-lg font-medium text-gray-600">Total:</span>
                    <span className="text-2xl font-bold text-green-700">
                      R$ {getCartTotal().toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <span>Pagamento:</span>
                    <span className="font-medium">
                      {paymentType === 'CASH' ? 'Dinheiro' : 
                       paymentType === 'CREDIT' ? 'Fiado' :
                       paymentType === 'PIX' ? 'PIX' : 'Cartão'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informações de troco */}
              {paymentType === 'CASH' && getChangeAmount() > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">💰</span>
                      <span className="font-medium text-blue-800">Troco a entregar:</span>
                    </div>
                    <span className="text-xl font-bold text-blue-700">
                      R$ {getChangeAmount().toFixed(2)}
                    </span>
                  </div>
                  {cashReceived && (
                    <div className="mt-2 text-sm text-blue-600">
                      Recebido: R$ {parseFloat(cashReceived).toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              {/* Informações de cliente fiado */}
              {paymentType === 'CREDIT' && selectedCustomer && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">👤</span>
                    <span className="font-medium text-orange-800">Venda Fiado</span>
                  </div>
                  <p className="text-orange-700 font-medium">
                    Cliente: {customers.find(c => c.id === selectedCustomer)?.name}
                  </p>
                  <p className="text-sm text-orange-600">Vencimento: 30 dias</p>
                </div>
              )}

              {/* Botões de ação */}
              <div className="border-t pt-4">
                <div className="text-center mb-4">
                  <p className="text-lg font-medium text-gray-800 mb-1">
                    Deseja imprimir o comprovante?
                  </p>
                  <p className="text-sm text-gray-500">
                    O comprovante será aberto em nova aba
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Button
                    onClick={printReceipt}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 text-base shadow-lg"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-lg">🖨️</span>
                      <span>Imprimir Comprovante</span>
                    </div>
                  </Button>
                  
                  <Button
                    onClick={skipReceipt}
                    variant="secondary"
                    className="w-full py-3 text-base font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    Continuar sem Imprimir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </>
  );
};