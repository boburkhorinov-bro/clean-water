import { formatTashkentDate } from '@/lib/due-date';
import { countAuditLogs, findAuditLogs } from '@/server/repositories/client-repository';
import styles from '../admin.module.css';

/**
 * Administrator harakatlari jurnali (§6, §7 dagi 5-band).
 *
 * Jurnal faqat o'qiladi: unga yozish har bir amal bilan bitta tranzaksiyada
 * bo'ladi (`services/audit.ts`). Bu yerdan uni tahrirlash yoki o'chirish
 * imkoniyati YO'Q — o'zgartirilishi mumkin bo'lgan jurnal jurnal emas.
 */
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

/** Texnik nomlarni menejer tushunadigan matnga aylantiradi. */
const ACTION_LABELS: Record<string, string> = {
  'product.create': 'Mahsulot qo‘shildi',
  'product.update': 'Mahsulot tahrirlandi',
  'product.archive': 'Mahsulot arxivlandi',
  'product.restore': 'Mahsulot qaytarildi',
  'lead.status': 'Ariza holati o‘zgardi',
  'installation.create': 'O‘rnatish qayd etildi',
  'part.replace': 'Kartrij almashtirildi',
};

export default async function AdminAuditPage() {
  const [logs, total] = await Promise.all([
    findAuditLogs({ limit: PAGE_SIZE, offset: 0 }),
    countAuditLogs(),
  ]);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Jurnal</h1>
      <p className={styles.lead}>
        Jami: {total}. Oxirgi {Math.min(total, PAGE_SIZE)} ta yozuv.
      </p>

      <div className={styles.tableWrap}>
        {logs.length === 0 ? (
          <p className={styles.empty}>Hali harakat qayd etilmagan.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sana</th>
                <th>Admin</th>
                <th>Harakat</th>
                <th>Obyekt</th>
                <th>Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className={styles.muted}>{formatTashkentDate(log.createdAt)}</td>
                  <td>{log.admin.name ?? String(log.admin.telegramId ?? '—')}</td>
                  <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                  <td className={styles.muted}>{log.entity}</td>
                  <td className={styles.muted}>
                    {log.payload === null ? '—' : JSON.stringify(log.payload)}
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
