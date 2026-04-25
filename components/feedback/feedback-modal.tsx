'use client';

import { useState } from 'react';
import { motion, Variants } from 'motion/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/use-auth-store';
import { toast } from 'sonner';
import { Bug, MessageSquare, Send, Loader2 } from 'lucide-react';

type FeedbackType = 'feedback' | 'bug';

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 300 } }
};

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { user } = useAuthStore();
  const [type, setType] = useState<FeedbackType>('feedback');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setType('feedback');
    setSubject('');
    setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tg/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: subject.trim(),
          description: description.trim(),
          userName: user?.firstName
            ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
            : 'Unknown',
          userHandle: user?.username || user?.phone || 'N/A',
          userId: user?.id || 'N/A',
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success(
        type === 'feedback'
          ? 'Thank you for your feedback!'
          : 'Bug report submitted successfully!'
      );
      resetForm();
      onClose();
    } catch (error: any) {
      toast.error('Failed to submit: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback & Bug Report</DialogTitle>
          <DialogDescription>
            Help us improve StorageVault by sharing your feedback or reporting a bug.
          </DialogDescription>
        </DialogHeader>

        <motion.form 
          onSubmit={handleSubmit} 
          className="space-y-4"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}
        >
          {/* Type selector */}
          <motion.div variants={itemVariants} className="space-y-2">
            <Label style={{ color: 'var(--text-hint)' }}>Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('feedback')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all"
                style={type === 'feedback'
                  ? { borderColor: 'var(--accent-rust-border)', background: 'var(--accent-rust-tint)', color: 'var(--accent-rust)' }
                  : { borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all"
                style={type === 'bug'
                  ? { borderColor: 'var(--accent-rust-border)', background: 'var(--accent-rust-tint)', color: 'var(--accent-rust)' }
                  : { borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
              >
                <Bug className="w-4 h-4" />
                Report Bug
              </button>
            </div>
          </motion.div>

          {/* Subject */}
          <motion.div variants={itemVariants} className="space-y-2">
            <Label htmlFor="subject" style={{ color: 'var(--text-hint)' }}>Subject</Label>
            <Input
              id="subject"
              placeholder={type === 'feedback' ? 'What would you like to share?' : 'Brief description of the bug'}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
            />
          </motion.div>

          {/* Description */}
          <motion.div variants={itemVariants} className="space-y-2">
            <Label htmlFor="description" style={{ color: 'var(--text-hint)' }}>Description</Label>
            <textarea
              id="description"
              rows={3}
              placeholder={
                type === 'feedback'
                  ? 'Tell us more about your experience, suggestions, or ideas...'
                  : 'Steps to reproduce the bug, expected behavior, and what actually happened...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              className="flex w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 resize-none min-h-[80px]"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-xs text-right" style={{ color: 'var(--text-hint)' }}>{description.length}/1000</p>
          </motion.div>

          {/* Submit */}
          <motion.div variants={itemVariants} className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => { resetForm(); onClose(); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !description.trim()}
              className="w-full sm:w-auto gap-2"
              style={type === 'bug' ? { background: 'var(--accent-rust)', color: '#fff' } : undefined}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </motion.div>
        </motion.form>
      </DialogContent>
    </Dialog>
  );
}
