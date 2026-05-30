'use client';

import { useState, useEffect, useRef } from 'react';
import { translateBatch } from '../utils/translateService';
import { useLanguage } from '../context/LanguageContext';

/**
 * useAutoTranslate
 *
 * Automatically translates an array of strings whenever the active language
 * changes. Returns the translated array (or the originals while loading).
 *
 * Usage:
 *   const translated = useAutoTranslate(['Hello', 'World']);
 *   // returns ['مرحبا', 'عالم'] in Arabic
 */
export function useAutoTranslate(texts: string[]): string[] {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<string[]>(texts);

  // Keep a stable ref to avoid re-rendering during the async call
  const textsKey = texts.join('|||');
  const prevKey = useRef('');
  const prevLang = useRef('en');

  useEffect(() => {
    const currentKey = `${language}:${textsKey}`;

    // Skip if nothing changed
    if (currentKey === prevKey.current) return;
    prevKey.current = currentKey;

    if (language === 'en') {
      setTranslated(texts);
      prevLang.current = 'en';
      return;
    }

    // Show originals immediately, then replace with translations
    setTranslated(texts);

    let cancelled = false;
    translateBatch(texts, language).then((result) => {
      if (!cancelled) {
        setTranslated(result);
        prevLang.current = language;
      }
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, textsKey]);

  return translated;
}

/**
 * useAutoTranslateSingle
 *
 * Convenience wrapper for a single string.
 *
 * Usage:
 *   const label = useAutoTranslateSingle('Hello');
 */
export function useAutoTranslateSingle(text: string): string {
  const results = useAutoTranslate([text]);
  return results[0] ?? text;
}
