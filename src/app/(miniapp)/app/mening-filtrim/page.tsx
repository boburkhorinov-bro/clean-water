import { PhoneForm } from '@/components/my-filter/PhoneForm';
import { ReplaceButton } from '@/components/my-filter/ReplaceButton';
import { ResourceBar } from '@/components/my-filter/ResourceBar';
import { TelegramSignIn } from '@/components/my-filter/TelegramSignIn';
import { formatTashkentDate } from '@/lib/due-date';
import { getMessages } from '@/lib/i18n/messages';
import { getSession } from '@/server/auth/require-admin';
import { findUserLocale, hasPhone } from '@/server/repositories/user-repository';
import { getMyFilterView } from '@/server/services/my-filter';
import styles from './my-filter.module.css';

/**
 * «Mening filtrim» (§2, §7 dagi 7-band).
 *
 * Har so'rovda serverda quriladi: ma'lumot mijozning shaxsiy holati va u
 * keshlanmaydi. Kim ekani sessiyadan olinadi (§6) — klient yuborgan hech
 * qanday identifikator ishlatilmaydi.
 */
export const dynamic = 'force-dynamic';

export default async function MyFilterPage() {
  const session = await getSession();

  if (!session) {
    // Mini App birinchi ochilishida cookie hali yo'q; klient `initData` bilan
    // sessiya oladi va sahifani yangilaydi.
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{getMessages('uz').myFilterTitle}</h1>
        <TelegramSignIn locale="uz" />
      </main>
    );
  }

  const locale = await findUserLocale(session.userId);
  const t = getMessages(locale);
  const installations = await getMyFilterView(session.userId, locale);
  // §4.5: raqamsiz mijoz almashtirishga ariza qoldira olmaydi. Forma
  // tugmadan OLDIN ko'rsatiladi — mijoz to'siqqa urilishidan oldin.
  const phoneKnown = await hasPhone(session.userId);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.myFilterTitle}</h1>
        <p className={styles.lead}>{t.myFilterLead}</p>
      </header>

      {!phoneKnown && <PhoneForm t={t} />}

      {installations.length === 0 ? (
        <div className={styles.empty}>
          <p>{t.myFilterEmpty}</p>
          <p className={styles.hint}>{t.myFilterEmptyHint}</p>
        </div>
      ) : (
        <ul className={styles.installations}>
          {installations.map((installation) => (
            <li key={installation.id} className={styles.installation}>
              <h2 className={styles.filterName}>{installation.filterName}</h2>

              <dl className={styles.meta}>
                <div className={styles.metaRow}>
                  <dt>{t.myFilterInstalled}</dt>
                  <dd>{formatTashkentDate(installation.installedAt)}</dd>
                </div>
                {installation.address && (
                  <div className={styles.metaRow}>
                    <dt>{t.myFilterAddress}</dt>
                    <dd>{installation.address}</dd>
                  </div>
                )}
              </dl>

              {installation.parts.length === 0 ? (
                <p className={styles.hint}>{t.myFilterNoParts}</p>
              ) : (
                <ul className={styles.parts}>
                  {installation.parts.map((part) => (
                    <li key={part.id} className={styles.part}>
                      <div className={styles.partHead}>
                        <span className={styles.partName}>{part.cartridgeName}</span>
                        <span className={styles.partDue}>
                          {t.myFilterDue}: {formatTashkentDate(part.dueAt)}
                        </span>
                      </div>

                      <ResourceBar progress={part.progress} locale={locale} />

                      {/* Tugma faqat muddat yaqinlashganda: har doim ko'rsatilsa,
                          u yangi kartrijni ham almashtirishga undardi. */}
                      {part.progress.state !== 'OK' && (
                        <ReplaceButton installedPartId={part.id} locale={locale} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
