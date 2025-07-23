import React, { useState, useEffect } from 'react';
import { BarChart3, DollarSign, TrendingUp, Calendar, Receipt, User, Award } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface MySalesStats {
  today: number;
  week: number;
  month: number;
  total_sales: number;
  avg_ticket: number;
  commission_today: number;
  commission_week: number;
  commission_month: number;
}

interface MySale {
  id: string;
  sale_number: string;
  total_amount: number;
  commission_amount: number;
  customer_name?: string;
  payment_method: string;
  created_at: string;
  status: string;
}

export const MyReportsPage: React.FC = () => {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<MySalesStats>({
    today: 0,
    week: 0,
    month: 0,
    total_sales: 0,
    avg_ticket: 0,
    commission_today: 0,
    commission_week: 0,
    commission_month: 0
  });
  const [sales, setSales] = useState<MySale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  useEffect(() => {
    if (profile) {
      loadMyData();
    }
  }, [profile, selectedPeriod]);

  const loadMyData = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      // Calculate date ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      let startDate = weekAgo;
      if (selectedPeriod === 'today') startDate = today;
      if (selectedPeriod === 'month') startDate = monthAgo;

      // Get my sales with commissions
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          total_amount,
          payment_method,
          status,
          created_at,
          customers(name),
          sale_commissions(commission_amount)
        `)
        .eq('user_id', profile.id)
        .eq('status', 'COMPLETED')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        setSales([]);
        setStats({
          today: 0,
          week: 0,
          month: 0,
          total_sales: 0,
          avg_ticket: 0,
          commission_today: 0,
          commission_week: 0,
          commission_month: 0
        });
        return;
      }

      // Process sales data
      const processedSales: MySale[] = (salesData || []).map(sale => {
        // Handle customers - it might be an array or object
        const customers = Array.isArray(sale.customers) ? sale.customers[0] : sale.customers;
        const commissions = Array.isArray(sale.sale_commissions) ? sale.sale_commissions : [];
        
        return {
          id: sale.id,
          sale_number: sale.sale_number,
          total_amount: parseFloat(sale.total_amount || '0'),
          commission_amount: commissions.reduce((sum: number, comm: any) => sum + parseFloat(comm.commission_amount || '0'), 0),
          customer_name: customers?.name || undefined,
          payment_method: sale.payment_method,
          created_at: sale.created_at,
          status: sale.status
        };
      });

      setSales(processedSales);

      // Calculate statistics
      const todaySales = processedSales.filter(s => new Date(s.created_at) >= today);
      const weekSales = processedSales.filter(s => new Date(s.created_at) >= weekAgo);
      const monthSales = processedSales.filter(s => new Date(s.created_at) >= monthAgo);

      const newStats: MySalesStats = {
        today: todaySales.reduce((sum, s) => sum + s.total_amount, 0),
        week: weekSales.reduce((sum, s) => sum + s.total_amount, 0),
        month: monthSales.reduce((sum, s) => sum + s.total_amount, 0),
        total_sales: processedSales.length,
        avg_ticket: processedSales.length > 0 ? processedSales.reduce((sum, s) => sum + s.total_amount, 0) / processedSales.length : 0,
        commission_today: todaySales.reduce((sum, s) => sum + s.commission_amount, 0),
        commission_week: weekSales.reduce((sum, s) => sum + s.commission_amount, 0),
        commission_month: monthSales.reduce((sum, s) => sum + s.commission_amount, 0)
      };

      setStats(newStats);
    } catch (error) {
      console.error('Error loading my data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Data inválida';
      }
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Data inválida';
    }
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Dinheiro',
      CREDIT_CARD: 'Cartão de Crédito',
      DEBIT_CARD: 'Cartão de Débito',
      PIX: 'PIX',
      BANK_TRANSFER: 'Transferência',
      CHECK: 'Cheque',
      CREDIT: 'Fiado',
      OTHER: 'Outro'
    };
    return methods[method] || method;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Meus Relatórios</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="today">Hoje</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Últimos 30 dias</option>
            </select>
          </div>
          
          <Button
            onClick={loadMyData}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <span>{loading ? 'Carregando...' : 'Atualizar'}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vendas Hoje</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.today)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vendas na Semana</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.week)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-full">
              <Receipt className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Vendas</p>
              <p className="text-2xl font-bold">{stats.total_sales}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <Award className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ticket Médio</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.avg_ticket)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Commission Cards (if enabled) */}
      {profile?.commission_enabled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-green-200 bg-green-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-700">Comissão Hoje</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(stats.commission_today)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-green-200 bg-green-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-700">Comissão Semana</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(stats.commission_week)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-green-200 bg-green-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Award className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-700">Comissão Mês</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(stats.commission_month)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Sales List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Minhas Vendas</h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">Carregando...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Nenhuma venda encontrada no período selecionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Nº Venda</th>
                  <th className="text-left py-2">Cliente</th>
                  <th className="text-right py-2">Valor</th>
                  <th className="text-right py-2">Comissão</th>
                  <th className="text-left py-2">Pagamento</th>
                  <th className="text-left py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <span className="font-mono text-sm">#{sale.sale_number}</span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{sale.customer_name || 'Cliente Avulso'}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(sale.total_amount)}
                    </td>
                    <td className="py-2 text-right">
                      {sale.commission_amount > 0 ? (
                        <span className="text-green-600 font-medium">
                          {formatCurrency(sale.commission_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {formatPaymentMethod(sale.payment_method)}
                      </span>
                    </td>
                    <td className="py-2 text-sm text-gray-600">
                      {formatDate(sale.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};