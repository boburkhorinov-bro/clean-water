import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentBlocks } from '@/components/content/ContentBlocks';
import { LeadForm } from '@/components/catalog/LeadForm';
import { StageStack } from '@/components/catalog/StageStack';
import { SiteHeader } from '@/components/ui/SiteHeader';
import { formatPrice } from '@/lib/format';
import { buildAlternates } from '@/lib/i18n/alternates';
import { isLocale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import { siteUrl } from '@/lib/site';
import { getCartridgesForFilter, getFilterBySlug } from '@/server/services/catalog';
import styles from '../../catalog.module.css';

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const product = await getFilterBySlug(slug);
  if (!product) return {};

  const name = locale === 'ru' ? product.nameRu : product.nameUz;
  const t = getMessages(locale);

  return {
    title: `${name} — ${t.brand}`,
    alternates: buildAlternates(`/filtrlar/${slug}`, locale, siteUrl()),
    openGraph: {
      title: name,
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function FilterPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const product = await getFilterBySlug(slug);
  if (!product) notFound();

  const t = getMessages(locale);
  const stages = await getCartridgesForFilter(product.id);
  const name = locale === 'ru' ? product.nameRu : product.nameUz;

  return (
    <>
      <SiteHeader locale={locale} />
      <main className={styles.page}>
        <div className={styles.product}>
          <div className={styles.productMain}>
            <h1>{name}</h1>

            <div className={styles.content}>
              <ContentBlocks blocks={product.contentBlocks} locale={locale} />
            </div>

            {/* §3: bosqichlar shkalasi — dekorativ emas, haqiqiy kartrijlar. */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t.compatibleCartridges}</h2>
              <StageStack stages={stages} locale={locale} />
            </section>
          </div>

          <aside className={styles.productAside}>
            <div className={styles.priceBox}>
              <p className={styles.priceLabel}>{t.price}</p>
              <p className={styles.priceValue}>
                {formatPrice(product.price)}{' '}
                <span className={styles.priceCurrency}>{t.currency}</span>
              </p>
            </div>

            <LeadForm t={t} productId={product.id} source="WEB" />
          </aside>
        </div>
      </main>
    </>
  );
}
