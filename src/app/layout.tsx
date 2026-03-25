import type { Metadata } from 'next';
import { Crimson_Pro, Archivo_Narrow, IBM_Plex_Mono } from 'next/font/google';
import { getServerSession } from 'next-auth';
import './globals.css';
import { Providers } from './providers';
import { authOptions } from '@/lib/auth';

const crimson = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const archivo = Archivo_Narrow({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AHEAD Research Output Tracker - Saint Louis University',
  description: 'Research publication and citation tracking for Saint Louis University departments',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${crimson.variable} ${archivo.variable} ${mono.variable}`}>
      <body className="font-body bg-gray-50 text-gray-900 antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
