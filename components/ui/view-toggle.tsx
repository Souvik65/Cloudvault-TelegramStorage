'use client';

import { LayoutGrid, List } from 'lucide-react';
import { motion } from 'motion/react';
import { useUIStore } from '@/store/use-ui-store';

export function ViewToggle() {
  const { viewMode, setViewMode } = useUIStore();

  return (
    <div
      className="flex items-center rounded-lg p-1 gap-0.5 border"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setViewMode('grid')}
        className={`relative p-2 rounded-md transition-colors`}
        style={{ color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-hint)' }}
      >
        {viewMode === 'grid' && (
          <motion.div
            layoutId="viewToggle"
            className="absolute inset-0 rounded-md"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-hover)' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          />
        )}
        <LayoutGrid className="w-4 h-4 relative z-10" />
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={`relative p-2 rounded-md transition-colors`}
        style={{ color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-hint)' }}
      >
        {viewMode === 'list' && (
          <motion.div
            layoutId="viewToggle"
            className="absolute inset-0 rounded-md"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-hover)' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          />
        )}
        <List className="w-4 h-4 relative z-10" />
      </button>
    </div>
  );
}
