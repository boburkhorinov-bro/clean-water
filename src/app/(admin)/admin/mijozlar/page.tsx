import Link from 'next/link';
import { formatTashkentDate } from '@/lib/due-date';
import { listClients } from '@/server/services/clients';
import styles from '../admin.module.css';

/**
 * Mijozlar bazasi (§7 dagi 6-band).
 *
 * Qidiruv satri bitta: menejer raqamni mijoz aytganicha yozadi yoki ismni
 * kiritadi — servis o'zi ajratadi.
 */
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ q?: string }>;

export default async function AdminClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const { items, total } = await listClients({ query: q });

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Mijozlar</h1>
      <p className={styles.lead}>Jami: {total}</p>

      <div className={styles.toolbar}>
        <form action="/admin/mijozlar">
          <input
            className={styles.search}
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Telefon yoki ism"
            aria-label="Mijozlarni qidirish"
          />
        </form>
      </div>

      <div className={styles.tableWrap}>
        {items.length === 0 ? (
          <p className={styles.empty}>Mijoz topilmadi.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ism</th>
                <th>Telefon</th>
                <th>Telegram</th>
                <th>Arizalar</th>
                <th>O‘rnatishlar</th>
                <th>Qo‘shilgan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((client) => (
                <tr key={client.id}>
                  <td>
                    <Link href={`/admin/mijozlar/${client.id}`}>{client.name ?? '—'}</Link>
                  </td>
                  <td>{client.phone ?? '—'}</td>
                  <td className={styles.muted}>{client.telegramId ? 'ulangan' : '—'}</td>
                  <td>{client.leadCount}</td>
                  <td>{client.installationCount}</td>
                  <td className={styles.muted}>{formatTashkentDate(client.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
