import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/catalog/ProductCard';
import { SiteHeader } from '@/components/ui/SiteHeader';
import { buildAlternates } from '@/lib/i18n/alternates';
import { isLocale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import { siteUrl } from '@/lib/site';
import { listFilters } from '@/server/services/catalog';
import styles from '../catalog.module.css';

/**
 * §4.3: SSR + ISR. Katalog admin panel orqali o'zgaradi, shuning uchun
 * sahifa build paytida muzlab qolmasligi kerak — bir daqiqada bir marta
 * qayta quriladi.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getMessages(locale);

  return {
    title: `${t.catalogFiltersTitle} — ${t.brand}`,
    description: t.catalogFiltersLead,
    alternates: buildAlternates('/filtrlar', locale, siteUrl()),
  };
}

export default async function FiltersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getMessages(locale);
  const filters = await listFilters();

  return (
    <>
      <SiteHeader locale={locale} />
      <main className={styles.page}>
        <header className={styles.head}>
          <h1>{t.catalogFiltersTitle}</h1>
          <p className={styles.lead}>{t.catalogFiltersLead}</p>
        </header>

        {filters.length === 0 ? (
          <p className={styles.empty}>{t.catalogEmpty}</p>
        ) : (
          <div className={styles.grid}>
            {filters.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                href={`/${locale}/filtrlar/${product.slug}`}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
