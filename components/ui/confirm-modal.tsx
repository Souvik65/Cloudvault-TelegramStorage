import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  isPending?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isPending = false
}: ConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] border-white/[0.08] bg-[#242424]/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="p-6"
            >
              <DialogHeader className="flex flex-col items-center text-center sm:items-center">
                <div className={`p-3 rounded-full mb-4 ${variant === 'danger' ? 'bg-[var(--accent-rust)]/10 text-[var(--accent-rust)]' : 'bg-[#DBDBDB]/10 text-[#DBDBDB]'}`}>
                  <AlertCircle className="w-8 h-8" />
                </div>
                <DialogTitle className="text-xl font-medium tracking-tight text-[#DBDBDB]">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-[#6C7883] text-sm mt-2 text-center">
                  {description}
                </DialogDescription>
              </DialogHeader>

              <div className="flex gap-3 justify-center mt-8 w-full">
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  disabled={isPending}
                  className="w-1/2 border-white/[0.12] bg-transparent text-[#DBDBDB] hover:bg-white/5 active:bg-white/10"
                >
                  {cancelText}
                </Button>
                <Button 
                  onClick={onConfirm} 
                  disabled={isPending}
                  className={`w-1/2 ${variant === 'danger' ? 'bg-[var(--accent-rust)] hover:bg-[var(--accent-rust)]/90 text-white' : 'bg-[#DBDBDB] hover:bg-[#DBDBDB]/90 text-[#1a1a1a]'}`}
                >
                  {isPending ? 'Processing...' : confirmText}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
