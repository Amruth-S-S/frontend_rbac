/**
 * translateService.ts
 *
 * Client-side translation cache + batch helper.
 * Calls our own /api/translate endpoint (which proxies Google Translate).
 */

// In-memory cache keyed by "lang:text"
const cache = new Map<string, string>();

/**
 * Translate an array of strings to targetLang.
 * Already-cached results are served instantly; only unknown strings hit the API.
 */
export async function translateBatch(
  texts: string[],
  targetLang: string,
  sourceLang = 'en',
): Promise<string[]> {
  if (!texts.length || targetLang === sourceLang || targetLang === 'en') {
    return texts;
  }

  const results: string[] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  texts.forEach((text, i) => {
    const key = `${targetLang}:${text}`;
    if (cache.has(key)) {
      results[i] = cache.get(key)!;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(text);
    }
  });

  if (uncachedTexts.length > 0) {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: uncachedTexts, targetLang, sourceLang }),
      });

      if (res.ok) {
        const data: { translations: string[] } = await res.json();
        data.translations.forEach((translated, j) => {
          const originalIdx = uncachedIndices[j];
          const key = `${targetLang}:${texts[originalIdx]}`;
          cache.set(key, translated);
          results[originalIdx] = translated;
        });
      } else {
        // Fallback: use originals
        uncachedIndices.forEach((idx) => {
          results[idx] = texts[idx];
        });
      }
    } catch {
      uncachedIndices.forEach((idx) => {
        results[idx] = texts[idx];
      });
    }
  }

  return results;
}

/** Translate a single string. */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = 'en',
): Promise<string> {
  const [result] = await translateBatch([text], targetLang, sourceLang);
  return result ?? text;
}

/** Clear the translation cache (e.g. on language switch if needed). */
export function clearTranslationCache() {
  cache.clear();
}

const LOCALE_MAP: Record<string, string> = { ar: 'ar-SA', de: 'de-DE', en: 'en-US' };

/**
 * Format a numeric string using locale-appropriate numerals and separators.
 * "1486798.5" + 'ar' → "١٬٤٨٦٬٧٩٨٫٥"
 * "1486798.5" + 'de' → "1.486.798,5"
 * Returns the original string if the value is not a number.
 */
export function formatNumber(value: string, language: string): string {
  if (language === 'en') return value;
  const num = Number(value);
  if (isNaN(num)) return value;
  const locale = LOCALE_MAP[language] ?? 'en-US';
  try {
    const decimals = value.includes('.') ? value.split('.')[1].length : 0;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    return value;
  }
}
