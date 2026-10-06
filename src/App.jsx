import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, PERFIS } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import Layout from './components/Layout';

// ────────────────────────────────────────────────────────────────────────────
// IMPORTAÇÃO DAS TELAS (MÓDULOS)
// ────────────────────────────────────────────────────────────────────────────
import Login from './pages/Login';
import Planejamento from './pages/Planejamento';
import DashboardAdmin from './pages/DashboardAdmin';
import DashboardGlobal from './pages/DashboardGlobal';
import Indicadores from './pages/Indicadores';
import AdminConfig from './pages/AdminConfig';
import MeuPainel from './pages/MeuPainel';

// ────────────────────────────────────────────────────────────────────────────
// GRUPOS DE PERMISSÕES (Mantém as rotas JSX limpas e fáceis de ler)
// ────────────────────────────────────────────────────────────────────────────
const GESTAO_ALTA = [PERFIS.ADMIN, 'Administrador', 'Diretor'];
const GESTAO_MEDIA = [...GESTAO_ALTA, PERFIS.CHEFE_3];
const OPERACIONAL = [...GESTAO_MEDIA, PERFIS.CHEFE_2, PERFIS.CHEFE_1];
const TODOS_USUARIOS = [...OPERACIONAL, PERFIS.COLABORADOR, 'Secretaria'];

function AppRoutes() {
  const { user } = useAuth();

  // ────────────────────────────────────────────────────────────────────────────
  // ROTEAMENTO INICIAL ("Guarda de Trânsito")
  // ────────────────────────────────────────────────────────────────────────────
  const getHomeRoute = () => {
    if (!user) return '/login';
    
    const role = user.role || '';
    const email = user.email || '';

    // 1. Alta Gestão e Lideranças: Aterram na Gestão Operacional (Fazer Escala)
    if (role.includes('Administrador') || role.includes('Diretor') || role.includes(PERFIS.CHEFE_1) || role.includes(PERFIS.CHEFE_2) || email === 'admin@teste.com') {
      return '/planejamento';
    }
    if (role.includes(PERFIS.CHEFE_3)) return '/dashboard-global';
    
    // 3. Assistencial / Resto: Aterra no Espaço Pessoal
    return '/meu-painel';
  };

  // ────────────────────────────────────────────────────────────────────────────
  // MAPA DE ROTAS DA APLICAÇÃO
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Routes>
      {/* Rota Pública (Sem Login) */}
      <Route path="/login" element={<Login />} />
      
      {/* Rotas Protegidas (Exigem Login e ficam dentro do Layout padrão) */}
      <Route element={<Layout />}>
        
        {/* Desvio Automático na Raiz */}
        <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
        
        {/* === TELAS CENTRALIZADAS === */}
        <Route path="/planejamento" element={
          <PrivateRoute allowedRoles={OPERACIONAL}>
            <Planejamento />
          </PrivateRoute>
        } />
        
        <Route path="/dashboard-admin" element={
          <PrivateRoute allowedRoles={GESTAO_MEDIA}>
            <DashboardAdmin />
          </PrivateRoute>
        } />

        <Route path="/meu-painel" element={
          <PrivateRoute allowedRoles={TODOS_USUARIOS}>
            <MeuPainel />
          </PrivateRoute>
        } />

        {/* === MÓDULOS SECUNDÁRIOS === */}
        <Route path="/dashboard-global" element={
          <PrivateRoute allowedRoles={GESTAO_MEDIA}>
            <DashboardGlobal />
          </PrivateRoute>
        } />
        
        <Route path="/indicadores" element={
          <PrivateRoute allowedRoles={GESTAO_ALTA}>
            <Indicadores />
          </PrivateRoute>
        } />

        <Route path="/configuracoes" element={
          <PrivateRoute allowedRoles={GESTAO_ALTA}>
            <AdminConfig />
          </PrivateRoute>
        } />
      </Route>
      
      {/* Rota de Queda: Se digitar URL errada, volta para o início */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}