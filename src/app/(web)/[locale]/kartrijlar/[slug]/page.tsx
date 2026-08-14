import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentBlocks } from '@/components/content/ContentBlocks';
import { LeadForm } from '@/components/catalog/LeadForm';
import { SiteHeader } from '@/components/ui/SiteHeader';
import { formatPrice } from '@/lib/format';
import { buildAlternates } from '@/lib/i18n/alternates';
import { isLocale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import { siteUrl } from '@/lib/site';
import { getCartridgeBySlug } from '@/server/services/catalog';
import styles from '../../catalog.module.css';

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const product = await getCartridgeBySlug(slug);
  if (!product) return {};

  const name = locale === 'ru' ? product.nameRu : product.nameUz;
  const t = getMessages(locale);

  return {
    title: `${name} — ${t.brand}`,
    alternates: buildAlternates(`/kartrijlar/${slug}`, locale, siteUrl()),
  };
}

export default async function CartridgePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const product = await getCartridgeBySlug(slug);
  if (!product) notFound();

  const t = getMessages(locale);
  const name = locale === 'ru' ? product.nameRu : product.nameUz;

  return (
    <>
      <SiteHeader locale={locale} />
      <main className={styles.page}>
        <div className={styles.product}>
          <div className={styles.productMain}>
            <h1>{name}</h1>

            {/* Kartrij uchun eng muhim ma'lumot — qachon almashtirish kerakligi. */}
            {product.resourceMonths !== null && (
              <p className={styles.lead}>
                {t.resource}: <strong>{product.resourceMonths}</strong> {t.months}
              </p>
            )}

            <div className={styles.content}>
              <ContentBlocks blocks={product.contentBlocks} locale={locale} />
            </div>
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
