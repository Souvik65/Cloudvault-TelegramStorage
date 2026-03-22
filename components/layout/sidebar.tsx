'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/use-auth-store';
import { useFileStore, FileMetadata } from '@/store/use-file-store';
import { useUIStore } from '@/store/use-ui-store';
import { Button } from '@/components/ui/button';
import { FeedbackModal } from '@/components/feedback/feedback-modal';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  HardDrive, LogOut, MessageSquare, Settings,
  Image as ImageIcon, FileText, Video, Clock, Star,
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { formatSize } from '@/lib/utils';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { files, currentFolder, setCurrentFolder } = useFileStore();
  const { openRightPanel, setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed, activeSection, setActiveSection, starred } = useUIStore();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const closeSidebarOnMobile = () => setSidebarOpen(false);

  const totalStorage = files.reduce((acc, file) => acc + (file.size || 0), 0);
  const totalStorageFormatted = formatSize(totalStorage);

  const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'heic', 'gif', 'bmp', 'tiff'];
  const VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp'];
  const getExt = (name: string) => name?.split('.').pop()?.toLowerCase() ?? '';
  const isImageFile = (f: FileMetadata) => f.hasDocument && (f.mimeType?.startsWith('image/') || IMAGE_EXTS.includes(getExt(f.name)));
  const isVideoFile = (f: FileMetadata) => f.hasDocument && (f.mimeType?.startsWith('video/') || VIDEO_EXTS.includes(getExt(f.name)));

  const images = files.filter(isImageFile).length;
  const videos = files.filter(isVideoFile).length;
  const documents = files.filter(f => f.hasDocument && !isImageFile(f) && !isVideoFile(f)).length;
  const starredCount = starred.length;

  const navItems = [
    { id: 'my-files' as const, label: 'My Files', icon: HardDrive, action: () => { setCurrentFolder('/'); setActiveSection('my-files'); closeSidebarOnMobile(); } },
    { id: 'recent' as const, label: 'Recent', icon: Clock, action: () => { setActiveSection('recent'); closeSidebarOnMobile(); } },
    { id: 'starred' as const, label: 'Starred', icon: Star, action: () => { setActiveSection('starred'); closeSidebarOnMobile(); }, badge: starredCount > 0 ? starredCount : undefined },
  ];

  const userInitial = user?.firstName?.[0]?.toUpperCase() || 'U';

  return (
    <div className={`relative flex flex-col h-full z-10 border-r shrink-0 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[68px]' : 'w-64'}`}
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}>

      {/* Header area */}
      <div className={`flex items-center h-16 shrink-0 border-b ${sidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}
        style={{ borderColor: 'var(--border)' }}>
        {/* Logo icon */}
        <img src="/logo.svg" alt="Cloud Vault" className="w-9 h-9 rounded-xl shadow-lg shrink-0" />
        {/* App name (hidden when collapsed) */}
        {!sidebarCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-[15px] font-bold tracking-tight leading-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Cloud Vault</span>
            <span className="text-[9px] font-semibold text-white rounded px-1.5 py-0.5 self-start leading-none mt-0.5 tracking-wide uppercase" style={{ background: 'var(--accent-rust)' }}>Beta</span>
          </div>
        )}
      </div>

      {/* Collapse toggle button - desktop only */}
      <button
        onClick={toggleSidebarCollapsed}
        className="absolute -right-3 top-[4.25rem] z-20 w-6 h-6 rounded-full hidden md:flex items-center justify-center transition-all duration-200 shadow-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-hint)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-hint)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-3">
        {/* Section label */}
        {!sidebarCollapsed && (
          <p className="px-4 text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-hint)' }}>Navigation</p>
        )}

        <div className="space-y-0.5 px-2">
          {navItems.map(({ id, label, icon: Icon, action, badge }) => (
            <button
              key={id}
              onClick={action}
              title={sidebarCollapsed ? label : undefined}
              className={`w-full flex items-center rounded-xl transition-all duration-150 group relative
                ${sidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2.5'}`}
              style={activeSection === id
                ? { background: 'var(--accent-rust-tint)', color: 'var(--accent-rust)', border: '1px solid var(--accent-rust-border)' }
                : { color: 'var(--text-muted)', border: '1px solid transparent' }}
              onMouseEnter={(e) => { if (activeSection !== id) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
              onMouseLeave={(e) => { if (activeSection !== id) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
            >
              <Icon className={`shrink-0 transition-all ${sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium flex-1 text-left whitespace-nowrap">{label}</span>
              )}
              {!sidebarCollapsed && badge !== undefined && (
                <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none"
                  style={{ background: 'var(--accent-rust-tint)', color: 'var(--accent-rust)' }}>
                  {badge}
                </span>
              )}
              {sidebarCollapsed && badge !== undefined && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--accent-rust)' }} />
              )}
              {/* Active indicator */}
              {activeSection === id && (
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full" style={{ background: 'var(--accent-rust)' }} />
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 mx-4 border-t" style={{ borderColor: 'var(--border)' }} />

        {/* Settings & Feedback & Theme */}
        <div className="space-y-0.5 px-2">
          <button
            onClick={() => { openRightPanel('settings'); closeSidebarOnMobile(); }}
            title={sidebarCollapsed ? 'Settings' : undefined}
            className={`w-full flex items-center rounded-xl transition-all duration-150
              ${sidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2.5'}`}
            style={{ color: 'var(--text-hint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-hint)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Settings className={`shrink-0 ${sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
            {!sidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Settings</span>}
          </button>

          <button
            onClick={() => { setIsFeedbackOpen(true); closeSidebarOnMobile(); }}
            title={sidebarCollapsed ? 'Feedback' : undefined}
            className={`w-full flex items-center rounded-xl transition-all duration-150
              ${sidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2.5'}`}
            style={{ color: 'var(--text-hint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-hint)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <MessageSquare className={`shrink-0 ${sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
            {!sidebarCollapsed && <span className="text-sm font-medium whitespace-nowrap">Feedback</span>}
          </button>

          {/* Theme toggle */}
          <ThemeToggle collapsed={sidebarCollapsed} />
        </div>

        {/* Storage section */}
        {!sidebarCollapsed && (
          <>
            <div className="my-3 mx-4 border-t" style={{ borderColor: 'var(--border)' }} />
            <div className="px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-hint)' }}>Storage</p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>Used</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{totalStorageFormatted}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full w-full" style={{ background: 'var(--text-primary)' }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-hint)' }}>Unlimited via Telegram</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <ImageIcon className="w-3.5 h-3.5" style={{ color: 'var(--accent-rust)' }} /> Images
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{images}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                      <Video className="w-3.5 h-3.5" style={{ color: 'var(--accent-teal)' }} /> Videos
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{videos}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                      <FileText className="w-3.5 h-3.5" style={{ color: 'var(--accent-rust)' }} /> Documents
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{documents}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* User profile footer */}
      <div className={`shrink-0 border-t ${sidebarCollapsed ? 'p-2' : 'p-3'}`} style={{ borderColor: 'var(--border)' }}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          {/* Avatar */}
          {user?.profilePhoto ? (
            <img src={user.profilePhoto} alt={user.firstName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: `linear-gradient(135deg, var(--accent-rust), var(--accent-rust-deep))` }}>
              {userInitial}
            </div>
          )}
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>{user?.firstName} {user?.lastName}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-hint)' }}>@{user?.username || user?.phone}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="shrink-0 w-7 h-7"
                style={{ color: 'var(--text-hint)' }}>
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
