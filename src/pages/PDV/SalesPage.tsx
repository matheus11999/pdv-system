import React, { useState, useEffect } from 'react';
import { Search, Filter, Receipt, Eye, Printer, Calendar, User, Package } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useSales } from '../../hooks/useSales';
import { generateReceiptPDF } from '../../utils/receiptPDF';
import { supabase } from '../../lib/supabase';

export const SalesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedSale, setSelectedSale] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<Array<{id: string, name: string}>>([]);

  const { sales, loading, error } = useSales();

  // Load employees for filter
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setEmployees(data || []);
      } catch (err) {
        console.error('Error fetching employees:', err);
      }
    };
    
    fetchEmployees();
  }, []);

  const filteredSales = sales.filter(sale => {
    // Filter by search term
    const matchesSearch = sale.sale_number.includes(searchTerm) ||
      (sale.customer?.name && sale.customer.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter by employee
    const matchesEmployee = selectedEmployee === 'all' || 
      sale.cashier_id === selectedEmployee || 
      sale.user_id === selectedEmployee;
    
    return matchesSearch && matchesEmployee;
  });

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Dinheiro',
      CREDIT_CARD: 'Cartão de Crédito',
      DEBIT_CARD: 'Cartão de Débito',
      PIX: 'PIX',
      CREDIT: 'Fiado',
      OTHER: 'Outro'
    };
    return methods[method] || method;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'text-green-600 bg-green-50',
      PENDING: 'text-yellow-600 bg-yellow-50',
      CANCELLED: 'text-red-600 bg-red-50',
      REFUNDED: 'text-orange-600 bg-orange-50'
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      COMPLETED: 'Concluída',
      PENDING: 'Pendente',
      CANCELLED: 'Cancelada',
      REFUNDED: 'Estornada'
    };
    return labels[status] || status;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return { date: dateStr, time: timeStr };
  };

  const handlePrintReceipt = (sale: any) => {
    try {
      const receiptData = {
        sale_number: sale.sale_number,
        customer: {
          name: sale.customer?.name
        },
        payment_method: sale.payment_method,
        payment_details: sale.payment_details,
        total_amount: sale.total_amount,
        change_amount: sale.change_amount || 0,
        cash_received: sale.payment_details?.cash_received,
        items: sale.sale_items.map((item: any) => ({
          name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })),
        created_at: sale.created_at || sale.sale_date,
        is_credit_sale: sale.is_credit_sale,
        due_date: sale.due_date,
        company: {
          company_name: 'PDV SYSTEM',
          receipt_message: 'Obrigado pela preferência!',
          receipt_footer: 'Volte sempre!'
        }
      };
      
      generateReceiptPDF(receiptData);
      alert('Comprovante PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar comprovante:', error);
      alert('Erro ao gerar comprovante: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  // Calculate stats from real data
  const totalSales = filteredSales.length;
  const completedSales = filteredSales.filter(s => s.status === 'COMPLETED');
  const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const averageTicket = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
  const cancelledSales = filteredSales.filter(s => s.status === 'CANCELLED').length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-red-600">Erro ao carregar vendas: {error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-gray-600">Histórico e gerenciamento de vendas</p>
        </div>
        <Button>
          <Receipt className="w-4 h-4 mr-2" />
          Relatório de Vendas
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-green-600">R$ {totalRevenue.toFixed(2)}</p>
            </div>
            <Receipt className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Vendas</p>
              <p className="text-2xl font-bold text-blue-600">{totalSales}</p>
            </div>
            <Receipt className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ticket Médio</p>
              <p className="text-2xl font-bold text-purple-600">R$ {averageTicket.toFixed(2)}</p>
            </div>
            <Receipt className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Canceladas</p>
              <p className="text-2xl font-bold text-red-600">{cancelledSales}</p>
            </div>
            <Receipt className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por número da venda ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select 
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="all">Todos os funcionários</option>
            {employees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
          <select 
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="today">Hoje</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
          </select>
          <Button variant="secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
        </div>
      </Card>

      {/* Sales Table */}
      <Card>
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          <div className="p-4 space-y-4">
            {filteredSales.map((sale) => {
              const dateTime = formatDateTime(sale.created_at);
              const itemsCount = sale.sale_items?.length || 0;
              return (
                <div key={sale.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-lg text-gray-900">#{sale.sale_number}</div>
                      <div className="text-sm text-gray-500">{dateTime.date} às {dateTime.time}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-green-600">R$ {sale.total_amount.toFixed(2)}</div>
                      {sale.is_credit_sale && (
                        <div className="text-xs text-orange-600 font-medium">Fiado</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <div className="text-gray-600 mb-1">Cliente</div>
                      <div className="font-medium">{sale.customer?.name || 'Cliente avulso'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Itens</div>
                      <div className="font-medium">{itemsCount} {itemsCount === 1 ? 'item' : 'itens'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Pagamento</div>
                      <div className="font-medium">{getPaymentMethodLabel(sale.payment_method)}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Vendedor</div>
                      <div className="font-medium">{sale.cashier?.name || 'N/A'}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(sale.status)}`}>
                      {getStatusLabel(sale.status)}
                    </span>
                    <div className="flex space-x-3">
                      <button 
                        className="text-blue-600 hover:text-blue-900 p-2" 
                        title="Ver detalhes"
                        onClick={() => setSelectedSale(selectedSale === sale.id ? null : sale.id)}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        className="text-gray-600 hover:text-gray-900 p-2" 
                        title="Imprimir cupom"
                        onClick={() => handlePrintReceipt(sale)}
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venda
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Itens
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pagamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => {
                const dateTime = formatDateTime(sale.created_at);
                const itemsCount = sale.sale_items?.length || 0;
                return (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          #{sale.sale_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {dateTime.date} às {dateTime.time}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900">
                          {sale.customer?.name || 'Cliente avulso'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-green-600">
                        R$ {sale.total_amount.toFixed(2)}
                      </div>
                      {sale.is_credit_sale && (
                        <div className="text-xs text-orange-600">Fiado</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getPaymentMethodLabel(sale.payment_method)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {sale.cashier?.name || 'N/A'}
                      </div>
                      {sale.cashier?.role && (
                        <div className="text-xs text-gray-500">
                          {sale.cashier.role === 'ADMIN' ? 'Admin' : 
                           sale.cashier.role === 'RESELLER' ? 'Revendedor' :
                           sale.cashier.role === 'CASHIER' ? 'Operador' : 'Usuário'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(sale.status)}`}>
                        {getStatusLabel(sale.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button 
                          className="text-blue-600 hover:text-blue-900" 
                          title="Ver detalhes"
                          onClick={() => setSelectedSale(selectedSale === sale.id ? null : sale.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="text-gray-600 hover:text-gray-900" 
                          title="Imprimir cupom"
                          onClick={() => handlePrintReceipt(sale)}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma venda encontrada</p>
          </div>
        )}
      </Card>

      {/* Sale Details Modal */}
      {selectedSale && (() => {
        const sale = filteredSales.find(s => s.id === selectedSale);
        if (!sale) return null;
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <Card className="w-full max-w-sm sm:max-w-md lg:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">Detalhes da Venda #{sale.sale_number}</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Cliente</p>
                      <p className="font-medium">{sale.customer?.name || 'Cliente avulso'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="font-bold text-green-600">R$ {sale.total_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pagamento</p>
                      <p className="font-medium">{getPaymentMethodLabel(sale.payment_method)}</p>
                      {sale.payment_method === 'CASH' && sale.payment_details && (
                        <div className="text-xs text-gray-500 mt-1">
                          {sale.payment_details.cash_received && (
                            <p>Recebido: R$ {sale.payment_details.cash_received.toFixed(2)}</p>
                          )}
                          {sale.change_amount && sale.change_amount > 0 && (
                            <p>Troco: R$ {sale.change_amount.toFixed(2)}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Vendedor</p>
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <p className="font-medium">{sale.cashier?.name || 'N/A'}</p>
                          {sale.cashier?.role && (
                            <p className="text-xs text-gray-500">
                              {sale.cashier.role === 'ADMIN' ? 'Administrador' : 
                               sale.cashier.role === 'RESELLER' ? 'Revendedor' :
                               sale.cashier.role === 'CASHIER' ? 'Operador de Caixa' : 'Usuário'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(sale.status)}`}>
                        {getStatusLabel(sale.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Data/Hora</p>
                      <p className="font-medium">{formatDateTime(sale.created_at).date} às {formatDateTime(sale.created_at).time}</p>
                    </div>
                  </div>

                  {sale.sale_items && sale.sale_items.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Itens da Venda</p>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Produto</th>
                              <th className="px-3 py-2 text-center">Qty</th>
                              <th className="px-3 py-2 text-right">Preço</th>
                              <th className="px-3 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {sale.sale_items.map((item, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2">{item.product_name}</td>
                                <td className="px-3 py-2 text-center">{item.quantity}</td>
                                <td className="px-3 py-2 text-right">R$ {item.unit_price.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-medium">R$ {item.total_price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button variant="secondary" onClick={() => setSelectedSale(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
};