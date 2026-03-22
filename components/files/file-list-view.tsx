'use client';

import { motion } from 'motion/react';
import {
  FileIcon, Folder, Download, Trash2, Eye, Image as ImageIcon, Video, FileText,
  FileArchive, FileAudio, FileCode, FileSpreadsheet, FileJson, MoreVertical, Star
} from 'lucide-react';
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
  onThreeDot: (e: React.MouseEvent, file: FileMetadata) => void;
  showPath?: boolean;
  starred: number[];
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'heic'];
function isImageByExtension(name: string): boolean {
  return IMAGE_EXTENSIONS.includes(name?.split('.').pop()?.toLowerCase() ?? '');
}
function canPreview(mimeType: string, name?: string): boolean {
  return (
    mimeType?.startsWith('image/') || isImageByExtension(name ?? '') ||
    mimeType?.startsWith('video/') || mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function getIcon(mimeType: string, name: string) {
  if (!mimeType || mimeType === 'folder') return <Folder className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.startsWith('video/')) return <Video className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <FileArchive className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.includes('json')) return <FileJson className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || mimeType.includes('css')) return <FileCode className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />;
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp'].includes(ext || '')) return <FileCode className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />;
  return <FileIcon className="w-4 h-4" style={{ color: 'var(--text-hint)' }} />;
}

export function FileListView({
  files, selectedFiles, onFileClick, onDownload, onDelete, onPreview,
  onThreeDot, showPath, starred
}: FileListViewProps) {
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest"
        style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', color: 'var(--text-hint)' }}>
        <span className="w-8 shrink-0" />
        <span className="flex-1 min-w-0">Name</span>
        <span className="w-28 text-right hidden md:block shrink-0">Modified</span>
        <span className="w-20 text-right hidden sm:block shrink-0">Size</span>
        <span className="w-8 shrink-0" />
      </div>

      {/* Rows */}
      {files.map((file, i) => {
        const isSelected = selectedFiles.includes(file.id);
        const isFileStar = starred.includes(file.id);
        return (
          <motion.div
            key={file.id}
            data-file-card
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.015, duration: 0.18 }}

            className={`group flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-all duration-150`}
            style={{
              borderColor: 'var(--border)',
              background: isSelected ? 'var(--accent-rust-tint)' : 'transparent',
            }}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            onClick={e => onFileClick(e, file)}
          >
            {/* Icon */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--bg-hover)' }}>
              {getIcon(file.mimeType, file.name)}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="min-w-0">
                <p className="text-[13px] truncate leading-snug" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                {showPath && file.folderPath && file.folderPath !== '/' && (
                  <span className="text-[10px] flex items-center gap-0.5 mt-0.5" style={{ color: 'var(--text-hint)' }}>
                    <Folder className="w-2.5 h-2.5 shrink-0" />{file.folderPath}
                  </span>
                )}
                {/* Mobile: date & size */}
                <p className="text-[11px] sm:hidden mt-0.5" style={{ color: 'var(--text-hint)' }}>
                  {file.hasDocument ? formatSize(file.size) : 'Folder'}
                  {file.uploadDate ? ` · ${format(new Date(file.uploadDate), 'MMM d, yyyy')}` : ''}
                </p>
              </div>
              {isFileStar && <Star className="w-3 h-3 shrink-0" style={{ color: 'var(--accent-rust)', fill: 'var(--accent-rust)' }} />}
            </div>

            {/* Date */}
            <span className="w-28 text-right text-[12px] hidden md:block shrink-0" style={{ color: 'var(--text-hint)' }}>
              {file.uploadDate ? format(new Date(file.uploadDate), 'MMM d, yyyy') : '—'}
            </span>
            {/* Size */}
            <span className="w-20 text-right text-[12px] hidden sm:block shrink-0" style={{ color: 'var(--text-hint)' }}>
              {file.hasDocument ? formatSize(file.size) : '—'}
            </span>

            {/* Three-dot — always visible on touch, hover-only on desktop */}
            <div className="w-8 flex items-center justify-center shrink-0">
              <button
                onClick={e => { e.nativeEvent.stopImmediatePropagation(); onThreeDot(e, file); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-all duration-150"
                style={{ color: 'var(--text-hint)' }}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
