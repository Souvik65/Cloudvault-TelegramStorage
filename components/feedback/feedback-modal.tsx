'use client';

import { useState } from 'react';
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

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { user, sessionString } = useAuthStore();
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
        headers: {
          'Content-Type': 'application/json',
          'x-tg-session': sessionString!,
        },
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
          <DialogDescription className="text-[#A0ADB9]">
            Help us improve CloudVault by sharing your feedback or reporting a bug.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label className="text-[#8B9CAF]">Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('feedback')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  type === 'feedback'
                    ? 'border-[#2AABEE] bg-[#2AABEE]/15 text-[#2AABEE]'
                    : 'border-[rgba(255,255,255,0.14)] bg-[#1C2733] text-[#8B9CAF] hover:text-white hover:border-[rgba(255,255,255,0.25)]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  type === 'bug'
                    ? 'border-[#EF5350] bg-[#EF5350]/15 text-[#EF5350]'
                    : 'border-[rgba(255,255,255,0.14)] bg-[#1C2733] text-[#8B9CAF] hover:text-white hover:border-[rgba(255,255,255,0.25)]'
                }`}
              >
                <Bug className="w-4 h-4" />
                Report Bug
              </button>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-[#8B9CAF]">Subject</Label>
            <Input
              id="subject"
              placeholder={type === 'feedback' ? 'What would you like to share?' : 'Brief description of the bug'}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[#8B9CAF]">Description</Label>
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
              className="flex w-full rounded-lg border border-[rgba(255,255,255,0.14)] bg-[#1C2733] px-3 py-2 text-sm text-white placeholder:text-[#5A6878] focus:outline-none focus:ring-2 focus:ring-[#2AABEE] focus:ring-offset-0 focus:border-transparent resize-none min-h-[80px]"
            />
            <p className="text-xs text-[#6C7883] text-right">{description.length}/1000</p>
          </div>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
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
              className={`w-full sm:w-auto gap-2 ${
                type === 'bug'
                  ? 'bg-[#EF5350] hover:bg-[#E53935] text-white'
                  : ''
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
