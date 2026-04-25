'use client';

import { useState } from 'react';
import { motion, Variants } from 'motion/react';
import { useFileStore } from '@/store/use-file-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 300 } }
};

export function NewFolderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const { currentFolder, setFiles, files, storageChannelId } = useFileStore();

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    const INVALID_CHARS = /[/\\:*?"<>|]/;
    if (INVALID_CHARS.test(folderName.trim())) {
      toast.error('Folder name cannot contain: / \\ : * ? " < > |');
      return;
    }

    // Check for duplicate folder names
    const isDuplicate = files.some(
      (f) => f.folderPath === currentFolder && !f.hasDocument && f.name === folderName
    );

    if (isDuplicate) {
      toast.error('A folder with this name already exists');
      return;
    }

    setCreating(true);
    try {
      const metadata = {
        name: folderName,
        size: 0,
        mimeType: 'folder',
        uploadDate: Date.now(),
        folderPath: currentFolder,
        hasDocument: false,
      };

      const formData = new FormData();
      formData.append('metadata', JSON.stringify(metadata));
      formData.append('channelId', storageChannelId);

      const res = await fetch('/api/tg/files', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create folder');
      }

      toast.success('Folder created successfully');
      setFolderName('');
      onClose();

      // Refresh files
      const refreshRes = await fetch(`/api/tg/files?channelId=${storageChannelId}`);
      const data = await refreshRes.json();
      if (!data.error) {
        setFiles(data.files);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription className="hidden">
            Create a new folder
          </DialogDescription>
        </DialogHeader>

        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}
        >
          <motion.div variants={itemVariants} className="space-y-4 py-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
              }}
            />
          </motion.div>

          <motion.div variants={itemVariants} className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={creating || !folderName.trim()}>
              {creating ? 'Creating...' : 'Create Folder'}
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
