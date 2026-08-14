/**
 * Kanonik havolalar va `hreflang` shu manzildan quriladi (§4.7).
 * Prodda `NEXT_PUBLIC_SITE_URL` majburiy — aks holda qidiruv tizimlariga
 * `localhost` havolalari ketadi.
 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
