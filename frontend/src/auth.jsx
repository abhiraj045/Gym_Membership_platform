import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, gymName: 'Gym', setupRequired: false });

  const load = useCallback(async () => {
    let gymName = 'Gym', setupRequired = false, user = null;
    try { gymName = (await api.get('/public/config')).data.gymName; } catch { /* backend down */ }
    try { setupRequired = (await api.get('/setup/status')).data.setupRequired; } catch { /* ignore */ }
    if (!setupRequired) {
      try { user = (await api.get('/auth/me')).data; } catch { user = null; }
    }
    document.title = `${gymName} - Manager`;
    setState({ loading: false, user, gymName, setupRequired });
  }, []);

  useEffect(() => { load(); }, [load]);

  const login = async (username, password) => {
    await api.post('/auth/login', new URLSearchParams({ username, password }));
    await load();
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } finally { await load(); }
  };

  return <AuthContext.Provider value={{ ...state, login, logout, reload: load }}>{children}</AuthContext.Provider>;
}
