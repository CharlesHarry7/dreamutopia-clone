import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'YouTube Automation AI for Faceless Channels | TaleTok Clone',
  description:
    'Build monetisable long-form YouTube videos and schedule faceless reels for TikTok, Instagram Reels and YouTube Shorts.',
  keywords: ['youtube automation', 'faceless channel', 'ai video', 'youtube shorts', 'tiktok automation'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
