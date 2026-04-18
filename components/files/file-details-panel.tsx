'use client';

import { useState } from 'react';
import { motion, Variants } from 'motion/react';
import { useFileStore, FileMetadata } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Eye, Folder, FileIcon, Image as ImageIcon, Video, FileText, FileAudio, FileArchive, FileCode, FileSpreadsheet, FileJson } from 'lucide-react';
import { format } from 'date-fns';
import { formatSize } from '@/lib/utils';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/confirm-modal';

function getLargeIcon(mimeType: string, name: string) {
  if (!mimeType || mimeType === 'folder') return <Folder className="w-12 h-12" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-12 h-12" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.startsWith('video/')) return <Video className="w-12 h-12" style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="w-12 h-12" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType === 'application/pdf') return <FileText className="w-12 h-12" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <FileArchive className="w-12 h-12" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.includes('json')) return <FileJson className="w-12 h-12" style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-12 h-12" style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || mimeType.includes('css')) return <FileCode className="w-12 h-12" style={{ color: 'var(--accent-rust)' }} />;
  return <FileIcon className="w-12 h-12" style={{ color: 'var(--text-hint)' }} />;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 300 } }
};

export function FileDetailsPanel() {
  const { files, storageChannelId, setFiles } = useFileStore();
  const { sessionString } = useAuthStore();
  const { selectedFileForDetails, closeRightPanel } = useUIStore();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const file = files.find(f => f.id === selectedFileForDetails);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-hint)' }}>
        No file selected
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/tg/download?channelId=${storageChannelId}&messageId=${file.id}`, {
        headers: { 'x-tg-session': sessionString! },
      });
      if (!res.ok) throw new Error('Failed to download file');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const confirmDelete = () => {
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tg/files?channelId=${storageChannelId}&messageIds=${file.id}`, {
        method: 'DELETE',
        headers: { 'x-tg-session': sessionString! },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete file');
      }
      setFiles(files.filter(f => f.id !== file.id));
      closeRightPanel();
      toast.success('File deleted');
      setDeleteModalOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <motion.div 
        className="space-y-6"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
      >
        {/* File icon */}
        <motion.div variants={itemVariants} className="flex justify-center py-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
            {getLargeIcon(file.mimeType, file.name)}
          </div>
        </motion.div>

        {/* File name */}
        <motion.div variants={itemVariants} className="text-center">
          <h3 className="text-sm font-semibold break-all" style={{ color: 'var(--text-primary)' }}>{file.name}</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>{file.mimeType || 'Unknown type'}</p>
        </motion.div>

        {/* Details */}
        <motion.div variants={itemVariants} className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-hint)' }}>Size</span>
            <span style={{ color: 'var(--text-muted)' }}>{file.hasDocument ? formatSize(file.size) : '\u2014'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-hint)' }}>Uploaded</span>
            <span style={{ color: 'var(--text-muted)' }}>{file.uploadDate ? format(new Date(file.uploadDate), 'MMM d, yyyy HH:mm') : '\u2014'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-hint)' }}>Location</span>
            <span className="truncate ml-4" style={{ color: 'var(--text-muted)' }}>{file.folderPath || '/'}</span>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          {file.hasDocument && (
            <Button variant="secondary" className="w-full justify-start gap-3" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              Download
            </Button>
          )}
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={confirmDelete}
            style={{ color: 'var(--accent-rust)' }}>
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </motion.div>
      </motion.div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={executeDelete}
        title="Delete this item?"
        description="Are you sure you want to delete this file? This action cannot be undone."
        confirmText="Delete"
        isPending={isDeleting}
      />
    </>
  );
}
