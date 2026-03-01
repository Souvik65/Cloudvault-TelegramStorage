'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileStore } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { UploadCloud, X, File as FileIcon } from 'lucide-react';
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

        const res = await fetch('/api/tg/files', {
          method: 'POST',
          headers: { 'x-tg-session': sessionString! },
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to upload file');
        }

        setProgress(((i + 1) / filesToUpload.length) * 100);
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription className="hidden">
            Upload files to your storage
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? 'border-[#2AABEE] bg-[rgba(42,171,238,0.1)]'
              : 'border-[rgba(255,255,255,0.12)] bg-[#1C2733] hover:border-[rgba(255,255,255,0.2)] hover:bg-[#242F3D]'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-10 h-10 text-[#2AABEE] mx-auto mb-4" />
          <p className="text-sm text-[#8B9CAF] font-medium">
            {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
          </p>
          <p className="text-xs text-[#6C7883] mt-2">Supports any file type</p>
        </div>

        {filesToUpload.length > 0 && (
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2">
            {filesToUpload.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[#1C2733] rounded-lg border border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileIcon className="w-4 h-4 text-[#6C7883] shrink-0" />
                  <span className="text-sm text-[#8B9CAF] truncate">{file.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-[#6C7883] hover:text-[#E53935]" onClick={() => removeFile(index)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="mt-4">
            <div className="h-1.5 bg-[#1C2733] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2AABEE] transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-center text-[#6C7883] mt-2">Uploading... {Math.round(progress)}%</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={filesToUpload.length === 0 || uploading}>
            {uploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
