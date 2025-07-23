import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, Save, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useProducts, type Product, type ProductInput } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';

export const ProductsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const { 
    products, 
    loading, 
    error, 
    createProduct, 
    updateProduct, 
    deleteProduct,
    searchProducts 
  } = useProducts();
  
  const { categories, loading: categoriesLoading } = useCategories();

  // Helper functions for price calculations
  const calculateSalePriceFromMarkup = (costPrice: number, markupPercentage: number): number => {
    if (costPrice <= 0 || markupPercentage < 0) return 0;
    return costPrice * (1 + markupPercentage / 100);
  };

  const calculateMarkupFromPrices = (salePrice: number, costPrice: number): number => {
    if (costPrice <= 0 || salePrice <= 0) return 0;
    return ((salePrice - costPrice) / costPrice) * 100;
  };

  const handleCostPriceChange = (newCostPrice: number) => {
    const newSalePrice = calculateSalePriceFromMarkup(newCostPrice, formData.markup_percentage || 0);
    setFormData({
      ...formData,
      cost_price: newCostPrice,
      sale_price: newSalePrice
    });
  };

  const handleSalePriceChange = (newSalePrice: number) => {
    const newMarkup = calculateMarkupFromPrices(newSalePrice, formData.cost_price || 0);
    setFormData({
      ...formData,
      sale_price: newSalePrice,
      markup_percentage: newMarkup
    });
  };

  const handleMarkupChange = (newMarkup: number) => {
    const newSalePrice = calculateSalePriceFromMarkup(formData.cost_price || 0, newMarkup);
    setFormData({
      ...formData,
      markup_percentage: newMarkup,
      sale_price: newSalePrice
    });
  };

  const [formData, setFormData] = useState<ProductInput>({
    name: '',
    description: '',
    barcode: '',
    sale_price: 0,
    cost_price: 0,
    markup_percentage: 0,
    current_stock: 0,
    min_stock: 5,
    unit: 'UN',
    category_id: '',
    is_active: true,
    is_service: false,
    allow_negative_stock: false
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      barcode: '',
      sale_price: 0,
      cost_price: 0,
      markup_percentage: 0,
      current_stock: 0,
      min_stock: 5,
      unit: 'UN',
      category_id: '',
      is_active: true,
      is_service: false,
      allow_negative_stock: false
    });
  };

  const handleAddProduct = () => {
    resetForm();
    setEditingProduct(null);
    setShowAddModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setFormData({
      name: product.name,
      description: product.description || '',
      barcode: product.barcode || '',
      sale_price: product.sale_price || product.price || 0,
      cost_price: product.cost_price || 0,
      markup_percentage: product.markup_percentage || 0,
      current_stock: product.current_stock || product.stock_current || 0,
      min_stock: product.min_stock || product.stock_minimum || 5,
      unit: product.unit || 'UN',
      category_id: product.category_id || '',
      is_active: product.is_active,
      is_service: product.is_service || false,
      allow_negative_stock: product.allow_negative_stock || false
    });
    setEditingProduct(product);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação obrigatória de categoria
    if (!formData.category_id) {
      alert('Por favor, selecione uma categoria para o produto.');
      return;
    }
    
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      setShowAddModal(false);
      resetForm();
      setEditingProduct(null);
    } catch (error) {
      alert('Erro ao salvar produto: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleDelete = async (product: Product) => {
    if (window.confirm(`Tem certeza que deseja excluir o produto "${product.name}"?`)) {
      try {
        await deleteProduct(product.id);
      } catch (error) {
        alert('Erro ao excluir produto: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      }
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      searchProducts(term);
    }
  };

  const filteredProducts = searchTerm.trim() 
    ? products 
    : products.filter(p => p.is_active);

  const getStockStatus = (stock: number, minimum: number = 5) => {
    if (stock === 0) return { color: 'text-red-600 bg-red-50', text: 'SEM ESTOQUE' };
    if (stock <= minimum) return { color: 'text-orange-600 bg-orange-50', text: 'ESTOQUE BAIXO' };
    return { color: 'text-green-600 bg-green-50', text: 'EM ESTOQUE' };
  };

  const getMargin = (price: number, cost: number) => {
    if (price === 0) return 0;
    return ((price - cost) / price * 100);
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">Erro ao carregar produtos: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-600">Gerencie seu catálogo de produtos</p>
        </div>
        <Button onClick={handleAddProduct}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por nome, código de barras..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              <div className="p-4 space-y-4">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.barcode || 'Sem código'}</p>
                        <p className="text-sm text-blue-600 font-medium">{product.category_name || 'Sem categoria'}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 hover:text-blue-900 p-2"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-900 p-2"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-gray-600 text-sm mb-1">Preço de Custo</div>
                        <div className="font-semibold text-gray-900">R$ {product.cost_price.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-sm mb-1">Preço de Venda</div>
                        <div className="font-semibold text-green-600">R$ {product.sale_price.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-sm mb-1">Estoque Atual</div>
                        <div className="font-semibold">{product.current_stock}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-sm mb-1">Estoque Mínimo</div>
                        <div className="font-semibold">{product.min_stock}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        product.current_stock <= 0 
                          ? 'bg-red-100 text-red-800' 
                          : product.current_stock <= product.min_stock
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {product.current_stock <= 0 ? 'Sem Estoque' : 
                         product.current_stock <= product.min_stock ? 'Estoque Baixo' : 'OK'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        product.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {product.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código de Barras
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preços
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estoque
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
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product.current_stock, product.min_stock);
                  const margin = getMargin(product.sale_price || 0, product.cost_price || 0);
                  
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                            <Package className="w-5 h-5 text-gray-500" />
                          </div>
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
                        <div className="text-sm text-gray-900 font-mono">
                          {product.barcode || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {product.category?.name || (
                            <span className="text-gray-400">Sem categoria</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="font-bold text-green-600">
                            Venda: R$ {(product.sale_price || 0).toFixed(2)}
                          </div>
                          <div className="text-gray-600">
                            Custo: R$ {(product.cost_price || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-blue-600">
                            Margem: {margin.toFixed(1)}%
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {product.current_stock}
                        </div>
                        {product.min_stock && (
                          <div className="text-xs text-gray-500">
                            Mín: {product.min_stock}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button 
                            onClick={() => handleEditProduct(product)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(product)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAddProduct} variant="ghost" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar primeiro produto
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
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
                      Nome do Produto *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select
                      value={formData.category_id || ''}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value || undefined })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={categoriesLoading}
                    >
                      <option value="">Selecione uma categoria...</option>
                      {categories.filter(c => c.is_active).map(category => (
                        <option key={category.id} value={category.id}>
                          {category.parent_category_id ? '└ ' : ''}{category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código de Barras
                    </label>
                    <Input
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preço de Custo *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost_price}
                      onChange={(e) => handleCostPriceChange(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preço de Venda *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sale_price}
                      onChange={(e) => handleSalePriceChange(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Margem de Lucro (%)
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.markup_percentage?.toFixed(2) || '0.00'}
                        onChange={(e) => handleMarkupChange(parseFloat(e.target.value) || 0)}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    {formData.cost_price > 0 && formData.sale_price > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        Lucro: R$ {((formData.sale_price || 0) - (formData.cost_price || 0)).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estoque Atual *
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.current_stock}
                      onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estoque Mínimo
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || undefined })}
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
                    <span className="ml-2 text-sm text-gray-700">Ativo</span>
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    {editingProduct ? 'Atualizar' : 'Salvar'} Produto
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
    </div>
  );
};