'use client';

import { useState } from 'react';
import { useFileStore } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function NewFolderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const { currentFolder, setFiles, files, storageChannelId } = useFileStore();
  const { sessionString } = useAuthStore();

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

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
        headers: { 'x-tg-session': sessionString! },
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
      const refreshRes = await fetch(`/api/tg/files?channelId=${storageChannelId}`, {
        headers: { 'x-tg-session': sessionString! },
      });
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

        <div className="space-y-4 py-4">
          <Input
            placeholder="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
            }}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button onClick={handleCreateFolder} disabled={creating || !folderName.trim()}>
            {creating ? 'Creating...' : 'Create Folder'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
