import type { Metadata } from 'next';
import { Inter, Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';

const inter = Inter({ subsets: ['latin'] });
// Exposed as CSS variables so just the CXO "Prompts" screen can opt into them
// (font-heading / font-body Tailwind classes) without changing the rest of the app.
const bricolageGrotesque = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-heading' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body' });

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
      <body className={`${inter.className} ${bricolageGrotesque.variable} ${dmSans.variable}`} suppressHydrationWarning>
        
        <ClientLayout>{children}</ClientLayout>
           {/* <Layout>{children}</Layout> */}
      </body>
    </html>
  );
}
