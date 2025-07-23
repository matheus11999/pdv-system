import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UserPerformance {
  user_id: string;
  user_name: string;
  role: 'ADMIN' | 'FUNCIONARIO';
  total_sales_count: number;
  total_sales_amount: number;
  average_ticket: number;
  total_commission: number;
  commission_enabled: boolean;
  is_active: boolean;
}

export interface DailyPerformance {
  sale_date: string;
  sales_count: number;
  sales_amount: number;
  commission_amount: number;
}

export function useUserPerformance() {
  const [userPerformances, setUserPerformances] = useState<UserPerformance[]>([]);
  const [dailyPerformances, setDailyPerformances] = useState<DailyPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserPerformances = async (
    userId?: string,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      // Try RPC first, fallback to manual query
      let data = null;
      let error = null;
      
      try {
        const result = await supabase.rpc('get_user_performance_stats', {
          user_id_param: userId || null,
          start_date: startDate || null,
          end_date: endDate || null
        });
        data = result.data;
        error = result.error;
      } catch (rpcError) {
        // RPC doesn't exist, use manual approach
        console.log('RPC not found, using manual query');
        
        // Get users first
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, name, role, commission_enabled, is_active')
          .eq('is_active', true);
          
        if (usersError) throw usersError;
        
        // Get sales data for each user
        const performances: UserPerformance[] = [];
        
        for (const user of users || []) {
          let salesQuery = supabase
            .from('sales')
            .select('total_amount, sale_commissions(commission_amount)')
            .eq('user_id', user.id)
            .eq('status', 'COMPLETED');
            
          if (startDate) salesQuery = salesQuery.gte('created_at', startDate);
          if (endDate) salesQuery = salesQuery.lte('created_at', endDate);
          
          const { data: salesData } = await salesQuery;
          
          const totalSales = (salesData || []).length;
          const totalAmount = (salesData || []).reduce((sum, sale) => sum + parseFloat(sale.total_amount || '0'), 0);
          const totalCommission = (salesData || []).reduce((sum, sale) => {
            const commissions = Array.isArray(sale.sale_commissions) ? sale.sale_commissions : [];
            return sum + commissions.reduce((cSum: number, c: any) => cSum + parseFloat(c.commission_amount || '0'), 0);
          }, 0);
          
          if (totalSales > 0 || userId === user.id) {
            performances.push({
              user_id: user.id,
              user_name: user.name,
              role: user.role,
              total_sales_count: totalSales,
              total_sales_amount: totalAmount,
              average_ticket: totalSales > 0 ? totalAmount / totalSales : 0,
              total_commission: totalCommission,
              commission_enabled: user.commission_enabled,
              is_active: user.is_active
            });
          }
        }
        
        data = performances;
      }

      if (error) throw error;
      setUserPerformances(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar desempenho dos usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyPerformance = async (
    userId: string,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      let data = null;
      let error = null;
      
      try {
        const result = await supabase.rpc('get_user_daily_performance', {
          user_id_param: userId,
          start_date: startDate || null,
          end_date: endDate || null
        });
        data = result.data;
        error = result.error;
      } catch (rpcError) {
        // RPC doesn't exist, use manual approach
        console.log('Daily performance RPC not found, using manual query');
        
        let salesQuery = supabase
          .from('sales')
          .select(`
            created_at,
            total_amount,
            sale_commissions(commission_amount)
          `)
          .eq('user_id', userId)
          .eq('status', 'COMPLETED');
          
        if (startDate) salesQuery = salesQuery.gte('created_at', startDate);
        if (endDate) salesQuery = salesQuery.lte('created_at', endDate);
        
        const { data: salesData, error: salesError } = await salesQuery;
        if (salesError) throw salesError;
        
        // Group by date
        const dailyData: { [key: string]: DailyPerformance } = {};
        
        (salesData || []).forEach(sale => {
          const date = sale.created_at.split('T')[0]; // Get date only
          
          if (!dailyData[date]) {
            dailyData[date] = {
              sale_date: date,
              sales_count: 0,
              sales_amount: 0,
              commission_amount: 0
            };
          }
          
          dailyData[date].sales_count++;
          dailyData[date].sales_amount += parseFloat(sale.total_amount || '0');
          
          const commissions = Array.isArray(sale.sale_commissions) ? sale.sale_commissions : [];
          dailyData[date].commission_amount += commissions.reduce((sum: number, c: any) => 
            sum + parseFloat(c.commission_amount || '0'), 0);
        });
        
        data = Object.values(dailyData).sort((a, b) => a.sale_date.localeCompare(b.sale_date));
      }

      if (error) throw error;
      setDailyPerformances(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar desempenho diário');
    } finally {
      setLoading(false);
    }
  };

  const getTopPerformers = (limit: number = 5) => {
    return [...userPerformances]
      .sort((a, b) => b.total_sales_amount - a.total_sales_amount)
      .slice(0, limit);
  };

  const getUserRanking = (userId: string) => {
    const sortedUsers = [...userPerformances]
      .sort((a, b) => b.total_sales_amount - a.total_sales_amount);
    
    return sortedUsers.findIndex(user => user.user_id === userId) + 1;
  };

  return {
    userPerformances,
    dailyPerformances,
    loading,
    error,
    fetchUserPerformances,
    fetchDailyPerformance,
    getTopPerformers,
    getUserRanking,
  };
}