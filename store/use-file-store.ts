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
}

interface FileState {
  files: FileMetadata[];
  currentFolder: string;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  storageChannelId: string;
  setFiles: (files: FileMetadata[]) => void;
  setCurrentFolder: (folder: string) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStorageChannelId: (channelId: string) => void;
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
      setFiles: (files) => set({ files }),
      setCurrentFolder: (currentFolder) => set({ currentFolder }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setStorageChannelId: (storageChannelId) => set({ storageChannelId }),
    }),
    {
      name: 'tg-file-storage',
      partialize: (state) => ({ storageChannelId: state.storageChannelId }),
    }
  )
);
