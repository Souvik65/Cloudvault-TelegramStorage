'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFileStore } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import {
  FileIcon, Folder, Download, Trash2, Image as ImageIcon, Video, FileText,
  ChevronRight, Home, FileArchive, FileAudio, FileCode, FileSpreadsheet,
  FileJson, Eye, Hash, ArrowLeft, X, MoreVertical, Star, StarOff,
  UploadCloud, SortAsc, SortDesc, ChevronDown, Clock
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileCardSkeleton, FileRowSkeleton } from '@/components/ui/skeleton';
import { FileListView } from '@/components/files/file-list-view';
import { format } from 'date-fns';
import { formatSize } from '@/lib/utils';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';

const TELEGRAM_DIRECT_PATH = '/__tg_direct__';
const VIRTUAL_FOLDER_ID = -1;

type PreviewType = 'image' | 'video' | 'pdf' | 'docx' | null;

// Three-dot dropdown
interface DropdownState {
  fileId: number;
  buttonRight: number; // viewport right edge of the button
  buttonBottom: number; // viewport bottom edge of the button
}

function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script,iframe,style,link,object,embed,form,base').forEach(el => el.remove());
  div.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  return div.innerHTML;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'heic'];
function isImageByExtension(name: string): boolean {
  const ext = name?.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext ?? '');
}
function canPreview(mimeType: string, name?: string): boolean {
  return (
    mimeType?.startsWith('image/') ||
    isImageByExtension(name ?? '') ||
    mimeType?.startsWith('video/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function getFileIcon(mimeType: string, name: string, size: 'sm' | 'md' | 'lg' = 'md') {
  const cls = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  if (!mimeType || mimeType === 'folder') return <Folder className={cls} style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.startsWith('image/')) return <ImageIcon className={cls} style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.startsWith('video/')) return <Video className={cls} style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.startsWith('audio/')) return <FileAudio className={cls} style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType === 'application/pdf') return <FileText className={cls} style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <FileArchive className={cls} style={{ color: 'var(--accent-rust)' }} />;
  if (mimeType.includes('json')) return <FileJson className={cls} style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return <FileSpreadsheet className={cls} style={{ color: 'var(--accent-teal)' }} />;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || mimeType.includes('css')) return <FileCode className={cls} style={{ color: 'var(--accent-rust)' }} />;
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp'].includes(ext || '')) return <FileCode className={cls} style={{ color: 'var(--accent-rust)' }} />;
  return <FileIcon className={cls} style={{ color: 'var(--text-hint)' }} />;
}



export function FileList() {
  const { files, setFiles, currentFolder, setCurrentFolder, searchQuery, filterType, setFilterType, filterGlobal, setFilterGlobal, isLoading, setLoading, setError, storageChannelId, storageChannelName } = useFileStore();
  const { sessionString } = useAuthStore();
  const { viewMode, openRightPanel, setSelectedFileForDetails, sortBy, setSortBy, starred, toggleStarred, activeSection, setActiveSection } = useUIStore();
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [dropdown, setDropdown] = useState<DropdownState | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortOpen, setSortOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const lastSelectedId = useRef<number | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const close = () => { setDropdown(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    return () => { if (previewUrl) window.URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    setSelectedFiles([]);
    lastSelectedId.current = null;
  }, [searchQuery]);

  useEffect(() => {
    window.history.replaceState({ folder: currentFolder }, '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const folder = (e.state as { folder?: string })?.folder ?? '/';
      setCurrentFolder(folder);
      setSelectedFiles([]);
      lastSelectedId.current = null;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentFolder]);

  const handlePreview = async (file: any) => {
    if (!canPreview(file.mimeType, file.name)) return;
    let type: PreviewType;
    if (file.mimeType?.startsWith('image/') || isImageByExtension(file.name)) type = 'image';
    else if (file.mimeType?.startsWith('video/')) type = 'video';
    else if (file.mimeType === 'application/pdf') type = 'pdf';
    else type = 'docx';
    setPreviewFile(file);
    setPreviewType(type);
    setIsPreviewLoading(true);
    setDocxHtml(null);
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    try {
      if (previewUrl) { window.URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      const res = await fetch(`/api/tg/download?channelId=${storageChannelId}&messageId=${file.id}`, {
        headers: { 'x-tg-session': sessionString! },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to load preview');
      const blob = await res.blob();
      if (type === 'docx') {
        const arrayBuffer = await blob.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(sanitizeHtml(result.value));
      } else {
        setPreviewUrl(window.URL.createObjectURL(blob));
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') { toast.error(error.message); setPreviewFile(null); setPreviewType(null); }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setPreviewType(null);
    setDocxHtml(null);
  };

  // Fetch files
  useEffect(() => {
    if (!sessionString) return;
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tg/files?channelId=${storageChannelId}`, { headers: { 'x-tg-session': sessionString } });
        if (res.status === 401) {
          useAuthStore.getState().logout();
          return;
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setFiles(data.files);
      } catch (error: any) {
        setError(error.message);
        toast.error('Failed to load files');
      } finally { setLoading(false); }
    };
    fetchFiles();
  }, [sessionString, setFiles, setLoading, setError, storageChannelId]);

  // Drag-and-drop upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setIsDragOver(false);
    setIsUploading(true);
    setUploadProgress(0);
    try {
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify({
          name: file.name, size: file.size, mimeType: file.type,
          uploadDate: Date.now(), folderPath: currentFolder, hasDocument: true,
        }));
        formData.append('channelId', storageChannelId);
        const res = await fetch('/api/tg/files', {
          method: 'POST',
          headers: { 'x-tg-session': sessionString! },
          body: formData,
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Upload failed'); }
        setUploadProgress(((i + 1) / acceptedFiles.length) * 100);
      }
      toast.success(`${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''} uploaded`);
      const res = await fetch(`/api/tg/files?channelId=${storageChannelId}`, { headers: { 'x-tg-session': sessionString! } });
      const data = await res.json();
      if (!data.error) setFiles(data.files);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [currentFolder, sessionString, storageChannelId, setFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
  });

  // Build and sort file list
  const filteredFiles = useMemo(() => {
    let result: any[];

    // Helper: apply type filter to a list
    const applyTypeFilter = (list: any[]) => {
      if (filterType === 'all') return list;
      return list.filter(f => {
        if (!f.hasDocument && f.mimeType === 'folder') return false;
        const isImage = f.mimeType?.startsWith('image/') || !!f.name?.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|heic)$/i);
        const isVideo = f.mimeType?.startsWith('video/') || !!f.name?.match(/\.(mp4|mkv|avi|mov|webm)$/i);
        const isDocument = 
          f.mimeType === 'application/pdf' ||
          f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          f.mimeType === 'application/msword' ||
          f.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          f.mimeType === 'application/vnd.ms-powerpoint' ||
          f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          f.mimeType === 'application/vnd.ms-excel' ||
          f.mimeType?.includes('spreadsheet') ||
          f.mimeType?.includes('presentation') ||
          f.mimeType === 'text/plain' ||
          f.mimeType === 'text/csv' ||
          f.mimeType === 'application/rtf' ||
          !!f.name?.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|txt|rtf|odt|ods|odp)$/i);
        switch (filterType) {
          case 'image': return isImage;
          case 'video': return isVideo;
          case 'document': return isDocument;
          case 'other': return !isImage && !isVideo && !isDocument;
          default: return true;
        }
      });
    };

    // Global filter (sidebar): search ALL files, skip folder scoping
    if (filterGlobal && filterType !== 'all') {
      result = applyTypeFilter(files.filter(f => f.hasDocument));
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(f => f.name?.toLowerCase().includes(q));
      }
    } else {
      // Section / folder scoping first
      if (activeSection === 'starred') {
        result = files.filter(f => starred.includes(f.id) && f.hasDocument);
      } else if (activeSection === 'recent') {
        result = [...files]
          .filter(f => f.hasDocument)
          .sort((a, b) => (b.uploadDate || 0) - (a.uploadDate || 0))
          .slice(0, 20);
      } else {
        if (searchQuery) {
          result = files.filter(f => f.hasDocument && f.name?.toLowerCase().includes(searchQuery.toLowerCase()));
        } else if (currentFolder === TELEGRAM_DIRECT_PATH) {
          result = files.filter(f => f.isDirectUpload && f.hasDocument);
        } else {
          result = files.filter(f => {
            if (f.isDirectUpload) return false;
            return f.folderPath === currentFolder;
          });
          if (currentFolder === '/') {
            const hasDirectUploads = files.some(f => f.isDirectUpload && f.hasDocument);
            if (hasDirectUploads) {
              const directCount = files.filter(f => f.isDirectUpload && f.hasDocument).length;
              result = [
                ...result,
                {
                  id: VIRTUAL_FOLDER_ID, name: storageChannelName || 'Telegram Channel',
                  mimeType: 'folder', hasDocument: false, size: 0,
                  folderPath: '/', uploadDate: 0, isVirtualChannelFolder: true, _directCount: directCount,
                },
              ];
            }
          }
        }
      }
      // Then apply folder-scoped filter (pills)
      result = applyTypeFilter(result);
    }

    // Sort
    const folders = result.filter(f => !f.hasDocument);
    const fileItems = result.filter(f => f.hasDocument);
    const sorted = [...fileItems].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortBy === 'date') cmp = (b.uploadDate || 0) - (a.uploadDate || 0);
      else if (sortBy === 'size') cmp = (b.size || 0) - (a.size || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return [...folders, ...sorted];
  }, [files, currentFolder, searchQuery, filterType, filterGlobal, storageChannelName, sortBy, sortDir, activeSection, starred]);

  const handleDelete = async (ids: number[]) => {
    if (!confirm(`Delete ${ids.length > 1 ? `${ids.length} items` : 'this item'}?`)) return;
    try {
      let allIds = [...ids];
      const selectedFolders = files.filter(f => ids.includes(f.id) && !f.hasDocument && f.mimeType === 'folder');
      for (const folder of selectedFolders) {
        const fp = currentFolder === '/' ? `/${folder.name}` : `${currentFolder}/${folder.name}`;
        const inner = files.filter(f => f.folderPath === fp || f.folderPath?.startsWith(`${fp}/`));
        allIds = [...allIds, ...inner.map(f => f.id)];
      }
      allIds = Array.from(new Set(allIds));
      const res = await fetch(`/api/tg/files?channelId=${storageChannelId}&messageIds=${allIds.join(',')}`, {
        method: 'DELETE', headers: { 'x-tg-session': sessionString! },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      setFiles(files.filter(f => !allIds.includes(f.id)));
      clearSelection();
      toast.success('Deleted successfully');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDownload = async (file: any) => {
    try {
      const res = await fetch(`/api/tg/download?channelId=${storageChannelId}&messageId=${file.id}`, {
        headers: { 'x-tg-session': sessionString! },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (e: any) { toast.error(e.message); }
  };

  const clearSelection = () => { setSelectedFiles([]); lastSelectedId.current = null; };

  const toggleSelection = (id: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedId.current !== null) {
      const ci = filteredFiles.findIndex(f => f.id === id);
      const li = filteredFiles.findIndex(f => f.id === lastSelectedId.current);
      if (ci !== -1 && li !== -1) {
        const st = Math.min(ci, li), en = Math.max(ci, li);
        setSelectedFiles(prev => Array.from(new Set([...prev, ...filteredFiles.slice(st, en + 1).map(f => f.id)])));
        return;
      }
    }
    setSelectedFiles(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    lastSelectedId.current = id;
  };

  const handleFileClick = (e: React.MouseEvent, file: any) => {
    if (!file.hasDocument && file.mimeType === 'folder') {
      const newPath = file.isVirtualChannelFolder
        ? TELEGRAM_DIRECT_PATH
        : (currentFolder === '/' ? `/${file.name}` : `${currentFolder}/${file.name}`);
      window.history.pushState({ folder: newPath }, '');
      setCurrentFolder(newPath);
      if (activeSection !== 'my-files') setActiveSection('my-files');
      clearSelection();
    } else {
      toggleSelection(file.id, e.shiftKey);
    }
  };

  const handleFileDoubleClick = (file: any) => {
    if (file.hasDocument) {
      if (canPreview(file.mimeType, file.name)) handlePreview(file);
      else { setSelectedFileForDetails(file.id); openRightPanel('file-details'); }
    }
  };

  const goBack = () => {
    if (currentFolder === TELEGRAM_DIRECT_PATH) { setCurrentFolder('/'); }
    else {
      const parts = currentFolder.split('/').filter(Boolean);
      parts.pop();
      setCurrentFolder(parts.length === 0 ? '/' : '/' + parts.join('/'));
    }
    clearSelection();
  };

  const handleThreeDot = (e: React.MouseEvent, file: any) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropdown({
      fileId: file.id,
      buttonRight: rect.right,
      buttonBottom: rect.bottom,
    });
  };

  const handleAreaClick = (e: React.MouseEvent) => {
    if (selectedFiles.length === 0) return;
    if (!(e.target as HTMLElement).closest('[data-file-card]')) clearSelection();
  };

  const isAtRoot = currentFolder === '/';
  const isInDirectFolder = currentFolder === TELEGRAM_DIRECT_PATH;
  const breadcrumbs = isInDirectFolder ? [] : currentFolder.split('/').filter(Boolean);

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Date modified' },
    { value: 'size', label: 'Size' },
  ] as const;

  const contextFile = dropdown ? filteredFiles.find(f => f.id === dropdown.fileId) : null;
  const isStarred = (id: number) => starred.includes(id);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-5" style={{ background: 'var(--bg-body)' }}>
        <div className="h-7 w-40 rounded-xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => <FileCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {Array.from({ length: 8 }).map((_, i) => <FileRowSkeleton key={i} />)}
          </div>
        )}
      </div>
    );
  }

  const sectionTitle = activeSection === 'starred' ? 'Starred' : activeSection === 'recent' ? 'Recent' : isAtRoot ? 'My Files' : null;

  return (
    <div className="flex-1 flex flex-col h-full" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Drag overlay */}
      <AnimatePresence>
        {(isDragActive || isDragOver) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(192, 82, 42, 0.08)', backdropFilter: 'blur(4px)' }}
          >
            <div className="flex flex-col items-center gap-4 scale-[1.02]">
              <div className="w-20 h-20 rounded-3xl border-2 border-dashed flex items-center justify-center"
                style={{ background: 'var(--accent-rust-tint)', borderColor: 'var(--accent-rust-border)' }}>
                <UploadCloud className="w-10 h-10" style={{ color: 'var(--accent-rust)' }} />
              </div>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Drop files to upload</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Files will be added to the current folder</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload progress bar */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-72 z-50 border rounded-2xl p-4 shadow-lg"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <UploadCloud className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent-rust)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Uploading...</span>
              <span className="ml-auto text-xs" style={{ color: 'var(--text-hint)' }}>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ width: `${uploadProgress}%`, background: 'var(--text-primary)' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-body)' }} onClick={handleAreaClick}>
        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
          {/* Toolbar row: Breadcrumbs + Sort */}
          <div className="flex items-center justify-between gap-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm min-w-0 flex-wrap">
              {!isAtRoot && activeSection === 'my-files' && (
                <button
                  onClick={goBack}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0"
                  style={{ color: 'var(--text-hint)' }}
                  title="Go back"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {sectionTitle && (
                <span className="text-base font-semibold pl-1" style={{ color: 'var(--text-primary)' }}>{sectionTitle}</span>
              )}

              {!sectionTitle && (
                <>
                  <button
                    onClick={() => { setCurrentFolder('/'); clearSelection(); setActiveSection('my-files'); }}
                    className="flex items-center gap-1 transition-colors px-1"
                    style={{ color: 'var(--text-hint)' }}
                  >
                    <Home className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline text-[13px]">My Files</span>
                  </button>

                  {isInDirectFolder ? (
                    <>
                      <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--border-hover)' }} />
                      <span className="text-[13px] font-semibold px-1" style={{ color: 'var(--text-primary)' }}>{storageChannelName || 'Telegram Channel'}</span>
                    </>
                  ) : (
                    breadcrumbs.map((crumb, index) => (
                      <div key={index} className="flex items-center gap-1 min-w-0">
                        <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--border-hover)' }} />
                        <button
                          className={`px-1 text-[13px] truncate transition-colors max-w-[120px]`}
                          style={index === breadcrumbs.length - 1
                            ? { fontWeight: 600, color: 'var(--text-primary)' }
                            : { color: 'var(--text-hint)' }}
                          onClick={() => setCurrentFolder('/' + breadcrumbs.slice(0, index + 1).join('/'))}
                        >
                          {crumb}
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Sort dropdown + selection count */}
            <div className="flex items-center gap-2 shrink-0">
              {selectedFiles.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-hint)' }}>{selectedFiles.length} selected</span>
                  <button
                    onClick={() => handleDelete(selectedFiles)}
                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors font-medium"
                    style={{ color: 'var(--accent-rust)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                  <button onClick={clearSelection} className="text-xs px-1.5 py-1.5 transition-colors" style={{ color: 'var(--text-hint)' }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Sort */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setSortOpen(p => !p)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                >
                  {sortDir === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                  <span>{sortOptions.find(s => s.value === sortBy)?.label ?? 'Sort'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {sortOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 mt-1.5 w-48 rounded-xl border shadow-lg overflow-hidden z-30 py-1"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {sortOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                          style={sortBy === opt.value
                            ? { color: 'var(--accent-rust)', background: 'var(--accent-rust-tint)' }
                            : { color: 'var(--text-muted)' }}
                        >
                          <span>{opt.label}</span>
                          {sortBy === opt.value && (
                            <div
                              onClick={e => { e.stopPropagation(); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}
                              className="cursor-pointer"
                              style={{ color: 'var(--accent-rust)' }}
                            >
                              {sortDir === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                            </div>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Format Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
            {(['all', 'image', 'video', 'document', 'other'] as const).map((ft) => (
              <button
                key={ft}
                onClick={() => { setFilterType(ft); setFilterGlobal(false); }}
                aria-pressed={filterType === ft}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border snap-start ${
                  filterType === ft 
                    ? 'border-transparent shadow-sm' 
                    : 'bg-transparent border-[var(--border)] hover:bg-[var(--bg-card)]'
                }`}
                style={filterType === ft 
                  ? { background: 'var(--text-primary)', color: 'var(--bg-body)' } 
                  : { color: 'var(--text-muted)', borderColor: 'var(--border)' }}
              >
                {ft.charAt(0).toUpperCase() + ft.slice(1)}
              </button>
            ))}
          </div>

          {/* File count */}
          {filteredFiles.length > 0 && (
            <p className="text-xs pt-1" style={{ color: 'var(--text-hint)' }}>{filteredFiles.length} item{filteredFiles.length !== 1 ? 's' : ''}</p>
          )}

          {/* Empty state */}
          {filteredFiles.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="w-20 h-20 rounded-3xl border border-dashed flex items-center justify-center mb-5"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
                {activeSection === 'starred'
                  ? <Star className="w-9 h-9" style={{ color: 'var(--accent-rust)', opacity: 0.6 }} />
                  : activeSection === 'recent'
                  ? <Clock className="w-9 h-9" style={{ color: 'var(--text-hint)', opacity: 0.4 }} />
                  : <UploadCloud className="w-9 h-9" style={{ color: 'var(--text-hint)', opacity: 0.4 }} />
                }
              </div>
              <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                {activeSection === 'starred' ? 'No starred files' : activeSection === 'recent' ? 'No recent files' : 'Drop files here'}
              </h3>
              <p className="text-[13px] text-center max-w-xs" style={{ color: 'var(--text-hint)' }}>
                {activeSection === 'starred'
                  ? 'Star files to find them quickly'
                  : activeSection === 'recent'
                  ? 'Files you access will appear here'
                  : 'Or click Upload to add files to this folder'
                }
              </p>
            </motion.div>
          )}

          {/* Grid View */}
          {filteredFiles.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3">
              {filteredFiles.map((file, i) => {
                const isFolder = !file.hasDocument && file.mimeType === 'folder';
                const isSelected = selectedFiles.includes(file.id);
                const isFileStar = isStarred(file.id);
                return (
                  <motion.div
                    key={file.id}
                    data-file-card
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    onClick={e => handleFileClick(e, file)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                    className="group relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden"
                    style={isSelected
                      ? { borderColor: 'var(--accent-rust-border)', background: 'var(--accent-rust-tint)' }
                      : { borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                    onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; } }}
                    onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                  >
                    {/* Card icon area */}
                    <div className={`flex items-center justify-center pt-5 pb-3 px-4 ${isFolder ? 'pt-6 pb-4' : ''}`}>
                      {isFolder ? (
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(192,82,42,0.08)' }}>
                            <Folder className="w-8 h-8" style={{ color: 'var(--accent-rust)' }} />
                          </div>
                          {file._directCount !== undefined && (
                            <span className="absolute -bottom-1 -right-1 text-[9px] font-bold text-white rounded-full px-1.5 py-0.5 leading-none"
                              style={{ background: 'var(--accent-rust)' }}>
                              {file._directCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(192,82,42,0.06)' }}>
                          {getFileIcon(file.mimeType, file.name, 'md')}
                        </div>
                      )}
                    </div>

                    {/* Card info */}
                    <div className="px-3 pb-3 flex-1">
                      <p className="text-[13px] font-medium truncate leading-snug mb-0.5" title={file.name}
                        style={{ color: 'var(--text-primary)' }}>
                        {file.name}
                      </p>
                      {searchQuery && file.folderPath && file.folderPath !== '/' && (
                        <p className="text-[10px] truncate flex items-center gap-0.5 mb-1" style={{ color: 'var(--accent-rust)' }}>
                          <Folder className="w-2.5 h-2.5 shrink-0" />{file.folderPath}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[11px] mt-1" style={{ color: 'var(--text-hint)' }}>
                        <span>
                          {file.isVirtualChannelFolder
                            ? `${file._directCount} file${file._directCount !== 1 ? 's' : ''}`
                            : file.hasDocument ? formatSize(file.size) : 'Folder'}
                        </span>
                        {file.uploadDate ? <span>{format(new Date(file.uploadDate), 'MMM d')}</span> : null}
                      </div>
                    </div>

                    {/* Actions row — always visible on mobile, hover-only on desktop */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity duration-150">
                      {isFileStar && (
                        <span className="w-6 h-6 flex items-center justify-center sm:hidden">
                          <Star className="w-3 h-3" style={{ color: 'var(--accent-rust)', fill: 'var(--accent-rust)' }} />
                        </span>
                      )}
                      <button
                        onClick={e => handleThreeDot(e, file)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all"
                        style={{ background: 'var(--bg-card)', opacity: 0.8, color: 'var(--text-hint)' }}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Star icon if starred (always visible) */}
                    {isFileStar && (
                      <div className="absolute top-2 left-2 opacity-100 group-hover:opacity-0 transition-opacity">
                        <Star className="w-3.5 h-3.5" style={{ color: 'var(--accent-rust)', fill: 'var(--accent-rust)' }} />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {filteredFiles.length > 0 && viewMode === 'list' && (
            <FileListView
              files={filteredFiles}
              selectedFiles={selectedFiles}
              onFileClick={handleFileClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onThreeDot={handleThreeDot}
              showPath={!!searchQuery}
              starred={starred}
            />
          )}
        </div>
      </div>

      {/* Actions dropdown (three-dot menu) */}
      <AnimatePresence>
        {dropdown && contextFile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[100] rounded-xl border shadow-lg overflow-hidden py-1 w-52"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              top: dropdown.buttonBottom + 6,
              right: window.innerWidth - dropdown.buttonRight,
            }}
            onClick={e => e.stopPropagation()}
          >
            {canPreview(contextFile.mimeType, contextFile.name) && (
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                onClick={() => { handlePreview(contextFile); setDropdown(null); }}
              >
                <Eye className="w-4 h-4" /> Preview
              </button>
            )}
            {contextFile.hasDocument && (
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                onClick={() => { handleDownload(contextFile); setDropdown(null); }}
              >
                <Download className="w-4 h-4" /> Download
              </button>
            )}
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              onClick={() => { toggleStarred(contextFile.id); setDropdown(null); }}
            >
              {isStarred(contextFile.id)
                ? <><StarOff className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} /> Remove Star</>
                : <><Star className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} /> Star</>
              }
            </button>
            <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            {!contextFile.isVirtualChannelFolder && (
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--accent-rust)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-rust-tint)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { handleDelete([contextFile.id]); setDropdown(null); }}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent
          className={`p-0 overflow-hidden flex flex-col w-full h-[95dvh] sm:h-[90vh] ${
            previewType === 'docx' ? 'sm:max-w-3xl' : 'sm:max-w-5xl'
          }`}
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <DialogHeader className="absolute top-4 left-4 z-10 backdrop-blur-md p-3 rounded-xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', opacity: 0.9 }}>
            <DialogTitle className="text-sm font-medium">{previewFile?.name}</DialogTitle>
            <DialogDescription className="hidden">File preview</DialogDescription>
          </DialogHeader>
          <div className={`relative flex-1 h-full flex items-center justify-center ${previewType === 'docx' ? 'p-0' : 'p-4'}`}
            style={{ background: previewType === 'docx' ? 'var(--bg-hover)' : 'var(--bg-body)' }}>
            {isPreviewLoading ? (
              <div className="flex flex-col items-center gap-3" style={{ color: 'var(--text-hint)' }}>
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-rust)', borderTopColor: 'transparent' }} />
                <p>Loading preview...</p>
              </div>
            ) : previewType === 'image' && previewUrl ? (
              <img src={previewUrl} alt={previewFile?.name} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : previewType === 'video' && previewUrl ? (
              <video src={previewUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" style={{ maxHeight: 'calc(90vh - 2rem)' }} />
            ) : previewType === 'pdf' && previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full rounded-lg border-0" title={previewFile?.name} />
            ) : previewType === 'docx' && docxHtml ? (
              <div className="w-full h-full overflow-auto rounded-lg" style={{ background: 'var(--bg-card)' }}>
                <div className="p-8 prose prose-sm max-w-none" style={{ color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: docxHtml }} />
              </div>
            ) : !isPreviewLoading ? (
              <div style={{ color: 'var(--text-hint)' }}>Failed to load preview</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
