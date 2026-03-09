'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/use-theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }, [theme]);

  return <>{children}</>;
}
