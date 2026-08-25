import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3001'),
  title: '游民 - 在OPC城市寻找志同道合的人,一人公司创业',
  description: '游民是一个以OPC城市为核心的AI垂直社区，连接全国694个城市的一人公司创业者，提供社区交流、城市活动与知识分享。',
  alternates: { canonical: '/' },
  openGraph: {
    title: '游民 - 在OPC城市寻找志同道合的人',
    description: '以全国694个OPC城市为核心，为一人公司创业者提供社区交流、城市活动与知识分享。',
    url: '/',
    siteName: '游民',
    locale: 'zh_CN',
    type: 'website',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: '游民 OPC 城市创业者社区' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '游民 - 在OPC城市寻找志同道合的人',
    description: '一人公司创业者的 AI 垂直社区。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
