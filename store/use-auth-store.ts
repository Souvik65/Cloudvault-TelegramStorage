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
  sessionString: string | null;
  user: TelegramUser | null;
  setSession: (sessionString: string) => void;
  setUser: (user: TelegramUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessionString: null,
      user: null,
      setSession: (sessionString) => set({ sessionString }),
      setUser: (user) => set({ user }),
      logout: () => set({ sessionString: null, user: null }),
    }),
    {
      name: 'tg-auth-storage',
    }
  )
);
