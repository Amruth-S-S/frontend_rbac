import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/translate
 * Body: { texts: string[], targetLang: string, sourceLang?: string }
 * Returns: { translations: string[] }
 *
 * Makes individual requests per text (free Google Translate endpoint only
 * translates one `q` reliably). Runs up to CONCURRENCY requests in parallel.
 */

const CONCURRENCY = 6; // parallel requests per batch

async function translateOne(
  text: string,
  targetLang: string,
  sourceLang: string,
): Promise<string> {
  if (!text || !text.trim()) return text;

  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    });

    if (!res.ok) return text;

    const data = await res.json();

    // data[0] = array of [translated_chunk, original_chunk, ...]
    // Concatenate all translated chunks to get the full translation.
    if (Array.isArray(data[0])) {
      const translated = data[0]
        .map((chunk: unknown[]) => (Array.isArray(chunk) ? chunk[0] : ''))
        .filter(Boolean)
        .join('');
      return translated || text;
    }

    return text;
  } catch {
    return text;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { texts, targetLang, sourceLang = 'en' } = body as {
      texts: string[];
      targetLang: string;
      sourceLang?: string;
    };

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ translations: [] });
    }

    if (sourceLang === targetLang) {
      return NextResponse.json({ translations: texts });
    }

    // Translate all texts with limited concurrency
    const translations: string[] = new Array(texts.length);

    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const chunk = texts.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((t) => translateOne(t, targetLang, sourceLang)),
      );
      results.forEach((result, j) => {
        translations[i + j] =
          result.status === 'fulfilled' ? result.value : texts[i + j];
      });
    }

    return NextResponse.json({ translations });
  } catch {
    try {
      const fallback = await req.json().catch(() => ({ texts: [] as string[] }));
      return NextResponse.json({ translations: fallback.texts ?? [] });
    } catch {
      return NextResponse.json({ translations: [] });
    }
  }
}
