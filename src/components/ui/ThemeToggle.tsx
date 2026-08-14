'use client';

import { useSyncExternalStore } from 'react';
import type { Theme } from '@/lib/theme';
import styles from './ThemeToggle.module.css';
import { getThemeServerSnapshot, getThemeSnapshot, setTheme, subscribeTheme } from './theme-store';

/**
 * Qo'lda mavzu almashtirish (§3).
 *
 * Tanlov `localStorage` ga yoziladi va shundan keyin Telegram ham, tizim
 * sozlamasi ham uni bosib keta olmaydi — `resolveTheme` ga qarang.
 */
export function ThemeToggle({ labels }: { labels: { light: string; dark: string } }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  // Server render da mavzu noma'lum — tugma faqat klientda ma'noga ega.
  if (theme === null) {
    return <span className={styles.placeholder} aria-hidden="true" />;
  }

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setTheme(next)}
      aria-label={labels[next]}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
    </button>
  );
}
