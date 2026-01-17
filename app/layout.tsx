import type { Metadata, Viewport } from 'next';
import { Ubuntu } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import './globals.css';

const ubuntu = Ubuntu({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-ubuntu',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export const metadata: Metadata = {
  title: 'myID.africa - Digital Identity Wallet',
  description: 'Secure digital identity wallet with enterprise consent management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'myID.africa',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('myid_theme');
                  var resolved = theme;
                  if (!theme || theme === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.add(resolved);
                  document.documentElement.style.colorScheme = resolved;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${ubuntu.variable} font-sans antialiased bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-white transition-colors`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
