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
  setUser: (user: TelegramUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      // Client-side logout: clear user from store + call the server to clear the cookie
      logout: async () => {
        set({ user: null }); // Optimistic: clear UI state immediately
        try {
          await fetch('/api/tg/auth/logout', { method: 'POST' });
        } catch (error) {
          console.error('Failed to logout on server:', error);
          // Client state is already cleared; session may persist server-side
        }
      },
    }),
    {
      name: 'tg-auth-storage',
    }
  )
);
