import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Indekslash qoidalari (§4.7).
 *
 * Mini App, admin panel va API ommaviy kontent emas. Ular sahifa
 * darajasida ham `robots` meta-teglari bilan yopilgan — bu ikkinchi qatlam.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: ['/app', '/admin', '/api'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
