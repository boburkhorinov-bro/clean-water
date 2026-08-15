import type { MetadataRoute } from 'next';
import { LOCALES } from '@/lib/i18n/locales';
import { siteUrl } from '@/lib/site';
import { listCartridges, listFilters } from '@/server/services/catalog';

/**
 * Sitemap (§4.7).
 *
 * Har bir til alohida URL da indekslanadi, shuning uchun har sahifa ikki
 * marta — `/uz/...` va `/ru/...` — ko'rsatiladi va ular bir-biriga
 * `alternates` orqali bog'lanadi.
 *
 * `force-dynamic`: sitemap katalogdan quriladi va uni build vaqtida
 * yig'ish `DATABASE_URL` ni majburiy qilardi (`src/server/db.ts` dagi
 * dangasa klient shu sababli bor).
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [filters, cartridges] = await Promise.all([listFilters(), listCartridges()]);

  const paths = [
    '',
    '/filtrlar',
    '/kartrijlar',
    ...filters.map((product) => `/filtrlar/${product.slug}`),
    ...cartridges.map((product) => `/kartrijlar/${product.slug}`),
  ];

  return paths.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((alternate) => [alternate, `${base}/${alternate}${path}`]),
        ),
      },
    })),
  );
}
