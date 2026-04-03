'use client';

import { useFileStore, FileMetadata } from '@/store/use-file-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import {
  Search, Upload, FolderPlus, RefreshCw, Menu,
  LayoutGrid, List, X, Image as ImageIcon, Video, FileText, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

import { FileUpload } from '@/components/files/file-upload';
import { NewFolderModal } from '@/components/files/new-folder-modal';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { formatSize } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// ── helpers ──────────────────────────────────────────────────────────────────
const IMAGE_EXTS = ['jpg','jpeg','png','webp','avif','svg','heic','gif','bmp','tiff'];
const VIDEO_EXTS = ['mp4','mkv','avi','mov','wmv','flv','webm','m4v','3gp'];
const DOC_EXTS   = ['pdf','doc','docx','ppt','pptx','xls','xlsx','csv','txt','rtf','odt','ods','odp'];
const getExt = (name: string) => name?.split('.').pop()?.toLowerCase() ?? '';
const isImg  = (f: FileMetadata) => f.hasDocument && (f.mimeType?.startsWith('image/') || IMAGE_EXTS.includes(getExt(f.name)));
const isVid  = (f: FileMetadata) => f.hasDocument && (f.mimeType?.startsWith('video/') || VIDEO_EXTS.includes(getExt(f.name)));
const isDoc  = (f: FileMetadata) => f.hasDocument && (
  f.mimeType === 'application/pdf' ||
  f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
  f.mimeType === 'application/msword' ||
  f.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
  f.mimeType === 'application/vnd.ms-powerpoint' ||
  f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
  f.mimeType === 'application/vnd.ms-excel' ||
  f.mimeType?.includes('spreadsheet') ||
  f.mimeType?.includes('presentation') ||
  f.mimeType === 'text/plain' ||
  f.mimeType === 'text/csv' ||
  f.mimeType === 'application/rtf' ||
  DOC_EXTS.includes(getExt(f.name))
);
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
  const documentCount  = files.filter(isDoc).length;

  return (
    <>
      <header
        className="h-14 sm:h-16 flex items-center gap-2 sm:gap-4 px-3 sm:px-4 shrink-0 z-20 border-b"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
      >
        {/* ── Hamburger (mobile only) ── */}
        <Button
          variant="ghost" size="icon"
          className="md:hidden w-9 h-9 shrink-0"
          style={{ color: 'var(--text-hint)' }}
          onClick={toggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* ── Logo (desktop only) ── */}
      <div className="hidden lg:flex items-center gap-2.5 shrink-0">
        <Image src="/logo.svg" alt="Cloud Vault" width={32} height={32} className="w-8 h-8 rounded-xl shadow-md" />
        <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Cloud Vault</span>
      </div>

        {/* ── Mobile search (expanded) ── */}
        {mobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 sm:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" style={{ color: 'var(--text-hint)' }} />
              <input
                type="text" autoFocus
                placeholder="Search in Cloud Vault"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full h-10 pl-9 pr-4 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ color: 'var(--text-hint)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Desktop/tablet search */}
            <div className="flex-1 max-w-2xl mx-auto hidden sm:block">
              <div className={`relative flex items-center transition-all duration-200 ${searchFocused ? 'scale-[1.01]' : ''}`}>
                <Search className="absolute left-4 w-4 h-4 pointer-events-none z-10" style={{ color: 'var(--text-hint)' }} />
                <input
                  type="text"
                  placeholder="Search in Cloud Vault"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="w-full h-10 sm:h-11 pl-11 pr-4 rounded-2xl text-sm outline-none transition-all duration-200"
                  style={{
                    background:  searchFocused ? 'var(--bg-hover)' : 'var(--bg-body)',
                    border:      searchFocused ? '1px solid var(--border-hover)' : '1px solid var(--border)',
                    boxShadow:   searchFocused ? '0 0 0 3px rgba(192,82,42,0.08)' : 'none',
                    color: 'var(--text-primary)',
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 transition-colors" style={{ color: 'var(--text-hint)' }}>
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
                className="sm:hidden w-9 h-9"
                style={{ color: 'var(--text-hint)' }}
                onClick={() => setMobileSearchOpen(true)}
              >
                <Search className="w-4 h-4" />
              </Button>

              {/* Refresh (desktop only) */}
              <Button variant="ghost" size="icon"
                className="hidden sm:flex w-9 h-9"
                style={{ color: 'var(--text-hint)' }}
                onClick={handleSync} disabled={isSyncing} title="Sync files"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>

              {/* View toggle */}
              <div className="flex items-center rounded-lg p-0.5" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                {(['grid','list'] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)} title={`${mode} view`}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150`}
                    style={viewMode === mode
                      ? { background: 'var(--accent-rust)', color: '#fff' }
                      : { color: 'var(--text-hint)' }}
                  >
                    {mode === 'grid' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 mx-0.5 hidden sm:block" style={{ background: 'var(--border)' }} />

              {/* New Folder */}
              <Button variant="ghost" size="icon"
                className="w-9 h-9 sm:hidden"
                style={{ color: 'var(--text-hint)' }}
                onClick={() => setIsNewFolderOpen(true)} title="New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm"
                className="hidden sm:flex h-9 gap-2 px-3 text-sm font-medium"
                style={{ color: 'var(--text-hint)' }}
                onClick={() => setIsNewFolderOpen(true)}
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden md:inline">New Folder</span>
              </Button>


              {/* Upload */}
              <Button size="sm"
                className="h-9 gap-1.5 px-3 sm:px-4 font-semibold text-sm text-white"
                style={{ background: 'var(--accent-rust)', boxShadow: '0 2px 8px rgba(192, 82, 42, 0.15)' }}
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>

              <div className="w-px h-5 mx-0.5" style={{ background: 'var(--border)' }} />

              {/* ── Avatar — mobile only ── */}
              <div ref={profileRef} className="relative sm:hidden">
                <button
                  onClick={() => setProfileOpen(p => !p)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer transition-all shadow-md shrink-0 ${
                    profileOpen ? 'ring-2 ring-offset-1' : 'hover:opacity-90'
                  } ${!authUser?.profilePhoto ? '' : ''}`}
                  style={{
                    ...(!authUser?.profilePhoto ? { background: `linear-gradient(135deg, var(--accent-rust), var(--accent-rust-deep))` } : {}),
                    ...(profileOpen ? { ringColor: 'var(--accent-rust)', ringOffsetColor: 'var(--bg-card)' } : {}),
                  }}
                  title={`${authUser?.firstName} ${authUser?.lastName}`}
                >
                  {authUser?.profilePhoto ? (
                    <Image src={authUser.profilePhoto} alt={authUser.firstName || 'User'} width={32} height={32} className="w-full h-full rounded-full object-cover" unoptimized />
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
                      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 shadow-lg`}
                          style={!authUser?.profilePhoto ? { background: `linear-gradient(135deg, var(--accent-rust), var(--accent-rust-deep))` } : {}}>
                          {authUser?.profilePhoto ? (
                            <Image src={authUser.profilePhoto} alt={authUser.firstName || 'User'} width={44} height={44} className="w-full h-full rounded-full object-cover" unoptimized />
                          ) : (
                            userInitial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                            {authUser?.firstName} {authUser?.lastName}
                          </p>
                          <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-hint)' }}>
                            @{authUser?.username || authUser?.phone}
                          </p>
                        </div>
                        <button
                          onClick={() => { logout(); setProfileOpen(false); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all shrink-0"
                          style={{ color: 'var(--text-hint)' }}
                          title="Log out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Storage */}
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-hint)' }}>Storage</p>

                        {/* Bar */}
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: 'var(--text-muted)' }}>Used</span>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatSize(totalStorage)}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full w-full" style={{ background: 'var(--text-primary)' }} />
                        </div>
                        <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-hint)' }}>Unlimited via Telegram</p>
                      </div>

                      {/* File type breakdown */}
                      <div className="px-4 py-3 space-y-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-hint)' }}>File Types</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-rust-tint)' }}>
                              <ImageIcon className="w-3.5 h-3.5" style={{ color: 'var(--accent-rust)' }} />
                            </div>
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Images</span>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{imageCount}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-teal-tint)' }}>
                              <Video className="w-3.5 h-3.5" style={{ color: 'var(--accent-teal)' }} />
                            </div>
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Videos</span>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{videoCount}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-rust-tint)' }}>
                              <FileText className="w-3.5 h-3.5" style={{ color: 'var(--accent-rust)' }} />
                            </div>
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Documents</span>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{documentCount}</span>
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
