'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import { LoginForm } from '@/components/auth/login-form';
import { FileList } from '@/components/files/file-list';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { RightPanel } from '@/components/layout/right-panel';
import { SettingsPanel } from '@/components/settings/settings-panel';
import { FileDetailsPanel } from '@/components/files/file-details-panel';
import { Toaster } from 'sonner';

export default function Home() {
  const { sessionString, user, setUser, logout } = useAuthStore();
  const { rightPanelOpen, closeRightPanel, sidebarOpen, setSidebarOpen } = useUIStore();

  useEffect(() => {
    if (sessionString && !user) {
      fetch('/api/tg/user', {
        headers: { 'x-tg-session': sessionString },
      })
        .then(async (res) => {
          const data = await res.json();
          if (!data.error) {
            setUser(data);
          } else if (res.status === 401) {
            logout();
          }
        })
        .catch((err) => {
          console.error('Failed to fetch user:', err);
        });
    }
  }, [sessionString, user, setUser, logout]);

  const rightPanelTitle = rightPanelOpen === 'settings' ? 'Settings' : rightPanelOpen === 'file-details' ? 'File Details' : '';

  if (!sessionString) {
    return (
      <main className="min-h-dvh bg-[#17212B] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <LoginForm />
        </motion.div>
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: '#242F3D',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#fff',
            },
          }}
        />
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-[#17212B] overflow-hidden">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative h-screen md:h-full z-40 md:z-auto transition-transform duration-300`}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <FileList />
        </main>
      </div>

      {/* Right panel */}
      <RightPanel
        isOpen={!!rightPanelOpen}
        onClose={closeRightPanel}
        title={rightPanelTitle}
      >
        {rightPanelOpen === 'settings' && <SettingsPanel />}
        {rightPanelOpen === 'file-details' && <FileDetailsPanel />}
      </RightPanel>

      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: '#242F3D',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}
