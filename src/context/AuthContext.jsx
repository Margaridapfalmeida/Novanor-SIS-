import { createContext, useContext, useState } from 'react';
import { loadPerfis } from './PermissionsConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // perfil activo

  const login = (perfilId, pin) => {
    const perfis = loadPerfis();
    const perfil = perfis.find(p => p.id === perfilId);
    if (!perfil) return { ok: false, erro: 'Perfil não encontrado' };
    if (perfil.pin !== pin) return { ok: false, erro: 'PIN incorreto' };
    setUser(perfil);
    return { ok: true };
  };

  const logout = () => setUser(null);

  const refreshUser = () => {
    if (!user) return;
    const perfis = loadPerfis();
    const updated = perfis.find(p => p.id === user.id);
    if (updated) setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
