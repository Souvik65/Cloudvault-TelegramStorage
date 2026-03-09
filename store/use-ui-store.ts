import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'grid' | 'list';
type RightPanel = null | 'settings' | 'file-details';
type SortBy = 'name' | 'date' | 'size';
type NavSection = 'my-files' | 'recent' | 'starred';

interface UIState {
  viewMode: ViewMode;
  rightPanelOpen: RightPanel;
  selectedFileForDetails: number | null;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sortBy: SortBy;
  starred: number[];
  activeSection: NavSection;
  setViewMode: (mode: ViewMode) => void;
  openRightPanel: (panel: RightPanel) => void;
  closeRightPanel: () => void;
  setSelectedFileForDetails: (id: number | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSortBy: (sort: SortBy) => void;
  toggleStarred: (id: number) => void;
  setActiveSection: (section: NavSection) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      rightPanelOpen: null,
      selectedFileForDetails: null,
      sidebarOpen: false,
      sidebarCollapsed: false,
      sortBy: 'name',
      starred: [],
      activeSection: 'my-files',
      setViewMode: (viewMode) => set({ viewMode }),
      openRightPanel: (rightPanelOpen) => set({ rightPanelOpen }),
      closeRightPanel: () => set({ rightPanelOpen: null, selectedFileForDetails: null }),
      setSelectedFileForDetails: (id) => set({ selectedFileForDetails: id }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSortBy: (sortBy) => set({ sortBy }),
      toggleStarred: (id) =>
        set((state) => ({
          starred: state.starred.includes(id)
            ? state.starred.filter((s) => s !== id)
            : [...state.starred, id],
        })),
      setActiveSection: (activeSection) => set({ activeSection }),
    }),
    {
      name: 'tg-ui-storage',
      partialize: (state) => ({
        viewMode: state.viewMode,
        sidebarCollapsed: state.sidebarCollapsed,
        sortBy: state.sortBy,
        starred: state.starred,
      }),
    }
  )
);
