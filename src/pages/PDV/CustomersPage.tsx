import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Users, Save, X, Phone, Mail, DollarSign, CreditCard, History, Eye } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useCustomers, type Customer, type CustomerInput } from '../../hooks/useCustomers';
import { supabase } from '../../lib/supabase';

export const CustomersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'CASH' | 'CARD' | 'PIX'>('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [customerHistory, setCustomerHistory] = useState<{sales: any[], payments: any[]}>({sales: [], payments: []});
  const [activeHistoryTab, setActiveHistoryTab] = useState<'sales' | 'payments'>('sales');
  
  const { 
    customers, 
    loading, 
    error, 
    createCustomer, 
    updateCustomer, 
    deleteCustomer,
    searchCustomers,
    fetchCustomers
  } = useCustomers();

  const [formData, setFormData] = useState<CustomerInput>({
    name: '',
    email: '',
    phone: '',
    document: '',
    document_type: 'CPF',
    address_street: '',
    address_number: '',
    address_city: '',
    address_state: '',
    address_zipcode: '',
    is_active: true
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      document: '',
      document_type: 'CPF',
      address_street: '',
      address_number: '',
      address_city: '',
      address_state: '',
      address_zipcode: '',
      is_active: true
    });
  };

  const handleAddCustomer = () => {
    resetForm();
    setEditingCustomer(null);
    setShowAddModal(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      document: customer.document || '',
      document_type: customer.document_type,
      address_street: customer.address_street || '',
      address_number: customer.address_number || '',
      address_city: customer.address_city || '',
      address_state: customer.address_state || '',
      address_zipcode: customer.address_zipcode || '',
      is_active: customer.is_active
    });
    setEditingCustomer(customer);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formData);
      } else {
        await createCustomer(formData);
      }
      setShowAddModal(false);
      resetForm();
      setEditingCustomer(null);
    } catch (error) {
      alert('Erro ao salvar cliente: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (window.confirm(`Tem certeza que deseja excluir o cliente "${customer.name}"?`)) {
      try {
        await deleteCustomer(customer.id);
      } catch (error) {
        alert('Erro ao excluir cliente: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      }
    }
  };

  const handlePayment = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setPaymentType('CASH');
    setPaymentDescription('');
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;
    
    try {
      const amount = parseFloat(paymentAmount);
      if (amount <= 0) {
        alert('Valor de pagamento deve ser maior que zero');
        return;
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) throw new Error('Profile do usuário não encontrado');

      // Record the payment
      const { error: paymentError } = await supabase
        .from('customer_payments')
        .insert({
          customer_id: selectedCustomer.id,
          payment_amount: amount,
          payment_type: paymentType,
          description: paymentDescription,
          created_by: profile.id
        });

      if (paymentError) throw paymentError;

      // Update customer debt balance and last payment date
      const newDebtBalance = Math.max(0, (selectedCustomer.debt_balance || 0) - amount);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ 
          debt_balance: newDebtBalance,
          last_payment_date: new Date().toISOString()
        })
        .eq('id', selectedCustomer.id);

      if (updateError) throw updateError;

      alert('Pagamento registrado com sucesso!');
      setShowPaymentModal(false);
      // Recarregar dados dos clientes
      await fetchCustomers();
    } catch (error) {
      alert('Erro ao processar pagamento: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleViewHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      // Fetch credit sales for this customer
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          total_amount,
          payment_method,
          status,
          is_credit_sale,
          due_date,
          created_at,
          cashier_id,
          sale_items!inner(
            product_name,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('customer_id', customer.id)
        .eq('is_credit_sale', true)
        .order('created_at', { ascending: false });

      // Fetch payments for this customer
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select(`
          id,
          payment_amount,
          payment_type,
          description,
          created_at,
          created_by,
          users!customer_payments_created_by_fkey(name)
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;
      if (paymentsError) throw paymentsError;

      // Fetch cashier information for sales
      const salesWithCashiers = await Promise.all(
        (salesData || []).map(async (sale) => {
          let cashier = null;
          if (sale.cashier_id) {
            const { data: cashierData } = await supabase
              .from('users')
              .select('name, role')
              .eq('id', sale.cashier_id)
              .single();
            cashier = cashierData;
          }
          return {
            ...sale,
            cashier
          };
        })
      );

      setCustomerHistory({
        sales: salesWithCashiers,
        payments: paymentsData || []
      });
      setShowHistoryModal(true);
    } catch (error) {
      alert('Erro ao carregar histórico: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const downloadCustomerReport = async (customer: Customer) => {
    try {
      // Create a detailed customer report
      const reportData = {
        customer,
        sales: customerHistory.sales,
        payments: customerHistory.payments,
        summary: {
          totalSales: customerHistory.sales.reduce((sum, sale) => sum + sale.total_amount, 0),
          totalPayments: customerHistory.payments.reduce((sum, payment) => sum + payment.payment_amount, 0),
          currentDebt: customer.debt_balance || 0,
          totalPurchases: customerHistory.sales.length,
          totalPaymentRecords: customerHistory.payments.length
        }
      };
      
      // Create CSV content
      let csvContent = `Relatório do Cliente: ${customer.name}\n`;
      csvContent += `Data de geração: ${new Date().toLocaleString('pt-BR')}\n\n`;
      csvContent += `RESUMO\n`;
      csvContent += `Total em Compras Fiado,R$ ${reportData.summary.totalSales.toFixed(2)}\n`;
      csvContent += `Total em Pagamentos,R$ ${reportData.summary.totalPayments.toFixed(2)}\n`;
      csvContent += `Saldo Atual,R$ ${reportData.summary.currentDebt.toFixed(2)}\n`;
      csvContent += `Número de Compras,${reportData.summary.totalPurchases}\n`;
      csvContent += `Número de Pagamentos,${reportData.summary.totalPaymentRecords}\n\n`;
      
      csvContent += `COMPRAS FIADO\n`;
      csvContent += `Data,Hora,Número da Venda,Status,Valor,Vencimento,Itens\n`;
      
      customerHistory.sales.forEach(sale => {
        const date = new Date(sale.created_at);
        const dateStr = date.toLocaleDateString('pt-BR');
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dueDate = sale.due_date ? new Date(sale.due_date).toLocaleDateString('pt-BR') : 'N/A';
        const status = sale.status === 'COMPLETED' ? 'Concluída' : 'Pendente';
        const itemsList = sale.sale_items?.map((item: any) => `${item.quantity}x ${item.product_name}`).join('; ') || '';
        
        csvContent += `${dateStr},${timeStr},#${sale.sale_number},${status},"R$ ${sale.total_amount.toFixed(2)}",${dueDate},"${itemsList}"\n`;
      });
      
      csvContent += `\nPAGAMENTOS\n`;
      csvContent += `Data,Hora,Forma de Pagamento,Valor,Observações,Registrado por\n`;
      
      customerHistory.payments.forEach((payment: any) => {
        const date = new Date(payment.created_at);
        const dateStr = date.toLocaleDateString('pt-BR');
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const paymentType = payment.payment_type === 'CASH' ? 'Dinheiro' : 
                           payment.payment_type === 'CARD' ? 'Cartão' : 
                           payment.payment_type === 'PIX' ? 'PIX' : payment.payment_type;
        const registeredBy = payment.users?.name || 'N/A';
        
        csvContent += `${dateStr},${timeStr},${paymentType},"R$ ${payment.payment_amount.toFixed(2)}","${payment.description || ''}",${registeredBy}\n`;
      });
      
      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio-cliente-${customer.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      alert('Relatório baixado com sucesso!');
    } catch (error) {
      alert('Erro ao gerar relatório: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const downloadPaymentsReport = async (customer: Customer) => {
    try {
      // Create CSV content for payments only
      let csvContent = `Relatório de Pagamentos: ${customer.name}\n`;
      csvContent += `Data de geração: ${new Date().toLocaleString('pt-BR')}\n\n`;
      
      const totalPayments = customerHistory.payments.reduce((sum, payment) => sum + payment.payment_amount, 0);
      csvContent += `RESUMO\n`;
      csvContent += `Total de Pagamentos,R$ ${totalPayments.toFixed(2)}\n`;
      csvContent += `Número de Registros,${customerHistory.payments.length}\n\n`;
      
      csvContent += `DETALHES DOS PAGAMENTOS\n`;
      csvContent += `Data,Hora,Forma de Pagamento,Valor,Observações,Registrado por\n`;
      
      customerHistory.payments.forEach((payment: any) => {
        const date = new Date(payment.created_at);
        const dateStr = date.toLocaleDateString('pt-BR');
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const paymentType = payment.payment_type === 'CASH' ? 'Dinheiro' : 
                           payment.payment_type === 'CARD' ? 'Cartão' : 
                           payment.payment_type === 'PIX' ? 'PIX' : payment.payment_type;
        const registeredBy = payment.users?.name || 'N/A';
        
        csvContent += `${dateStr},${timeStr},${paymentType},"R$ ${payment.payment_amount.toFixed(2)}","${payment.description || ''}",${registeredBy}\n`;
      });
      
      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio-pagamentos-${customer.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      alert('Relatório de pagamentos baixado com sucesso!');
    } catch (error) {
      alert('Erro ao gerar relatório: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      searchCustomers(term);
    }
  };

  const filteredCustomers = searchTerm.trim() 
    ? customers 
    : customers.filter(c => c.is_active);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">Erro ao carregar clientes: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600">Gerencie seus clientes</p>
        </div>
        <Button onClick={handleAddCustomer}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total de Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <Phone className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Clientes Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{customers.filter(c => c.is_active).length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <Mail className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Pontos de Fidelidade</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.reduce((sum, c) => sum + c.loyalty_points, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por nome, telefone, email ou documento..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Customers Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo/Pontos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <Users className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {customer.name}
                          </div>
                          {customer.company_name && (
                            <div className="text-sm text-gray-500">
                              {customer.company_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.phone && (
                          <div className="flex items-center mb-1">
                            <Phone className="w-3 h-3 mr-1 text-gray-400" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center">
                            <Mail className="w-3 h-3 mr-1 text-gray-400" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.document && (
                          <>
                            <div className="font-medium">{customer.document}</div>
                            <div className="text-xs text-gray-500">{customer.document_type}</div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.address_city && customer.address_state && (
                          `${customer.address_city}, ${customer.address_state}`
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {customer.debt_balance && customer.debt_balance > 0 ? (
                          <div className="font-bold text-red-600">
                            Deve: R$ {customer.debt_balance.toFixed(2)}
                          </div>
                        ) : customer.credit_balance && customer.credit_balance > 0 ? (
                          <div className="font-bold text-green-600">
                            Crédito: R$ {customer.credit_balance.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-gray-500">
                            Em dia
                          </div>
                        )}
                        <div className="text-xs text-purple-600">
                          {customer.loyalty_points || 0} pontos
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleViewHistory(customer)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Ver Histórico de Compras e Pagamentos"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {customer.debt_balance && customer.debt_balance > 0 && (
                          <button 
                            onClick={() => handlePayment(customer)}
                            className="text-green-600 hover:text-green-900"
                            title="Registrar Pagamento"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleEditCustomer(customer)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(customer)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAddCustomer} variant="ghost" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar primeiro cliente
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Add/Edit Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Documento
                    </label>
                    <select
                      value={formData.document_type}
                      onChange={(e) => setFormData({ ...formData, document_type: e.target.value as 'CPF' | 'CNPJ' })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.document_type}
                    </label>
                    <Input
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <h4 className="text-md font-medium text-gray-800 mb-2">Endereço</h4>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rua/Avenida
                    </label>
                    <Input
                      value={formData.address_street}
                      onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número
                    </label>
                    <Input
                      value={formData.address_number}
                      onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cidade
                    </label>
                    <Input
                      value={formData.address_city}
                      onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado
                    </label>
                    <Input
                      value={formData.address_state}
                      onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CEP
                    </label>
                    <Input
                      value={formData.address_zipcode}
                      onChange={(e) => setFormData({ ...formData, address_zipcode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Cliente ativo</span>
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    {editingCustomer ? 'Atualizar' : 'Salvar'} Cliente
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Registrar Pagamento
                </h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="font-medium text-blue-800">Cliente: {selectedCustomer.name}</p>
                {selectedCustomer.debt_balance && selectedCustomer.debt_balance > 0 && (
                  <p className="text-red-600">
                    Débito atual: R$ {selectedCustomer.debt_balance.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor do Pagamento *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('CASH')}
                      className={`p-2 border rounded-md text-sm font-medium ${
                        paymentType === 'CASH' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 mx-auto mb-1" />
                      Dinheiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('CARD')}
                      className={`p-2 border rounded-md text-sm font-medium ${
                        paymentType === 'CARD' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 mx-auto mb-1" />
                      Cartão
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('PIX')}
                      className={`p-2 border rounded-md text-sm font-medium ${
                        paymentType === 'PIX' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      📱
                      PIX
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <Input
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    placeholder="Pagamento parcial, quitação, etc."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button 
                    onClick={processPayment}
                    className="flex-1"
                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Registrar Pagamento
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowPaymentModal(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Customer History Modal */}
      {showHistoryModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Histórico de {selectedCustomer.name}
                </h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-blue-50 rounded">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-blue-800">Cliente: {selectedCustomer.name}</p>
                    {selectedCustomer.phone && <p className="text-sm text-blue-600">📞 {selectedCustomer.phone}</p>}
                  </div>
                  <div className="text-right">
                    {selectedCustomer.debt_balance && selectedCustomer.debt_balance > 0 ? (
                      <p className="font-bold text-red-600">
                        Débito atual: R$ {selectedCustomer.debt_balance.toFixed(2)}
                      </p>
                    ) : (
                      <p className="font-bold text-green-600">✅ Em dia</p>
                    )}
                    <p className="text-sm text-purple-600">
                      {selectedCustomer.loyalty_points || 0} pontos de fidelidade
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs para separar vendas e pagamentos */}
              <div className="flex border-b mb-4">
                <button 
                  onClick={() => setActiveHistoryTab('sales')}
                  className={`px-4 py-2 font-medium ${activeHistoryTab === 'sales' 
                    ? 'text-orange-600 border-b-2 border-orange-600' 
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🏪 Compras Fiado ({customerHistory.sales.length})
                </button>
                <button 
                  onClick={() => setActiveHistoryTab('payments')}
                  className={`px-4 py-2 font-medium ml-4 ${activeHistoryTab === 'payments' 
                    ? 'text-green-600 border-b-2 border-green-600' 
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  💳 Pagamentos ({customerHistory.payments.length})
                </button>
              </div>

              {/* Content based on active tab */}
              {activeHistoryTab === 'sales' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-semibold text-gray-800">Histórico de Compras</h4>
                    <button 
                      onClick={() => downloadCustomerReport(selectedCustomer)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                    >
                      📄 Baixar Relatório
                    </button>
                  </div>
                
                {customerHistory.sales.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p>Nenhuma compra fiado encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                      {customerHistory.sales.map((sale, index) => (
                        <div key={index} className="border border-gray-200 hover:border-orange-300 rounded-lg p-4 bg-white hover:bg-orange-50 transition-colors cursor-pointer group">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-semibold text-gray-900">Venda #{sale.sale_number}</h5>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  sale.status === 'COMPLETED' 
                                    ? 'text-green-700 bg-green-100' 
                                    : 'text-yellow-700 bg-yellow-100'
                                }`}>
                                  {sale.status === 'COMPLETED' ? '✅ Concluída' : '⏳ Pendente'}
                                </span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                                <span className="flex items-center gap-1">
                                  📅 {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="flex items-center gap-1">
                                  🕒 {new Date(sale.created_at).toLocaleTimeString('pt-BR', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                                {sale.due_date && (
                                  <span className="flex items-center gap-1 text-orange-600">
                                    ⏰ Venc: {new Date(sale.due_date).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 font-medium">
                                  📦 {sale.sale_items?.length || 0} {(sale.sale_items?.length || 0) === 1 ? 'item' : 'itens'}
                                </span>
                                {sale.cashier && (
                                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                                    👤 {sale.cashier.name}
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({sale.cashier.role === 'ADMIN' ? 'Admin' : 
                                        sale.cashier.role === 'RESELLER' ? 'Revendedor' :
                                        sale.cashier.role === 'CASHIER' ? 'Operador' : 'Usuário'})
                                    </span>
                                  </span>
                                )}
                              </div>

                              <div className="border-t pt-3">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-sm text-gray-600">Valor da compra</p>
                                    <p className="text-lg font-bold text-orange-600">R$ {sale.total_amount.toFixed(2)}</p>
                                  </div>
                                  <button className="opacity-0 group-hover:opacity-100 transition-opacity text-sm text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-200 rounded-md hover:bg-blue-50">
                                    Ver Detalhes
                                  </button>
                                </div>
                              </div>

                              {/* Itens da venda - colapsível */}
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <details className="group/details">
                                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 select-none">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="group-open/details:rotate-90 transition-transform">▶</span>
                                      Ver itens da compra ({sale.sale_items?.length || 0})
                                    </span>
                                  </summary>
                                  <div className="mt-2 space-y-1">
                                    {sale.sale_items?.map((item: any, itemIndex: number) => (
                                      <div key={itemIndex} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded text-sm">
                                        <span className="text-gray-700">
                                          <span className="font-medium">{item.quantity}x</span> {item.product_name}
                                        </span>
                                        <span className="font-medium text-gray-900">R$ {item.total_price.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payments Section */}
              {activeHistoryTab === 'payments' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-semibold text-gray-800">Pagamentos Realizados</h4>
                    <button 
                      onClick={() => downloadPaymentsReport(selectedCustomer)}
                      className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1 px-3 py-1 border border-green-200 rounded-md hover:bg-green-50"
                    >
                      📄 Baixar Relatório
                    </button>
                  </div>
                  {customerHistory.payments.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <p>Nenhum pagamento registrado</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {customerHistory.payments.map((payment: any, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-green-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-green-800">
                                Pagamento - {payment.payment_type === 'CASH' ? 'Dinheiro' : 
                                           payment.payment_type === 'CARD' ? 'Cartão' : 
                                           payment.payment_type === 'PIX' ? 'PIX' : payment.payment_type}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(payment.created_at).toLocaleDateString('pt-BR')} às{' '}
                                {new Date(payment.created_at).toLocaleTimeString('pt-BR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                              {payment.description && (
                                <p className="text-xs text-gray-600 mt-1">💬 {payment.description}</p>
                              )}
                              {payment.users && payment.users.name && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Registrado por: {payment.users.name}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">R$ {payment.payment_amount.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t mt-6">
                <div className="text-sm text-gray-600">
                  <p>Total compras fiado: <span className="font-medium text-orange-600">
                    R$ {customerHistory.sales.reduce((sum, sale) => sum + sale.total_amount, 0).toFixed(2)}
                  </span></p>
                  <p>Total pagamentos: <span className="font-medium text-green-600">
                    R$ {customerHistory.payments.reduce((sum, payment) => sum + payment.payment_amount, 0).toFixed(2)}
                  </span></p>
                </div>
                <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};