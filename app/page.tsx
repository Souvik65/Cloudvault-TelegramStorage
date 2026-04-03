'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Infinity as InfinityIcon, FolderOpen, Shield, Eye, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/store/use-auth-store';
import { useUIStore } from '@/store/use-ui-store';
import { useThemeStore } from '@/store/use-theme-store';
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
  const { theme } = useThemeStore();

  useEffect(() => {
    if (!sessionString || user) return;
    const controller = new AbortController();
    fetch('/api/tg/user', {
      headers: { 'x-tg-session': sessionString },
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!data.error) { setUser(data); }
        else if (res.status === 401) { logout(); }
      })
      .catch((err) => { if (err.name !== 'AbortError') console.error('Failed to fetch user:', err); });
    return () => controller.abort();
  }, [sessionString, user, setUser, logout]);

  const rightPanelTitle = rightPanelOpen === 'settings' ? 'Settings' : rightPanelOpen === 'file-details' ? 'File Details' : '';

  // Landing page state
  const [showScrollHint, setShowScrollHint] = useState(true);
  const loginSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionString) return;
    window.scrollTo(0, 0);
    const onScroll = () => { if (window.scrollY > 80) setShowScrollHint(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sessionString]);

  const scrollToLogin = () => {
    setShowScrollHint(false);
    loginSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!sessionString) {
    const features = [
      { icon: InfinityIcon, color: 'var(--accent-rust)', title: 'Unlimited Storage', desc: 'There is no storage cap. Store as much as you want, completely free.' },
      { icon: FolderOpen,   color: 'var(--accent-teal)', title: 'Folder Organisation', desc: 'Create nested folders and keep all your files neatly structured.' },
      { icon: Shield,       color: 'var(--accent-rust)', title: 'Private & Secure', desc: 'Files live in your own Telegram account. Only you have access.' },
      { icon: Eye,          color: 'var(--accent-teal)', title: 'Preview & Download', desc: 'Instantly preview images, videos, PDFs, and Word documents.' },
    ];

    return (
      <main className="min-h-dvh flex flex-col lg:flex-row relative overflow-x-hidden" style={{ background: 'var(--bg-body)' }}>
        {/* Animated background blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(192,82,42,0.08) 0%, transparent 70%)', top: '-10%', left: '-10%' }}
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(42,124,111,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-5%' }}
            animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          />
          <motion.div
            className="absolute w-[300px] h-[300px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(192,82,42,0.06) 0%, transparent 70%)', top: '50%', left: '50%', translateX: '-50%', translateY: '-50%' }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)`,
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        {/* LEFT — Hero + features */}
        <div className="relative z-10 min-h-dvh lg:min-h-0 flex-1 flex flex-col justify-center px-8 py-16 lg:px-16 lg:py-20">
          <motion.div className="flex items-center gap-3 mb-10" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
            <img src="/logo.svg" alt="Cloud Vault" className="w-12 h-12 rounded-2xl shadow-lg" style={{ boxShadow: '0 4px 12px rgba(192,82,42,0.2)' }} />
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>Cloud Vault</span>
              <span className="text-[10px] font-semibold text-white rounded px-1.5 py-0.5 self-start leading-none mt-1 tracking-wide uppercase"
                style={{ background: 'var(--accent-rust)', border: '1px solid rgba(192,82,42,0.3)' }}>Beta</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08, ease: 'easeOut' }}>
            <h2 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-4" style={{ color: 'var(--text-primary)' }}>
              Unlimited Cloud Storage,<br />
              <span style={{ color: 'var(--accent-rust)' }}>Powered by Telegram</span>
            </h2>
            <p className="text-base lg:text-lg mb-10 max-w-lg leading-relaxed" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
              Use your Telegram account as a free, unlimited cloud drive. Organise files into folders, preview them instantly, and access everything from any device — no subscriptions, no limits.
            </p>
          </motion.div>

          <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.18, ease: 'easeOut' }}>
            {features.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="rounded-xl p-4 backdrop-blur-sm border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: '0 1px 3px var(--shadow-color)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', opacity: 0.75 }}>{desc}</p>
              </div>
            ))}
          </motion.div>

          <AnimatePresence>
            {showScrollHint && (
              <motion.button
                onClick={scrollToLogin}
                className="fixed top-[62%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 lg:hidden flex flex-col items-center gap-2 cursor-pointer group"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.9, duration: 0.45 }} aria-label="Scroll to login form"
              >
                <span className="px-6 py-3 rounded-full backdrop-blur-md text-sm font-semibold transition-colors shadow-lg"
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-hover)', color: 'var(--accent-rust)', boxShadow: '0 4px 16px var(--shadow-lg)' }}>
                  Login
                </span>
                <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}>
                  <ChevronDown className="w-5 h-5" style={{ color: 'var(--accent-rust)' }} />
                </motion.div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT — Login form */}
        <div ref={loginSectionRef} className="relative z-10 min-h-dvh lg:min-h-0 flex items-center w-full justify-center px-4 py-12 lg:w-1/2 xl:w-[500px] lg:shrink-0 lg:py-0">
          <LoginForm embedded />
        </div>

        <Toaster richColors theme={theme} toastOptions={{ style: { border: '1px solid var(--border)' } }} />
      </main>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: 'var(--bg-body)' }}>
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 md:hidden"
            style={{ background: 'var(--backdrop-blur)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative h-dvh md:h-full z-40 md:z-auto transition-transform duration-300 ease-in-out`}>
        <Sidebar />
      </div>

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          <FileList />
        </main>
      </div>

      {/* Right panel (settings / file details) */}
      <RightPanel
        isOpen={!!rightPanelOpen}
        onClose={closeRightPanel}
        title={rightPanelTitle}
      >
        {rightPanelOpen === 'settings' && <SettingsPanel />}
        {rightPanelOpen === 'file-details' && <FileDetailsPanel />}
      </RightPanel>

      <Toaster richColors theme={theme} toastOptions={{ style: { border: '1px solid var(--border)' } }} />
    </div>
  );
}
