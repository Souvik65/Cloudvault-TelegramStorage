'use client';

import { motion } from 'motion/react';
import { FileIcon, Folder, Download, Trash2, Eye, Image as ImageIcon, Video, FileText, FileArchive, FileAudio, FileCode, FileSpreadsheet, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { formatSize } from '@/lib/utils';
import { FileMetadata } from '@/store/use-file-store';

interface FileListViewProps {
  files: FileMetadata[];
  selectedFiles: number[];
  onFileClick: (e: React.MouseEvent, file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (ids: number[]) => void;
  onPreview: (file: FileMetadata) => void;
}

function canPreview(mimeType: string): boolean {
  return (
    mimeType?.startsWith('image/') ||
    mimeType?.startsWith('video/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function getIcon(mimeType: string, name: string) {
  if (!mimeType || mimeType === 'folder') return <Folder className="w-5 h-5 text-[#2AABEE]" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#4FC3F7]" />;
  if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-[#AB47BC]" />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="w-5 h-5 text-[#FFB74D]" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-[#EF5350]" />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <FileArchive className="w-5 h-5 text-[#FF7043]" />;
  if (mimeType.includes('json')) return <FileJson className="w-5 h-5 text-[#66BB6A]" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-[#26A69A]" />;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || mimeType.includes('css')) return <FileCode className="w-5 h-5 text-[#42A5F5]" />;
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp'].includes(ext || '')) return <FileCode className="w-5 h-5 text-[#42A5F5]" />;
  return <FileIcon className="w-5 h-5 text-[#6C7883]" />;
}

export function FileListView({ files, selectedFiles, onFileClick, onDownload, onDelete, onPreview }: FileListViewProps) {
  return (
    <div className="border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-[#1C2733] text-xs text-[#6C7883] uppercase tracking-wider font-medium">
        <span className="w-10" />
        <span className="flex-1 min-w-0">Name</span>
        <span className="w-20 text-right hidden sm:block">Size</span>
        <span className="w-28 text-right hidden md:block">Modified</span>
        <span className="w-24" />
      </div>
      {/* File rows */}
      {files.map((file, i) => (
        <motion.div
          key={file.id}
          data-file-card
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.02, duration: 0.2 }}
          className={`group flex items-center gap-4 px-4 py-3 border-b border-[rgba(255,255,255,0.03)] cursor-pointer transition-colors ${
            selectedFiles.includes(file.id)
              ? 'bg-[rgba(42,171,238,0.15)]'
              : 'hover:bg-[#242F3D]'
          }`}
          onClick={(e) => onFileClick(e, file)}
        >
          <div className="w-10 h-10 rounded-lg bg-[#1C2733] flex items-center justify-center shrink-0">
            {getIcon(file.mimeType, file.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{file.name}</p>
            <p className="text-xs text-[#6C7883] sm:hidden">
              {file.hasDocument ? formatSize(file.size) : 'Folder'}
            </p>
          </div>
          <span className="w-20 text-right text-xs text-[#6C7883] hidden sm:block shrink-0">
            {file.hasDocument ? formatSize(file.size) : 'Folder'}
          </span>
          <span className="w-28 text-right text-xs text-[#6C7883] hidden md:block shrink-0">
            {file.uploadDate ? format(new Date(file.uploadDate), 'MMM d, yyyy') : '\u2014'}
          </span>
          <div className="w-24 flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            {canPreview(file.mimeType) && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6C7883] hover:text-[#2AABEE]" onClick={(e) => { e.stopPropagation(); onPreview(file); }}>
                <Eye className="w-4 h-4" />
              </Button>
            )}
            {file.hasDocument && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6C7883] hover:text-[#2AABEE]" onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
                <Download className="w-4 h-4" />
              </Button>
            )}
            {!file.isVirtualChannelFolder && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6C7883] hover:text-[#E53935]" onClick={(e) => { e.stopPropagation(); onDelete([file.id]); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
