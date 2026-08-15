import Link from 'next/link';
import { getMessages } from '@/lib/i18n/messages';
import styles from './home.module.css';

/**
 * Mini App bosh ekrani.
 *
 * Menyuda faqat amalga oshirilgan bo'limlar (§3 — «tez orada» zaglushkalari
 * yo'q). Til bu yerda o'zbekcha: sessiyasiz foydalanuvchining tilini bilmaymiz,
 * ichkarida esa u profildan olinadi (§4.7).
 */
export default function MiniAppHomePage() {
  const t = getMessages('uz');

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t.brand}</h1>
      <p className={styles.tagline}>{t.tagline}</p>

      <nav className={styles.nav}>
        <Link href="/app/mening-filtrim" className={styles.link}>
          {t.myFilterTitle}
        </Link>
        <Link href="/uz/filtrlar" className={styles.link}>
          {t.navFilters}
        </Link>
        <Link href="/uz/kartrijlar" className={styles.link}>
          {t.navCartridges}
        </Link>
      </nav>
    </main>
  );
}
