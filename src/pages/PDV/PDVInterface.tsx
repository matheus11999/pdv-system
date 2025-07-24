import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign, User, Download, Calculator, ArrowLeft, LogOut, ShoppingCart, X, QrCode, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useProducts } from '../../hooks/useProducts';
import { useCustomers } from '../../hooks/useCustomers';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { generateReceiptPDF, generateReceiptHTML, openReceiptInNewTab } from '../../utils/receiptPDF';
import { useAlert } from '../../components/AlertProvider';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { playSound, playScanSound, playSuccessSound } from '../../utils/sound';


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
  const [showCreditSaleModal, setShowCreditSaleModal] = useState(false);
  const [creditSaleCustomer, setCreditSaleCustomer] = useState<any>(null);
  
  const { products, loading: productsLoading, searchProducts } = useProducts();
  const { customers, loading: customersLoading, searchCustomers } = useCustomers();
  
  // Only import createSale function, not the entire hook to avoid loading all sales
  const [salesLoading, setSalesLoading] = useState(false);
  
  const createSale = async (saleData: any) => {
    setSalesLoading(true);
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

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_id: saleData.customer_id,
          cashier_id: profile.id,
          user_id: profile.id,
          total_amount: saleData.total_amount,
          discount_amount: saleData.discount_amount || 0,
          tax_amount: saleData.tax_amount || 0,
          payment_method: saleData.payment_method,
          payment_details: saleData.payment_details || {},
          status: 'COMPLETED',
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

      // Insert sale items
      const saleItemsWithSaleId = saleData.items.map((item: any) => ({
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
          const pointsToAdd = Math.floor(saleData.total_amount * 0.01);
            
          if (pointsToAdd > 0) {
            await supabase
              .from('customers')
              .update({
                loyalty_points: supabase.sql`loyalty_points + ${pointsToAdd}`
              })
              .eq('id', saleData.customer_id);
          }
        } catch (loyaltyError) {
          console.error('Error processing loyalty points:', loyaltyError);
        }
      }

      return sale;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao criar venda');
    } finally {
      setSalesLoading(false);
    }
  };
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
    const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
    
    // Verificar se a nova quantidade não excede o estoque real
    if (newQuantity > product.current_stock) {
      warning(`Estoque insuficiente! Disponível: ${product.current_stock}`, 'Estoque Limitado');
      return;
    }
    
    // Animação de sucesso visual (sem alterar o estoque)
    const productElement = document.querySelector(`[data-product-id="${product.id}"]`);
    if (productElement) {
      // Adicionar efeito de sucesso
      productElement.style.transform = 'scale(1.05)';
      productElement.style.transition = 'all 0.3s ease';
      productElement.style.backgroundColor = '#dcfce7';
      productElement.style.borderColor = '#16a34a';
      
      setTimeout(() => {
        productElement.style.transform = '';
        productElement.style.backgroundColor = '';
        productElement.style.borderColor = '';
      }, 300);
    }
    
    if (existingItem) {
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
    
    try {
      const saleData = {
        total_amount: getCartTotal(),
        discount_amount: 0,
        tax_amount: 0,
        payment_method: paymentType,
        payment_details: paymentType === 'CASH' ? { 
          cash_received: cashReceived ? parseFloat(cashReceived) : getCartTotal(),
          change_given: getChangeAmount()
        } : {},
        requires_receipt: requiresReceipt,
        is_credit_sale: false,
        payment_gateway: 'direct',
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
      playSuccessSound();
      
      // Perguntar sobre comprovante
      setShowPaymentModal(false);
      if (requiresReceipt) {
        setShowReceiptModal(true);
      } else {
        // Notificação de sucesso
        const paymentLabel = paymentType === 'CASH' ? 'Dinheiro' : paymentType === 'PIX' ? 'PIX' : 'Cartão';
        const details = paymentType === 'CASH' && cashReceived ? 
          `\nRecebido: R$ ${parseFloat(cashReceived).toFixed(2)}\nTroco: R$ ${getChangeAmount().toFixed(2)}` : '';
        
        success(
          `Valor: R$ ${getCartTotal().toFixed(2)}\nPagamento: ${paymentLabel}${details}`,
          '✅ Venda Realizada!',
          5000
        );
        
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

  const processCreditSale = async () => {
    if (!profile || cart.length === 0 || !creditSaleCustomer) return;
    
    try {
      const today = new Date();
      const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias
      
      const saleData = {
        customer_id: creditSaleCustomer.id,
        total_amount: getCartTotal(),
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'CREDIT',
        payment_details: {
          credit_sale: true,
          customer_id: creditSaleCustomer.id,
          due_date: dueDate.toISOString()
        },
        notes: 'Venda fiado - criar débito para cliente',
        requires_receipt: requiresReceipt,
        is_credit_sale: true,
        due_date: dueDate.toISOString().split('T')[0],
        payment_gateway: 'direct',
        change_amount: 0,
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
      playSuccessSound();
      
      // Update customer debt
      const currentDebt = creditSaleCustomer.debt_balance || 0;
      const newDebt = currentDebt + getCartTotal();
      
      await supabase
        .from('customers')
        .update({ debt_balance: newDebt })
        .eq('id', creditSaleCustomer.id);
      
      // Close modal and show success
      setShowCreditSaleModal(false);
      setCreditSaleCustomer(null);
      
      if (requiresReceipt) {
        setShowReceiptModal(true);
      } else {
        success(
          `Valor da compra: R$ ${getCartTotal().toFixed(2)}\nCliente: ${creditSaleCustomer.name}\nVencimento: 30 dias\n\nNovo Saldo Devedor: R$ ${newDebt.toFixed(2)}`,
          '✅ Venda Fiado Realizada!',
          6000
        );
        clearCart();
      }
      
    } catch (err) {
      console.error('Erro ao processar venda fiado:', err);
      error(
        err instanceof Error ? err.message : 'Erro desconhecido ao processar venda fiado',
        'Erro na Venda Fiado'
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
    setCreditSaleCustomer(null);
    setShowCreditSaleModal(false);
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
    
    // Reproduzir som de escaneamento
    playScanSound();
    
    // Buscar produto automaticamente
    if (result.trim()) {
      searchProducts(result);
      success(`Código escaneado: ${result}`, '📷 Scanner');
    }
  };

  const stopScanner = () => {
    setShowScanner(false);
  };

  // Função para calcular estoque disponível visual (estoque real - quantidade no carrinho)
  const getAvailableStock = (productId: string, currentStock: number) => {
    const cartItem = cart.find(item => item.id === productId);
    const quantityInCart = cartItem ? cartItem.quantity : 0;
    return Math.max(0, currentStock - quantityInCart);
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
              Voltar
            </button>
            
            <div className="h-8 w-px bg-white/20"></div>
            
            <div className="flex items-center">
              <h1 className="text-white font-bold text-lg leading-tight">{storeSettings?.company_name || 'Sistema PDV'}</h1>
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
        {/* Desktop Search - Integrated with header */}
        <div className="hidden lg:block">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar produto por nome ou código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-white/20 rounded-xl text-lg font-medium text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-all hover:border-white/40"
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
              displayProducts.map(product => {
                const availableStock = getAvailableStock(product.id, product.current_stock);
                const cartItem = cart.find(item => item.id === product.id);
                const quantityInCart = cartItem ? cartItem.quantity : 0;
                const canAddMore = quantityInCart < product.current_stock;
                
                return (
                <div
                  key={product.id}
                  data-product-id={product.id}
                  className={`
                    relative bg-gradient-to-br from-white via-slate-50 to-blue-50 
                    border-2 rounded-xl p-3 cursor-pointer 
                    transition-all duration-200 shadow-sm
                    ${!canAddMore 
                      ? 'opacity-60 border-gray-200 bg-gray-50' 
                      : 'border-slate-200 hover:shadow-lg hover:scale-[1.02] hover:border-blue-300 hover:from-blue-50 hover:to-indigo-50'
                    }
                    active:scale-95 select-none min-h-[120px] lg:min-h-[140px]
                  `}
                  onClick={() => addToCart(product)}
                >
                  {/* Stock status indicator */}
                  <div className="absolute top-2 right-2">
                    {canAddMore ? (
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

                  {/* Stock quantity - mostra disponível vs no carrinho */}
                  <div className="text-center mb-2">
                    {canAddMore ? (
                      <span className="stock-counter text-emerald-600 text-xs font-bold">
                        {availableStock} disp
                        {quantityInCart > 0 && (
                          <span className="text-gray-500"> ({quantityInCart} no carrinho)</span>
                        )}
                      </span>
                    ) : (
                      <span className="stock-counter text-red-600 text-xs font-bold">
                        {product.current_stock > 0 ? `${product.current_stock} no carrinho` : 'Sem estoque'}
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
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Cart Section - Desktop */}
      <div className="hidden lg:flex lg:w-96 bg-white shadow-lg border-l flex-col">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Carrinho de Compras</h3>
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
      </div>

      {/* Scanner Modal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={stopScanner}
        onScan={handleScanResult}
      />

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-4 text-white rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Finalizar Venda</h3>
                  <p className="text-emerald-100 text-sm">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-white hover:bg-emerald-700 p-1 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Total display */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-3 mb-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Total da compra</p>
                  <p className="text-2xl font-bold text-emerald-600">R$ {getCartTotal().toFixed(2)}</p>
                </div>
              </div>
              
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Forma de pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('CASH')}
                      className={`relative p-3 rounded-lg border-2 transition-all ${
                        paymentType === 'CASH' 
                          ? 'bg-green-500 text-white border-green-400' 
                          : 'bg-white text-gray-700 hover:bg-green-50 border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <DollarSign className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm font-medium">Dinheiro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('CREDIT_CARD')}
                      className={`relative p-3 rounded-lg border-2 transition-all ${
                        paymentType === 'CREDIT_CARD' 
                          ? 'bg-blue-500 text-white border-blue-400' 
                          : 'bg-white text-gray-700 hover:bg-blue-50 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm font-medium">Cartão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('PIX')}
                      className={`relative p-3 rounded-lg border-2 transition-all ${
                        paymentType === 'PIX' 
                          ? 'bg-purple-500 text-white border-purple-400' 
                          : 'bg-white text-gray-700 hover:bg-purple-50 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="w-5 h-5 mx-auto mb-1 text-lg">📱</div>
                      <span className="text-sm font-medium">PIX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('DEBIT_CARD')}
                      className={`relative p-3 rounded-lg border-2 transition-all ${
                        paymentType === 'DEBIT_CARD' 
                          ? 'bg-indigo-500 text-white border-indigo-400' 
                          : 'bg-white text-gray-700 hover:bg-indigo-50 border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm font-medium">Débito</span>
                    </button>
                  </div>
                  
                  {/* Vender Fiado Button - apenas se habilitado nas configurações */}
                  {storeSettings?.allow_credit_sales && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaymentModal(false);
                          setShowCreditSaleModal(true);
                        }}
                        className="relative w-full p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 bg-gradient-to-br from-orange-50 to-orange-100 text-orange-700 hover:from-orange-100 hover:to-orange-200 border-orange-200 hover:border-orange-300 shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <User className="w-6 h-6" />
                          <span className="text-xl">🏪</span>
                          <span className="font-bold text-lg">Vender Fiado</span>
                        </div>
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
                      className="text-lg py-2 px-3 text-center font-semibold"
                    />
                    {cashReceived && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700 font-medium">Troco:</span>
                          <span className="font-bold text-lg text-green-600">
                            R$ {getChangeAmount().toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                
                <div className="flex space-x-2 pt-4">
                  <button
                    onClick={processSale}
                    disabled={salesLoading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  >
                    {salesLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Confirmar Venda
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>

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
            <p className="text-green-100 text-sm">#{lastSale?.sale_number || `VENDA-${Date.now()}`}</p>
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
                    {lastSale?.payment_method === 'CASH' ? 'Dinheiro' : 
                     lastSale?.payment_method === 'CREDIT' ? 'Fiado' :
                     lastSale?.payment_method === 'PIX' ? 'PIX' : 
                     lastSale?.payment_method === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                     lastSale?.payment_method === 'DEBIT_CARD' ? 'Cartão de Débito' : 
                     'Cartão'}
                  </span>
                </div>
              </div>
            </div>

            {/* Informações de troco - DESTAQUE MAIOR */}
            {lastSale?.payment_method === 'CASH' && lastSale?.change_amount > 0 && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-400 rounded-2xl p-6 shadow-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-4xl mr-3">💰</span>
                    <span className="text-xl font-bold text-white">TROCO A ENTREGAR</span>
                  </div>
                  <div className="text-5xl font-black text-white mb-2 tracking-wider">
                    R$ {lastSale?.change_amount?.toFixed(2) || '0.00'}
                  </div>
                  {lastSale?.cash_received && (
                    <div className="text-green-100 text-sm">
                      Recebido: R$ {lastSale.cash_received.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Informações de cliente fiado */}
            {lastSale?.payment_method === 'CREDIT' && lastSale?.customer_name && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">👤</span>
                  <span className="font-medium text-orange-800">Venda Fiado</span>
                </div>
                <p className="text-orange-700 font-medium">
                  Cliente: {lastSale.customer_name}
                </p>
                <p className="text-sm text-orange-600">
                  Vencimento: {lastSale.due_date ? new Date(lastSale.due_date).toLocaleDateString('pt-BR') : '30 dias'}
                </p>
                {lastSale.customer_debt_balance && (
                  <p className="text-sm text-red-600 mt-1">
                    Novo saldo devedor: R$ {lastSale.customer_debt_balance.toFixed(2)}
                  </p>
                )}
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

    {/* Credit Sale Modal */}
    {showCreditSaleModal && (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 text-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Venda Fiado</h3>
                <p className="text-orange-100">Selecione o cliente</p>
              </div>
              <button
                onClick={() => {
                  setShowCreditSaleModal(false);
                  setCreditSaleCustomer(null);
                  setCustomerSearchTerm('');
                }}
                className="text-white hover:bg-orange-700 p-2 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {!creditSaleCustomer ? (
              <>
                {/* Customer Search */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <User className="w-4 h-4 inline mr-2" />
                    Buscar Cliente
                  </label>
                  
                  <Input
                    placeholder="Digite o nome, telefone ou documento do cliente..."
                    value={customerSearchTerm}
                    onChange={(e) => {
                      setCustomerSearchTerm(e.target.value);
                      if (e.target.value.trim()) {
                        searchCustomers(e.target.value);
                      }
                    }}
                    className="text-base h-12"
                  />
                </div>

                {/* Customer Results */}
                {customerSearchTerm && filteredCustomers.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredCustomers.slice(0, 5).map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => {
                          setCreditSaleCustomer(customer);
                          setCustomerSearchTerm('');
                        }}
                        className="p-3 bg-gray-50 hover:bg-orange-50 rounded-lg cursor-pointer transition-colors border border-gray-200 hover:border-orange-300"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-1">
                              {customer.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {customer.cpf && `CPF: ${customer.cpf}`}
                              {customer.cnpj && `CNPJ: ${customer.cnpj}`}
                            </div>
                            {(customer.street || customer.city) && (
                              <div className="text-xs text-gray-500 mt-1">
                                {[customer.street, customer.city].filter(Boolean).join(', ')}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right ml-3">
                            <div className="space-y-1">
                              {customer.debt_balance > 0 ? (
                                <div className="text-xs text-red-600 font-bold">
                                  R$ {customer.debt_balance.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-xs text-green-600 font-medium">
                                  ✓ Em dia
                                </div>
                              )}
                              {customer.last_payment_date && (
                                <div className="text-xs text-gray-400">
                                  {(() => {
                                    const days = Math.floor((Date.now() - new Date(customer.last_payment_date).getTime()) / (1000 * 60 * 60 * 24));
                                    return `há ${days} dias`;
                                  })()}
                                </div>
                              )}
                              {customer.loyalty_points > 0 && (
                                <div className="text-xs text-blue-600">
                                  🏆 {customer.loyalty_points} pts
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customerSearchTerm && filteredCustomers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Nenhum cliente encontrado</p>
                    <p className="text-sm">Tente buscar por nome, telefone ou documento</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Selected Customer Details */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-orange-900 text-lg">Cliente Selecionado</h4>
                    <button
                      onClick={() => {
                        setCreditSaleCustomer(null);
                        setCustomerSearchTerm('');
                      }}
                      className="text-orange-600 hover:text-orange-800 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Nome:</span>
                      <p className="font-semibold text-gray-900">{creditSaleCustomer.name}</p>
                    </div>

                    {creditSaleCustomer.cpf && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">CPF:</span>
                        <p className="text-gray-900">{creditSaleCustomer.cpf}</p>
                      </div>
                    )}

                    {(creditSaleCustomer.street || creditSaleCustomer.city) && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Endereço:</span>
                        <p className="text-gray-900">
                          {[
                            creditSaleCustomer.street,
                            creditSaleCustomer.number,
                            creditSaleCustomer.city,
                            creditSaleCustomer.state
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}

                    <div>
                      <span className="text-sm font-medium text-gray-600">Saldo Devedor:</span>
                      <p className={`font-bold ${creditSaleCustomer.debt_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        R$ {(creditSaleCustomer.debt_balance || 0).toFixed(2)}
                      </p>
                    </div>

                    {creditSaleCustomer.last_payment_date && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Último Pagamento:</span>
                        <p className="text-gray-900">
                          {(() => {
                            const days = Math.floor((Date.now() - new Date(creditSaleCustomer.last_payment_date).getTime()) / (1000 * 60 * 60 * 24));
                            const date = new Date(creditSaleCustomer.last_payment_date).toLocaleDateString('pt-BR');
                            return `há ${days} dias (${date})`;
                          })()}
                        </p>
                      </div>
                    )}

                    {creditSaleCustomer.loyalty_points > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Pontos de Fidelidade:</span>
                        <p className="text-gray-900 flex items-center">
                          🏆 {creditSaleCustomer.loyalty_points} pontos
                        </p>
                      </div>
                    )}

                    {/* Address */}
                    {(creditSaleCustomer.street || creditSaleCustomer.city) && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Endereço:</span>
                        <p className="text-gray-900">
                          {[
                            creditSaleCustomer.street,
                            creditSaleCustomer.number,
                            creditSaleCustomer.neighborhood,
                            creditSaleCustomer.city,
                            creditSaleCustomer.state
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sale Summary */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Resumo da Venda</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Valor da compra:</span>
                      <span className="font-bold">R$ {getCartTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saldo atual:</span>
                      <span>R$ {(creditSaleCustomer.debt_balance || 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">Novo saldo devedor:</span>
                      <span className="font-bold text-red-600">
                        R$ {((creditSaleCustomer.debt_balance || 0) + getCartTotal()).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Vencimento: 30 dias ({new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')})
                    </div>
                  </div>
                </div>

                {/* Confirm Button */}
                <Button
                  onClick={processCreditSale}
                  disabled={salesLoading}
                  className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold py-4 text-lg shadow-lg"
                >
                  {salesLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <User className="w-5 h-5 mr-2" />
                      Confirmar Venda Fiado
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};