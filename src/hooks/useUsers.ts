import { useState, useEffect } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';

export interface UserCommission {
  category_id: string;
  commission_percentage: number;
  category_name?: string;
}

export interface User {
  id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'FUNCIONARIO';
  credits: number;
  commission_enabled: boolean;
  total_commission_earned?: number;
  parent_id?: string;
  parent_name?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  user_commissions?: UserCommission[];
}

export interface UserInput {
  name: string;
  email: string;
  password: string;
  role: 'FUNCIONARIO';
  credits?: number;
  commission_enabled?: boolean;
  parent_id?: string;
  is_active?: boolean;
  commissions?: UserCommission[];
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // First, try to get users with basic info
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Process users and get parent names separately
      const processedUsers = await Promise.all(
        (data || []).map(async (user) => {
          let parentName = null;
          if (user.parent_id) {
            const { data: parentData } = await supabase
              .from('users')
              .select('name')
              .eq('id', user.parent_id)
              .single();
            parentName = parentData?.name;
          }
          
          // Try to get commissions if table exists
          let userCommissions: UserCommission[] = [];
          try {
            const { data: commissionsData } = await supabase
              .from('user_commissions')
              .select('category_id, commission_percentage')
              .eq('user_id', user.id);
              
            if (commissionsData) {
              userCommissions = commissionsData.map((comm: any) => ({
                ...comm,
                category_name: 'Categoria' // Placeholder name
              }));
            }
          } catch (commError) {
            // Commissions table doesn't exist yet, ignore
            console.log('Commissions table not found, continuing without it');
          }
          
          return {
            ...user,
            parent_name: parentName,
            user_commissions: userCommissions
          };
        })
      );
      
      setUsers(processedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: UserInput) => {
    try {
      setLoading(true);
      
      // Get current user for created_by field
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) throw new Error('Profile do usuário não encontrado');

      // Only ADMIN can create users
      if (profile.role !== 'ADMIN') {
        throw new Error('Apenas administradores podem criar usuários');
      }

      console.log('Creating user:', userData);

      // Call edge function to create user
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-user',
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          credits: userData.credits || 0,
          commission_enabled: userData.commission_enabled || false,
          parent_id: profile.id,
          created_by: profile.id
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar usuário');
      }

      const { user: newUser } = await response.json();
      console.log('User created:', newUser);

      // Step 2: Create commission settings if provided
      if (userData.commission_enabled && userData.commissions && userData.commissions.length > 0) {
        try {
          const commissionsToInsert = userData.commissions.map(comm => ({
            user_id: newUser.id,
            category_id: comm.category_id,
            commission_percentage: comm.commission_percentage,
            is_active: true
          }));

          const { error: commissionError } = await supabase
            .from('user_commissions')
            .insert(commissionsToInsert);

          if (commissionError) {
            console.error('Commission creation error:', commissionError);
          }
        } catch (commError) {
          console.log('Commission table operations failed:', commError);
        }
      }

      await fetchUsers();
      return newUser;
    } catch (err) {
      console.error('Create user error:', err);
      throw err instanceof Error ? err : new Error('Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, userData: Partial<UserInput> & { commissions?: UserCommission[] }) => {
    try {
      setLoading(true);
      
      // Update user profile
      const { data, error } = await supabase
        .from('users')
        .update({
          name: userData.name,
          email: userData.email,
          role: userData.role,
          credits: userData.credits,
          commission_enabled: userData.commission_enabled,
          is_active: userData.is_active
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update commissions if provided
      if (userData.commissions !== undefined) {
        try {
          // Delete existing commissions
          await supabase
            .from('user_commissions')
            .delete()
            .eq('user_id', id);

          // Insert new commissions if enabled
          if (userData.commission_enabled && userData.commissions.length > 0) {
            const commissionsToInsert = userData.commissions.map(comm => ({
              user_id: id,
              category_id: comm.category_id,
              commission_percentage: comm.commission_percentage,
              is_active: true
            }));

            await supabase
              .from('user_commissions')
              .insert(commissionsToInsert);
          }
        } catch (commError) {
          console.log('Commission table operations failed, continuing without commissions update');
        }
      }

      await fetchUsers();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao atualizar usuário');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      setLoading(true);
      
      // Soft delete - just deactivate the user
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await fetchUsers();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao deletar usuário');
    } finally {
      setLoading(false);
    }
  };

  const changeUserPassword = async (userId: string, newPassword: string) => {
    try {
      setLoading(true);
      
      // Get current user for permission check
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();
        
      if (profileError || !profile) throw new Error('Profile do usuário não encontrado');

      // Only ADMIN can change passwords
      if (profile.role !== 'ADMIN') {
        throw new Error('Apenas administradores podem alterar senhas');
      }

      // Get the user's auth_user_id
      const { data: targetUser, error: targetUserError } = await supabase
        .from('users')
        .select('auth_user_id')
        .eq('id', userId)
        .single();

      if (targetUserError || !targetUser?.auth_user_id) {
        throw new Error('Usuário não encontrado ou sem conta de acesso');
      }

      // Call edge function to change password
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'change-password',
          auth_user_id: targetUser.auth_user_id,
          new_password: newPassword
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao alterar senha');
      }

      return true;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('name');

      if (error) throw error;
      
      // Process users similar to fetchUsers
      const processedUsers = await Promise.all(
        (data || []).map(async (user) => {
          let parentName = null;
          if (user.parent_id) {
            const { data: parentData } = await supabase
              .from('users')
              .select('name')
              .eq('id', user.parent_id)
              .single();
            parentName = parentData?.name;
          }
          
          let userCommissions: UserCommission[] = [];
          try {
            const { data: commissionsData } = await supabase
              .from('user_commissions')
              .select('category_id, commission_percentage')
              .eq('user_id', user.id);
              
            if (commissionsData) {
              userCommissions = commissionsData.map((comm: any) => ({
                ...comm,
                category_name: 'Categoria' // Placeholder name
              }));
            }
          } catch (commError) {
            // Ignore if table doesn't exist
          }
          
          return {
            ...user,
            parent_name: parentName,
            user_commissions: userCommissions
          };
        })
      );
      
      setUsers(processedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pesquisar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    changeUserPassword,
    searchUsers,
  };
}