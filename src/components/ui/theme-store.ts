'use client';

import { THEME_STORAGE_KEY, type Theme, resolveTheme } from '@/lib/theme';

/**
 * Mavzu — React dan tashqaridagi holat: u `localStorage` da va `matchMedia`
 * da yashaydi. Shuning uchun `useState` + `useEffect` emas, tashqi store:
 * effekt ichida `setState` chaqirish kaskadli renderlarga olib keladi va
 * React 19 buni xato deb hisoblaydi.
 */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeTheme(callback: () => void): () => void {
  listeners.add(callback);

  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', callback);
  // Boshqa yorliqda o'zgartirilsa ham ergashamiz.
  globalThis.addEventListener?.('storage', callback);

  return () => {
    listeners.delete(callback);
    media?.removeEventListener('change', callback);
    globalThis.removeEventListener?.('storage', callback);
  };
}

/** Primitiv qaytaradi — React uni qiymat bo'yicha solishtiradi. */
export function getThemeSnapshot(): Theme {
  return resolveTheme({
    stored: globalThis.localStorage?.getItem(THEME_STORAGE_KEY) ?? null,
    telegram: null,
    system: globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  });
}

/** Serverda mavzu noma'lum — komponent bu holatda joy egallab turadi. */
export function getThemeServerSnapshot(): null {
  return null;
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
  // `storage` hodisasi o'z yorlig'ida ishlamaydi — o'zimiz xabar beramiz.
  emit();
}
