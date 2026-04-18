'use client';

import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/store/use-theme-store';
import { motion, AnimatePresence } from 'motion/react';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative flex items-center rounded-xl transition-all duration-200 group
        ${collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2.5 w-full'}`}
      style={{ color: 'var(--text-hint)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)';
        e.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-hint)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="relative w-5 h-5 shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="sun"
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Sun className={collapsed ? 'w-5 h-5' : 'w-4 h-4'} />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Moon className={collapsed ? 'w-5 h-5' : 'w-4 h-4'} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-sm font-medium whitespace-nowrap overflow-hidden"
          >
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </motion.span>
        )}      </AnimatePresence>
    </button>
  );
}
