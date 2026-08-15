import Link from 'next/link';
import { formatTashkentDate } from '@/lib/due-date';
import { getMessages } from '@/lib/i18n/messages';
import { getSession } from '@/server/auth/require-admin';
import { findUserLocale } from '@/server/repositories/user-repository';
import { pickMostUrgentPart } from '@/server/services/dashboard';
import { getMyFilterView } from '@/server/services/my-filter';
import styles from './home.module.css';

/**
 * Mini App dashboardi (§7 dagi 8-band, §3).
 *
 * Banner va katalogga o'tish — dastlabki g'oyadagidek. Lekin «o'z-o'zidan
 * to'ladigan» modul shkalalari YO'Q: ular ongli ravishda rad etilgan.
 * Ularning o'rnida mijozning HAQIQIY kartriji turadi — va agar o'rnatish
 * qayd etilmagan bo'lsa, blok umuman ko'rsatilmaydi.
 *
 * Menyuda faqat amalga oshirilgan bo'limlar (§3 — «tez orada» yo'q).
 */
export const dynamic = 'force-dynamic';

export default async function MiniAppHomePage() {
  const session = await getSession();
  const locale = session ? await findUserLocale(session.userId) : 'uz';
  const t = getMessages(locale);

  const installations = session ? await getMyFilterView(session.userId, locale) : [];
  const urgent = pickMostUrgentPart(installations);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>{t.heroTitle}</h1>
        <p className={styles.tagline}>{t.heroLead}</p>
      </section>

      {urgent && (
        <Link
          href="/app/mening-filtrim"
          className={styles.urgent}
          data-state={urgent.part.progress.state}
        >
          <span className={styles.urgentLabel}>
            {urgent.part.progress.state === 'OK' ? t.homeAllGood : t.homeAttention}
          </span>
          <span className={styles.urgentName}>
            {urgent.part.cartridgeName} · {urgent.installation.filterName}
          </span>
          <span className={styles.urgentDue}>
            {t.myFilterDue}: {formatTashkentDate(urgent.part.dueAt)} ·{' '}
            {urgent.part.progress.daysLeft > 0
              ? `${urgent.part.progress.daysLeft} ${t.daysLeft}`
              : urgent.part.progress.daysLeft === 0
                ? t.dueToday
                : `${-urgent.part.progress.daysLeft} ${t.daysOverdue}`}
          </span>
        </Link>
      )}

      <nav className={styles.nav}>
        <Link href="/app/mening-filtrim" className={styles.link}>
          {t.homeOpenMyFilter}
        </Link>
        <Link href={`/${locale}/filtrlar`} className={styles.link}>
          {t.navFilters}
        </Link>
        <Link href={`/${locale}/kartrijlar`} className={styles.link}>
          {t.navCartridges}
        </Link>
      </nav>
    </main>
  );
}
