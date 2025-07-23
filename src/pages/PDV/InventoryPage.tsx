import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingUp, TrendingDown, Search, Edit, Plus, Download, Filter, SortDesc, DollarSign, ShoppingCart } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useProducts } from '../../hooks/useProducts';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';

interface StockMovement {
  id: string;
  product_name: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  created_at: string;
}

export const InventoryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'movements' | 'alerts'>('overview');
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [alertsSearchTerm, setAlertsSearchTerm] = useState('');
  const [alertsSortBy, setAlertsSortBy] = useState<'name' | 'stock' | 'value'>('stock');
  
  const { products, loading, searchProducts, fetchProducts } = useProducts();

  useEffect(() => {
    if (selectedTab === 'movements') {
      fetchStockMovements();
    }
  }, [selectedTab]);

  const fetchStockMovements = async () => {
    setLoadingMovements(true);
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          id,
          movement_type,
          quantity,
          previous_stock,
          new_stock,
          reason,
          created_at,
          products(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const movements = data?.map(movement => ({
        id: movement.id,
        product_name: movement.products?.name || 'Produto não encontrado',
        movement_type: movement.movement_type,
        quantity: movement.quantity,
        previous_stock: movement.previous_stock,
        new_stock: movement.new_stock,
        reason: movement.reason || '',
        created_at: movement.created_at
      })) || [];

      setStockMovements(movements);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      searchProducts(term);
    } else {
      fetchProducts();
    }
  };

  const getLowStockProducts = () => {
    return products.filter(p => p.current_stock > 0 && p.current_stock <= (p.min_stock || 0));
  };

  const getOutOfStockProducts = () => {
    return products.filter(p => p.current_stock === 0);
  };

  const getCriticalProducts = () => {
    return products.filter(p => p.current_stock <= Math.max(1, (p.min_stock || 0) * 0.5));
  };

  const getHighStockProducts = () => {
    return products.filter(p => p.max_stock && p.current_stock >= p.max_stock);
  };

  const getStockValue = () => {
    return products.reduce((total, product) => {
      return total + (product.current_stock * (product.cost_price || 0));
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'OUT':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'ADJUSTMENT':
        return <Edit className="w-4 h-4 text-blue-600" />;
      default:
        return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'IN':
        return 'Entrada';
      case 'OUT':
        return 'Saída';
      case 'ADJUSTMENT':
        return 'Ajuste';
      default:
        return type;
    }
  };

  const exportStockAlertsPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text('Relatorio de Alertas de Estoque', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
      doc.text(`Hora: ${new Date().toLocaleTimeString('pt-BR')}`, 20, 40);
      
      const outOfStock = getOutOfStockProducts();
      const lowStock = getLowStockProducts();
      const totalProblems = outOfStock.length + lowStock.length;
      
      doc.text(`Total de produtos com problemas: ${totalProblems}`, 20, 50);
      
      let yPosition = 70;
      
      // Out of Stock Section
      if (outOfStock.length > 0) {
        doc.setFontSize(16);
        doc.text(`Produtos SEM Estoque (${outOfStock.length})`, 20, yPosition);
        yPosition += 15;
        
        outOfStock.forEach((product, index) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFontSize(10);
          doc.text(`${index + 1}. ${product.name || 'Produto'}`, 25, yPosition);
          doc.text(`Categoria: ${product.category || 'N/A'}`, 30, yPosition + 7);
          doc.text(`Preco de Venda: R$ ${(product.sale_price || 0).toFixed(2)}`, 30, yPosition + 14);
          doc.text(`Ultima Atualizacao: ${new Date(product.updated_at || new Date()).toLocaleDateString('pt-BR')}`, 30, yPosition + 21);
          
          yPosition += 35;
        });
        
        yPosition += 10;
      }
      
      // Low Stock Section
      if (lowStock.length > 0) {
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(16);
        doc.text(`Produtos com Estoque Baixo (${lowStock.length})`, 20, yPosition);
        yPosition += 15;
        
        lowStock.forEach((product, index) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFontSize(10);
          doc.text(`${index + 1}. ${product.name || 'Produto'}`, 25, yPosition);
          doc.text(`Categoria: ${product.category || 'N/A'}`, 30, yPosition + 7);
          doc.text(`Estoque Atual: ${product.current_stock} / Minimo: ${product.min_stock || 0}`, 30, yPosition + 14);
          doc.text(`Preco de Venda: R$ ${(product.sale_price || 0).toFixed(2)}`, 30, yPosition + 21);
          doc.text(`Necessita: ${Math.max(0, (product.min_stock || 0) - product.current_stock)} unidades`, 30, yPosition + 28);
          
          yPosition += 40;
        });
      }
      
      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Pagina ${i} de ${totalPages} - Sistema PDV`, 20, 290);
      }
      
      doc.save(`alertas-estoque-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar relatório PDF');
    }
  };
  
  const sortAlertProducts = (products: any[]) => {
    if (!products || !Array.isArray(products)) {
      return [];
    }
    
    const filtered = products.filter(product => {
      if (!product || !product.name) return false;
      
      const searchLower = alertsSearchTerm.toLowerCase();
      const nameMatch = product.name.toLowerCase().includes(searchLower);
      const categoryMatch = product.category && product.category.toLowerCase().includes(searchLower);
      
      return nameMatch || categoryMatch;
    });
    
    return filtered.sort((a, b) => {
      switch (alertsSortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'stock':
          return (a.current_stock || 0) - (b.current_stock || 0);
        case 'value':
          return (b.sale_price || 0) - (a.sale_price || 0);
        default:
          return 0;
      }
    });
  };

  const stockStats = [
    {
      title: 'Valor Total do Estoque',
      value: formatCurrency(getStockValue()),
      icon: Package,
      color: 'text-blue-600'
    },
    {
      title: 'Produtos em Falta',
      value: getOutOfStockProducts().length.toString(),
      icon: AlertTriangle,
      color: 'text-red-600'
    },
    {
      title: 'Estoque Baixo',
      value: getLowStockProducts().length.toString(),
      icon: TrendingDown,
      color: 'text-orange-600'
    },
    {
      title: 'Estoque Alto',
      value: getHighStockProducts().length.toString(),
      icon: TrendingUp,
      color: 'text-green-600'
    }
  ];

  const filteredProducts = searchTerm.trim() 
    ? products 
    : products;

  return (
    <div className="p-4 lg:p-6">
      {/* Header - Responsivo */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Controle de Estoque</h1>
          <p className="text-sm lg:text-base text-gray-600">Gerencie e monitore seu estoque</p>
        </div>
      </div>

      {/* Stats Cards - Otimizado para mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6">
        {stockStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-3 lg:p-6">
              <div className="flex items-center justify-between lg:justify-start">
                <div className="min-w-0 flex-1 lg:flex-initial">
                  <p className="text-xs lg:text-sm text-gray-600 truncate">{stat.title}</p>
                  <p className="text-base lg:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                </div>
                <Icon className={`w-5 h-5 lg:w-8 lg:h-8 ${stat.color} lg:mr-3 lg:ml-3 flex-shrink-0`} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tabs - Responsivo */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 lg:space-x-8 overflow-x-auto">
            {[
              { key: 'overview', label: 'Visão Geral' },
              { key: 'movements', label: 'Movimentações' },
              { key: 'alerts', label: 'Alertas' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-xs lg:text-sm whitespace-nowrap ${
                  selectedTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <>
          {/* Search */}
          <Card className="p-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          {/* Products Stock Table */}
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
                        Produto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estoque Atual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estoque Mín/Máx
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor do Estoque
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product) => {
                      const isOutOfStock = product.current_stock === 0;
                      const isLowStock = product.current_stock <= (product.min_stock || 0) && !isOutOfStock;
                      const stockValue = product.current_stock * (product.cost_price || 0);
                      
                      return (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Package className="w-8 h-8 text-gray-400 mr-3" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {product.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {product.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {product.current_stock}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              Mín: {product.min_stock || '-'}
                            </div>
                            <div className="text-sm text-gray-500">
                              Máx: {product.max_stock || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(stockValue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Custo: {formatCurrency(product.cost_price || 0)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              isOutOfStock 
                                ? 'bg-red-100 text-red-800' 
                                : isLowStock 
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {isOutOfStock ? 'SEM ESTOQUE' : isLowStock ? 'ESTOQUE BAIXO' : 'OK'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum produto encontrado</p>
              </div>
            )}
          </Card>
        </>
      )}

      {selectedTab === 'movements' && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Movimentações Recentes</h2>
            {loadingMovements ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {stockMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getMovementIcon(movement.movement_type)}
                      <div>
                        <p className="font-medium text-gray-900">{movement.product_name}</p>
                        <p className="text-sm text-gray-500">
                          {getMovementTypeLabel(movement.movement_type)} - {movement.reason}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(movement.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{movement.previous_stock}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-bold text-gray-900">{movement.new_stock}</span>
                      </div>
                      <div className={`text-sm font-medium ${
                        movement.movement_type === 'IN' 
                          ? 'text-green-600' 
                          : movement.movement_type === 'OUT' 
                            ? 'text-red-600' 
                            : 'text-blue-600'
                      }`}>
                        {movement.movement_type === 'IN' ? '+' : movement.movement_type === 'OUT' ? '-' : '±'}
                        {Math.abs(movement.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {stockMovements.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Nenhuma movimentação encontrada</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {selectedTab === 'alerts' && (
        <div className="space-y-6">
          {/* Alert Controls */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-1 gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar produtos com problemas..."
                    value={alertsSearchTerm}
                    onChange={(e) => setAlertsSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={alertsSortBy}
                  onChange={(e) => setAlertsSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="stock">Ordenar por Estoque</option>
                  <option value="name">Ordenar por Nome</option>
                  <option value="value">Ordenar por Valor</option>
                </select>
              </div>
              <Button onClick={exportStockAlertsPDF} variant="secondary" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            </div>
          </Card>

          {/* Alert Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-red-200 bg-red-50">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-full mr-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800">Sem Estoque</p>
                  <p className="text-2xl font-bold text-red-900">{getOutOfStockProducts().length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-full mr-3">
                  <TrendingDown className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-800">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-yellow-900">{getLowStockProducts().length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-orange-200 bg-orange-50">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-full mr-3">
                  <Package className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-800">Críticos</p>
                  <p className="text-2xl font-bold text-orange-900">{getCriticalProducts().length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Out of Stock Products */}
          {getOutOfStockProducts().length > 0 && (
            <Card className="border-red-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
                    <h2 className="text-lg font-semibold text-red-800">
                      🚨 Produtos SEM Estoque ({getOutOfStockProducts().length})
                    </h2>
                  </div>
                  <div className="text-sm text-red-600">
                    Ação urgente necessária!
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortAlertProducts(getOutOfStockProducts()).map((product) => product && product.id ? (
                    <div key={product.id} className="p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-red-900 flex-1">{product.name}</h3>
                        <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full ml-2">
                          SEM ESTOQUE
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-red-700">
                        <p className="flex items-center">
                          <Package className="w-3 h-3 mr-1" />
                          Categoria: {product.category || 'N/A'}
                        </p>
                        <p className="flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          Venda: R$ {product.sale_price?.toFixed(2) || '0,00'}
                        </p>
                        <p className="flex items-center">
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Mínimo: {product.min_stock || 'N/D'}
                        </p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <p className="text-xs text-red-600">
                          ⚠️ Necessita reposição imediata
                        </p>
                      </div>
                    </div>
                  ) : null)}
                </div>
              </div>
            </Card>
          )}

          {/* Low Stock Products */}
          {getLowStockProducts().length > 0 && (
            <Card className="border-yellow-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <TrendingDown className="w-6 h-6 text-yellow-600 mr-2" />
                    <h2 className="text-lg font-semibold text-yellow-800">
                      ⚠️ Produtos com Estoque Baixo ({getLowStockProducts().length})
                    </h2>
                  </div>
                  <div className="text-sm text-yellow-600">
                    Reposição recomendada
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortAlertProducts(getLowStockProducts()).map((product) => {
                    if (!product || !product.id) return null;
                    
                    const needsRestock = Math.max(0, (product.min_stock || 0) - (product.current_stock || 0));
                    const stockPercentage = (((product.current_stock || 0) / (product.min_stock || 1)) * 100).toFixed(0);
                    
                    return (
                      <div key={product.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-yellow-900 flex-1">{product.name}</h3>
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full ml-2">
                            {stockPercentage}% do mín
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-yellow-700">
                          <p className="flex items-center">
                            <Package className="w-3 h-3 mr-1" />
                            Atual: {product.current_stock} / Mín: {product.min_stock}
                          </p>
                          <p className="flex items-center">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Venda: R$ {product.sale_price?.toFixed(2) || '0,00'}
                          </p>
                          <p className="flex items-center">
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            Categoria: {product.category || 'N/A'}
                          </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-yellow-200">
                          <p className="text-xs text-yellow-600">
                            💡 Sugestão: comprar {needsRestock > 0 ? needsRestock : 'mais'} unidades
                          </p>
                          <div className="w-full bg-yellow-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-yellow-500 h-2 rounded-full transition-all" 
                              style={{ width: `${Math.min(100, parseInt(stockPercentage))}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              </div>
            </Card>
          )}

          {/* No Alerts */}
          {getOutOfStockProducts().length === 0 && getLowStockProducts().length === 0 && (
            <Card>
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">✅ Tudo em ordem!</h3>
                <p className="text-gray-500 mb-4">Não há alertas de estoque no momento.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-md mx-auto text-sm">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="font-medium text-green-800">Produtos Ativos</p>
                    <p className="text-2xl font-bold text-green-600">{products.length}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="font-medium text-blue-800">Valor Estoque</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(getStockValue())}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="font-medium text-purple-800">Com Estoque OK</p>
                    <p className="text-2xl font-bold text-purple-600">{products.filter(p => p.current_stock > (p.min_stock || 0)).length}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};