import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'FUNCIONARIO';
  credits: number;
  commission_enabled?: boolean;
  total_commission_earned?: number;
  parent_id: string | null;
  mercado_pago_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  auth_user_id: string;
}

interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isSetupNeeded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createFirstAdmin: (email: string, password: string, name: string) => Promise<void>;
  checkSetupStatus: () => Promise<void>;
  loadProfile: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  isSetupNeeded: false,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    await get().loadProfile();
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, profile: null });
  },

  createFirstAdmin: async (email, password, name) => {
    try {
      // Primeiro, verifica se não existe admin
      const { data: existingAdmin } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN')
        .limit(1);
      
      if (existingAdmin && existingAdmin.length > 0) {
        throw new Error('Administrador já existe no sistema');
      }

      // Cria usuário na auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined // Não redireciona, confirma imediatamente
        }
      });
      
      if (error) {
        if (error.message.includes('User already registered')) {
          throw new Error('Este email já está registrado');
        }
        throw error;
      }
      if (!data.user) throw new Error('Falha ao criar usuário');

      // Cria profile na tabela users usando função especial
      const { data: adminData, error: profileError } = await supabase
        .rpc('create_first_admin', {
          p_email: email,
          p_name: name,
          p_auth_user_id: data.user.id,
        });

      if (profileError) {
        console.error('Erro ao criar profile:', profileError);
        throw new Error(`Falha ao criar perfil do administrador: ${profileError.message}`);
      }
      
      // Faz login automático após criar o admin
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Erro no login automático:', signInError);
        // Mesmo com erro no login, o admin foi criado, então atualiza o estado
        set({ isSetupNeeded: false });
        return;
      }

      // Recarrega o profile e atualiza estado
      await get().loadProfile();
      set({ isSetupNeeded: false });
    } catch (error) {
      console.error('Erro no createFirstAdmin:', error);
      throw error;
    }
  },

  checkSetupStatus: async () => {
    try {
      // Check directly for admin users instead of using RPC
      const { data: adminUsers, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN')
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error checking admin status:', error);
        set({ isSetupNeeded: true });
        return;
      }

      const hasAdmin = adminUsers && adminUsers.length > 0;
      set({ isSetupNeeded: !hasAdmin });
    } catch (error) {
      console.error('Error in checkSetupStatus:', error);
      set({ isSetupNeeded: true });
    }
  },

  loadProfile: async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        // Silently handle auth session missing errors
        if (userError.message.includes('Auth session missing')) {
          set({ user: null, profile: null, loading: false });
          return;
        }
        console.error('Error getting user:', userError);
        set({ user: null, profile: null, loading: false });
        return;
      }
      
      if (!user) {
        set({ user: null, profile: null, loading: false });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        set({ user, profile: null, loading: false });
        return;
      }
      set({ user, profile, loading: false });
    } catch (error) {
      console.error('Error in loadProfile:', error);
      set({ user: null, profile: null, loading: false });
    }
  },

  initialize: async () => {
    set({ loading: true });
    
    try {
      await get().checkSetupStatus();
      await get().loadProfile();
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      set({ loading: false });
    }
  },
}));