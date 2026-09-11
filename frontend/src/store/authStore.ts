import { create } from 'zustand';
import type { User } from '../types';
import { getMe } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('omni_token'),
  isLoading: true,

  setAuth: (token, user) => {
    localStorage.setItem('omni_token', token);
    set({ token, user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('omni_token');
    set({ token: null, user: null, isLoading: false });
  },

  hydrate: async () => {
    const token = localStorage.getItem('omni_token');
    if (!token) { set({ isLoading: false }); return; }
    try {
      const user = await getMe();
      set({ user, token, isLoading: false });
    } catch {
      localStorage.removeItem('omni_token');
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
