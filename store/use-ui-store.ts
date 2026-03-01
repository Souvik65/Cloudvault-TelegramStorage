import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'grid' | 'list';
type RightPanel = null | 'settings' | 'file-details';

interface UIState {
  viewMode: ViewMode;
  rightPanelOpen: RightPanel;
  selectedFileForDetails: number | null;
  sidebarOpen: boolean;
  setViewMode: (mode: ViewMode) => void;
  openRightPanel: (panel: RightPanel) => void;
  closeRightPanel: () => void;
  setSelectedFileForDetails: (id: number | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      rightPanelOpen: null,
      selectedFileForDetails: null,
      sidebarOpen: true,
      setViewMode: (viewMode) => set({ viewMode }),
      openRightPanel: (rightPanelOpen) => set({ rightPanelOpen }),
      closeRightPanel: () => set({ rightPanelOpen: null, selectedFileForDetails: null }),
      setSelectedFileForDetails: (id) => set({ selectedFileForDetails: id }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'tg-ui-storage',
      partialize: (state) => ({ viewMode: state.viewMode }),
    }
  )
);
