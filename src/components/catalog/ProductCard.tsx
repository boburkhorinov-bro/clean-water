import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import type { CatalogProduct } from '@/server/services/catalog';
import styles from './ProductCard.module.css';

/**
 * Katalog kartochkasi. Veb va Mini App uchun umumiy (§4.3).
 */
export function ProductCard({
  product,
  locale,
  href,
}: {
  product: CatalogProduct;
  locale: Locale;
  href: string;
}) {
  const t = getMessages(locale);
  const name = locale === 'ru' ? product.nameRu : product.nameUz;
  const cover = product.images[0];

  return (
    <article className={styles.card}>
      <Link href={href} className={styles.link}>
        <div className={styles.media}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" className={styles.image} />
          ) : (
            <span className={styles.placeholder} aria-hidden="true" />
          )}
        </div>

        <div className={styles.body}>
          <h3 className={styles.name}>{name}</h3>

          {product.resourceMonths !== null && (
            <p className={styles.resource}>
              {t.resource}: <strong>{product.resourceMonths}</strong> {t.months}
            </p>
          )}

          <p className={styles.price}>
            {formatPrice(product.price)} <span className={styles.currency}>{t.currency}</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
