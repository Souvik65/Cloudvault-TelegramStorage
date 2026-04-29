import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TelegramUser {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePhoto?: string;
}

interface AuthState {
  user: TelegramUser | null;
  setUser: (user: TelegramUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'tg-auth-storage',
    }
  )
);
