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

export type FileFilterType = 'all' | 'image' | 'video' | 'document' | 'other';

interface FileState {
  files: FileMetadata[];
  currentFolder: string;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filterType: FileFilterType;
  filterGlobal: boolean;
  storageChannelId: string;
  storageChannelName: string;
  setFiles: (files: FileMetadata[]) => void;
  setCurrentFolder: (folder: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterType: (filter: FileFilterType) => void;
  setFilterGlobal: (global: boolean) => void;
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
      filterType: 'all',
      filterGlobal: false,
      storageChannelId: 'me',
      storageChannelName: 'Saved Messages',
      setFiles: (files) => set({ files }),
      setCurrentFolder: (currentFolder) => set({ currentFolder }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setFilterType: (filterType) => set({ filterType }),
      setFilterGlobal: (filterGlobal) => set({ filterGlobal }),
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
