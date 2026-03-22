import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'CredTransfer - Jimma University',
    template: '%s | CredTransfer',
  },
  description: 'Blockchain-based Academic Credential Verification and Transfer System for Jimma University, Ethiopia',
  keywords: ['academic credentials', 'blockchain', 'verification', 'Jimma University', 'Ethiopia', 'diploma', 'transcript'],
  authors: [{ name: 'Jimma University' }],
  themeColor: '#1a1a2e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
