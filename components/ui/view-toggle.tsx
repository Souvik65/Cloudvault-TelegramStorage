'use client';

import { LayoutGrid, List } from 'lucide-react';
import { motion } from 'motion/react';
import { useUIStore } from '@/store/use-ui-store';

export function ViewToggle() {
  const { viewMode, setViewMode } = useUIStore();

  return (
    <div className="flex items-center bg-[#242F3D] rounded-lg p-1 gap-0.5">
      <button
        onClick={() => setViewMode('grid')}
        className={`relative p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'text-white' : 'text-[#6C7883] hover:text-[#8B9CAF]'}`}
      >
        {viewMode === 'grid' && (
          <motion.div
            layoutId="viewToggle"
            className="absolute inset-0 bg-[#2AABEE] rounded-md"
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          />
        )}
        <LayoutGrid className="w-4 h-4 relative z-10" />
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={`relative p-2 rounded-md transition-colors ${viewMode === 'list' ? 'text-white' : 'text-[#6C7883] hover:text-[#8B9CAF]'}`}
      >
        {viewMode === 'list' && (
          <motion.div
            layoutId="viewToggle"
            className="absolute inset-0 bg-[#2AABEE] rounded-md"
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          />
        )}
        <List className="w-4 h-4 relative z-10" />
      </button>
    </div>
  );
}
