import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthHeader } from '@/components/AuthHeader';
import './globals.css';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500'] });

export const metadata: Metadata = {
  title: 'Minimalist Quiz Experience',
  description: 'IAA 标注问卷',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} bg-[#F9FAFB] text-[#111827]`}>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <AuthHeader />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
