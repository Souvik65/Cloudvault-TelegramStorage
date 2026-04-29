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
  virtualCategory?: string;
  _directCount?: number;
}

export type FileFilterType = 'all' | 'image' | 'video' | 'document' | 'other';

export interface ChannelStats {
  totalSize: number;
  images: number;
  videos: number;
  documents: number;
  others: number;
  folderCounts: Record<string, number>;
}

export type FileTypeCategory = 'image' | 'video' | 'document' | 'other';

export function getFileTypeCategory(mimeType: string, fileName: string): FileTypeCategory {
  const mime = mimeType || '';
  const name = fileName || '';
  
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|avif|heic)$/i.test(name)) {
    return 'image';
  }
  if (mime.startsWith('video/') || /\.(mp4|mkv|avi|mov|webm)$/i.test(name)) {
    return 'video';
  }
  if (
    mime === 'application/pdf' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime === 'text/plain' ||
    mime === 'text/csv' ||
    mime === 'application/rtf' ||
    /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|txt|rtf|odt|ods|odp)$/i.test(name)
  ) {
    return 'document';
  }
  return 'other';
}

export function applyStatsDiff(stats: ChannelStats, sizeDiff: number, category: FileTypeCategory, countDiff: number): ChannelStats {
  const newStats = { ...stats };
  newStats.totalSize = Math.max(0, newStats.totalSize + sizeDiff);
  if (category === 'image') newStats.images = Math.max(0, newStats.images + countDiff);
  else if (category === 'video') newStats.videos = Math.max(0, newStats.videos + countDiff);
  else if (category === 'document') newStats.documents = Math.max(0, newStats.documents + countDiff);
  else newStats.others = Math.max(0, newStats.others + countDiff);
  return newStats;
}

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
  pagination: {
    hasMore: boolean;
    nextOffsetId: number | null;
  };
  channelStats: ChannelStats | null;
  setFiles: (files: FileMetadata[]) => void;
  appendFiles: (files: FileMetadata[]) => void;
  setPagination: (pagination: { hasMore: boolean; nextOffsetId: number | null }) => void;
  setCurrentFolder: (folder: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterType: (filter: FileFilterType) => void;
  setFilterGlobal: (global: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStorageChannelId: (channelId: string) => void;
  setStorageChannelName: (channelName: string) => void;
  setChannelStats: (stats: ChannelStats) => void;
  fetchStats: (channelId: string) => Promise<void>;
  updateStatsOptimistically: (file: Partial<FileMetadata>, action: 'add' | 'remove') => void;
  updateStatsOptimisticallyBatch: (files: Partial<FileMetadata>[], action: 'add' | 'remove') => void;
  addFileOptimistically: (file: FileMetadata) => void;
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      files: [],
      currentFolder: '/',
      isLoading: false,
      error: null,
      searchQuery: '',
      filterType: 'all',
      filterGlobal: false,
      storageChannelId: 'me',
      storageChannelName: 'Saved Messages',
      pagination: {
        hasMore: false,
        nextOffsetId: null,
      },
      channelStats: null,
      setFiles: (files) => set({ files }),
      appendFiles: (newFiles) => set((state) => ({ files: [...state.files, ...newFiles] })),
      setPagination: (pagination) => set({ pagination }),
      setCurrentFolder: (currentFolder) => set({ currentFolder, files: [], pagination: { hasMore: false, nextOffsetId: null } }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setFilterType: (filterType) => set({ filterType }),
      setFilterGlobal: (filterGlobal) => set({ filterGlobal }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setStorageChannelId: (storageChannelId) => set({ storageChannelId }),
      setStorageChannelName: (storageChannelName) => set({ storageChannelName }),
      setChannelStats: (channelStats) => set({ channelStats }),
      fetchStats: async (channelId) => {
        try {
          const res = await fetch(`/api/tg/stats?channelId=${encodeURIComponent(channelId)}`, { cache: 'no-store', credentials: 'include' });
          if (!res.ok) return;
          const data = await res.json();
          if (!data.error) {
            // Convert BigInt string to number for frontend use
            set({ 
              channelStats: {
                ...data,
                totalSize: Number(data.totalSize)
              }
            });
          }
        } catch (err) {
          console.error('Failed to fetch stats:', err);
        }
      },
      addFileOptimistically: (file) => {
        set((state) => {
          const newFiles = [file, ...state.files];
          let newStats = state.channelStats;
          
          if (newStats) {
            const category = getFileTypeCategory(file.mimeType, file.name);
            newStats = applyStatsDiff(newStats, file.size || 0, category, 1);
          }
          
          return { files: newFiles, channelStats: newStats };
        });
      },
      updateStatsOptimistically: (file, action) => {
        const { channelStats } = get();
        if (!channelStats) return;

        const diffMultiplier = action === 'add' ? 1 : -1;
        const category = getFileTypeCategory(file.mimeType || '', file.name || '');
        const sizeDiff = (file.size || 0) * diffMultiplier;

        const newStats = applyStatsDiff(channelStats, sizeDiff, category, diffMultiplier);
        set({ channelStats: newStats });
      },
      updateStatsOptimisticallyBatch: (files, action) => {
        const { channelStats } = get();
        if (!channelStats) return;

        const diffMultiplier = action === 'add' ? 1 : -1;
        let newStats = { ...channelStats };

        files.forEach(file => {
          const category = getFileTypeCategory(file.mimeType || '', file.name || '');
          const sizeDiff = (file.size || 0) * diffMultiplier;
          newStats = applyStatsDiff(newStats, sizeDiff, category, diffMultiplier);
        });

        set({ channelStats: newStats });
      },
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
