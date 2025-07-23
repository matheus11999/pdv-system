import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, Shield, Users as UsersIcon, Key, Percent } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useUsers, UserInput, UserCommission } from '../../hooks/useUsers';
import { useCategories } from '../../hooks/useCategories';

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: 'FUNCIONARIO';
  credits: number;
  commission_enabled: boolean;
  commissions: UserCommission[];
}

export const UsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState<NewUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'FUNCIONARIO',
    credits: 0,
    commission_enabled: false,
    commissions: []
  });
  
  const { users, loading, error, createUser, updateUser, deleteUser, changeUserPassword, searchUsers } = useUsers();
  const { categories } = useCategories();

  // Search functionality
  useEffect(() => {
    if (searchTerm.trim()) {
      searchUsers(searchTerm);
    }
  }, [searchTerm]);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleLabel = (role: string) => {
    const labels = {
      ADMIN: 'Administrador',
      RESELLER: 'Revendedor',
      USER: 'Usuário',
      CASHIER: 'Operador de Caixa'
    };
    return labels[role];
  };

  const getRoleColor = (role: string) => {
    const colors = {
      ADMIN: 'text-red-600 bg-red-50',
      RESELLER: 'text-blue-600 bg-blue-50',
      USER: 'text-green-600 bg-green-50',
      CASHIER: 'text-purple-600 bg-purple-50'
    };
    return colors[role];
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Creating user:', newUser);
      await createUser(newUser);
      setShowAddModal(false);
      resetNewUserForm();
      alert('Usuário criado com sucesso!');
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Erro ao criar usuário: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const resetNewUserForm = () => {
    setNewUser({
      name: '',
      email: '',
      password: '',
      role: 'FUNCIONARIO',
      credits: 0,
      commission_enabled: false,
      commissions: []
    });
  };

  const handleChangePassword = (user: any) => {
    setPasswordUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser || !newPassword) return;
    
    try {
      await changeUserPassword(passwordUser.id, newPassword);
      setShowPasswordModal(false);
      setPasswordUser(null);
      setNewPassword('');
      alert('Senha alterada com sucesso!');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao alterar senha');
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser({
      ...user,
      commissions: user.user_commissions || []
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      await updateUser(editingUser.id, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        credits: editingUser.credits,
        commission_enabled: editingUser.commission_enabled,
        commissions: editingUser.commissions
      });
      setShowEditModal(false);
      setEditingUser(null);
      alert('Usuário atualizado com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar usuário: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Deseja realmente excluir o usuário ${userName}?`)) {
      try {
        await deleteUser(userId);
        alert('Usuário excluído com sucesso!');
      } catch (error) {
        alert('Erro ao excluir usuário: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      }
    }
  };

  const addCommission = (userForm: any, setUserForm: any) => {
    const newCommission = {
      category_id: '',
      commission_percentage: 0
    };
    setUserForm({
      ...userForm,
      commissions: [...(userForm.commissions || []), newCommission]
    });
  };

  const updateCommission = (index: number, field: string, value: any, userForm: any, setUserForm: any) => {
    const updatedCommissions = [...(userForm.commissions || [])];
    updatedCommissions[index] = {
      ...updatedCommissions[index],
      [field]: value
    };
    setUserForm({
      ...userForm,
      commissions: updatedCommissions
    });
  };

  const removeCommission = (index: number, userForm: any, setUserForm: any) => {
    const updatedCommissions = (userForm.commissions || []).filter((_: any, i: number) => i !== index);
    setUserForm({
      ...userForm,
      commissions: updatedCommissions
    });
  };

  const roleStats = {
    ADMIN: users.filter(u => u.role === 'ADMIN').length,
    RESELLER: users.filter(u => u.role === 'RESELLER').length,
    CASHIER: users.filter(u => u.role === 'CASHIER').length,
    USER: users.filter(u => u.role === 'USER').length
  };

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

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-red-600">Erro ao carregar usuários: {error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Tentar Novamente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-600">Gerencie usuários e permissões do sistema</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Administradores</p>
              <p className="text-2xl font-bold text-gray-900">{roleStats.ADMIN}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <UsersIcon className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Revendedores</p>
              <p className="text-2xl font-bold text-gray-900">{roleStats.RESELLER}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <Key className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Operadores</p>
              <p className="text-2xl font-bold text-gray-900">{roleStats.CASHIER}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <User className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Usuários</p>
              <p className="text-2xl font-bold text-gray-900">{roleStats.USER}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="secondary">Filtros</Button>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Função
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créditos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Superior
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Acesso
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
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-bold">
                      {user.credits > 0 ? `${user.credits} créditos` : '-'}
                    </div>
                    {user.commission_enabled && (
                      <div className="text-xs text-green-600 flex items-center">
                        <Percent className="w-3 h-3 mr-1" />
                        Comissão ativa
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.parent_name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.last_login ? formatDateTime(user.last_login) : 'Nunca'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                    }`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button 
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => handleEditUser(user)}
                        title="Editar usuário"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        className="text-green-600 hover:text-green-900"
                        onClick={() => handleChangePassword(user)}
                        title="Alterar senha"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      {user.role !== 'ADMIN' && (
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Novo Usuário</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <Input
                  label="Nome Completo"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
                <Input
                  label="Senha"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={6}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Função
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  >
                    <option value="CASHIER">Operador de Caixa</option>
                    <option value="USER">Usuário</option>
                    <option value="RESELLER">Revendedor</option>
                  </select>
                </div>
                {newUser.role === 'RESELLER' && (
                  <Input
                    label="Créditos Iniciais"
                    type="number"
                    value={newUser.credits}
                    onChange={(e) => setNewUser({ ...newUser, credits: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                )}
                
                {/* Commission Settings */}
                <div className="border-t pt-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="commission_enabled"
                      checked={newUser.commission_enabled}
                      onChange={(e) => setNewUser({ ...newUser, commission_enabled: e.target.checked })}
                      className="mr-2"
                    />
                    <label htmlFor="commission_enabled" className="text-sm font-medium text-gray-700">
                      Habilitar Comissão
                    </label>
                  </div>
                  
                  {newUser.commission_enabled && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Comissão por Categoria</h4>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => addCommission(newUser, setNewUser)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      
                      {newUser.commissions.map((commission, index) => (
                        <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                          <select
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            value={commission.category_id}
                            onChange={(e) => updateCommission(index, 'category_id', e.target.value, newUser, setNewUser)}
                          >
                            <option value="">Selecionar categoria...</option>
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            placeholder="% Comissão"
                            min={0}
                            max={100}
                            step="0.5"
                            value={commission.commission_percentage}
                            onChange={(e) => updateCommission(index, 'commission_percentage', parseFloat(e.target.value) || 0, newUser, setNewUser)}
                            className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeCommission(index, newUser, setNewUser)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      {newUser.commissions.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-2">
                          Clique em "Adicionar" para definir comissões por categoria
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    Criar Usuário
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      resetNewUserForm();
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Editar Usuário</h3>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <Input
                  label="Nome Completo"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Função
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    disabled={editingUser.role === 'ADMIN'}
                  >
                    <option value="CASHIER">Operador de Caixa</option>
                    <option value="USER">Usuário</option>
                    <option value="RESELLER">Revendedor</option>
                    {editingUser.role === 'ADMIN' && <option value="ADMIN">Administrador</option>}
                  </select>
                </div>
                
                {editingUser.role === 'RESELLER' && (
                  <Input
                    label="Créditos"
                    type="number"
                    value={editingUser.credits}
                    onChange={(e) => setEditingUser({ ...editingUser, credits: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                )}
                
                {/* Commission Settings */}
                <div className="border-t pt-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="edit_commission_enabled"
                      checked={editingUser.commission_enabled}
                      onChange={(e) => setEditingUser({ ...editingUser, commission_enabled: e.target.checked })}
                      className="mr-2"
                    />
                    <label htmlFor="edit_commission_enabled" className="text-sm font-medium text-gray-700">
                      Habilitar Comissão
                    </label>
                  </div>
                  
                  {editingUser.commission_enabled && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Comissão por Categoria</h4>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => addCommission(editingUser, setEditingUser)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      
                      {(editingUser.commissions || []).map((commission: any, index: number) => (
                        <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                          <select
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            value={commission.category_id}
                            onChange={(e) => updateCommission(index, 'category_id', e.target.value, editingUser, setEditingUser)}
                          >
                            <option value="">Selecionar categoria...</option>
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            placeholder="% Comissão"
                            min={0}
                            max={100}
                            step="0.5"
                            value={commission.commission_percentage}
                            onChange={(e) => updateCommission(index, 'commission_percentage', parseFloat(e.target.value) || 0, editingUser, setEditingUser)}
                            className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeCommission(index, editingUser, setEditingUser)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      {(!editingUser.commissions || editingUser.commissions.length === 0) && (
                        <p className="text-sm text-gray-500 text-center py-2">
                          Clique em "Adicionar" para definir comissões por categoria
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    Atualizar Usuário
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                Alterar Senha - {passwordUser.name}
              </h2>
              
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nova Senha
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    required
                    minLength={6}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Mínimo de 6 caracteres
                  </p>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={loading || newPassword.length < 6}
                  >
                    {loading ? 'Alterando...' : 'Alterar Senha'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordUser(null);
                      setNewPassword('');
                    }}
                    className="flex-1"
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