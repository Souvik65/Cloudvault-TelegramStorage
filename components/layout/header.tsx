'use client';

import { useFileStore, FileMetadata } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import {
  Search, Upload, FolderPlus, RefreshCw, Menu,
  LayoutGrid, List, X, Image as ImageIcon, Video, FileText, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/files/file-upload';
import { NewFolderModal } from '@/components/files/new-folder-modal';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { formatSize } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// ── helpers ──────────────────────────────────────────────────────────────────
const IMAGE_EXTS = ['jpg','jpeg','png','webp','avif','svg','heic','gif','bmp','tiff'];
const VIDEO_EXTS = ['mp4','mkv','avi','mov','wmv','flv','webm','m4v','3gp'];
const getExt = (name: string) => name?.split('.').pop()?.toLowerCase() ?? '';
const isImg  = (f: FileMetadata) => f.hasDocument && (f.mimeType?.startsWith('image/') || IMAGE_EXTS.includes(getExt(f.name)));
const isVid  = (f: FileMetadata) => f.hasDocument && (f.mimeType?.startsWith('video/') || VIDEO_EXTS.includes(getExt(f.name)));
// ─────────────────────────────────────────────────────────────────────────────

export function Header() {
  const { searchQuery, setSearchQuery, storageChannelId, setFiles, setLoading, files } = useFileStore();
  const { sessionString, user: authUser, logout } = useAuthStore();
  const { toggleSidebar, viewMode, setViewMode } = useUIStore();

  const [isUploadOpen,    setIsUploadOpen]    = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isSyncing,       setIsSyncing]       = useState(false);
  const [searchFocused,   setSearchFocused]   = useState(false);
  const [mobileSearchOpen,setMobileSearchOpen]= useState(false);
  const [profileOpen,     setProfileOpen]     = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleSync = async () => {
    setIsSyncing(true); setLoading(true);
    try {
      const res  = await fetch(`/api/tg/files?channelId=${storageChannelId}`, { headers: { 'x-tg-session': sessionString! } });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFiles(data.files);
      toast.success('Files synced successfully');
    } catch (err: any) { toast.error('Failed to sync files: ' + err.message); }
    finally { setIsSyncing(false); setLoading(false); }
  };

  const userInitial    = authUser?.firstName?.[0]?.toUpperCase() || 'U';
  const totalStorage   = files.reduce((s, f) => s + (f.size || 0), 0);
  const imageCount     = files.filter(isImg).length;
  const videoCount     = files.filter(isVid).length;
  const documentCount  = files.filter(f => f.hasDocument && !isImg(f) && !isVid(f)).length;

  return (
    <>
      <header
        className="h-14 sm:h-16 flex items-center gap-2 sm:gap-4 px-3 sm:px-4 shrink-0 z-20 border-b"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}
      >
        {/* ── Hamburger (mobile only) ── */}
        <Button
          variant="ghost" size="icon"
          className="md:hidden text-white/50 hover:text-white hover:bg-white/[0.06] w-9 h-9 shrink-0"
          onClick={toggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* ── Logo (desktop only) ── */}
      <div className="hidden lg:flex items-center gap-2.5 shrink-0">
        <img src="/logo.svg" alt="Cloud Vault" className="w-8 h-8 rounded-xl shadow-md" />
        <span className="text-[15px] font-bold text-white/90 tracking-tight">Cloud Vault</span>
      </div>

        {/* ── Mobile search (expanded) ── */}
        {mobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 sm:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
              <input
                type="text" autoFocus
                placeholder="Search in Cloud Vault"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full h-10 pl-9 pr-4 rounded-xl text-sm text-white placeholder:text-white/55 outline-none"
                style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(219,219,219,0.4)' }}
              />
            </div>
            <button
              onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
              className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Desktop/tablet search */}
            <div className="flex-1 max-w-2xl mx-auto hidden sm:block">
              <div className={`relative flex items-center transition-all duration-200 ${searchFocused ? 'scale-[1.01]' : ''}`}>
                <Search className="absolute left-4 w-4 h-4 text-white/40 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search in Cloud Vault"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="w-full h-10 sm:h-11 pl-11 pr-4 rounded-2xl text-sm text-white placeholder:text-white/55 outline-none transition-all duration-200"
                  style={{
                    background:  searchFocused ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.06)',
                    border:      searchFocused ? '1px solid rgba(219,219,219,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    boxShadow:   searchFocused ? '0 0 0 3px rgba(219,219,219,0.08)' : 'none',
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 text-white/30 hover:text-white/70 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile spacer */}
            <div className="flex-1 sm:hidden" />

            {/* ── Right action bar ── */}
            <div className="flex items-center gap-1 shrink-0">

              {/* Mobile search icon */}
              <Button variant="ghost" size="icon"
                className="sm:hidden w-9 h-9 text-white/50 hover:text-white hover:bg-white/[0.06]"
                onClick={() => setMobileSearchOpen(true)}
              >
                <Search className="w-4 h-4" />
              </Button>

              {/* Refresh (desktop only) */}
              <Button variant="ghost" size="icon"
                className="hidden sm:flex w-9 h-9 text-white/40 hover:text-white hover:bg-white/[0.06]"
                onClick={handleSync} disabled={isSyncing} title="Sync files"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>

              {/* View toggle */}
              <div className="flex items-center bg-white/[0.05] border border-white/[0.08] rounded-lg p-0.5">
                {(['grid','list'] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)} title={`${mode} view`}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 ${
                      viewMode === mode ? 'bg-[#DBDBDB]/20 text-[#DBDBDB]' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {mode === 'grid' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-white/[0.08] mx-0.5 hidden sm:block" />

              {/* New Folder */}
              <Button variant="ghost" size="icon"
                className="w-9 h-9 text-white/60 hover:text-white hover:bg-white/[0.06] sm:hidden"
                onClick={() => setIsNewFolderOpen(true)} title="New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm"
                className="hidden sm:flex h-9 gap-2 px-3 text-white/60 hover:text-white hover:bg-white/[0.06] text-sm font-medium"
                onClick={() => setIsNewFolderOpen(true)}
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden md:inline">New Folder</span>
              </Button>


              {/* Upload */}
              <Button size="sm"
                className="h-9 gap-1.5 px-3 sm:px-4 font-semibold text-sm"
                style={{ background: 'var(--accent)', color: 'var(--bg-panel)', boxShadow: '0 2px 12px rgba(0,0,0,0.20)' }}
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>

              <div className="w-px h-5 bg-white/[0.08] mx-0.5" />

              {/* ── Avatar — mobile only ── */}
              <div ref={profileRef} className="relative sm:hidden">
                <button
                  onClick={() => setProfileOpen(p => !p)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer transition-all shadow-md shrink-0 ${
                    profileOpen ? 'ring-2 ring-[#DBDBDB]/60 ring-offset-1 ring-offset-[#3B3B3B]' : 'hover:opacity-90'
                  } ${!authUser?.profilePhoto ? 'bg-gradient-to-br from-[#DBDBDB] to-[#C4C4C4]' : ''}`}
                  title={`${authUser?.firstName} ${authUser?.lastName}`}
                >
                  {authUser?.profilePhoto ? (
                    <img src={authUser.profilePhoto} alt={authUser.firstName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </button>

                {/* ── Mobile profile dropdown (sm:hidden) ── */}
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="sm:hidden absolute right-0 top-11 w-72 rounded-2xl border shadow-2xl overflow-hidden z-50"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* User info */}
                      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/[0.07]">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 shadow-lg ${!authUser?.profilePhoto ? 'bg-gradient-to-br from-[#DBDBDB] to-[#C4C4C4]' : ''}`}>
                          {authUser?.profilePhoto ? (
                            <img src={authUser.profilePhoto} alt={authUser.firstName} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            userInitial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-white truncate leading-tight">
                            {authUser?.firstName} {authUser?.lastName}
                          </p>
                          <p className="text-[12px] text-white/40 truncate mt-0.5">
                            @{authUser?.username || authUser?.phone}
                          </p>
                        </div>
                        <button
                          onClick={() => { logout(); setProfileOpen(false); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-[#ff6a3d] hover:bg-[#ff6a3d]/10 transition-all shrink-0"
                          title="Log out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Storage */}
                      <div className="px-4 py-3 border-b border-white/[0.07]">
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2.5">Storage</p>

                        {/* Bar */}
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/40">Used</span>
                          <span className="font-semibold text-[#DBDBDB]">{formatSize(totalStorage)}</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#DBDBDB] to-[#C4C4C4] rounded-full w-full" />
                        </div>
                        <p className="text-[10px] text-white/25 mt-1.5">Unlimited via Telegram</p>
                      </div>

                      {/* File type breakdown */}
                      <div className="px-4 py-3 space-y-2.5">
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">File Types</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#DBDBDB]/10 flex items-center justify-center">
                              <ImageIcon className="w-3.5 h-3.5 text-[#DBDBDB]" />
                            </div>
                            <span className="text-sm text-white/50">Images</span>
                          </div>
                          <span className="text-sm font-semibold text-white/70">{imageCount}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#ff6a3d]/10 flex items-center justify-center">
                              <Video className="w-3.5 h-3.5 text-[#ff6a3d]" />
                            </div>
                            <span className="text-sm text-white/50">Videos</span>
                          </div>
                          <span className="text-sm font-semibold text-white/70">{videoCount}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#f4db7d]/10 flex items-center justify-center">
                              <FileText className="w-3.5 h-3.5 text-[#f4db7d]" />
                            </div>
                            <span className="text-sm text-white/50">Documents</span>
                          </div>
                          <span className="text-sm font-semibold text-white/70">{documentCount}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* end avatar wrapper */}

            </div>
            {/* end right action bar */}
          </>
        )}

        <FileUpload isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
        <NewFolderModal isOpen={isNewFolderOpen} onClose={() => setIsNewFolderOpen(false)} />
      </header>
    </>
  );
}
