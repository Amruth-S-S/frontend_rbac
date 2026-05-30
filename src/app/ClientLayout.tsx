'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './components/Sidebar';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { LanguageProvider } from './context/LanguageContext';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/';
  const isConsultantPage = pathname === '/consultant' || pathname === '/Consultant';
  const isCXOPage = pathname === '/cxo' || pathname === '/CXO';

  useEffect(() => {
    // console.log('Current pathname:', pathname);
  }, [pathname, isConsultantPage, isCXOPage]);

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageProvider>
        <div className="flex h-screen">
          {!isLoginPage && !isConsultantPage && !isCXOPage && (
            <Sidebar clientUserId={''} />
          )}
          <div className="w-full overflow-auto">{children}</div>
        </div>
      </LanguageProvider>
    </I18nextProvider>
  );
}
