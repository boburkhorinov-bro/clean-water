import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/catalog/ProductCard';
import { SiteHeader } from '@/components/ui/SiteHeader';
import { buildAlternates } from '@/lib/i18n/alternates';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import { siteUrl } from '@/lib/site';
import { listFilters } from '@/server/services/catalog';
import styles from './home.module.css';

/** Katalog o'zgarganda bosh sahifa ham yangilanadi (katalog sahifalari bilan bir xil). */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const current = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = getMessages(current);

  // §4.7: har bir til alohida URL da indekslanadi, shuning uchun kanonik
  // havola va hreflang to'plami har sahifada aniq ko'rsatiladi.
  return {
    title: `${t.brand} — ${t.tagline}`,
    description: t.heroLead,
    alternates: buildAlternates('/', current, siteUrl()),
    openGraph: { title: t.brand, description: t.heroLead, type: 'website' },
  };
}

/**
 * Sayt bosh sahifasi — Dashboard (§7 dagi 8-band).
 *
 * Dastlabki g'oyadagi «o'z-o'zidan to'ladigan» modul shkalalari YO'Q (§3):
 * ular buzuqlik sifatida qabul qilinadi. Uning o'rniga katalogdagi haqiqiy
 * mahsulotlar ko'rsatiladi — bu ham navigatsiya, ham SEO uchun kontent.
 */
export default async function WebHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const current = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = getMessages(current);

  const filters = await listFilters();

  return (
    <>
      <SiteHeader locale={current} />

      <main className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>{t.heroTitle}</h1>
          <p className={styles.heroLead}>{t.heroLead}</p>

          <div className={styles.heroActions}>
            <Link href={`/${current}/filtrlar`} className={styles.primary}>
              {t.heroFilters}
            </Link>
            <Link href={`/${current}/kartrijlar`} className={styles.secondary}>
              {t.heroCartridges}
            </Link>
          </div>
        </section>

        <section className={styles.catalog}>
          <h2 className={styles.sectionTitle}>{t.homeCatalogTitle}</h2>

          {filters.length === 0 ? (
            <p className={styles.empty}>{t.homeCatalogEmpty}</p>
          ) : (
            <div className={styles.grid}>
              {filters.slice(0, 6).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={current}
                  href={`/${current}/filtrlar/${product.slug}`}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
