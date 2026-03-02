'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/use-auth-store';
import { useFileStore, FileMetadata } from '@/store/use-file-store';
import { useUIStore } from '@/store/use-ui-store';
import { Button } from '@/components/ui/button';
import { FeedbackModal } from '@/components/feedback/feedback-modal';
import { Cloud, HardDrive, LogOut, MessageSquare, Settings, Image as ImageIcon, FileText, Video } from 'lucide-react';
import { formatSize } from '@/lib/utils';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { files, currentFolder, setCurrentFolder } = useFileStore();
  const { openRightPanel, setSidebarOpen } = useUIStore();
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

  return (
    <div className="bg-[#0E1621] w-64 flex flex-col h-full z-10 border-r border-[rgba(255,255,255,0.06)] shrink-0">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]">
        <div className="w-10 h-10 bg-[#2AABEE] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#2AABEE]/20">
          <Cloud className="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Cloud Vault</h1>
          <span className="text-[10px] font-semibold text-[#2AABEE] bg-[#2AABEE]/15 border border-[#2AABEE]/30 rounded px-1.5 py-0.5 self-start leading-none mt-0.5 tracking-wide uppercase">Beta</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
        <div className="space-y-1">
          <Button
            variant={currentFolder === '/' ? 'secondary' : 'ghost'}
            className={`w-full justify-start gap-3 transition-colors ${
              currentFolder === '/'
                ? 'bg-[rgba(42,171,238,0.15)] text-[#2AABEE] hover:bg-[rgba(42,171,238,0.2)]'
                : 'text-[#8B9CAF] hover:text-white hover:bg-[#242F3D]'
            }`}
            onClick={() => { setCurrentFolder('/'); closeSidebarOnMobile(); }}
          >
            <HardDrive className={`w-4 h-4 ${currentFolder === '/' ? 'text-[#2AABEE]' : ''}`} />
            My Files
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-[#8B9CAF] hover:text-white hover:bg-[#242F3D]"
            onClick={() => { openRightPanel('settings'); closeSidebarOnMobile(); }}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-[#8B9CAF] hover:text-[#2AABEE] hover:bg-[#2AABEE]/10"
            onClick={() => { setIsFeedbackOpen(true); closeSidebarOnMobile(); }}
          >
            <MessageSquare className="w-4 h-4" />
            Feedback / Report Bug
          </Button>
        </div>

        {/* Storage section */}
        <div>
          <h3 className="text-xs font-semibold text-[#6C7883] uppercase tracking-wider mb-3 px-4">Storage</h3>
          <div className="px-4 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#6C7883]">Used</span>
                <span className="font-medium text-[#8B9CAF]">{totalStorageFormatted}</span>
              </div>
              <div className="h-1.5 bg-[#242F3D] rounded-full overflow-hidden">
                <div className="h-full bg-[#2AABEE] rounded-full" style={{ width: '100%' }} />
              </div>
              <p className="text-xs text-[#6C7883] mt-1">Unlimited with Telegram</p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[#6C7883]">
                  <ImageIcon className="w-4 h-4 text-[#4FC3F7]" /> Images
                </div>
                <span className="font-medium text-[#8B9CAF]">{images}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[#6C7883]">
                  <Video className="w-4 h-4 text-[#AB47BC]" /> Videos
                </div>
                <span className="font-medium text-[#8B9CAF]">{videos}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[#6C7883]">
                  <FileText className="w-4 h-4 text-[#EF5350]" /> Documents
                </div>
                <span className="font-medium text-[#8B9CAF]">{documents}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.06)] bg-[#0B1018]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#2AABEE] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="truncate">
              <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-[#6C7883] truncate">@{user?.username || user?.phone}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="shrink-0 text-[#6C7883] hover:text-[#E53935] hover:bg-[#E53935]/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
