import type { Metadata } from 'next';
import '../../globals.css';

/** Mini App indekslanmaydi (§4.3). */
export const metadata: Metadata = {
  title: 'Clean Water',
  robots: { index: false, follow: false },
};

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  // Mavzu Telegram dan olinadi (§3) — dizayn-tokenlar bilan birga qo'shiladi.
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
