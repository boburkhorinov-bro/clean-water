import Link from 'next/link';
import type { Locale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import styles from './SiteHeader.module.css';

/**
 * Sayt sarlavhasi.
 *
 * §2: amalga oshirilmagan bo'limlar menyuda KO'RSATILMAYDI. Shuning uchun
 * bu yerda faqat ikkita havola bor — servis-markaz, fikrlar va kviz MVP dan
 * tashqarida va ular «tez orada» yozuvi bilan turmaydi.
 */
export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getMessages(locale);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={`/${locale}`} className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.brandName}>{t.brand}</span>
        </Link>

        <nav className={styles.nav} aria-label={t.brand}>
          <Link href={`/${locale}/filtrlar`} className={styles.navLink}>
            {t.navFilters}
          </Link>
          <Link href={`/${locale}/kartrijlar`} className={styles.navLink}>
            {t.navCartridges}
          </Link>
        </nav>

        <div className={styles.actions}>
          <LanguageSwitcher locale={locale} labels={{ uz: t.languageUz, ru: t.languageRu }} />
          <ThemeToggle labels={{ light: t.themeToLight, dark: t.themeToDark }} />
        </div>
      </div>
    </header>
  );
}
