import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Category {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface CategoryInput {
  name: string;
  description?: string;
  is_active: boolean;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, description, is_active, created_at, updated_at, user_id')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Erro detalhado ao carregar categorias:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (categoryData: CategoryInput) => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Erro de autenticação:', userError);
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) {
        console.error('Erro ao buscar profile:', profileError);
        throw new Error('Profile do usuário não encontrado');
      }

      console.log('Criando categoria com dados:', { ...categoryData, user_id: profile.id, created_by: profile.id });

      const { data, error } = await supabase
        .from('categories')
        .insert([{
          name: categoryData.name,
          description: categoryData.description,
          is_active: categoryData.is_active,
          user_id: profile.id,
          created_by: profile.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao inserir categoria:', error);
        throw error;
      }

      console.log('Categoria criada com sucesso:', data);
      await fetchCategories();
      return data;
    } catch (err) {
      console.error('Erro no createCategory:', err);
      throw err instanceof Error ? err : new Error('Erro ao criar categoria');
    }
  };

  const updateCategory = async (id: string, categoryData: CategoryInput) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', id);

      if (error) throw error;
      await fetchCategories();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao atualizar categoria');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await fetchCategories();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao excluir categoria');
    }
  };

  const searchCategories = async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, description, is_active, created_at, updated_at, user_id')
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    searchCategories,
  };
}