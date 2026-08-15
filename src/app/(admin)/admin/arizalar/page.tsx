import Link from 'next/link';
import { LeadStatusControl } from '@/components/admin/LeadStatusControl';
import { formatTashkentDate } from '@/lib/due-date';
import { listLeadsForAdmin } from '@/server/services/admin-leads';
import styles from '../admin.module.css';

/**
 * Arizalar ro'yxati (§4.5, 6-qadam).
 *
 * Filtr va qidiruv URL da: menejer holatni havola sifatida saqlashi va
 * hamkasbiga yuborishi mumkin.
 */
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: undefined, label: 'Hammasi' },
  { value: 'NEW', label: 'Yangi' },
  { value: 'IN_WORK', label: 'Ishda' },
  { value: 'DONE', label: 'Bajarilgan' },
  { value: 'REJECTED', label: 'Rad etilgan' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yangi',
  IN_WORK: 'Ishda',
  DONE: 'Bajarilgan',
  REJECTED: 'Rad etilgan',
};

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function AdminLeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const { status, q } = await searchParams;
  const activeStatus = STATUSES.find((item) => item.value === status)?.value;

  const { items, total } = await listLeadsForAdmin({ status: activeStatus, query: q });

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Arizalar</h1>
      <p className={styles.lead}>Jami: {total}</p>

      <div className={styles.toolbar}>
        {STATUSES.map((item) => {
          const href = item.value ? `/admin/arizalar?status=${item.value}` : '/admin/arizalar';
          return (
            <Link
              key={item.label}
              href={href}
              className={styles.filterLink}
              data-active={item.value === activeStatus}
            >
              {item.label}
            </Link>
          );
        })}

        <form className={styles.spacer} action="/admin/arizalar">
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          <input
            className={styles.search}
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Telefon yoki ism"
            aria-label="Arizalarni qidirish"
          />
        </form>
      </div>

      <div className={styles.tableWrap}>
        {items.length === 0 ? (
          <p className={styles.empty}>Ariza topilmadi.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sana</th>
                <th>Mijoz</th>
                <th>Telefon</th>
                <th>Mahsulot</th>
                <th>Manba</th>
                <th>Holat</th>
                <th>Harakat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id}>
                  <td className={styles.muted}>{formatTashkentDate(lead.createdAt)}</td>
                  <td>
                    {lead.clientId ? (
                      <Link href={`/admin/mijozlar/${lead.clientId}`}>{lead.name ?? '—'}</Link>
                    ) : (
                      (lead.name ?? '—')
                    )}
                  </td>
                  <td>{lead.phone}</td>
                  <td className={styles.muted}>{lead.productName ?? '—'}</td>
                  <td className={styles.muted}>
                    {lead.source === 'MINIAPP' ? 'Mini App' : 'Sayt'}
                  </td>
                  <td>
                    <span className={styles.badge} data-status={lead.status}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td>
                    <LeadStatusControl leadId={lead.id} status={lead.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
