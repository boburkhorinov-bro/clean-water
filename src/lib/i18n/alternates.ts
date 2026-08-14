import { LOCALES, type Locale } from './locales';

export interface Alternates {
  canonical: string;
  languages: Record<Locale, string>;
}

/** Yo'l boshidagi til prefiksini olib tashlaydi, agar bo'lsa. */
function stripLocale(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  for (const locale of LOCALES) {
    if (normalized === `/${locale}`) return '';
    if (normalized.startsWith(`/${locale}/`)) return normalized.slice(locale.length + 1);
  }
  return normalized === '/' ? '' : normalized;
}

function absolute(baseUrl: string, locale: Locale, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${locale}${path}`;
}

/**
 * §4.7 — kanonik havola va `hreflang` to'plami.
 *
 * Har bir til alohida URL da yashaydi, shuning uchun kanonik havola doim
 * joriy tilnikini ko'rsatadi, `languages` esa qidiruv tizimiga qolgan
 * variantlarni bildiradi.
 */
export function buildAlternates(path: string, locale: Locale, baseUrl: string): Alternates {
  const cleanPath = stripLocale(path);

  const languages = Object.fromEntries(
    LOCALES.map((candidate) => [candidate, absolute(baseUrl, candidate, cleanPath)]),
  ) as Record<Locale, string>;

  return {
    canonical: absolute(baseUrl, locale, cleanPath),
    languages,
  };
}
