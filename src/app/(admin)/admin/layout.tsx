import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { montserrat } from '@/app/fonts';
import { getSession } from '@/server/auth/require-admin';
import '../../globals.css';
import styles from './admin.module.css';

export const metadata: Metadata = {
  title: 'Clean Water — admin',
  robots: { index: false, follow: false },
};

/**
 * Admin panel o'zbek tilida: loyihaning butun hujjatlashtiruvi va kod bazasi
 * o'zbekcha yuritiladi (`spec.uz.md`, `CLAUDE.md`). Menejerlar ruscha ishlashi
 * ma'lum bo'lsa, bu bir joyda — shu fayldagi menyu va sahifa matnlarida —
 * o'zgartiriladi.
 */
const NAV = [
  { href: '/admin', label: 'Bosh sahifa' },
  { href: '/admin/arizalar', label: 'Arizalar' },
  { href: '/admin/mahsulotlar', label: 'Mahsulotlar' },
  { href: '/admin/mijozlar', label: 'Mijozlar' },
  { href: '/admin/jurnal', label: 'Jurnal' },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // §3, §4.4: rol har bir so'rovda SERVERDA tekshiriladi. Interfeysdagi admin
  // tumbleri faqat boshqaruv elementlarini ko'rsatadi va hech qanday huquq bermaydi.
  //
  // 403 emas, 404: panel mavjudligini begonaga bildirmaslik kerak.
  const session = await getSession();
  if (session?.role !== 'ADMIN') notFound();

  return (
    <html lang="uz" className={montserrat.variable}>
      <body>
        <div className={styles.shell}>
          <header className={styles.header}>
            <span className={styles.brand}>Clean Water</span>
            <nav className={styles.nav}>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
