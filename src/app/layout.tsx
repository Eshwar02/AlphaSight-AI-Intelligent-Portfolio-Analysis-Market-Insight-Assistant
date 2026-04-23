import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'AlphaSight AI',
  description:
    'AI-powered stock analysis assistant. Get real-time insights, portfolio tracking, and market intelligence.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans bg-dark-900 text-gray-300 dark:bg-dark-900 light:bg-white light:text-gray-900`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
