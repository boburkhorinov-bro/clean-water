'use client';

import { useEffect } from 'react';
import { THEME_STORAGE_KEY, resolveTheme } from '@/lib/theme';

/**
 * Mini App da mavzuni Telegram dan oladi (§3).
 *
 * Brending saqlanadi: biz Telegram ning ranglarini ko'chirmaymiz, faqat
 * `light`/`dark` tanlovini olamiz va o'z palitramizni qo'llaymiz. Aks holda
 * ilova har bir foydalanuvchida boshqacha ko'rinardi.
 */

interface TelegramWebApp {
  colorScheme?: string;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  ready?: () => void;
  expand?: () => void;
}

function telegramApp(): TelegramWebApp | null {
  const candidate = (globalThis as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  return candidate ?? null;
}

export function TelegramTheme() {
  useEffect(() => {
    const app = telegramApp();
    app?.ready?.();
    app?.expand?.();

    function apply() {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const system = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      const theme = resolveTheme({
        stored,
        telegram: telegramApp()?.colorScheme ?? null,
        system,
      });

      document.documentElement.dataset.theme = theme;
    }

    apply();

    // Foydalanuvchi Telegram ichida mavzuni almashtirsa, ilova ham o'zgaradi.
    app?.onEvent?.('themeChanged', apply);
    return () => app?.offEvent?.('themeChanged', apply);
  }, []);

  return null;
}
