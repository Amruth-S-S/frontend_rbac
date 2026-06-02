import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
   viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  title: 'OneVega',
  description: 'OneVega AI Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        
        <ClientLayout>{children}</ClientLayout>
           {/* <Layout>{children}</Layout> */}
      </body>
    </html>
  );
}
