# Sistema PDV Completo - Documentação Atualizada

Este é um sistema completo de **Ponto de Venda (PDV)** profissional com controle de estoque, gestão de usuários e sistema avançado de comissões, desenvolvido com React/TypeScript e Supabase.

## 🚀 Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS + Lucide React (ícones)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Database**: PostgreSQL com Row Level Security (RLS)
- **Autenticação**: Supabase Auth + JWT
- **Estado Global**: Zustand
- **Roteamento**: React Router DOM
- **PWA**: Progressive Web App com manifest configurado

## 📊 Informações do Banco

- **Nome do Projeto**: `pdv`
- **ID do Projeto**: `szzgqacuomtlbpouegtw`
- **URL**: `https://szzgqacuomtlbpouegtw.supabase.co`
- **Região**: `sa-east-1` (São Paulo)
- **Versão PostgreSQL**: 17.4.1.054

## 🗄️ Schema do Banco de Dados

### **Tabelas Principais**

#### **1. `users` - Sistema de Usuários**
- **Hierarquia Simplificada**: ADMIN → FUNCIONARIO
- **Campos Principais**: 
  - `role` (ADMIN/FUNCIONARIO)
  - `commission_enabled` (boolean)
  - `total_commission_earned` (decimal)
  - `auth_user_id` (integração Supabase Auth)
- **Funcionalidades**: Gestão completa de usuários com comissões

#### **2. `products` - Catálogo de Produtos**
- **Informações Completas**: nome, descrição, código de barras
- **Controle de Preços**: custo, venda, markup automático
- **Gestão de Estoque**: atual, mínimo, máximo
- **Categorização**: integração com tabela categories
- **Status**: ativo/inativo, controle de visibilidade

#### **3. `categories` - Categorias de Produtos**
- **Organização**: estrutura hierárquica de produtos
- **Integração**: sistema de comissões por categoria
- **Controle**: acesso baseado em permissões

#### **4. `customers` - Base de Clientes**
- **Dados Pessoais**: CPF/CNPJ, contatos, endereço
- **Sistema de Crédito**: controle de saldo devedor
- **Fidelidade**: sistema de pontos (implementado)
- **Histórico**: integração com vendas

#### **5. `sales` - Transações de Venda**
- **Numeração**: sequencial automática
- **Pagamentos**: múltiplos métodos (CASH, CARD, PIX, CREDIT)
- **Status**: COMPLETED, CANCELLED, REFUNDED
- **Comissões**: campos para cálculo automático
- **Desconto**: suporte a desconto por porcentagem

#### **6. `sale_items` - Itens das Vendas**
- **Snapshot**: dados do produto no momento da venda
- **Rastreabilidade**: histórico completo de transações
- **Cálculos**: totais, descontos, comissões por item

### **Tabelas de Controle**

#### **7. `stock_movements` - Movimentações de Estoque**
- **Tipos**: IN, OUT, ADJUSTMENT, TRANSFER
- **Auditoria**: usuário, timestamp, motivo
- **Integração**: automática com vendas

#### **8. `user_commissions` - Configuração de Comissões**
- **Relacionamento**: user_id → category_id → percentage
- **Flexibilidade**: configuração individual por categoria
- **Controle**: ativação/desativação por usuário

#### **9. `sale_commissions` - Comissões Calculadas**
- **Cálculo Automático**: via triggers no banco
- **Status**: CALCULATED, PAID, CANCELLED
- **Rastreabilidade**: por venda e item individual

#### **10. `store_settings` - Configurações da Loja**
- **Dados da Empresa**: nome, CNPJ, contatos, endereço
- **Configurações de Desconto**: percentual máximo permitido
- **Mensagens**: cabeçalho e rodapé dos cupons
- **PWA**: configurações do aplicativo

## 🏗️ Arquitetura do Sistema

### **Estrutura de Arquivos**
```
src/
├── components/
│   ├── ui/                    # Componentes base reutilizáveis
│   │   ├── Button.tsx         # Botão padronizado
│   │   ├── Input.tsx          # Input com validação
│   │   ├── Card.tsx           # Container de conteúdo
│   │   └── Alert.tsx          # Sistema de notificações
│   ├── AlertProvider.tsx      # Provider global de alertas
│   └── CommissionDashboard.tsx # Dashboard de comissões
├── hooks/
│   ├── useProducts.ts         # Gestão de produtos
│   ├── useCustomers.ts        # Gestão de clientes
│   ├── useSales.ts           # Gestão de vendas
│   ├── useUsers.ts           # Gestão de usuários
│   └── useStoreSettings.ts   # Configurações da loja
├── lib/
│   ├── supabase.ts           # Cliente Supabase configurado
│   ├── auth.ts               # Utilitários de autenticação
│   └── utils.ts              # Funções utilitárias
├── pages/
│   ├── Login.tsx             # Autenticação
│   ├── Setup.tsx             # Configuração inicial
│   ├── Dashboard.tsx         # Layout principal com roteamento
│   └── PDV/                  # Páginas do sistema
│       ├── PDVInterface.tsx      # ✅ Interface do PDV
│       ├── ProductsPage.tsx      # ✅ Gestão de produtos
│       ├── CustomersPage.tsx     # ✅ Gestão de clientes
│       ├── SalesPage.tsx         # ✅ Histórico de vendas
│       ├── InventoryPage.tsx     # ✅ Controle de estoque
│       ├── UsersPage.tsx         # ✅ Gestão de usuários (ADMIN)
│       ├── ReportsPage.tsx       # ✅ Relatórios e analytics
│       ├── CategoriesPage.tsx    # ✅ Gestão de categorias
│       └── SettingsPage.tsx      # ⚠️ Configurações (necessita PWA)
├── store/
│   └── authStore.ts          # Estado global de autenticação
├── utils/
│   └── receiptPDF.ts         # Geração de cupons em HTML/PDF
└── App.tsx                   # Roteamento e providers
```

## 🎯 Páginas e Funcionalidades

### **🏠 Dashboard Principal** (`/dashboard`)
**Acesso**: Todos os usuários logados
**Funcionalidades**:
- ✅ **Estatísticas em Tempo Real**: vendas hoje, produtos, clientes, estoque baixo
- ✅ **Vendas Recentes**: últimas transações realizadas
- ✅ **Produtos em Falta**: alertas de estoque crítico
- ✅ **Dashboard de Comissões**: para usuários FUNCIONARIO com comissão habilitada
- ✅ **Interface Responsiva**: adaptável a mobile e desktop

### **🧮 PDV - Ponto de Venda** (`/dashboard/pdv`)
**Acesso**: Todos os usuários
**Interface**: Dedicada sem sidebar para foco na venda
**Funcionalidades Implementadas**:
- ✅ **Busca de Produtos**: por nome, código de barras ou categoria
- ✅ **Carrinho Inteligente**: adição/remoção com validação de estoque
- ✅ **Sistema de Desconto**: porcentagem configurável com limite
  - Input de desconto com validação automática
  - Limite máximo baseado nas configurações da loja
  - Exibição de subtotal, desconto e total
- ✅ **Busca de Clientes**: nome, telefone, documento com dados expandidos
- ✅ **Métodos de Pagamento**:
  - Dinheiro (com cálculo de troco)
  - Cartão de Crédito/Débito
  - PIX
  - Fiado (somente com cliente selecionado)
- ✅ **Modal de Confirmação Melhorada**:
  - Design profissional com gradientes
  - Exibição detalhada de desconto e troco
  - Responsiva para mobile e desktop
- ✅ **Geração de Cupom**:
  - HTML profissional com dados da loja
  - Abertura em nova aba com impressão automática
  - Dados completos: empresa, cliente, produtos, desconto, troco

### **📦 Produtos** (`/dashboard/products`)
**Acesso**: Todos os usuários
**Funcionalidades**:
- ✅ **CRUD Completo**: criar, listar, editar, deletar produtos
- ✅ **Controle de Estoque**: atual, mínimo, máximo
- ✅ **Gestão de Preços**: custo, venda, cálculo automático de margem
- ✅ **Categorização**: associação com categorias
- ✅ **Busca Avançada**: por nome, código de barras, categoria
- ✅ **Status Visual**: indicadores de estoque (OK, Baixo, Sem Estoque)
- ✅ **Validações**: preços, estoque, dados obrigatórios

### **👥 Clientes** (`/dashboard/customers`)
**Acesso**: Todos os usuários
**Funcionalidades**:
- ✅ **Base Completa**: dados pessoais e empresariais (CPF/CNPJ)
- ✅ **Endereço Completo**: integração com busca CEP
- ✅ **Controle de Crédito**: saldo devedor, histórico de pagamentos
- ✅ **Sistema de Fidelidade**: pontos por compra
- ✅ **Busca Inteligente**: nome, telefone, documento
- ✅ **Histórico de Vendas**: todas as transações do cliente

### **🧾 Vendas** (`/dashboard/sales`)
**Acesso**: Todos os usuários (próprias vendas) / ADMIN (todas)
**Funcionalidades**:
- ✅ **Histórico Completo**: todas as vendas com filtros
- ✅ **Estatísticas Automáticas**: total, vendas, ticket médio, canceladas
- ✅ **Detalhes da Venda**: itens, pagamento, cliente, comissões
- ✅ **Impressão de Comprovante**: geração de HTML com dados atualizados
- ✅ **Filtros Avançados**: data, cliente, método de pagamento, status
- ✅ **Identificação Visual**: vendas fiado destacadas

### **📊 Controle de Estoque** (`/dashboard/inventory`)
**Acesso**: Todos os usuários
**Funcionalidades**:
- ✅ **Aba Visão Geral**: listagem com status de estoque
- ✅ **Aba Movimentações**: histórico de entradas e saídas
- ✅ **Aba Alertas**: produtos sem estoque e estoque baixo
- ✅ **Estatísticas**: valor total do estoque, produtos críticos
- ✅ **Relatórios**: produtos em situação crítica

### **👤 Usuários** (`/dashboard/users`)
**Acesso**: Somente ADMIN
**Funcionalidades Avançadas**:
- ✅ **CRUD Completo**: criar, editar, visualizar, desativar usuários
- ✅ **Integração Supabase Auth**: criação automática de credenciais
- ✅ **Sistema de Comissões**:
  - Habilitação individual por usuário
  - Configuração de percentual por categoria
  - Dashboard de performance
- ✅ **Controle de Acesso**: ativação/desativação de usuários
- ✅ **Hierarquia**: ADMIN (total) → FUNCIONARIO (limitado)

### **📈 Relatórios** (`/dashboard/reports`)
**Acesso**: ADMIN (todos) / FUNCIONARIO (próprios dados)
**Funcionalidades**:
- ✅ **Gráficos Visuais**: performance de 7 dias com Chart.js
- ✅ **Breakdown de Pagamentos**: métodos mais utilizados
- ✅ **Análise de Produtos**: mais vendidos, margem de lucro
- ✅ **Relatório de Estoque Baixo**: export em PDF
- ✅ **Estatísticas Financeiras**: receita, ticket médio, crescimento

### **💰 Dashboard de Comissões** (`/dashboard/commissions`)
**Acesso**: FUNCIONARIO com comissão habilitada
**Funcionalidades**:
- ✅ **Filtros por Período**: dia, semana, mês com seletores
- ✅ **Resumo Executivo**: total acumulado, vendas realizadas, média
- ✅ **Histórico Detalhado**: todas as comissões calculadas
- ✅ **Performance**: ranking entre funcionários (para ADMIN)

### **🏷️ Categorias** (`/dashboard/categories`)
**Acesso**: ADMIN e FUNCIONARIO
**Funcionalidades**:
- ✅ **Gestão Completa**: criar, editar, deletar categorias
- ✅ **Integração com Comissões**: configuração por categoria
- ✅ **Organização**: hierarquia de produtos

### **⚙️ Configurações** (`/dashboard/settings`)
**Acesso**: Somente ADMIN
**Funcionalidades Implementadas**:
- ✅ **Dados da Empresa**: nome, CNPJ, contatos, endereço
- ✅ **Configurações de Desconto**: percentual máximo permitido
- ✅ **Mensagens do Cupom**: cabeçalho, mensagem, rodapé
- ⚠️ **PWA (Pendente)**: nome do app, cor principal, ícone
- ⚠️ **Upload de Imagens (Pendente)**: integração com Supabase Storage

## 🔐 Sistema de Permissões

### **ADMIN**
- ✅ **Acesso Total**: todas as páginas e funcionalidades
- ✅ **Gestão de Usuários**: criar, editar, configurar comissões
- ✅ **Configurações**: sistema, loja, PWA
- ✅ **Relatórios Globais**: todos os dados do sistema
- ✅ **Configurações Avançadas**: desconto máximo, integrações

### **FUNCIONARIO**
- ✅ **PDV Completo**: vendas, produtos, clientes
- ✅ **Vendas Próprias**: histórico das próprias transações
- ✅ **Dashboard de Comissões**: quando habilitado
- ✅ **Relatórios Pessoais**: própria performance
- ❌ **Bloqueado**: gestão de usuários, configurações do sistema

## 🎨 Sistema de Design

### **Componentes UI**
- ✅ **Design System**: componentes padronizados e reutilizáveis
- ✅ **Alertas Bonitos**: substituição completa dos alerts nativos
- ✅ **Modais Responsivos**: adaptáveis a qualquer dispositivo
- ✅ **Gradientes e Cores**: paleta consistente verde/esmeralda
- ✅ **Animações**: transitions suaves e feedback visual

### **Responsividade**
- ✅ **Mobile First**: otimizado para dispositivos móveis
- ✅ **Breakpoints**: sm, md, lg, xl configurados
- ✅ **Touch Friendly**: elementos adequados para touch
- ✅ **PWA Ready**: manifest configurado, falta service worker

## 🔧 Funcionalidades Técnicas

### **Sistema de Comissões Avançado**
- ✅ **Configuração Flexível**: por usuário e categoria
- ✅ **Cálculo Automático**: triggers no banco de dados
- ✅ **Dashboard Completo**: filtros, resumos, histórico
- ✅ **Integração com Vendas**: cálculo em tempo real
- ✅ **Relatórios**: performance e acompanhamento

### **Sistema de Desconto**
- ✅ **Porcentagem Configurável**: limite máximo por loja
- ✅ **Validação Automática**: alertas de limite excedido
- ✅ **Cálculo em Tempo Real**: subtotal, desconto, total
- ✅ **Integração com Cupom**: exibição no comprovante

### **Geração de Cupom Profissional**
- ✅ **HTML Completo**: dados da loja, cliente, produtos
- ✅ **Auto-impressão**: abertura em nova aba com print()
- ✅ **Dados da Loja**: integração com store_settings
- ✅ **Responsive Design**: layout adaptável para impressão
- ✅ **Informações Completas**: desconto, troco, métodos de pagamento

### **Integração com Supabase**
- ✅ **Auth Completo**: criação automática de usuários
- ✅ **RLS Configurado**: políticas de segurança por linha
- ✅ **Hooks Customizados**: gestão de estado otimizada
- ✅ **Real-time**: atualizações em tempo real
- ✅ **Storage**: preparado para upload de imagens

## 📱 PWA (Progressive Web App)

### **✅ Implementado**
- ✅ **Manifest.json**: configuração básica do PWA
- ✅ **Ícones**: SVG responsivo para diferentes tamanhos
- ✅ **Meta Tags**: viewport, theme-color, etc.
- ✅ **Responsividade**: layout adaptável

### **⚠️ Pendente de Implementação**
- ⚠️ **Service Worker**: para funcionalidade offline
- ⚠️ **Cache Strategy**: cacheamento de recursos estáticos
- ⚠️ **Configuração PWA**: página de configurações para:
  - Nome do aplicativo
  - Cor principal/tema
  - Upload de ícone personalizado
  - Configurações de notificação

## 🚀 Status de Implementação

### **✅ Completamente Implementado (95%)**
1. **Autenticação e Usuários** - Sistema completo com comissões
2. **PDV Interface** - Funcionalidade completa com desconto
3. **Produtos e Estoque** - Gestão completa
4. **Clientes e Vendas** - Sistema completo
5. **Relatórios e Analytics** - Gráficos e exportação
6. **Sistema de Comissões** - Funcionalidade avançada
7. **Alertas e Notificações** - Sistema próprio implementado
8. **Cupom Fiscal** - HTML profissional com dados da loja

### **⚠️ Necessita Implementação**
1. **Página de Configurações PWA** - Configurar app, cores, ícones
2. **Service Worker** - Funcionalidade offline
3. **Upload de Imagens** - Integração com Supabase Storage
4. **Configurações Avançadas** - Integrações externas

### **📋 Próximos Passos Prioritários**
1. **Implementar aba PWA na página de configurações**
2. **Configurar Supabase Storage para upload de imagens**
3. **Adicionar service worker para funcionalidade offline**
4. **Criar interface para customização de cores e ícones**
5. **Implementar backup/restauração de dados**

## 🛠️ Comandos de Desenvolvimento

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Verificação de código
npm run lint

# Testes (quando implementados)
npm run test
```

## 📦 Estrutura de Deploy

O sistema está preparado para deploy em:
- ✅ **Vercel/Netlify**: build estático otimizado
- ✅ **Supabase Edge Functions**: para lógica serverless
- ✅ **PWA**: instalação como aplicativo móvel
- ⚠️ **Docker**: containerização (configuração pendente)

---

## 📝 Notas de Desenvolvimento

**Status Atual**: Sistema em produção com 95% das funcionalidades implementadas
**Última Atualização**: Janeiro 2025
**Próxima Milestone**: Finalização do PWA e configurações avançadas