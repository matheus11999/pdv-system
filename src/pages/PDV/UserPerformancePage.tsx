import React, { useState, useEffect } from 'react';
import { BarChart3, Users, TrendingUp, DollarSign, Trophy, Calendar, Filter, User } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useUserPerformance } from '../../hooks/useUserPerformance';

export const UserPerformancePage: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showDailyChart, setShowDailyChart] = useState(false);
  
  const {
    userPerformances,
    dailyPerformances,
    loading,
    error,
    fetchUserPerformances,
    fetchDailyPerformance,
    getTopPerformers,
    getUserRanking
  } = useUserPerformance();

  useEffect(() => {
    loadPerformances();
  }, [selectedPeriod]);

  const loadPerformances = () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(selectedPeriod));
    
    fetchUserPerformances(
      undefined,
      startDate.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
  };

  const loadDailyPerformance = (userId: string) => {
    setSelectedUserId(userId);
    setShowDailyChart(true);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days
    
    fetchDailyPerformance(
      userId,
      startDate.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const topPerformers = getTopPerformers(3);
  const totalUsers = userPerformances.length;
  const totalSales = userPerformances.reduce((sum, user) => sum + user.total_sales_amount, 0);
  const totalCommissions = userPerformances.reduce((sum, user) => sum + user.total_commission, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Desempenho dos Funcionários</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="15">Últimos 15 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 3 meses</option>
            </select>
          </div>
          
          <Button
            onClick={loadPerformances}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>{loading ? 'Carregando...' : 'Atualizar'}</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Funcionários</p>
              <p className="text-2xl font-bold">{totalUsers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vendas Totais</p>
              <p className="text-2xl font-bold">{formatCurrency(totalSales)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Comissões Totais</p>
              <p className="text-2xl font-bold">{formatCurrency(totalCommissions)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <Trophy className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ticket Médio</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalUsers > 0 ? totalSales / totalUsers : 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold">Top 3 Funcionários</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topPerformers.map((user, index) => (
              <div
                key={user.user_id}
                className={`p-4 rounded-lg border-2 ${
                  index === 0
                    ? 'border-yellow-300 bg-yellow-50'
                    : index === 1
                    ? 'border-gray-300 bg-gray-50'
                    : 'border-orange-300 bg-orange-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        index === 0
                          ? 'bg-yellow-500'
                          : index === 1
                          ? 'bg-gray-500'
                          : 'bg-orange-500'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="font-medium">{user.user_name}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                    {user.role}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Vendas:</span>
                    <span className="font-medium">{formatCurrency(user.total_sales_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Quantidade:</span>
                    <span className="font-medium">{user.total_sales_count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ticket Médio:</span>
                    <span className="font-medium">{formatCurrency(user.average_ticket)}</span>
                  </div>
                  {user.commission_enabled && (
                    <div className="flex justify-between text-sm">
                      <span>Comissão:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(user.total_commission)}
                      </span>
                    </div>
                  )}
                </div>
                
                <Button
                  onClick={() => loadDailyPerformance(user.user_id)}
                  className="w-full mt-3 text-xs"
                  variant="outline"
                >
                  Ver Detalhes
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All Users Performance Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Todos os Funcionários</h3>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Pos.</th>
                <th className="text-left py-2">Funcionário</th>
                <th className="text-left py-2">Cargo</th>
                <th className="text-right py-2">Vendas</th>
                <th className="text-right py-2">Quantidade</th>
                <th className="text-right py-2">Ticket Médio</th>
                <th className="text-right py-2">Comissão</th>
                <th className="text-center py-2">Status</th>
                <th className="text-center py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {userPerformances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    {loading ? 'Carregando...' : 'Nenhum dado encontrado'}
                  </td>
                </tr>
              ) : (
                userPerformances.map((user, index) => (
                  <tr key={user.user_id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <span className="font-mono text-sm">#{index + 1}</span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{user.user_name}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.role === 'ADMIN' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'ADMIN' ? 'Administrador' : 'Funcionário'}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(user.total_sales_amount)}
                    </td>
                    <td className="py-2 text-right">
                      {user.total_sales_count}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(user.average_ticket)}
                    </td>
                    <td className="py-2 text-right">
                      {user.commission_enabled ? (
                        <span className="text-green-600 font-medium">
                          {formatCurrency(user.total_commission)}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <Button
                        onClick={() => loadDailyPerformance(user.user_id)}
                        variant="outline"
                        className="text-xs px-2 py-1"
                      >
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Daily Performance Chart Modal */}
      {showDailyChart && dailyPerformances.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Desempenho Diário - {userPerformances.find(u => u.user_id === selectedUserId)?.user_name}
            </h3>
            <Button
              onClick={() => setShowDailyChart(false)}
              variant="outline"
              className="text-sm"
            >
              Fechar
            </Button>
          </div>
          
          <div className="space-y-4">
            {dailyPerformances.map((day) => (
              <div key={day.sale_date} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">
                    {new Date(day.sale_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {day.sales_count} vendas
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(day.sales_amount)}</p>
                  {day.commission_amount > 0 && (
                    <p className="text-sm text-green-600">
                      Comissão: {formatCurrency(day.commission_amount)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};