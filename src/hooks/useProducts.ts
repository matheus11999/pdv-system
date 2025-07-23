import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Product {
  id: string;
  name: string;
  description?: string;
  barcode?: string;
  sale_price: number;
  cost_price: number;
  markup_percentage?: number;
  current_stock: number;
  min_stock?: number;
  max_stock?: number;
  category_id?: string;
  supplier_id?: string;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  weight?: number;
  unit?: string;
  tax_rate?: number;
  tax_included?: boolean;
  is_active: boolean;
  is_service?: boolean;
  allow_negative_stock?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Support both old and new property names for compatibility
  price?: number;  // alias for sale_price
  stock_current?: number;  // alias for current_stock
  stock_minimum?: number;  // alias for min_stock
  stock_maximum?: number;  // alias for max_stock
  can_be_sold?: boolean;
  track_stock?: boolean;
  category?: {
    name: string;
  };
}

export interface ProductInput {
  name: string;
  description?: string;
  barcode?: string;
  sale_price?: number;
  price?: number;  // alias for sale_price
  cost_price?: number;
  markup_percentage?: number;
  current_stock?: number;
  stock_current?: number;  // alias for current_stock
  min_stock?: number;
  stock_minimum?: number;  // alias for min_stock
  max_stock?: number;
  stock_maximum?: number;  // alias for max_stock
  category_id?: string;
  supplier_id?: string;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  weight?: number;
  unit?: string;
  tax_rate?: number;
  tax_included?: boolean;
  is_active?: boolean;
  is_service?: boolean;
  allow_negative_stock?: boolean;
  can_be_sold?: boolean;
  track_stock?: boolean;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (productData: ProductInput) => {
    try {
      // Obter o usuário atual para o campo created_by
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) throw new Error('Profile do usuário não encontrado');

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: productData.name,
          description: productData.description,
          barcode: productData.barcode,
          sale_price: productData.sale_price || productData.price || 0,
          cost_price: productData.cost_price || 0,
          markup_percentage: productData.markup_percentage,
          current_stock: productData.current_stock || productData.stock_current || 0,
          min_stock: productData.min_stock || productData.stock_minimum,
          max_stock: productData.max_stock || productData.stock_maximum,
          category_id: productData.category_id,
          supplier_id: productData.supplier_id,
          brand: productData.brand,
          model: productData.model,
          color: productData.color,
          size: productData.size,
          weight: productData.weight,
          unit: productData.unit || 'UN',
          tax_rate: productData.tax_rate || 0,
          tax_included: productData.tax_included || false,
          is_active: productData.is_active ?? true,
          is_service: productData.is_service || false,
          allow_negative_stock: productData.allow_negative_stock || false,
          created_by: profile.id,
          user_id: profile.id
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchProducts();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao criar produto');
    }
  };

  const updateProduct = async (id: string, productData: Partial<ProductInput>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchProducts();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao atualizar produto');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await fetchProducts();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao deletar produto');
    }
  };

  const searchProducts = async (query: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name)
        `)
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,barcode.ilike.%${query}%,description.ilike.%${query}%`)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pesquisar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    loading,
    error,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
  };
}