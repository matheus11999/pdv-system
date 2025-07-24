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
  Package,
  CreditCard,
  Target,
  ShoppingCart,
  Activity,
  Clock,
  Star,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import jsPDF from 'jspdf';

type Period = 'today' | 'week' | 'month';
type ActiveTab = 'overview' | 'top-products' | 'low-stock' | 'customers';

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
  stock_current: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  category: string;
  stock_current: number;
  stock_minimum: number;
  cost_price: number;
  sale_price: number;
  total_sold: number;
  total_revenue: number;
  profit_margin: number;
  is_profitable: boolean;
  last_sale_date: string;
}

interface Customer {
  id: string;
  name: string;
  debt_balance: number;
  last_payment_date: string;
  total_purchases: number;
  total_spent: number;
  loyalty_points: number;
  months_without_payment: number;
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Filters
  const [stockFilter, setStockFilter] = useState<'all' | 'profitable' | 'popular'>('all');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'debt' | 'inactive'>('all');
  
  const { settings: storeSettings } = useStoreSettings();

  useEffect(() => {
    fetchReportsData();
  }, [period]);

  useEffect(() => {
    if (activeTab === 'top-products') {
      fetchTopProducts();
    } else if (activeTab === 'low-stock') {
      fetchLowStockProducts();
    } else if (activeTab === 'customers') {
      fetchCustomers();
    }
  }, [activeTab, period, stockFilter, customerFilter]);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      await fetchSalesData();
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesData = async () => {
    try {
      const today = new Date();
      let dateFilter: Date;
      
      if (period === 'today') {
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
        dateFilter.setHours(0, 0, 0, 0);
      } else { // month
        dateFilter = new Date();
        dateFilter.setDate(1);
        dateFilter.setHours(0, 0, 0, 0);
      }

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
            unit_cost
          )
        `)
        .gte('created_at', dateFilter.toISOString())
        .eq('status', 'COMPLETED');

      if (error) throw error;

      // Process sales data
      const totalSales = sales?.length || 0;
      const totalRevenue = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const totalProfit = sales?.reduce((sum, sale) => {
        const saleProfit = sale.sale_items?.reduce((itemSum: number, item: any) => {
          return itemSum + ((item.unit_price - (item.unit_cost || 0)) * item.quantity);
        }, 0) || 0;
        return sum + saleProfit;
      }, 0) || 0;

      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Payment method breakdown
      const paymentBreakdown = sales?.reduce((acc, sale) => {
        const method = sale.payment_method;
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      setSalesData({
        total_sales: totalSales,
        total_revenue: totalRevenue,
        total_profit: totalProfit,
        profit_margin: profitMargin,
        avg_ticket: avgTicket,
        cash_sales: paymentBreakdown.CASH || 0,
        credit_card_sales: (paymentBreakdown.CREDIT_CARD || 0) + (paymentBreakdown.DEBIT_CARD || 0),
        pix_sales: paymentBreakdown.PIX || 0,
        credit_sales: paymentBreakdown.CREDIT || 0,
        today: {
          date: new Date().toISOString().split('T')[0],
          day_name: new Date().toLocaleDateString('pt-BR', { weekday: 'long' }),
          sales_count: totalSales,
          revenue: totalRevenue,
          profit: totalProfit,
          profit_margin: profitMargin,
          items_sold: sales?.reduce((sum, sale) => sum + (sale.sale_items?.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0) || 0), 0) || 0
        },
        week: [],
        month: []
      });
    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const today = new Date();
      let dateFilter: Date;
      
      if (period === 'today') {
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter = new Date();
        dateFilter.setDate(1);
        dateFilter.setHours(0, 0, 0, 0);
      }

      // First get completed sales for the period
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id')
        .gte('created_at', dateFilter.toISOString())
        .eq('status', 'COMPLETED');

      if (salesError) throw salesError;

      if (!sales || sales.length === 0) {
        setTopProducts([]);
        return;
      }

      const saleIds = sales.map(sale => sale.id);

      // Now get sale items with product details
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price,
          unit_cost,
          products (
            name,
            current_stock,
            categories (name)
          )
        `)
        .in('sale_id', saleIds);

      if (error) throw error;

      // Group by product and calculate metrics
      const productStats = data?.reduce((acc, item) => {
        const productId = item.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            id: productId,
            name: item.product_name || item.products?.name || 'Produto sem nome',
            category: item.products?.categories?.name || 'Sem categoria',
            quantity_sold: 0,
            revenue: 0,
            profit: 0,
            stock_current: item.products?.current_stock || 0,
            prices: []
          };
        }
        
        acc[productId].quantity_sold += item.quantity;
        acc[productId].revenue += item.total_price;
        acc[productId].profit += (item.unit_price - (item.unit_cost || 0)) * item.quantity;
        acc[productId].prices.push(item.unit_price);
        
        return acc;
      }, {} as Record<string, any>) || {};

      const topProductsList = Object.values(productStats)
        .map((product: any) => ({
          ...product,
          profit_margin: product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0,
          avg_price: product.prices.length > 0 ? product.prices.reduce((sum: number, price: number) => sum + price, 0) / product.prices.length : 0
        }))
        .sort((a, b) => b.quantity_sold - a.quantity_sold)
        .slice(0, 50);

      setTopProducts(topProductsList);
    } catch (error) {
      console.error('Error fetching top products:', error);
    }
  };

  const fetchLowStockProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          current_stock,
          min_stock,
          cost_price,
          sale_price,
          categories (name)
        `)
        .eq('is_active', true);

      if (error) throw error;

      // Filter products with low stock in JavaScript since Supabase comparison might not work
      const lowStockProducts = products?.filter(product => 
        product.current_stock <= (product.min_stock || 0)
      ) || [];

      // Get sales data for these products
      const productIds = lowStockProducts?.map(p => p.id) || [];
      
      const { data: salesData, error: salesError } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          total_price,
          sales!inner (
            created_at,
            status
          )
        `)
        .in('product_id', productIds)
        .eq('sales.status', 'COMPLETED')
        .gte('sales.created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 3 months

      if (salesError) throw salesError;

      // Calculate metrics for each product
      const productMetrics = lowStockProducts?.map(product => {
        const productSales = salesData?.filter(sale => sale.product_id === product.id) || [];
        const totalSold = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
        const totalRevenue = productSales.reduce((sum, sale) => sum + sale.total_price, 0);
        const profitMargin = ((product.sale_price - product.cost_price) / product.sale_price) * 100;
        
        const lastSale = productSales.sort((a, b) => new Date(b.sales.created_at).getTime() - new Date(a.sales.created_at).getTime())[0];
        
        return {
          ...product,
          category: product.categories?.name || 'Sem categoria',
          stock_minimum: product.min_stock,
          stock_current: product.current_stock,
          total_sold: totalSold,
          total_revenue: totalRevenue,
          profit_margin: profitMargin,
          is_profitable: profitMargin > 20, // Consider profitable if margin > 20%
          last_sale_date: lastSale?.sales.created_at || null
        };
      }) || [];

      // Apply filters
      let filteredProducts = productMetrics;
      if (stockFilter === 'profitable') {
        filteredProducts = productMetrics.filter(p => p.is_profitable && p.total_sold > 0);
      } else if (stockFilter === 'popular') {
        filteredProducts = productMetrics.filter(p => p.total_sold > 5); // Sold more than 5 units
      }

      setLowStockProducts(filteredProducts.sort((a, b) => b.total_sold - a.total_sold));
    } catch (error) {
      console.error('Error fetching low stock products:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data: customersData, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          debt_balance,
          last_payment_date,
          loyalty_points,
          created_at
        `)
        .eq('is_active', true);

      if (error) throw error;

      // Get customer payment data (debt payments, not sales)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select(`
          customer_id,
          payment_amount,
          payment_date,
          created_at
        `);

      if (paymentsError) throw paymentsError;

      // Get sales data for total purchases and spent
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          customer_id,
          total_amount,
          created_at,
          status
        `)
        .eq('status', 'COMPLETED')
        .not('customer_id', 'is', null);

      if (salesError) throw salesError;

      // Calculate customer metrics
      const customerMetrics = customersData?.map(customer => {
        const customerSales = salesData?.filter(sale => sale.customer_id === customer.id) || [];
        const customerPayments = paymentsData?.filter(payment => payment.customer_id === customer.id) || [];
        
        const totalPurchases = customerSales.length;
        const totalSpent = customerSales.reduce((sum, sale) => sum + sale.total_amount, 0);
        
        // Find last debt payment (from customer_payments table)
        let lastDebtPayment = null;
        let daysSinceLastPayment = null;
        
        if (customerPayments.length > 0) {
          // Sort payments by date (most recent first)
          const sortedPayments = customerPayments.sort((a, b) => 
            new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime()
          );
          
          lastDebtPayment = sortedPayments[0];
          const paymentDate = new Date(lastDebtPayment.payment_date || lastDebtPayment.created_at);
          daysSinceLastPayment = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          ...customer,
          total_purchases: totalPurchases,
          total_spent: totalSpent,
          days_since_last_payment: daysSinceLastPayment,
          last_debt_payment_date: lastDebtPayment?.payment_date || lastDebtPayment?.created_at || null
        };
      }) || [];

      // Apply filters
      let filteredCustomers = customerMetrics;
      if (customerFilter === 'debt') {
        filteredCustomers = customerMetrics.filter(c => c.debt_balance > 0).sort((a, b) => b.debt_balance - a.debt_balance);
      } else if (customerFilter === 'inactive') {
        filteredCustomers = customerMetrics.filter(c => c.days_since_last_payment === null || c.days_since_last_payment >= 60).sort((a, b) => (b.days_since_last_payment || 999) - (a.days_since_last_payment || 999));
      }

      setCustomers(filteredCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const generateHTMLReport = (title: string, data: any[], type: 'products' | 'stock' | 'customers' | 'overview') => {
    const companyName = storeSettings?.company_name || 'Sistema PDV';
    const periodLabel = period === 'today' ? 'Hoje' : period === 'week' ? 'Últimos 7 dias' : 'Este mês';
    
    let tableContent = '';
    
    if (type === 'overview' && salesData) {
      tableContent = `
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Total de Vendas</h3>
            <p class="stat-value">${salesData.total_sales}</p>
          </div>
          <div class="stat-card">
            <h3>Receita Total</h3>
            <p class="stat-value">R$ ${salesData.total_revenue.toFixed(2)}</p>
          </div>
          <div class="stat-card">
            <h3>Lucro Total</h3>
            <p class="stat-value">R$ ${salesData.total_profit.toFixed(2)}</p>
          </div>
          <div class="stat-card">
            <h3>Margem de Lucro</h3>
            <p class="stat-value">${salesData.profit_margin.toFixed(1)}%</p>
          </div>
          <div class="stat-card">
            <h3>Ticket Médio</h3>
            <p class="stat-value">R$ ${salesData.avg_ticket.toFixed(2)}</p>
          </div>
        </div>
      `;
    } else if (type === 'products') {
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Qtd Vendida</th>
              <th>Receita</th>
              <th>Lucro</th>
              <th>Margem</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.quantity_sold}</td>
                <td>R$ ${item.revenue.toFixed(2)}</td>
                <td>R$ ${item.profit.toFixed(2)}</td>
                <td>${item.profit_margin.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'stock') {
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Estoque Atual</th>
              <th>Estoque Mínimo</th>
              <th>Vendas (3 meses)</th>
              <th>Receita</th>
              <th>Margem</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.stock_current}</td>
                <td>${item.stock_minimum}</td>
                <td>${item.total_sold}</td>
                <td>R$ ${item.total_revenue.toFixed(2)}</td>
                <td>${item.profit_margin.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'customers') {
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Saldo Devedor</th>
              <th>Último Pagamento</th>
              <th>Pontos Fidelidade</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>R$ ${item.debt_balance.toFixed(2)}</td>
                <td>${item.days_since_last_payment === null ? 'Nunca' : item.days_since_last_payment === 0 ? 'Hoje' : `${item.days_since_last_payment} dias`}</td>
                <td>${item.loyalty_points}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${companyName}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 20px; 
            background: #f8f9fa; 
        }
        .report-container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
            border-bottom: 3px solid #3b82f6; 
            padding-bottom: 20px; 
        }
        .header h1 { 
            color: #1f2937; 
            margin: 0 0 10px 0; 
            font-size: 28px; 
            font-weight: 700; 
        }
        .header h2 { 
            color: #3b82f6; 
            margin: 0 0 5px 0; 
            font-size: 20px; 
            font-weight: 600; 
        }
        .period { 
            color: #6b7280; 
            font-size: 14px; 
            font-weight: 500; 
        }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
            color: white; 
            padding: 20px; 
            border-radius: 12px; 
            text-align: center; 
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); 
        }
        .stat-card h3 { 
            margin: 0 0 10px 0; 
            font-size: 14px; 
            font-weight: 500; 
            opacity: 0.9; 
        }
        .stat-value { 
            font-size: 24px; 
            font-weight: 700; 
            margin: 0; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        th { 
            background: linear-gradient(135deg, #374151 0%, #1f2937 100%); 
            color: white; 
            padding: 15px 12px; 
            text-align: left; 
            font-weight: 600; 
            font-size: 13px; 
            text-transform: uppercase; 
            letter-spacing: 0.5px; 
        }
        td { 
            padding: 12px; 
            border-bottom: 1px solid #e5e7eb; 
            font-size: 14px; 
        }
        tr:nth-child(even) { 
            background-color: #f9fafb; 
        }
        tr:hover { 
            background-color: #f3f4f6; 
        }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            color: #6b7280; 
            font-size: 12px; 
        }
        @media print {
            body { margin: 0; background: white; }
            .report-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>${companyName}</h1>
            <h2>${title}</h2>
            <div class="period">${periodLabel} • Gerado em ${new Date().toLocaleString('pt-BR')}</div>
        </div>
        
        ${tableContent}
        
        <div class="footer">
            <p>Relatório gerado automaticamente pelo Sistema PDV</p>
            <p>${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
    </div>
    
    <script>
        // Auto print after 1 second
        setTimeout(() => {
            window.print();
        }, 1000);
    </script>
</body>
</html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      newWindow.focus();
    }
  };

  const getPaginatedData = (data: any[]) => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: any[]) => Math.ceil(data.length / pageSize);

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
    { id: 'top-products', label: 'Top Produtos', icon: TrendingUp },
    { id: 'low-stock', label: 'Estoque Baixo', icon: AlertTriangle },
    { id: 'customers', label: 'Clientes', icon: Users }
  ];

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

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600">Análise detalhada de vendas e performance</p>
        </div>
        
        {/* Period Filter */}
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="today">Hoje</option>
            <option value="week">Últimos 7 dias</option>
            <option value="month">Este mês</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as ActiveTab);
                  setCurrentPage(1);
                }}
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

      {/* Overview Tab */}
      {activeTab === 'overview' && salesData && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Vendas</p>
                  <p className="text-2xl font-bold text-blue-600">{salesData.total_sales}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Receita</p>
                  <p className="text-2xl font-bold text-green-600">R$ {salesData.total_revenue.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Lucro</p>
                  <p className="text-2xl font-bold text-purple-600">R$ {salesData.total_profit.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Margem</p>
                  <p className="text-2xl font-bold text-orange-600">{salesData.profit_margin.toFixed(1)}%</p>
                </div>
                <Target className="w-8 h-8 text-orange-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ticket Médio</p>
                  <p className="text-2xl font-bold text-indigo-600">R$ {salesData.avg_ticket.toFixed(2)}</p>
                </div>
                <Activity className="w-8 h-8 text-indigo-500" />
              </div>
            </Card>
          </div>

          {/* Payment Methods */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Métodos de Pagamento</h3>
              <Button
                onClick={() => generateHTMLReport('Relatório de Vendas', [], 'overview')}
                size="sm"
                className="flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <CreditCard className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Dinheiro</p>
                <p className="text-xl font-bold text-blue-600">{salesData.cash_sales}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CreditCard className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Cartão</p>
                <p className="text-xl font-bold text-green-600">{salesData.credit_card_sales}</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <span className="text-2xl mb-2 block">📱</span>
                <p className="text-sm text-gray-600">PIX</p>
                <p className="text-xl font-bold text-purple-600">{salesData.pix_sales}</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Fiado</p>
                <p className="text-xl font-bold text-orange-600">{salesData.credit_sales}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Top Products Tab */}
      {activeTab === 'top-products' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Produtos Mais Vendidos</h3>
              <Button
                onClick={() => generateHTMLReport('Top Produtos', topProducts, 'products')}
                size="sm"
                className="flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </div>
            
            {topProducts.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Produto</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Categoria</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Qtd Vendida</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Receita</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Lucro</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Margem</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Estoque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getPaginatedData(topProducts).map((product, index) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                                {((currentPage - 1) * pageSize) + index + 1}
                              </span>
                              <span className="font-medium">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{product.category}</td>
                          <td className="px-4 py-3 text-center font-medium">{product.quantity_sold}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">
                            R$ {product.revenue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-purple-600">
                            R$ {product.profit.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.profit_margin > 30 ? 'bg-green-100 text-green-800' :
                              product.profit_margin > 15 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {product.profit_margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.stock_current > 10 ? 'bg-green-100 text-green-800' :
                              product.stock_current > 0 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {product.stock_current}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {getTotalPages(topProducts) > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, topProducts.length)} de {topProducts.length} produtos
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600">
                        {currentPage} de {getTotalPages(topProducts)}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(currentPage + 1, getTotalPages(topProducts)))}
                        disabled={currentPage === getTotalPages(topProducts)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum produto vendido no período selecionado</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Low Stock Tab */}
      {activeTab === 'low-stock' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Produtos com Estoque Baixo</h3>
              <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                <select
                  value={stockFilter}
                  onChange={(e) => {
                    setStockFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="all">Todos os produtos</option>
                  <option value="profitable">Mais lucrativos</option>
                  <option value="popular">Mais vendidos</option>
                </select>
                <Button
                  onClick={() => generateHTMLReport('Relatório de Estoque Baixo', lowStockProducts, 'stock')}
                  size="sm"
                  className="flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Relatório
                </Button>
              </div>
            </div>
            
            {lowStockProducts.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Produto</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Categoria</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Estoque</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Vendas (3m)</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Receita</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Margem</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getPaginatedData(lowStockProducts).map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium">{product.name}</span>
                              {product.last_sale_date && (
                                <p className="text-xs text-gray-500">
                                  Última venda: {new Date(product.last_sale_date).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{product.category}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="text-center">
                              <span className={`font-medium ${
                                product.stock_current === 0 ? 'text-red-600' : 'text-orange-600'
                              }`}>
                                {product.stock_current}
                              </span>
                              <span className="text-gray-400 text-sm">/{product.stock_minimum}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-medium">{product.total_sold}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">
                            R$ {product.total_revenue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.profit_margin > 30 ? 'bg-green-100 text-green-800' :
                              product.profit_margin > 15 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {product.profit_margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {product.is_profitable && product.total_sold > 0 && (
                                <span className="w-2 h-2 bg-green-500 rounded-full" title="Lucrativo"></span>
                              )}
                              {product.total_sold > 5 && (
                                <Star className="w-3 h-3 text-yellow-500" title="Popular" />
                              )}
                              {product.stock_current === 0 && (
                                <AlertTriangle className="w-3 h-3 text-red-500" title="Sem estoque" />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {getTotalPages(lowStockProducts) > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, lowStockProducts.length)} de {lowStockProducts.length} produtos
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600">
                        {currentPage} de {getTotalPages(lowStockProducts)}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(currentPage + 1, getTotalPages(lowStockProducts)))}
                        disabled={currentPage === getTotalPages(lowStockProducts)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum produto com estoque baixo</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Análise de Clientes</h3>
              <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                <select
                  value={customerFilter}
                  onChange={(e) => {
                    setCustomerFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="all">Todos os clientes</option>
                  <option value="debt">Maior saldo devedor</option>
                  <option value="inactive">Sem pagamento +2 meses</option>
                </select>
                <Button
                  onClick={() => generateHTMLReport('Relatório de Clientes', customers, 'customers')}
                  size="sm"
                  className="flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Relatório
                </Button>
              </div>
            </div>
            
            {customers.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Cliente</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Saldo Devedor</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Último Pagamento</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Pontos</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getPaginatedData(customers).map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="font-medium">{customer.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${
                              customer.debt_balance > 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              R$ {customer.debt_balance.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                customer.days_since_last_payment === null ? 'bg-gray-100 text-gray-800' :
                                customer.days_since_last_payment >= 180 ? 'bg-red-100 text-red-800' :
                                customer.days_since_last_payment >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                customer.days_since_last_payment > 0 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {customer.days_since_last_payment === null ? 'Nunca' :
                                 customer.days_since_last_payment === 0 ? 'Hoje' : 
                                 `${customer.days_since_last_payment} dias`}
                              </span>
                              {customer.last_debt_payment_date && customer.days_since_last_payment !== 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Pagamento: {new Date(customer.last_debt_payment_date).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-purple-600">
                            {customer.loyalty_points}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {customer.debt_balance > 0 && (
                                <span className="w-2 h-2 bg-red-500 rounded-full" title="Com dívida"></span>
                              )}
                              {(customer.days_since_last_payment === null || customer.days_since_last_payment >= 60) && (
                                <Clock className="w-3 h-3 text-orange-500" title="Sem pagamentos recentes" />
                              )}
                              {customer.total_spent > 1000 && (
                                <Star className="w-3 h-3 text-yellow-500" title="Cliente VIP" />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {getTotalPages(customers) > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, customers.length)} de {customers.length} clientes
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600">
                        {currentPage} de {getTotalPages(customers)}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(currentPage + 1, getTotalPages(customers)))}
                        disabled={currentPage === getTotalPages(customers)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum cliente encontrado</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};