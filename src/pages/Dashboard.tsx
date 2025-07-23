import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Calculator,
  UserPlus,
  Receipt,
  Truck,
  Home,
  Menu,
  X,
  DollarSign,
  TrendingUp,
  Award,
  Calendar,
  AlertTriangle,
  Eye
} from 'lucide-react';

// Lazy load components
const PDVInterface = React.lazy(() => import('./PDV/PDVInterface').then(module => ({ default: module.PDVInterface })));
const ProductsPage = React.lazy(() => import('./PDV/ProductsPage').then(module => ({ default: module.ProductsPage })));
const CustomersPage = React.lazy(() => import('./PDV/CustomersPage').then(module => ({ default: module.CustomersPage })));
const SalesPage = React.lazy(() => import('./PDV/SalesPage').then(module => ({ default: module.SalesPage })));
const InventoryPage = React.lazy(() => import('./PDV/InventoryPage').then(module => ({ default: module.InventoryPage })));
const CategoriesPage = React.lazy(() => import('./PDV/CategoriesPage').then(module => ({ default: module.CategoriesPage })));
const UsersPage = React.lazy(() => import('./PDV/UsersPage').then(module => ({ default: module.UsersPage })));
const UserPerformancePage = React.lazy(() => import('./PDV/UserPerformancePage').then(module => ({ default: module.UserPerformancePage })));
const ReportsPage = React.lazy(() => import('./PDV/ReportsPage').then(module => ({ default: module.ReportsPage })));
const SettingsPage = React.lazy(() => import('./PDV/SettingsPage').then(module => ({ default: module.SettingsPage })));
const CommissionDashboard = React.lazy(() => import('../components/CommissionDashboard').then(module => ({ default: module.CommissionDashboard })));
const MyReportsPage = React.lazy(() => import('./PDV/MyReportsPage').then(module => ({ default: module.MyReportsPage })));

const Sidebar = React.memo(({ isCollapsed, onToggleCollapse }: { isCollapsed: boolean, onToggleCollapse: () => void }) => {
  const { profile, user, loading } = useAuthStore();
  
  // Memoização das verificações de permissão
  const userPermissions = useMemo(() => {
    const userRole = profile?.role || 'ADMIN';
    return {
      userRole,
      isAdmin: userRole === 'ADMIN',
      canUsePOS: ['ADMIN', 'FUNCIONARIO'].includes(userRole),
      canManageProducts: ['ADMIN', 'FUNCIONARIO'].includes(userRole),
      hasCommissions: profile?.commission_enabled
    };
  }, [profile?.role, profile?.commission_enabled]);

  // Memoização dos items do menu
  const menuItems = useMemo(() => [
    ...(userPermissions.canUsePOS ? [{
      path: '/dashboard/pdv',
      icon: Calculator,
      label: 'ABRIR PDV',
      highlight: true,
      priority: 1
    }] : []),
    
    {
      path: '/dashboard',
      icon: Home,
      label: 'Início',
      priority: 2
    },
    
    ...(userPermissions.hasCommissions ? [{
      path: '/dashboard/commissions',
      icon: DollarSign,
      label: 'Minhas Comissões',
      priority: 2.5
    }] : []),
    
    ...(userPermissions.canManageProducts ? [
      {
        path: '/dashboard/products',
        icon: Package,
        label: 'Produtos',
        priority: 3
      },
      {
        path: '/dashboard/inventory',
        icon: Truck,
        label: 'Estoque',
        priority: 4
      }
    ] : []),
    
    ...(userPermissions.canUsePOS ? [
      {
        path: '/dashboard/customers',
        icon: Users,
        label: 'Clientes',
        priority: 5
      },
      {
        path: '/dashboard/sales',
        icon: Receipt,
        label: 'Vendas',
        priority: 6
      },
      ...(userPermissions.userRole === 'FUNCIONARIO' ? [{
        path: '/dashboard/my-reports',
        icon: BarChart3,
        label: 'Meus Relatórios',
        priority: 7
      }] : [])
    ] : []),
    
    ...(userPermissions.isAdmin ? [
      {
        path: '/dashboard/categories',
        icon: Package,
        label: 'Categorias',
        priority: 7
      },
      {
        path: '/dashboard/users',
        icon: UserPlus,
        label: 'Usuários',
        priority: 8
      },
      {
        path: '/dashboard/user-performance',
        icon: TrendingUp,
        label: 'Desempenho',
        priority: 8.5
      },
      {
        path: '/dashboard/reports',
        icon: BarChart3,
        label: 'Relatórios',
        priority: 9
      },
      {
        path: '/dashboard/settings',
        icon: Settings,
        label: 'Configurações',
        priority: 10
      }
    ] : [])
  ], [userPermissions]);

  // Memoização da ordenação dos itens
  const sortedMenuItems = useMemo(() => 
    menuItems.sort((a, b) => (a.priority || 999) - (b.priority || 999)),
    [menuItems]
  );

  return (
    <div className={`${isCollapsed ? 'w-0 lg:w-16' : 'w-64'} bg-gradient-to-b from-white via-slate-50 to-white h-full shadow-xl border-r border-gray-200 transition-all duration-300 ease-in-out ${isCollapsed ? 'overflow-hidden' : 'lg:relative fixed inset-y-0 left-0 z-50 lg:z-auto'}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className={`${isCollapsed ? 'hidden' : 'block'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Sistema PDV
              </h2>
              <p className="text-sm font-medium text-slate-700">{profile?.name || 'Usuário'}</p>
              <p className="text-xs text-slate-500">{userPermissions.userRole}</p>
            </div>
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/70 transition-all duration-200 hover:shadow-md"
              title="Ocultar sidebar"
            >
              <Menu className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
        {isCollapsed && (
          <div className="hidden lg:flex justify-center">
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg hover:bg-white/70 transition-all duration-200 flex items-center justify-center hover:shadow-md"
              title="Expandir sidebar"
            >
              <Menu className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className={`p-3 space-y-2 ${isCollapsed ? 'hidden lg:block' : 'block'}`}>
        {sortedMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center ${isCollapsed ? 'justify-center' : ''} p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                item.highlight 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl transform hover:scale-105' 
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:shadow-md'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              {item.highlight && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              )}
              <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} relative z-10 ${item.highlight ? '' : 'group-hover:scale-110 transition-transform duration-200'}`} />
              {!isCollapsed && (
                <span className={`font-semibold relative z-10 ${item.highlight ? 'text-white' : ''}`}>
                  {item.label}
                </span>
              )}
              {item.highlight && !isCollapsed && (
                <span className="ml-auto text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full font-bold animate-bounce">
                  NOVO!
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      
      {/* Footer com informações do usuário quando colapsado no desktop */}
      {isCollapsed && (
        <div className="hidden lg:block absolute bottom-4 left-2 right-2">
          <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
            <span className="text-blue-600 font-bold text-sm">
              {profile?.name?.charAt(0) || 'U'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

interface DashboardStats {
  salesToday: number;
  productCount: number;
  customerCount: number;
  lowStockCount: number;
}

interface RecentSale {
  sale_number: string;
  customer_name: string | null;
  cashier_name: string | null;
  cashier_role: string | null;
  total_amount: string;
  sale_date: string;
}

interface LowStockProduct {
  name: string;
  current_stock: number;
  min_stock: number;
}

interface CommissionStats {
  today: number;
  week: number;
  month: number;
}

function DashboardHome() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0,
    productCount: 0,
    customerCount: 0,
    lowStockCount: 0
  });
  const [commissionStats, setCommissionStats] = useState<CommissionStats>({
    today: 0,
    week: 0,
    month: 0
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);

  const fetchSaleDetails = useCallback(async (saleNumber: string) => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(name, cpf, cnpj),
          sale_items(
            id,
            product_name,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('sale_number', saleNumber)
        .single();

      if (error) throw error;
      setSelectedSale(data);
      setShowSaleDetails(true);
    } catch (error) {
      console.error('Erro ao buscar detalhes da venda:', error);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch commission data if user has commissions enabled
      if (profile?.commission_enabled) {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        const todayStr = today.toISOString().split('T')[0];
        const weekStr = weekAgo.toISOString().split('T')[0];
        const monthStr = monthAgo.toISOString().split('T')[0];

        try {
          const [todayComm, weekComm, monthComm] = await Promise.all([
            supabase
              .from('sale_commissions')
              .select('commission_amount')
              .eq('user_id', profile.id)
              .gte('created_at', todayStr),
            supabase
              .from('sale_commissions')
              .select('commission_amount')
              .eq('user_id', profile.id)
              .gte('created_at', weekStr),
            supabase
              .from('sale_commissions')
              .select('commission_amount')
              .eq('user_id', profile.id)
              .gte('created_at', monthStr)
          ]);

          setCommissionStats({
            today: todayComm.data?.reduce((sum, c) => sum + parseFloat(c.commission_amount || '0'), 0) || 0,
            week: weekComm.data?.reduce((sum, c) => sum + parseFloat(c.commission_amount || '0'), 0) || 0,
            month: monthComm.data?.reduce((sum, c) => sum + parseFloat(c.commission_amount || '0'), 0) || 0
          });
        } catch (commError) {
          console.log('Commission tables not available yet');
        }
      }
      
      // Get stats - otimizado para apenas 5 vendas recentes
      let salesQuery = supabase
        .from('sales')
        .select(`
          sale_number,
          total_amount,
          created_at,
          cashier_id,
          user_id,
          customers(name)
        `)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(5);

      // If funcionario, only show their sales
      if (profile?.role === 'FUNCIONARIO') {
        salesQuery = salesQuery.eq('user_id', profile.id);
      }

      // Calculate stats based on user role
      if (profile?.role === 'FUNCIONARIO') {
        // For funcionarios, show only their personal stats
        const today = new Date().toISOString().split('T')[0];
        
        const [salesData, lowStockResult] = await Promise.all([
          supabase
            .from('sales')
            .select('total_amount')
            .eq('user_id', profile.id)
            .gte('created_at', today)
            .eq('status', 'COMPLETED'),
          supabase.rpc('get_low_stock_products', { limit_count: 5 })
        ]);

        const salesToday = salesData.data?.reduce((sum, sale) => sum + parseFloat(sale.total_amount || '0'), 0) || 0;
        
        setStats({
          salesToday,
          productCount: 0, // Funcionarios don't need this
          customerCount: 0, // Funcionarios don't need this
          lowStockCount: lowStockResult.data?.length || 0
        });
      } else {
        // For admins, show overall stats
        const [statsResult, lowStockResult] = await Promise.all([
          supabase.rpc('get_dashboard_stats'),
          supabase.rpc('get_low_stock_products', { limit_count: 5 })
        ]);

        if (statsResult.data) {
          const data = statsResult.data[0];
          setStats({
            salesToday: parseFloat(data.salestoday || 0),
            productCount: parseInt(data.productcount || 0),
            customerCount: parseInt(data.customercount || 0),
            lowStockCount: parseInt(data.lowstockcount || 0)
          });
        } else {
          // Fallback: manually calculate stats
          const [products, customers, sales, lowStock] = await Promise.all([
            supabase.from('products').select('id').eq('is_active', true),
            supabase.from('customers').select('id').eq('is_active', true),
            supabase
              .from('sales')
              .select('total_amount')
              .gte('created_at', new Date().toISOString().split('T')[0])
              .eq('status', 'COMPLETED'),
            supabase.rpc('get_low_stock_products', { limit_count: 100 })
          ]);
          
          const salesToday = sales.data?.reduce((sum, sale) => sum + parseFloat(sale.total_amount || '0'), 0) || 0;
          
          setStats({
            salesToday,
            productCount: products.data?.length || 0,
            customerCount: customers.data?.length || 0,
            lowStockCount: lowStock.data?.length || 0
          });
        }
      }

      const [salesResult, lowStockResult] = await Promise.all([
        salesQuery,
        supabase.rpc('get_low_stock_products', { limit_count: 5 })
      ]);

      if (salesResult.data) {
        // Otimização: buscar todos os cashiers de uma vez
        const cashierIds = [...new Set(salesResult.data.map(sale => sale.cashier_id).filter(Boolean))];
        let cashiersMap = new Map();
        
        if (cashierIds.length > 0) {
          const { data: cashiersData } = await supabase
            .from('users')
            .select('id, name, role')
            .in('id', cashierIds);
          
          if (cashiersData) {
            cashiersMap = new Map(cashiersData.map(cashier => [cashier.id, cashier]));
          }
        }
        
        const salesWithCashiers = salesResult.data.map(sale => {
          const cashier = cashiersMap.get(sale.cashier_id);
          return {
            sale_number: sale.sale_number,
            customer_name: sale.customers?.name || null,
            cashier_name: cashier?.name || null,
            cashier_role: cashier?.role || null,
            total_amount: sale.total_amount,
            sale_date: sale.created_at
          };
        });
        
        setRecentSales(salesWithCashiers);
      }

      if (lowStockResult.data) {
        setLowStockProducts(lowStockResult.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `há ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `há ${hours}h`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `há ${days}d`;
    }
  };

  const dashboardStats = profile?.role === 'FUNCIONARIO' 
    ? [
        {
          title: 'Minhas Vendas Hoje',
          value: formatCurrency(stats.salesToday),
          change: '',
          color: 'text-green-600'
        },
        {
          title: 'Produtos em Falta',
          value: stats.lowStockCount.toString(),
          change: '',
          color: stats.lowStockCount > 0 ? 'text-orange-600' : 'text-green-600'
        }
      ]
    : [
        {
          title: 'Vendas Hoje',
          value: formatCurrency(stats.salesToday),
          change: '+12%',
          color: 'text-green-600'
        },
        {
          title: 'Produtos Cadastrados',
          value: stats.productCount.toString(),
          change: '+3%',
          color: 'text-blue-600'
        },
        {
          title: 'Clientes Ativos',
          value: stats.customerCount.toString(),
          change: '+8%',
          color: 'text-purple-600'
        },
        {
          title: 'Estoque Baixo',
          value: stats.lowStockCount.toString(),
          change: stats.lowStockCount > 0 ? '-2%' : '+0%',
          color: stats.lowStockCount > 0 ? 'text-orange-600' : 'text-green-600'
        }
      ];
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Bem-vindo, {profile?.name}!
        </h1>
        <p className="text-gray-600">Aqui está um resumo do seu negócio hoje.</p>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8 ${profile?.role === 'FUNCIONARIO' ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))
        ) : (
          dashboardStats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`text-sm font-medium ${stat.color}`}>
                  {stat.change}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Commission Card for Funcionarios */}
      {profile?.role === 'FUNCIONARIO' && profile?.commission_enabled && (
        <div className="mb-8">
          <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-green-800 mb-2 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                  Comissão de Hoje
                </h2>
                <p className="text-3xl font-bold text-green-800">{formatCurrency(commissionStats.today)}</p>
                <p className="text-sm text-green-600 mt-1">
                  Semana: {formatCurrency(commissionStats.week)} | Mês: {formatCurrency(commissionStats.month)}
                </p>
              </div>
              <div className="p-3 bg-green-200 rounded-full">
                <Award className="h-8 w-8 text-green-700" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Receipt className="w-5 h-5 mr-2 text-green-500" />
              Vendas Recentes
            </h2>
            {recentSales.length > 0 && (
              <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                {recentSales.length} vendas
              </span>
            )}
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="flex items-center p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg mr-3"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-5 bg-gray-200 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : recentSales.length > 0 ? (
              recentSales.map((sale, index) => (
                <div 
                  key={index} 
                  className="flex items-center p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                >
                  {/* Sale icon */}
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <p className="font-bold text-gray-900 text-sm">
                        Venda #{sale.sale_number}
                      </p>
                      <span className="ml-2 text-xs text-gray-500">
                        {formatTimeAgo(sale.sale_date)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-1">
                      {sale.customer_name ? (
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {sale.customer_name}
                        </span>
                      ) : (
                        'Cliente avulso'
                      )}
                    </p>
                    
                    {sale.cashier_name && (
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center mr-1">
                          <span className="text-blue-600 text-xs">👤</span>
                        </div>
                        <span className="text-xs text-blue-700 font-medium">
                          {sale.cashier_name}
                        </span>
                        <span className="ml-1 text-xs text-gray-500">
                          ({sale.cashier_role === 'ADMIN' ? 'Admin' : 
                            sale.cashier_role === 'FUNCIONARIO' ? 'Funcionário' :
                            sale.cashier_role === 'CASHIER' ? 'Operador' : 'Usuário'})
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right flex flex-col items-end">
                    <p className="font-bold text-lg text-green-600 mb-1">
                      {formatCurrency(parseFloat(sale.total_amount))}
                    </p>
                    <div className="text-xs text-gray-500 mb-2">
                      {new Date(sale.sale_date).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchSaleDetails(sale.sale_number);
                      }}
                      className="flex items-center px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded-full transition-colors"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Ver itens
                    </button>
                    {sale.payment_method === 'CASH' && sale.change_amount > 0 && (
                      <div className="text-xs text-orange-600 mt-1">
                        Troco: {formatCurrency(parseFloat(sale.change_amount))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Receipt className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">Nenhuma venda realizada hoje</p>
                <p className="text-sm text-gray-400 mt-1">As vendas aparecerão aqui automaticamente</p>
              </div>
            )}
          </div>
          
          {recentSales.length > 5 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium">
                Ver todas as vendas →
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Package className="w-5 h-5 mr-2 text-orange-500" />
              Produtos em Falta
            </h2>
            {lowStockProducts.length > 0 && (
              <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                {lowStockProducts.length} produtos
              </span>
            )}
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="flex items-center p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg mr-3"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : lowStockProducts.length > 0 ? (
              lowStockProducts.map((product, index) => {
                const isOutOfStock = product.current_stock === 0;
                const isCritical = product.current_stock > 0 && product.current_stock < product.min_stock;
                
                return (
                  <div 
                    key={index} 
                    className={`
                      flex items-center p-3 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer
                      ${isOutOfStock 
                        ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 hover:border-red-300' 
                        : 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200 hover:border-orange-300'
                      }
                    `}
                  >
                    {/* Product icon/indicator */}
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center mr-3 
                      ${isOutOfStock ? 'bg-red-500' : 'bg-orange-500'}
                    `}>
                      {isOutOfStock ? (
                        <X className="w-5 h-5 text-white" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-white" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">
                        {product.name}
                      </p>
                      <div className="flex items-center mt-1">
                        <span className={`
                          text-xs font-bold px-2 py-0.5 rounded-full
                          ${isOutOfStock 
                            ? 'bg-red-200 text-red-800' 
                            : 'bg-orange-200 text-orange-800'
                          }
                        `}>
                          {isOutOfStock ? 'SEM ESTOQUE' : 'ESTOQUE BAIXO'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-baseline">
                        <span className={`
                          font-bold text-lg
                          ${isOutOfStock ? 'text-red-700' : 'text-orange-700'}
                        `}>
                          {product.current_stock}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          /{product.min_stock}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Mín: {product.min_stock} {product.unit || 'un'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-green-600 font-medium">Todos os produtos estão com estoque adequado!</p>
                <p className="text-sm text-gray-500 mt-1">Nenhum produto com estoque baixo</p>
              </div>
            )}
          </div>
          
          {lowStockProducts.length > 3 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-center text-sm text-gray-500">
                E mais {lowStockProducts.length - 3} produtos com problemas de estoque
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhes da venda */}
      {showSaleDetails && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Detalhes da Venda</h3>
                  <p className="text-blue-100">#{selectedSale.sale_number}</p>
                </div>
                <button
                  onClick={() => setShowSaleDetails(false)}
                  className="text-white hover:bg-blue-700 p-2 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Informações da venda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Informações Gerais</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data:</span>
                      <span>{new Date(selectedSale.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Método de Pagamento:</span>
                      <span className="font-medium">
                        {selectedSale.payment_method === 'CASH' ? 'Dinheiro' :
                         selectedSale.payment_method === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                         selectedSale.payment_method === 'DEBIT_CARD' ? 'Cartão de Débito' :
                         selectedSale.payment_method === 'PIX' ? 'PIX' :
                         selectedSale.payment_method === 'CREDIT' ? 'Fiado' : selectedSale.payment_method}
                      </span>
                    </div>
                    {selectedSale.payment_method === 'CASH' && selectedSale.change_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Troco:</span>
                        <span className="font-medium text-orange-600">
                          {formatCurrency(parseFloat(selectedSale.change_amount))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Cliente</h4>
                  <div className="text-sm">
                    {selectedSale.customer ? (
                      <div className="space-y-2">
                        <div className="font-medium">{selectedSale.customer.name}</div>
                        {selectedSale.customer.cpf && (
                          <div className="text-gray-600">CPF: {selectedSale.customer.cpf}</div>
                        )}
                        {selectedSale.customer.cnpj && (
                          <div className="text-gray-600">CNPJ: {selectedSale.customer.cnpj}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500">Cliente avulso</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itens da venda */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Itens da Venda</h4>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-700">Produto</th>
                        <th className="text-center p-3 font-medium text-gray-700">Qtd</th>
                        <th className="text-right p-3 font-medium text-gray-700">Vlr Unit</th>
                        <th className="text-right p-3 font-medium text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.sale_items?.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="p-3 font-medium">{item.product_name}</td>
                          <td className="p-3 text-center">{item.quantity}</td>
                          <td className="p-3 text-right">{formatCurrency(parseFloat(item.unit_price))}</td>
                          <td className="p-3 text-right font-medium">{formatCurrency(parseFloat(item.total_price))}</td>
                        </tr>
                      )) || []}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total da Venda:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(parseFloat(selectedSale.total_amount))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuthStore();
  const location = useLocation();
  const isPDVOpen = location.pathname.includes('/pdv');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 1024);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {!isPDVOpen && (
        <>
          {/* Mobile overlay */}
          {!sidebarCollapsed && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarCollapsed(true)}
            />
          )}
          <Sidebar 
            isCollapsed={sidebarCollapsed} 
            onToggleCollapse={toggleSidebar}
          />
        </>
      )}
      <div className="flex-1 flex flex-col">
        {!isPDVOpen && (
          <header className="bg-white shadow h-16 flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors lg:hidden"
                title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Sistema PDV</h1>
                <p className="text-sm text-gray-600">Ponto de Venda Integrado</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
                <p className="text-xs text-gray-600">{profile?.role}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              >
                <LogOut className="w-5 h-5 mr-1" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </header>
        )}
        <main className="flex-1 overflow-auto">
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>}>
            <Routes>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/pdv" element={<PDVInterface />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/user-performance" element={<UserPerformancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/commissions" element={<CommissionDashboard />} />
              <Route path="/my-reports" element={<MyReportsPage />} />
              {/* Additional routes will be added here */}
            </Routes>
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}