'use client';

import { useFileStore } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import { Input } from '@/components/ui/input';
import { Search, Upload, FolderPlus, RefreshCw, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewToggle } from '@/components/ui/view-toggle';
import { FileUpload } from '@/components/files/file-upload';
import { NewFolderModal } from '@/components/files/new-folder-modal';
import { useState } from 'react';
import { toast } from 'sonner';

export function Header() {
  const { searchQuery, setSearchQuery, storageChannelId, setFiles, setLoading } = useFileStore();
  const { sessionString } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/tg/files?channelId=${storageChannelId}`, {
        headers: { 'x-tg-session': sessionString! },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFiles(data.files);
      toast.success('Files synced successfully');
    } catch (error: any) {
      toast.error('Failed to sync files: ' + error.message);
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  return (
    <header className="bg-[#1C2733] h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 border-b border-[rgba(255,255,255,0.10)]">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-[#8B9CAF] hover:text-white mr-2"
        onClick={toggleSidebar}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9CAF]" />
          <Input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3 ml-4">
        <ViewToggle />

        <div className="w-px h-5 bg-[rgba(255,255,255,0.12)] hidden sm:block" />

        <Button
          variant="ghost"
          size="icon"
          className="text-[#8B9CAF] hover:text-white"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setIsNewFolderOpen(true)}
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden sm:inline">New Folder</span>
        </Button>

        <Button
          size="sm"
          className="gap-2"
          onClick={() => setIsUploadOpen(true)}
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </div>

      <FileUpload isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      <NewFolderModal isOpen={isNewFolderOpen} onClose={() => setIsNewFolderOpen(false)} />
    </header>
  );
}
