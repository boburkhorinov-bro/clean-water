import type { MetadataRoute } from 'next';

/**
 * PWA manifesti (§7 dagi 8-band).
 *
 * Bu SAYT uchun: mijoz uni brauzerdan «o'rnatishi» mumkin. Mini App
 * Telegram ichida ishlaydi va unga manifest kerak emas.
 *
 * `start_url` — `/uz`, chunki `/` ni `proxy.ts` yo'naltiradi va PWA
 * ochilishida ortiqcha redirect bo'lardi.
 *
 * Ikonka SVG: bitta fayl barcha o'lchamlarga yetadi va kattalashtirilganda
 * buzilmaydi. `purpose: 'maskable'` uchun alohida to'ldirilgan variant
 * kerak bo'ladi — bu logotip tayyor bo'lgach qo'shiladi.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Clean Water — osmos filtrlar va kartrijlar',
    short_name: 'Clean Water',
    description: 'Osmos suv filtrlari, kartrijlar va almashtirish muddati haqida eslatmalar.',
    start_url: '/uz',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#5b3fd9',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
