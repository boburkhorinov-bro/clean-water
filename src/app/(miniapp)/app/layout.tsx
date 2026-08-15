import type { Metadata, Viewport } from 'next';
import { montserrat } from '@/app/fonts';
import { TelegramTheme } from '@/components/ui/TelegramTheme';
import '../../globals.css';

/** Mini App indekslanmaydi (§4.3). */
export const metadata: Metadata = {
  title: 'Clean Water',
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

/**
 * Telegram WebView ni telefon ekraniga moslaydi.
 *
 * `maximumScale` cheklanmaydi: Telegram ichida ham foydalanuvchi matnni
 * kattalashtirish huquqiga ega bo'lishi kerak.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={montserrat.variable}>
      <body>
        {/* §3: mavzu Telegram dan olinadi, brending esa saqlanadi. */}
        <TelegramTheme />
        {children}
      </body>
    </html>
  );
}
