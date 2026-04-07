import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/globals.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TesourariaPage from './pages/Tesouraria.jsx';
import ObrasPage from './pages/Obras.jsx';
import ObraDetalhe from './pages/ObraDetalhe.jsx';
import FornecedoresPage from './pages/Fornecedores.jsx';
import ClientesPage from './pages/Clientes.jsx';
import ArquivoPage from './pages/Arquivo.jsx';
import PerfilPage from './pages/Perfil.jsx';
import RHPage from './pages/RH.jsx';
import LogisticaPage from './pages/Logistica.jsx';
import { canViewPage } from './context/PermissionsConfig';

// Rota protegida — verifica se o utilizador tem acesso à página
function ProtectedRoute({ path, element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.isAdmin) return element;
  // Verifica acesso à rota base (ex: /obras/O142 → /obras)
  const basePath = '/' + path.split('/')[1];
  if (!canViewPage(user, basePath || '/')) return <Navigate to="/" />;
  return element;
}

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/"                  element={<ProtectedRoute path="/"              element={<Dashboard />} />} />
        <Route path="/tesouraria"        element={<ProtectedRoute path="/tesouraria"    element={<TesourariaPage />} />} />
        <Route path="/obras"             element={<ProtectedRoute path="/obras"         element={<ObrasPage />} />} />
        <Route path="/obras/:id"         element={<ProtectedRoute path="/obras"         element={<ObraDetalhe />} />} />
        <Route path="/fornecedores"      element={<ProtectedRoute path="/fornecedores"  element={<FornecedoresPage />} />} />
        <Route path="/clientes"          element={<ProtectedRoute path="/clientes"      element={<ClientesPage />} />} />
        <Route path="/arquivo"           element={<ProtectedRoute path="/arquivo"       element={<ArquivoPage />} />} />
        <Route path="/perfil"            element={<ProtectedRoute path="/perfil"        element={<PerfilPage />} />} />
        <Route path="/rh"                element={<ProtectedRoute path="/rh"            element={<RHPage />} />} />
        <Route path="/logistica"         element={<ProtectedRoute path="/logistica"     element={<LogisticaPage />} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  );
}
