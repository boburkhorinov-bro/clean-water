import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/alternates';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/locales';
import { siteUrl } from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const current = isLocale(locale) ? locale : DEFAULT_LOCALE;

  // §4.7: har bir til alohida URL da indekslanadi, shuning uchun kanonik
  // havola va hreflang to'plami har sahifada aniq ko'rsatiladi.
  return { alternates: buildAlternates('/', current, siteUrl()) };
}

export default async function WebHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  // Skelet. Katalog va mahsulot kartochkasi — kritik yo'l 4.
  return (
    <main>
      <h1>Clean Water</h1>
      <p>locale: {locale}</p>
    </main>
  );
}
