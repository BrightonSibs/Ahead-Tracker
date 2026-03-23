import type { Metadata } from 'next';
import { Lora, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AHEAD Research Output Tracker - Saint Louis University',
  description: 'Research publication and citation tracking for SLU AHEAD and HCOR departments',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="font-body bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
