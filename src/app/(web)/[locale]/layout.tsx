import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, isLocale } from '@/lib/i18n/locales';
import '../../globals.css';

export const metadata: Metadata = {
  title: 'Clean Water',
  description: 'Osmos suv filtrlari va kartrijlar',
};

/** SSR + ISR: har ikkala til uchun statik parametrlar (§4.3). */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function WebLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
