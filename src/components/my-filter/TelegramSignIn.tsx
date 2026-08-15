'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';

/**
 * Mini App ning birinchi ochilishida sessiyani oladi (§4.4).
 *
 * Sahifa serverda renderlanadi, sessiya esa cookie da. Ilova birinchi marta
 * ochilganda cookie hali yo'q — `initData` ni faqat brauzerdagi Telegram
 * beradi. Shuning uchun sahifa sessiyasiz ochilsa, shu komponent `initData`
 * ni yuboradi va sahifani yangilaydi.
 *
 * Telegram tashqarisida (oddiy brauzer) `initData` bo'lmaydi — bunda hech
 * narsa qilinmaydi va foydalanuvchi tushuntirish matnini ko'radi.
 */
export function TelegramSignIn({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  const router = useRouter();
  const [tried, setTried] = useState(false);

  useEffect(() => {
    // Butun mantiq asinxron qayta chaqiruvda: effekt tanasida to'g'ridan-to'g'ri
    // `setState` zanjirli renderlarga olib keladi (`react-hooks/set-state-in-effect`).
    void (async () => {
      const initData = (globalThis as { Telegram?: { WebApp?: { initData?: string } } }).Telegram
        ?.WebApp?.initData;

      if (initData) {
        try {
          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          });
          if (response.ok) {
            router.refresh();
            return;
          }
        } catch {
          // Tarmoq uzilgan bo'lishi mumkin — pastdagi matn ko'rsatiladi.
        }
      }

      setTried(true);
    })();
  }, [router]);

  if (!tried) return null;

  return <p>{t.myFilterSignIn}</p>;
}
