'use client';

import { useFileStore, FileMetadata } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Eye, Folder, FileIcon, Image as ImageIcon, Video, FileText, FileAudio, FileArchive, FileCode, FileSpreadsheet, FileJson } from 'lucide-react';
import { format } from 'date-fns';
import { formatSize } from '@/lib/utils';
import { toast } from 'sonner';

function getLargeIcon(mimeType: string, name: string) {
  if (!mimeType || mimeType === 'folder') return <Folder className="w-12 h-12 text-[#DBDBDB]" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-12 h-12 text-[#DBDBDB]" />;
  if (mimeType.startsWith('video/')) return <Video className="w-12 h-12 text-[#AB47BC]" />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="w-12 h-12 text-[#FFB74D]" />;
  if (mimeType === 'application/pdf') return <FileText className="w-12 h-12 text-[#EF5350]" />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <FileArchive className="w-12 h-12 text-[#FF7043]" />;
  if (mimeType.includes('json')) return <FileJson className="w-12 h-12 text-[#66BB6A]" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-12 h-12 text-[#26A69A]" />;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || mimeType.includes('css')) return <FileCode className="w-12 h-12 text-[#42A5F5]" />;
  return <FileIcon className="w-12 h-12 text-[#6C7883]" />;
}

export function FileDetailsPanel() {
  const { files, storageChannelId, setFiles } = useFileStore();
  const { sessionString } = useAuthStore();
  const { selectedFileForDetails, closeRightPanel } = useUIStore();

  const file = files.find(f => f.id === selectedFileForDetails);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-[#6C7883] text-sm">
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this file?')) return;
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
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* File icon */}
      <div className="flex justify-center py-4">
        <div className="w-20 h-20 rounded-2xl bg-[#808080] flex items-center justify-center">
          {getLargeIcon(file.mimeType, file.name)}
        </div>
      </div>

      {/* File name */}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-white break-all">{file.name}</h3>
        <p className="text-xs text-[#6C7883] mt-1">{file.mimeType || 'Unknown type'}</p>
      </div>

      {/* Details */}
      <div className="space-y-3 border-t border-[rgba(255,255,255,0.10)] pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-[#6C7883]">Size</span>
          <span className="text-[#DBDBDB]/60">{file.hasDocument ? formatSize(file.size) : '\u2014'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6C7883]">Uploaded</span>
          <span className="text-[#DBDBDB]/60">{file.uploadDate ? format(new Date(file.uploadDate), 'MMM d, yyyy HH:mm') : '\u2014'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6C7883]">Location</span>
          <span className="text-[#DBDBDB]/60 truncate ml-4">{file.folderPath || '/'}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-[rgba(255,255,255,0.10)] pt-4">
        {file.hasDocument && (
          <Button variant="secondary" className="w-full justify-start gap-3" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Download
          </Button>
        )}
        <Button variant="ghost" className="w-full justify-start gap-3 text-[#ff6a3d] hover:text-[#ff6a3d] hover:bg-[#ff6a3d]/10" onClick={handleDelete}>
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}
