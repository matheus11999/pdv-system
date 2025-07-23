import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, Award, Download, ChevronDown } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Commission {
  id: string;
  sale_id: string;
  sale_number: string;
  category_name: string;
  commission_amount: number;
  sale_total: number;
  commission_percentage: number;
  sale_date: string;
  status: 'PENDING' | 'PAID';
  paid_at?: string;
  customer_name?: string;
}

interface CommissionSummary {
  today: number;
  week: number;
  month: number;
  total_earned: number;
  total_sales_count: number;
  avg_commission_rate: number;
}

export const CommissionDashboard: React.FC = () => {
  const { profile } = useAuthStore();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    today: 0,
    week: 0,
    month: 0,
    total_earned: 0,
    total_sales_count: 0,
    avg_commission_rate: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (profile?.commission_enabled) {
      fetchCommissions();
    }
  }, [profile, selectedMonth, selectedYear]);

  const fetchCommissions = async () => {
    if (!profile?.commission_enabled || !profile.user_commissions) return;
    
    setLoading(true);
    try {
      // Get date ranges
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const startOfMonth = new Date(selectedYear, selectedMonth, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      // Fetch sales data
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          total_amount,
          sale_date,
          customers(name),
          sale_items(
            product_id,
            total_price,
            quantity,
            products!inner(
              id,
              name,
              category_id,
              categories(name)
            )
          )
        `)
        .eq('cashier_id', profile.id)
        .eq('status', 'COMPLETED')
        .gte('sale_date', startOfMonth.toISOString())
        .lte('sale_date', endOfMonth.toISOString())
        .order('sale_date', { ascending: false });

      if (error) throw error;

      // Calculate commissions
      const calculatedCommissions: Commission[] = [];
      let totalCommissionAmount = 0;
      
      if (data && profile.user_commissions) {
        data.forEach(sale => {
          const saleDate = new Date(sale.sale_date);
          
          sale.sale_items?.forEach(item => {
            const product = item.products;
            if (product && product.category_id) {
              const userCommission = profile.user_commissions?.find(
                (uc: any) => uc.category_id === product.category_id
              );
              
              if (userCommission && userCommission.commission_percentage > 0) {
                const commissionAmount = (item.total_price * userCommission.commission_percentage) / 100;
                totalCommissionAmount += commissionAmount;
                
                calculatedCommissions.push({
                  id: `${sale.id}-${item.product_id}`,
                  sale_id: sale.id,
                  sale_number: sale.sale_number,
                  category_name: product.categories?.name || 'Sem categoria',
                  commission_amount: commissionAmount,
                  sale_total: sale.total_amount,
                  commission_percentage: userCommission.commission_percentage,
                  sale_date: sale.sale_date,
                  status: 'PENDING',
                  customer_name: sale.customers?.name
                });
              }
            }
          });
        });
      }
      
      setCommissions(calculatedCommissions);
      calculateSummary(calculatedCommissions);
      
    } catch (error) {
      console.error('Error fetching commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (allCommissions: Commission[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const todayCommissions = allCommissions.filter(comm => {
      const saleDate = new Date(comm.sale_date);
      return saleDate >= startOfToday;
    });
    
    const weekCommissions = allCommissions.filter(comm => {
      const saleDate = new Date(comm.sale_date);
      return saleDate >= startOfWeek;
    });
    
    const monthCommissions = allCommissions.filter(comm => {
      const saleDate = new Date(comm.sale_date);
      return saleDate >= startOfMonth;
    });
    
    const totalEarned = allCommissions.reduce((sum, comm) => sum + comm.commission_amount, 0);
    const totalSalesCount = [...new Set(allCommissions.map(comm => comm.sale_id))].length;
    const avgCommissionRate = totalSalesCount > 0 ? totalEarned / totalSalesCount : 0;
    
    setSummary({
      today: todayCommissions.reduce((sum, comm) => sum + comm.commission_amount, 0),
      week: weekCommissions.reduce((sum, comm) => sum + comm.commission_amount, 0),
      month: monthCommissions.reduce((sum, comm) => sum + comm.commission_amount, 0),
      total_earned: totalEarned,
      total_sales_count: totalSalesCount,
      avg_commission_rate: avgCommissionRate
    });
  };

  const filteredCommissions = commissions.filter(comm => {
    const saleDate = new Date(comm.sale_date);
    const now = new Date();
    
    switch (selectedPeriod) {
      case 'today':
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return saleDate >= startOfToday;
      case 'week':
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        return saleDate >= startOfWeek;
      case 'month':
        return saleDate.getMonth() === selectedMonth && saleDate.getFullYear() === selectedYear;
      default:
        return true;
    }
  });
  
  const getPeriodTotal = () => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.commission_amount, 0);
  };
  
  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return 'Hoje';
      case 'week': return 'Esta Semana';
      case 'month': 
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${monthNames[selectedMonth]} ${selectedYear}`;
      default: return 'Período';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (!profile?.commission_enabled) {
    return (
      <Card className="p-6 text-center">
        <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Comissão não habilitada</h3>
        <p className="text-gray-600">Entre em contato com o administrador para habilitar o sistema de comissão.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commission Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-700">Comissão Hoje</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.today)}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {filteredCommissions.filter(c => {
                  const today = new Date();
                  const saleDate = new Date(c.sale_date);
                  return saleDate.toDateString() === today.toDateString();
                }).length} vendas
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-700">Comissão Semana</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary.week)}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {filteredCommissions.filter(c => {
                  const now = new Date();
                  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                  const saleDate = new Date(c.sale_date);
                  return saleDate >= startOfWeek;
                }).length} vendas
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-700">Comissão Mês</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(summary.month)}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {summary.total_sales_count} vendas no mês
              </p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Current Period Summary */}
      <Card className="p-6 bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-orange-800 mb-2">
            Comissão {getPeriodLabel()}
          </h3>
          <p className="text-3xl font-bold text-orange-600 mb-1">
            {formatCurrency(getPeriodTotal())}
          </p>
          <p className="text-sm text-orange-700">
            {filteredCommissions.length} transações com comissão
          </p>
        </div>
      </Card>

      {/* Filters and Actions */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'today', label: 'Hoje' },
              { key: 'week', label: 'Semana' },
              { key: 'month', label: 'Mês' }
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setSelectedPeriod(filter.key as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === filter.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Month/Year Selector for month view */}
            {selectedPeriod === 'month' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {[
                    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                  ].map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}
            
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </Card>

      {/* Commissions List */}
      <Card>
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Detalhes - {getPeriodLabel()}
            </h3>
            <div className="text-sm text-gray-600">
              Total: {formatCurrency(getPeriodTotal())}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando comissões...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Venda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Venda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    % Comissão
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Valor Comissão
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCommissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        #{commission.sale_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {commission.customer_name || 'Cliente avulso'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {commission.category_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(commission.sale_total)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {commission.commission_percentage}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-green-600">
                        {formatCurrency(commission.commission_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        commission.status === 'PAID' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {commission.status === 'PAID' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(commission.sale_date)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCommissions.length === 0 && (
              <div className="text-center py-12">
                <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma comissão encontrada</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};