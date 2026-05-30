import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('aura_token');
    if (!token) { setLoading(false); return; }

    authApi.me()
      .then((u) => setUser(u))
      .catch(() => { localStorage.removeItem('aura_token'); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('aura_token', res.access_token);
    setUser(res.user);
    return res;
  }, []);

  const loginWithGoogle = useCallback(async (id_token) => {
    const res = await authApi.googleLogin({ id_token });
    localStorage.setItem('aura_token', res.access_token);
    setUser(res.user);
    return res;
  }, []);

  const signup = useCallback(async (email, username, password) => {
    const res = await authApi.signup({ email, username, password });
    localStorage.setItem('aura_token', res.access_token);
    setUser(res.user);
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('aura_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
