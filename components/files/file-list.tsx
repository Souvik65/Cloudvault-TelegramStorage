'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { useFileStore } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import { FileIcon, Folder, Download, Trash2, Image as ImageIcon, Video, FileText, ChevronRight, Home, FileArchive, FileAudio, FileCode, FileSpreadsheet, FileJson, Eye, Sparkles, Hash, ArrowLeft, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileCardSkeleton, FileRowSkeleton } from '@/components/ui/skeleton';
import { FileListView } from '@/components/files/file-list-view';
import { format } from 'date-fns';
import { formatSize } from '@/lib/utils';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';

// Special path for the virtual "Telegram direct uploads" folder
const TELEGRAM_DIRECT_PATH = '/__tg_direct__';
const VIRTUAL_FOLDER_ID = -1;

type PreviewType = 'image' | 'video' | 'pdf' | 'docx' | null;

function canPreview(mimeType: string): boolean {
  return (
    mimeType?.startsWith('image/') ||
    mimeType?.startsWith('video/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function FileList() {
  const { files, setFiles, currentFolder, setCurrentFolder, searchQuery, isLoading, setLoading, setError, storageChannelId, storageChannelName } = useFileStore();
  const { sessionString } = useAuthStore();
  const { viewMode, openRightPanel, setSelectedFileForDetails } = useUIStore();
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastSelectedId = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    setSelectedFiles([]);
    lastSelectedId.current = null;
  }, [searchQuery]);

  const clearSelection = () => {
    setSelectedFiles([]);
    lastSelectedId.current = null;
  };

  const handlePreview = async (file: any) => {
    if (!canPreview(file.mimeType)) return;

    let type: PreviewType;
    if (file.mimeType?.startsWith('image/')) type = 'image';
    else if (file.mimeType?.startsWith('video/')) type = 'video';
    else if (file.mimeType === 'application/pdf') type = 'pdf';
    else type = 'docx';

    setPreviewFile(file);
    setPreviewType(type);
    setIsPreviewLoading(true);
    setAnalysisResult(null);
    setDocxHtml(null);

    try {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      const res = await fetch(`/api/tg/download?channelId=${storageChannelId}&messageId=${file.id}`, {
        headers: { 'x-tg-session': sessionString! },
      });

      if (!res.ok) throw new Error('Failed to load preview');

      const blob = await res.blob();

      if (type === 'docx') {
        const arrayBuffer = await blob.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(result.value);
      } else {
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    } catch (error: any) {
      toast.error(error.message);
      setPreviewFile(null);
      setPreviewType(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setPreviewType(null);
    setDocxHtml(null);
    setAnalysisResult(null);
  };

  const analyzeImage = async () => {
    if (!previewUrl || !previewFile) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key is not configured');

      const response = await fetch(previewUrl);
      const blob = await response.blob();

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const ai = new GoogleGenAI({ apiKey });
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: previewFile.mimeType || 'image/jpeg', data: base64Data } },
            { text: 'Analyze this image and describe what you see in detail. If there is text, extract it. If there are objects, list them.' },
          ],
        },
      });

      setAnalysisResult(aiResponse.text || 'No analysis result returned.');
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || 'Failed to analyze image');
      setAnalysisResult('Analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!sessionString) return;

    const fetchFiles = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tg/files?channelId=${storageChannelId}`, {
          headers: { 'x-tg-session': sessionString },
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setFiles(data.files);
      } catch (error: any) {
        setError(error.message);
        toast.error('Failed to load files');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [sessionString, setFiles, setLoading, setError, storageChannelId]);

  // Build the file list for the current folder, injecting a virtual channel folder at root
  const filteredFiles = useMemo(() => {
    let result: any[];

    if (currentFolder === TELEGRAM_DIRECT_PATH) {
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
              id: VIRTUAL_FOLDER_ID,
              name: storageChannelName || 'Telegram Channel',
              mimeType: 'folder',
              hasDocument: false,
              size: 0,
              folderPath: '/',
              uploadDate: 0,
              isVirtualChannelFolder: true,
              _directCount: directCount,
            },
          ];
        }
      }
    }

    if (!searchQuery) return result;
    return result.filter(f => f.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [files, currentFolder, searchQuery, storageChannelName]);

  const handleDelete = async (ids: number[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length > 1 ? `these ${ids.length} items` : 'this item'}?`)) return;

    try {
      let allIdsToDelete = [...ids];

      const selectedFolders = files.filter(f => ids.includes(f.id) && !f.hasDocument && f.mimeType === 'folder');

      for (const folder of selectedFolders) {
        const folderFullPath = currentFolder === '/' ? `/${folder.name}` : `${currentFolder}/${folder.name}`;
        const filesInFolder = files.filter(f => f.folderPath === folderFullPath || f.folderPath?.startsWith(`${folderFullPath}/`));
        allIdsToDelete = [...allIdsToDelete, ...filesInFolder.map(f => f.id)];
      }

      allIdsToDelete = Array.from(new Set(allIdsToDelete));

      const res = await fetch(`/api/tg/files?channelId=${storageChannelId}&messageIds=${allIdsToDelete.join(',')}`, {
        method: 'DELETE',
        headers: { 'x-tg-session': sessionString! },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete files');
      }

      setFiles(files.filter(f => !allIdsToDelete.includes(f.id)));
      clearSelection();
      toast.success('Items deleted successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleSelection = (id: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedId.current !== null) {
      const currentIndex = filteredFiles.findIndex(f => f.id === id);
      const lastIndex = filteredFiles.findIndex(f => f.id === lastSelectedId.current);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const idsToSelect = filteredFiles.slice(start, end + 1).map(f => f.id);
        setSelectedFiles(prev => Array.from(new Set([...prev, ...idsToSelect])));
        return;
      }
    }

    setSelectedFiles(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    lastSelectedId.current = id;
  };

  const handleDownload = async (file: any) => {
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

  const getIcon = (mimeType: string, name: string) => {
    if (!mimeType || mimeType === 'folder') return <Folder className="w-8 h-8 text-[#2AABEE]" />;
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-[#4FC3F7]" />;
    if (mimeType.startsWith('video/')) return <Video className="w-8 h-8 text-[#AB47BC]" />;
    if (mimeType.startsWith('audio/')) return <FileAudio className="w-8 h-8 text-[#FFB74D]" />;
    if (mimeType === 'application/pdf') return <FileText className="w-8 h-8 text-[#EF5350]" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <FileArchive className="w-8 h-8 text-[#FF7043]" />;
    if (mimeType.includes('json')) return <FileJson className="w-8 h-8 text-[#66BB6A]" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return <FileSpreadsheet className="w-8 h-8 text-[#26A69A]" />;
    if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html') || mimeType.includes('css')) return <FileCode className="w-8 h-8 text-[#42A5F5]" />;
    const ext = name?.split('.').pop()?.toLowerCase();
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp'].includes(ext || '')) return <FileCode className="w-8 h-8 text-[#42A5F5]" />;
    return <FileIcon className="w-8 h-8 text-[#6C7883]" />;
  };

  const handleFileClick = (e: React.MouseEvent, file: any) => {
    if (!file.hasDocument && file.mimeType === 'folder') {
      if (file.isVirtualChannelFolder) {
        setCurrentFolder(TELEGRAM_DIRECT_PATH);
      } else {
        setCurrentFolder(currentFolder === '/' ? `/${file.name}` : `${currentFolder}/${file.name}`);
      }
      clearSelection();
    } else {
      toggleSelection(file.id, e.shiftKey);
    }
  };

  const handleFileDoubleClick = (file: any) => {
    if (file.hasDocument) {
      setSelectedFileForDetails(file.id);
      openRightPanel('file-details');
    }
  };

  // Navigate one level up
  const goBack = () => {
    if (currentFolder === TELEGRAM_DIRECT_PATH) {
      setCurrentFolder('/');
    } else {
      const parts = currentFolder.split('/').filter(Boolean);
      parts.pop();
      setCurrentFolder(parts.length === 0 ? '/' : '/' + parts.join('/'));
    }
    clearSelection();
  };

  const isAtRoot = currentFolder === '/';
  const isInDirectFolder = currentFolder === TELEGRAM_DIRECT_PATH;
  const breadcrumbs = isInDirectFolder ? [] : currentFolder.split('/').filter(Boolean);

  // Handle click on the background area to deselect files
  const handleAreaClick = (e: React.MouseEvent) => {
    if (selectedFiles.length === 0) return;
    const target = e.target as HTMLElement;
    if (!target.closest('[data-file-card]')) {
      clearSelection();
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded bg-[#242F3D]" />
        </div>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <FileCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => <FileRowSkeleton key={i} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumbs + selection actions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 text-sm min-w-0">
          {/* Back button — visible whenever not at root */}
          {!isAtRoot && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#8B9CAF] hover:text-white shrink-0"
              onClick={goBack}
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}

          {/* Home button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#8B9CAF] hover:text-white shrink-0"
            onClick={() => { setCurrentFolder('/'); clearSelection(); }}
          >
            <Home className="w-4 h-4" />
          </Button>

          {/* Channel name badge */}
          <span className="hidden sm:flex items-center gap-1 text-xs text-[#4FC3F7] font-medium px-1.5 py-0.5 bg-[#4FC3F7]/10 rounded-md border border-[#4FC3F7]/20 shrink-0">
            <Hash className="w-3 h-3" />
            {storageChannelName || 'Saved Messages'}
          </span>

          {/* Folder breadcrumbs */}
          {isInDirectFolder ? (
            <div className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-[#6C7883]" />
              <span className="h-8 px-2 text-sm font-semibold text-white flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[#2AABEE]" />
                {storageChannelName || 'Telegram Channel'}
              </span>
            </div>
          ) : (
            breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-[#6C7883] shrink-0" />
                <Button
                  variant="ghost"
                  className={`h-8 px-2 text-sm truncate ${index === breadcrumbs.length - 1 ? 'font-semibold text-white' : 'text-[#8B9CAF] hover:text-white'}`}
                  onClick={() => setCurrentFolder('/' + breadcrumbs.slice(0, index + 1).join('/'))}
                >
                  {crumb}
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Selection action bar */}
        {selectedFiles.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
            <span className="text-xs sm:text-sm text-[#6C7883] shrink-0">
              {selectedFiles.length}<span className="hidden sm:inline"> selected</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2 sm:px-3 text-[#E53935] hover:text-[#E53935] hover:bg-[#E53935]/10"
              onClick={() => handleDelete(selectedFiles)}
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2 sm:px-3 text-[#6C7883] hover:text-white hover:bg-white/5"
              onClick={clearSelection}
            >
              <X className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        )}
      </div>

      {/* File area — clicking background deselects */}
      <div onClick={handleAreaClick}>
        {filteredFiles.length === 0 ? (
          <div className="bg-[#242F3D] text-center py-20 rounded-2xl border border-[rgba(255,255,255,0.06)] border-dashed">
            <Folder className="w-12 h-12 text-[#2AABEE] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No files here</h3>
            <p className="text-[#6C7883] text-sm">Upload some files or create a new folder.</p>
          </div>
        ) : viewMode === 'list' ? (
          <FileListView
            files={filteredFiles}
            selectedFiles={selectedFiles}
            onFileClick={handleFileClick}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onPreview={handlePreview}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFiles.map((file, i) => (
              <motion.div
                key={file.id}
                data-file-card
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className={`group relative bg-[#242F3D] p-5 rounded-xl border transition-all duration-200 cursor-pointer hover:bg-[#2B3A4D] ${
                  selectedFiles.includes(file.id) ? 'border-[#2AABEE] ring-1 ring-[#2AABEE]/30' : 'border-[rgba(255,255,255,0.06)]'
                }`}
                onClick={(e) => handleFileClick(e, file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-[#1C2733] rounded-xl">
                    {getIcon(file.mimeType, file.name)}
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {canPreview(file.mimeType) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6C7883] hover:text-[#2AABEE]" onClick={(e) => { e.stopPropagation(); handlePreview(file); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    {file.hasDocument && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6C7883] hover:text-[#2AABEE]" onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    {!file.isVirtualChannelFolder && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6C7883] hover:text-[#E53935]" onClick={(e) => { e.stopPropagation(); handleDelete([file.id]); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <h4 className="font-medium text-white truncate mb-1" title={file.name}>{file.name}</h4>
                <div className="flex items-center justify-between text-xs text-[#6C7883]">
                  <span>
                    {file.isVirtualChannelFolder
                      ? `${file._directCount} file${file._directCount !== 1 ? 's' : ''}`
                      : file.hasDocument
                      ? formatSize(file.size)
                      : 'Folder'}
                  </span>
                  <span>{file.uploadDate ? format(new Date(file.uploadDate), 'MMM d, yyyy') : ''}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent
          className={`p-0 bg-black/95 border-none overflow-hidden flex flex-col h-[95dvh] sm:h-[90vh] ${
            previewType === 'docx' ? 'sm:max-w-3xl' : 'sm:max-w-5xl md:flex-row'
          }`}
        >
          <DialogHeader className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10">
            <DialogTitle className="text-white text-sm font-medium">{previewFile?.name}</DialogTitle>
            <DialogDescription className="hidden">
              {previewType === 'image' ? 'Image preview' : previewType === 'video' ? 'Video preview' : previewType === 'pdf' ? 'PDF preview' : 'Document preview'}
            </DialogDescription>
          </DialogHeader>

          {/* Preview content */}
          <div className={`relative flex-1 h-full flex items-center justify-center ${previewType === 'docx' ? 'p-0' : 'p-4'}`}>
            {isPreviewLoading ? (
              <div className="text-white/70 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#2AABEE] border-t-transparent rounded-full animate-spin" />
                <p>Loading preview...</p>
              </div>
            ) : previewType === 'image' && previewUrl ? (
              <img src={previewUrl} alt={previewFile?.name} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : previewType === 'video' && previewUrl ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg"
                style={{ maxHeight: 'calc(90vh - 2rem)' }}
              />
            ) : previewType === 'pdf' && previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg border-0"
                title={previewFile?.name}
              />
            ) : previewType === 'docx' && docxHtml ? (
              <div className="w-full h-full overflow-auto bg-white rounded-lg">
                <div
                  className="p-8 text-black prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              </div>
            ) : !isPreviewLoading ? (
              <div className="text-white/70">Failed to load preview</div>
            ) : null}

            {/* Gemini analyze button — images only */}
            {previewType === 'image' && previewUrl && !isPreviewLoading && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <Button onClick={analyzeImage} disabled={isAnalyzing} className="shadow-xl rounded-full px-6 gap-2">
                  <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                  {isAnalyzing ? 'Analyzing Image...' : 'Analyze with Gemini'}
                </Button>
              </div>
            )}
          </div>

          {/* AI analysis sidebar — images only */}
          {previewType === 'image' && (isAnalyzing || analysisResult) && (
            <div className="w-full md:w-80 lg:w-96 bg-[#0E1621] border-t md:border-t-0 md:border-l border-[rgba(255,255,255,0.06)] p-4 md:p-6 flex flex-col max-h-56 md:max-h-none md:h-full overflow-y-auto shrink-0">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-[#2AABEE]" />
                <h3 className="text-white font-medium">AI Analysis</h3>
              </div>
              {isAnalyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[#6C7883] gap-4">
                  <div className="w-8 h-8 border-2 border-[#2AABEE] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-center">Gemini is analyzing your image...</p>
                </div>
              ) : analysisResult ? (
                <div className="text-[#8B9CAF] whitespace-pre-wrap leading-relaxed text-sm">{analysisResult}</div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
