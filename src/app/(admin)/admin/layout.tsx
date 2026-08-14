import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/require-admin';
import '../../globals.css';

export const metadata: Metadata = {
  title: 'Clean Water — admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // §3, §4.4: rol har bir so'rovda SERVERDA tekshiriladi. Interfeysdagi admin
  // tumbleri faqat boshqaruv elementlarini ko'rsatadi va hech qanday huquq bermaydi.
  //
  // 403 emas, 404: panel mavjudligini begonaga bildirmaslik kerak.
  const session = await getSession();
  if (session?.role !== 'ADMIN') notFound();

  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
