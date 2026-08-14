'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES, type Locale } from '@/lib/i18n/locales';
import styles from './LanguageSwitcher.module.css';

/**
 * Til almashtirish (§4.7).
 *
 * Manzil ham o'zgaradi: `/uz/katalog` → `/ru/katalog`. Bu majburiy, chunki
 * har bir til alohida URL da indekslanadi. Shuning uchun bu `<Link>`,
 * tugma emas — qidiruv roboti ham, foydalanuvchi ham ikkinchi versiya
 * mavjudligini ko'radi.
 */
export function LanguageSwitcher({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Record<Locale, string>;
}) {
  const pathname = usePathname();

  function hrefFor(target: Locale): string {
    if (!pathname) return `/${target}`;
    // Faqat birinchi segment almashadi — qolgan yo'l saqlanadi.
    const rest = pathname.replace(new RegExp(`^/(${LOCALES.join('|')})(?=/|$)`), '');
    return `/${target}${rest}`;
  }

  return (
    <div className={styles.group}>
      {LOCALES.map((candidate) => (
        <Link
          key={candidate}
          href={hrefFor(candidate)}
          className={candidate === locale ? styles.active : styles.item}
          hrefLang={candidate}
          aria-current={candidate === locale ? 'true' : undefined}
          title={labels[candidate]}
        >
          {candidate.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
