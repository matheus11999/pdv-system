import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  Download, 
  AlertTriangle, 
  BarChart3, 
  PieChart,
  FileText,
  Filter,
  ArrowUp,
  ArrowDown,
  Equal,
  Package,
  CreditCard,
  Target,
  ShoppingCart,
  Activity
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';

interface SalesData {
  total_sales: number;
  total_revenue: number;
  total_profit: number;
  profit_margin: number;
  avg_ticket: number;
  cash_sales: number;
  credit_card_sales: number;
  pix_sales: number;
  credit_sales: number;
  today: SalesDay;
  week: SalesDay[];
  month: SalesDay[];
}

interface SalesDay {
  date: string;
  day_name: string;
  sales_count: number;
  revenue: number;
  profit: number;
  profit_margin: number;
  items_sold: number;
  payment_methods: {
    cash: number;
    credit_card: number;
    pix: number;
    credit: number;
  };
}

interface TopProduct {
  id: string;
  name: string;
  category: string;
  quantity_sold: number;
  revenue: number;
  profit: number;
  profit_margin: number;
  avg_price: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  cost_price: number;
  sale_price: number;
  status: 'out_of_stock' | 'low_stock' | 'critical';
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'stock'>('overview');
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data states
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSalesData(),
        fetchTopProducts(),
        fetchLowStockProducts()
      ]);
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesData = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      let dateFilter = startOfDay;
      if (period === 'week') dateFilter = startOfWeek;
      if (period === 'month') dateFilter = startOfMonth;

      // Fetch sales data
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          payment_method,
          created_at,
          sale_items (
            quantity,
            unit_price,
            total_price,
            product_id,
            products (
              cost_price
            )
          )
        `)
        .gte('created_at', dateFilter.toISOString())
        .eq('status', 'COMPLETED');

      if (error) throw error;

      // Process sales data
      const processedData = processSalesData(sales || []);
      setSalesData(processedData);

    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  };

  const processSalesData = (sales: any[]): SalesData => {
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    const weekData = last7Days.map(date => {
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const daySales = sales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= dayStart && saleDate <= dayEnd;
      });

      const revenue = daySales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const profit = daySales.reduce((sum, sale) => {
        return sum + sale.sale_items.reduce((itemSum: number, item: any) => {
          const cost = (item.products?.cost_price || 0) * item.quantity;
          return itemSum + (item.total_price - cost);
        }, 0);
      }, 0);

      const paymentMethods = {
        cash: daySales.filter(s => s.payment_method === 'CASH').length,
        credit_card: daySales.filter(s => s.payment_method === 'CREDIT_CARD').length,
        pix: daySales.filter(s => s.payment_method === 'PIX').length,
        credit: daySales.filter(s => s.payment_method === 'CREDIT').length,
      };

      return {
        date: date.toISOString().split('T')[0],
        day_name: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
        sales_count: daySales.length,
        revenue,
        profit,
        profit_margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        items_sold: daySales.reduce((sum, sale) => sum + sale.sale_items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0),
        payment_methods: paymentMethods
      };
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalProfit = sales.reduce((sum, sale) => {
      return sum + sale.sale_items.reduce((itemSum: number, item: any) => {
        const cost = (item.products?.cost_price || 0) * item.quantity;
        return itemSum + (item.total_price - cost);
      }, 0);
    }, 0);

    return {
      total_sales: sales.length,
      total_revenue: totalRevenue,
      total_profit: totalProfit,
      profit_margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      avg_ticket: sales.length > 0 ? totalRevenue / sales.length : 0,
      cash_sales: sales.filter(s => s.payment_method === 'CASH').length,
      credit_card_sales: sales.filter(s => s.payment_method === 'CREDIT_CARD').length,
      pix_sales: sales.filter(s => s.payment_method === 'PIX').length,
      credit_sales: sales.filter(s => s.payment_method === 'CREDIT').length,
      today: weekData[weekData.length - 1],
      week: weekData,
      month: weekData // Simplified - in production would fetch actual month data
    };
  };

  const fetchTopProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          unit_price,
          total_price,
          products (
            name,
            cost_price,
            categories (
              name
            )
          ),
          sales!inner (
            created_at,
            status
          )
        `)
        .eq('sales.status', 'COMPLETED')
        .gte('sales.created_at', getPeriodStartDate().toISOString());

      if (error) throw error;

      // Group by product and calculate metrics
      const productGroups = (data || []).reduce((acc: any, item) => {
        const productId = item.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            id: productId,
            name: item.products.name,
            category: item.products.categories?.name || 'Sem categoria',
            quantity_sold: 0,
            revenue: 0,
            cost: 0,
            sales: []
          };
        }
        acc[productId].quantity_sold += item.quantity;
        acc[productId].revenue += item.total_price;
        acc[productId].cost += (item.products.cost_price || 0) * item.quantity;
        acc[productId].sales.push(item.unit_price);
        return acc;
      }, {});

      const topProducts = Object.values(productGroups)
        .map((product: any) => ({
          ...product,
          profit: product.revenue - product.cost,
          profit_margin: product.revenue > 0 ? ((product.revenue - product.cost) / product.revenue) * 100 : 0,
          avg_price: product.sales.length > 0 ? product.sales.reduce((sum: number, price: number) => sum + price, 0) / product.sales.length : 0
        }))
        .sort((a: any, b: any) => b.quantity_sold - a.quantity_sold)
        .slice(0, 10);

      setTopProducts(topProducts);
    } catch (error) {
      console.error('Error fetching top products:', error);
    }
  };

  const fetchLowStockProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          current_stock,
          min_stock,
          max_stock,
          cost_price,
          sale_price,
          categories (
            name
          )
        `)
        .eq('is_active', true)
        .order('current_stock', { ascending: true });

      if (error) throw error;

      // Filter products with low stock in JavaScript to ensure correct logic
      const lowStockFiltered = (data || []).filter(product => 
        product.current_stock <= 0 || product.current_stock < product.min_stock
      );

      const processedProducts = lowStockFiltered.map(product => ({
        ...product,
        category: product.categories?.name || 'Sem categoria',
        status: product.current_stock <= 0 ? 'out_of_stock' : 
                product.current_stock < product.min_stock ? 'low_stock' : 'critical'
      }));

      setLowStockProducts(processedProducts as LowStockProduct[]);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
    }
  };

  const getPeriodStartDate = () => {
    const today = new Date();
    if (period === 'today') {
      return new Date(today.setHours(0, 0, 0, 0));
    } else if (period === 'week') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return new Date(startOfWeek.setHours(0, 0, 0, 0));
    } else {
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }
  };

  const getPeriodLabel = () => {
    const labels = {
      today: 'Hoje',
      week: 'Esta Semana',
      month: 'Este Mês'
    };
    return labels[period];
  };

  const exportLowStockPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Relatório de Produtos com Estoque Baixo', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
    doc.text(`Produtos com problemas de estoque: ${lowStockProducts.length}`, 20, 40);
    
    let yPosition = 60;
    
    lowStockProducts.forEach((product, index) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${product.name}`, 20, yPosition);
      doc.text(`Categoria: ${product.category}`, 25, yPosition + 7);
      doc.text(`Estoque atual: ${product.current_stock}`, 25, yPosition + 14);
      doc.text(`Estoque mínimo: ${product.min_stock}`, 25, yPosition + 21);
      doc.text(`Status: ${getStockStatusLabel(product.status)}`, 25, yPosition + 28);
      
      yPosition += 40;
    });
    
    doc.save('produtos-estoque-baixo.pdf');
  };

  const getStockStatusLabel = (status: string) => {
    const labels = {
      out_of_stock: 'SEM ESTOQUE',
      low_stock: 'ESTOQUE BAIXO',
      critical: 'CRÍTICO'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStockStatusColor = (status: string) => {
    const colors = {
      out_of_stock: 'text-red-600 bg-red-50',
      low_stock: 'text-orange-600 bg-orange-50',
      critical: 'text-yellow-600 bg-yellow-50'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  const filteredLowStockProducts = lowStockProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header - Responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6 mr-2 text-blue-500" />
            Relatórios & Analytics
          </h1>
          <p className="text-gray-600">Análise completa de vendas, produtos e estoque</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="today">Hoje</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
          </select>
          
          <Button onClick={exportLowStockPDF} variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Tabs - Responsivo */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 lg:space-x-8 overflow-x-auto">
          {[
            { id: 'overview', name: 'Visão Geral', icon: Activity },
            { id: 'products', name: 'Top Produtos', icon: Package },
            { id: 'stock', name: 'Estoque Baixo', icon: AlertTriangle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-xs lg:text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">{tab.name}</span>
              <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && salesData && (
        <div className="space-y-6">
          {/* KPI Cards - Otimizado para mobile */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between lg:justify-start">
                <div className="min-w-0 flex-1 lg:flex-initial">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Faturamento {getPeriodLabel()}</p>
                  <p className="text-lg lg:text-2xl font-bold text-green-600 truncate">
                    R$ {salesData.total_revenue.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {salesData.total_sales} vendas
                  </p>
                </div>
                <div className="p-2 lg:p-3 rounded-full bg-green-100 lg:mr-4 flex-shrink-0">
                  <DollarSign className="w-4 h-4 lg:w-6 lg:h-6 text-green-600" />
                </div>
              </div>
            </Card>

            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between lg:justify-start">
                <div className="min-w-0 flex-1 lg:flex-initial">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Lucro {getPeriodLabel()}</p>
                  <p className="text-lg lg:text-2xl font-bold text-emerald-600 truncate">
                    R$ {salesData.total_profit.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {salesData.profit_margin.toFixed(1)}% margem
                  </p>
                </div>
                <div className="p-2 lg:p-3 rounded-full bg-emerald-100 lg:mr-4 flex-shrink-0">
                  <TrendingUp className="w-4 h-4 lg:w-6 lg:h-6 text-emerald-600" />
                </div>
              </div>
            </Card>

            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between lg:justify-start">
                <div className="min-w-0 flex-1 lg:flex-initial">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Ticket Médio</p>
                  <p className="text-lg lg:text-2xl font-bold text-blue-600 truncate">
                    R$ {salesData.avg_ticket.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    por venda
                  </p>
                </div>
                <div className="p-2 lg:p-3 rounded-full bg-blue-100 lg:mr-4 flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 lg:w-6 lg:h-6 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between lg:justify-start">
                <div className="min-w-0 flex-1 lg:flex-initial">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Meta Atingida</p>
                  <p className="text-lg lg:text-2xl font-bold text-purple-600 truncate">
                    {Math.min(100, (salesData.total_revenue / 5000) * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    Meta: R$ 5.000
                  </p>
                </div>
                <div className="p-2 lg:p-3 rounded-full bg-purple-100 lg:mr-4 flex-shrink-0">
                  <Target className="w-4 h-4 lg:w-6 lg:h-6 text-purple-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                Performance dos Últimos 7 Dias
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-end justify-between h-40 border-b border-gray-200 pb-2">
                  {salesData.week.map((day, index) => {
                    const maxRevenue = Math.max(...salesData.week.map(d => d.revenue));
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 120 : 2;
                    
                    return (
                      <div key={index} className="flex flex-col items-center flex-1 mx-1">
                        <div 
                          className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                          style={{ height: `${Math.max(height, 2)}px` }}
                          title={`${day.day_name}: R$ ${day.revenue.toFixed(2)} (${day.sales_count} vendas)`}
                        />
                        <span className="text-xs text-gray-600 mt-2 font-medium">
                          {day.day_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {day.sales_count}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Maior Faturamento</p>
                    <p className="font-bold text-green-600">
                      R$ {Math.max(...salesData.week.map(d => d.revenue)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Média Diária</p>
                    <p className="font-bold text-blue-600">
                      R$ {(salesData.week.reduce((sum, day) => sum + day.revenue, 0) / 7).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment Methods */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <PieChart className="w-5 h-5 mr-2 text-purple-500" />
                Métodos de Pagamento
              </h3>
              
              <div className="space-y-4">
                {[
                  { name: 'Dinheiro', count: salesData.cash_sales, color: 'bg-blue-500', emoji: '💵' },
                  { name: 'Cartão', count: salesData.credit_card_sales, color: 'bg-purple-500', emoji: '💳' },
                  { name: 'PIX', count: salesData.pix_sales, color: 'bg-green-500', emoji: '📱' },
                  { name: 'Fiado', count: salesData.credit_sales, color: 'bg-orange-500', emoji: '🏪' }
                ].filter(method => method.count > 0).map((method, index) => {
                  const percentage = (method.count / salesData.total_sales) * 100;
                  return (
                    <div key={index} className="flex items-center">
                      <div className="flex items-center w-20">
                        <span className="mr-2">{method.emoji}</span>
                        <span className="text-sm text-gray-700">{method.name}</span>
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`${method.color} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right w-16">
                        <span className="text-sm font-semibold text-gray-900">
                          {method.count}
                        </span>
                        <div className="text-xs text-gray-500">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-green-500" />
              Top 10 Produtos Mais Vendidos - {getPeriodLabel()}
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Produto</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900">Qtd Vendida</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Receita</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Lucro</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, index) => (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <span className="font-bold text-lg text-gray-900">#{index + 1}</span>
                          {index === 0 && <span className="ml-2 text-yellow-500">🏆</span>}
                          {index === 1 && <span className="ml-2 text-gray-400">🥈</span>}
                          {index === 2 && <span className="ml-2 text-orange-600">🥉</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.category}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                          {product.quantity_sold}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-green-600">
                          R$ {product.revenue.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-emerald-600">
                          R$ {product.profit.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.profit_margin >= 30 ? 'bg-green-100 text-green-800' :
                          product.profit_margin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.profit_margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                  Produtos com Estoque Baixo
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredLowStockProducts.length} produtos precisam de atenção
                </p>
              </div>
              
              <div className="flex gap-3">
                <Input
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
                <Button onClick={exportLowStockPDF} variant="secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            </div>
            
            {/* Lista de Produtos com Estoque Baixo */}
            <div className="space-y-2">
              {filteredLowStockProducts.map(product => (
                <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all hover:border-orange-300">
                  <div className="flex items-center justify-between">
                    {/* Informações do Produto */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-lg">{product.name}</h4>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <Package className="w-3 h-3 mr-1" />
                            {product.category}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Métricas em linha */}
                    <div className="flex items-center space-x-6 text-sm">
                      {/* Estoque Atual */}
                      <div className="text-center">
                        <p className="text-gray-600 text-xs">Atual</p>
                        <p className={`font-bold text-lg ${product.current_stock <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                          {product.current_stock}
                        </p>
                      </div>
                      
                      {/* Estoque Mínimo */}
                      <div className="text-center">
                        <p className="text-gray-600 text-xs">Mínimo</p>
                        <p className="font-bold text-lg text-gray-900">{product.min_stock}</p>
                      </div>
                      
                      {/* Necessita */}
                      <div className="text-center">
                        <p className="text-gray-600 text-xs">Necessita</p>
                        <p className="font-bold text-lg text-red-600">
                          {Math.max(0, product.min_stock - product.current_stock)}
                        </p>
                      </div>
                      
                      {/* Valor */}
                      <div className="text-center">
                        <p className="text-gray-600 text-xs">Venda</p>
                        <p className="font-semibold text-green-600">R$ {product.sale_price.toFixed(2)}</p>
                      </div>
                      
                      {/* Status */}
                      <div className="text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStockStatusColor(product.status)}`}>
                          {getStockStatusLabel(product.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredLowStockProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchTerm ? 'Nenhum produto encontrado com os filtros aplicados' : 'Todos os produtos estão com estoque adequado!'}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};