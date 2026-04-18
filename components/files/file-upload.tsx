'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { useFileStore } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';import { UploadCloud, X, File as FileIcon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function FileUpload({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { currentFolder, setFiles, files, storageChannelId } = useFileStore();
  const { sessionString } = useAuthStore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFilesToUpload((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const removeFile = (index: number) => {
    setFilesToUpload((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    setProgress(0);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const formData = new FormData();
        formData.append('file', file);

        const metadata = {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          uploadDate: Date.now(),
          folderPath: currentFolder,
          hasDocument: true,
        };

        formData.append('metadata', JSON.stringify(metadata));
        formData.append('channelId', storageChannelId);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/tg/files');
          xhr.timeout = 300000; // 5 minutes for large files
          xhr.setRequestHeader('x-tg-session', sessionString!);

          xhr.ontimeout = () => reject(new Error('Upload timed out'));
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const fileProgress = event.loaded / event.total;
              const overallProgress = ((i + fileProgress) / filesToUpload.length) * 100;
              setProgress(overallProgress);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              let errorMsg = 'Failed to upload file';
              try {
                const errResult = JSON.parse(xhr.responseText);
                if (errResult.error) errorMsg = errResult.error;
              } catch (e) {}
              reject(new Error(errorMsg));
            }
          };

          xhr.onerror = () => reject(new Error('Network error occurred during upload.'));
          xhr.send(formData);
        });
      }

      toast.success('Files uploaded successfully');
      setFilesToUpload([]);
      onClose();

      // Refresh files
      const res = await fetch(`/api/tg/files?channelId=${storageChannelId}`, {
        headers: { 'x-tg-session': sessionString! },
      });
      const data = await res.json();
      if (!data.error) {
        setFiles(data.files);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !uploading && !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden shadow-2xl border-none" style={{ backgroundColor: 'var(--bg-card)' }}>
        <DialogHeader className="p-6 pb-4 border-b relative" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}>
          <DialogTitle className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Upload Files
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-hint)' }}>
            Securely upload files to your current folder
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          <div
            {...getRootProps()}
            className="flex flex-col items-center justify-center relative w-full rounded-2xl cursor-pointer"
          >
            <input {...getInputProps()} />
            <motion.div
              animate={{ 
                scale: isDragActive ? 0.98 : 1,
              }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{ 
                borderColor: isDragActive ? 'var(--accent-rust)' : 'var(--border)',
                backgroundColor: isDragActive ? 'var(--selection-bg)' : 'transparent' 
              }}
              className={`w-full min-h-[160px] flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl group transition-colors hover:bg-[var(--bg-hover)]`}
            >
              <div className="p-4 rounded-full mb-4 transition-colors" style={{ 
                backgroundColor: isDragActive ? 'var(--accent-rust-tint)' : 'var(--bg-hover)' 
              }}>
                <UploadCloud className="w-8 h-8 transition-colors" style={{ 
                  color: isDragActive ? 'var(--accent-rust)' : 'var(--text-muted)' 
                }} />
              </div>
              
              <h3 className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {isDragActive ? 'Drop files here' : 'Click or drop files'}
              </h3>
              <p className="text-xs max-w-[200px] text-center leading-relaxed" style={{ color: 'var(--text-hint)' }}>
                Supports all file types. Maximum file size depends on Telegram limits.
              </p>
            </motion.div>
          </div>

          <div className="mt-4">
            <AnimatePresence initial={false}>
              {filesToUpload.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="max-h-48 overflow-y-auto pr-1 space-y-2 custom-scroll overflow-x-hidden"
                >
                  <AnimatePresence>
                    {filesToUpload.map((file, index) => (
                      <motion.div 
                        key={`${file.name}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
                        className="flex items-center justify-between p-3 rounded-xl border"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <div className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: 'var(--bg-hover)' }}>
                            <FileIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-hint)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </div>
                        {uploading ? (
                           <CheckCircle2 className="w-4 h-4 transition-colors" style={{ color: progress >= (((index + 1)/filesToUpload.length)*100) ? 'var(--accent-teal)' : 'var(--text-hint)' }} />
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 rounded-lg shrink-0 transition-colors cursor-pointer" 
                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                            style={{ color: 'var(--text-hint)' }}
                            autoFocus={false}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {uploading && (
              <motion.div 
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mt-6 w-full"
              >
                <div className="h-1.5 rounded-full overflow-hidden shadow-inner relative" style={{ backgroundColor: 'var(--bg-hover)' }}>
                  {/* Dynamic infinite sweeping animation for active state */}
                  <motion.div
                    className="absolute inset-0 w-[200%] h-full pointer-events-none z-10 opacity-70"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    }}
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: 'linear',
                    }}
                  />
                  {/* Actual progress bar fill */}
                  <motion.div
                    className="h-full rounded-full relative z-0"
                    style={{ backgroundColor: 'var(--accent-rust)' }}
                    initial={{ width: '5%' }}
                    animate={{ width: `${Math.max(progress, 5)}%` }}
                    transition={{ ease: "easeOut", duration: 0.4 }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs font-medium animate-pulse" style={{ color: 'var(--text-muted)' }}>Uploading to folder...</p>
                  <p className="text-xs font-mono font-bold" style={{ color: 'var(--accent-rust)' }}>{Math.round(progress)}%</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={uploading}
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={filesToUpload.length === 0 || uploading}
              style={{ backgroundColor: 'var(--accent-rust)', color: '#fff' }}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading
                </span>
              ) : 'Upload Files'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
