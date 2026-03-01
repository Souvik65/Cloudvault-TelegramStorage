import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FileMetadata {
  id: number;
  name: string;
  size: number;
  mimeType: string;
  uploadDate: number;
  folderPath: string;
  hasDocument: boolean;
  isDirectUpload?: boolean;
  isVirtualChannelFolder?: boolean;
}

interface FileState {
  files: FileMetadata[];
  currentFolder: string;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  storageChannelId: string;
  storageChannelName: string;
  setFiles: (files: FileMetadata[]) => void;
  setCurrentFolder: (folder: string) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStorageChannelId: (channelId: string) => void;
  setStorageChannelName: (channelName: string) => void;
}

export const useFileStore = create<FileState>()(
  persist(
    (set) => ({
      files: [],
      currentFolder: '/',
      isLoading: false,
      error: null,
      searchQuery: '',
      storageChannelId: 'me',
      storageChannelName: 'Saved Messages',
      setFiles: (files) => set({ files }),
      setCurrentFolder: (currentFolder) => set({ currentFolder }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setStorageChannelId: (storageChannelId) => set({ storageChannelId }),
      setStorageChannelName: (storageChannelName) => set({ storageChannelName }),
    }),
    {
      name: 'tg-file-storage',
      partialize: (state) => ({
        storageChannelId: state.storageChannelId,
        storageChannelName: state.storageChannelName,
      }),
    }
  )
);
