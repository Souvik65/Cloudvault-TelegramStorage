import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Cloud Vault',
  description: 'Telegram-powered Cloud Storage',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" data-theme="dark">
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
