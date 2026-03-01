'use client';

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function RightPanel({ isOpen, onClose, title, children, width = 'w-80' }: RightPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className={`${width} h-full bg-[#0E1621] border-l border-[rgba(255,255,255,0.06)] flex flex-col shrink-0 z-20`}
        >
          <div className="h-14 flex items-center justify-between px-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-[#6C7883] hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
