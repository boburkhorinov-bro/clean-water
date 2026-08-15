import Link from 'next/link';
import { getAdminOverview } from '@/server/services/admin-overview';
import styles from './admin.module.css';

/**
 * Admin bosh sahifasi (§7 dagi 5-band).
 *
 * §3: faqat real ma'lumot. Bu yerdagi har bir son — bazadagi haqiqiy hisob
 * va u menejerga bugun nima qilish kerakligini aytadi.
 */
export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const overview = await getAdminOverview();

  const cards = [
    { label: 'Yangi arizalar', value: overview.leads.NEW, accent: overview.leads.NEW > 0 },
    { label: 'Ishdagi arizalar', value: overview.leads.IN_WORK },
    { label: 'Muddati kelgan kartrijlar', value: overview.dueParts, accent: overview.dueParts > 0 },
    { label: 'Mijozlar', value: overview.clients },
    { label: 'O‘rnatishlar', value: overview.installations },
    { label: 'Filtrlar', value: overview.products.filters },
    { label: 'Kartrijlar', value: overview.products.cartridges },
    { label: 'Arxivda', value: overview.products.archived },
  ];

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Bosh sahifa</h1>

      <ul className={styles.cards}>
        {cards.map((card) => (
          <li key={card.label} className={styles.card} data-accent={card.accent ? 'warn' : 'none'}>
            <span className={styles.cardValue}>{card.value}</span>
            <span className={styles.cardLabel}>{card.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.toolbar}>
        <Link href="/admin/arizalar?status=NEW" className={styles.primary}>
          Yangi arizalarni ko‘rish
        </Link>
        <Link href="/admin/mahsulotlar/yangi" className={styles.filterLink}>
          Mahsulot qo‘shish
        </Link>
      </div>
    </main>
  );
}
