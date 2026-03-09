'use client';

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function RightPanel({ isOpen, onClose, title, children }: RightPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={onClose}
          />

          {/* Panel — full-screen overlay on mobile, sidebar on desktop */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed right-0 top-0 h-full w-full z-40 md:relative md:w-80 md:z-20 flex flex-col shrink-0 border-l"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-[rgba(255,255,255,0.10)] shrink-0">
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 text-[#DBDBDB]/70 hover:text-[#DBDBDB]"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
