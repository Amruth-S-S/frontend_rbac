'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import i18n from '../i18n';

export type SupportedLanguage = 'en' | 'de' | 'ar';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English',        nativeLabel: 'English',  flag: '🇬🇧', dir: 'ltr' },
  { code: 'de', label: 'German',         nativeLabel: 'Deutsch',  flag: '🇩🇪', dir: 'ltr' },
  { code: 'ar', label: 'Arabic',         nativeLabel: 'العربية',  flag: '🇸🇦', dir: 'rtl' },
];

interface LanguageContextValue {
  language: SupportedLanguage;
  changeLanguage: (lang: SupportedLanguage) => void;
  currentOption: LanguageOption;
  options: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  changeLanguage: () => {},
  currentOption: LANGUAGE_OPTIONS[0],
  options: LANGUAGE_OPTIONS,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguage>('en');

  // Initialise from localStorage on first mount
  useEffect(() => {
    const saved = localStorage.getItem('appLanguage') as SupportedLanguage | null;
    if (saved && LANGUAGE_OPTIONS.some((o) => o.code === saved)) {
      applyLanguage(saved);
      setLanguage(saved);
    }
  }, []);

  const applyLanguage = useCallback((lang: SupportedLanguage) => {
    // 1. Switch i18next (text translations only — layout stays LTR always)
    i18n.changeLanguage(lang);

    // 2. Persist choice
    localStorage.setItem('appLanguage', lang);

    // NOTE: We intentionally do NOT change dir/direction on <html> or <body>.
    // That would flip the entire layout (sidebar, flex rows, etc.).
    // Only the translated text content changes.
  }, []);

  const changeLanguage = useCallback(
    (lang: SupportedLanguage) => {
      setLanguage(lang);
      applyLanguage(lang);
    },
    [applyLanguage],
  );

  const currentOption =
    LANGUAGE_OPTIONS.find((o) => o.code === language) ?? LANGUAGE_OPTIONS[0];

  return (
    <LanguageContext.Provider
      value={{ language, changeLanguage, currentOption, options: LANGUAGE_OPTIONS }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
