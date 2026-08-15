import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InstallationForm } from '@/components/admin/InstallationForm';
import { ReplacePartButton } from '@/components/admin/ReplacePartButton';
import { formatTashkentDate } from '@/lib/due-date';
import { findProductsByKind } from '@/server/repositories/product-repository';
import { getClientProfile } from '@/server/services/clients';
import { computeResourceProgress } from '@/server/services/my-filter';
import styles from '../../admin.module.css';

/**
 * Mijoz kartochkasi — CRM ning asosiy ekrani (§7 dagi 6-band, §5).
 *
 * Bir mijozda bir nechta o'rnatish bo'lishi mumkin (uy, dala hovli) va har
 * birining o'z kartrijlari bor. Menejer shu yerdan o'rnatish qo'shadi va
 * almashtirishni belgilaydi — aynan shu ikki amal eslatmalar jadvalini
 * belgilaydi.
 */
export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yangi',
  IN_WORK: 'Ishda',
  DONE: 'Bajarilgan',
  REJECTED: 'Rad etilgan',
};

type Params = Promise<{ id: string }>;

export default async function AdminClientPage({ params }: { params: Params }) {
  const { id } = await params;

  const [client, filters, cartridges] = await Promise.all([
    getClientProfile(id),
    findProductsByKind('FILTER'),
    findProductsByKind('CARTRIDGE'),
  ]);

  if (!client) notFound();

  const now = new Date();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{client.name ?? 'Ismsiz mijoz'}</h1>
      <p className={styles.lead}>
        {client.phone ?? 'telefonsiz'} ·{' '}
        {client.telegramId ? 'Telegram ulangan' : 'Telegram ulanmagan — eslatma yetib bormaydi'}
      </p>

      <section>
        <h2 className={styles.title} style={{ fontSize: 'var(--cw-text-lg)' }}>
          O‘rnatishlar
        </h2>

        {client.installations.length === 0 ? (
          <p className={styles.lead}>O‘rnatish qayd etilmagan.</p>
        ) : (
          client.installations.map((installation) => (
            <div key={installation.id} className={styles.tableWrap} style={{ marginTop: 12 }}>
              <table className={styles.table}>
                <caption
                  style={{
                    padding: 'var(--cw-space-3)',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  {installation.filterProduct.nameUz} ·{' '}
                  {formatTashkentDate(installation.installedAt)}
                  {installation.address ? ` · ${installation.address}` : ''}
                </caption>
                <thead>
                  <tr>
                    <th>Kartrij</th>
                    <th>O‘rnatilgan</th>
                    <th>Muddat</th>
                    <th>Holat</th>
                    <th>Harakat</th>
                  </tr>
                </thead>
                <tbody>
                  {installation.parts.map((part) => {
                    const progress = computeResourceProgress({
                      installedAt: part.installedAt,
                      dueAt: part.dueAt,
                      now,
                    });

                    return (
                      <tr key={part.id}>
                        <td>{part.cartridgeProduct.nameUz}</td>
                        <td className={styles.muted}>{formatTashkentDate(part.installedAt)}</td>
                        <td>{formatTashkentDate(part.dueAt)}</td>
                        <td>
                          {part.replacedAt ? (
                            <span className={styles.muted}>
                              almashtirilgan {formatTashkentDate(part.replacedAt)}
                            </span>
                          ) : (
                            <span
                              className={styles.badge}
                              data-status={
                                progress.state === 'DUE'
                                  ? 'REJECTED'
                                  : progress.state === 'SOON'
                                    ? 'IN_WORK'
                                    : 'DONE'
                              }
                            >
                              {progress.daysLeft > 0
                                ? `${progress.daysLeft} kun qoldi`
                                : progress.daysLeft === 0
                                  ? 'bugun'
                                  : `${-progress.daysLeft} kun kechikdi`}
                            </span>
                          )}
                        </td>
                        <td>{part.replacedAt ? '—' : <ReplacePartButton partId={part.id} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}

        <div style={{ marginTop: 'var(--cw-space-4)' }}>
          {filters.length === 0 ? (
            <p className={styles.lead}>
              Avval katalogga filtr qo‘shing — o‘rnatishni apparatsiz yozib bo‘lmaydi.
            </p>
          ) : (
            <InstallationForm
              userId={client.id}
              filters={filters.map((filter) => ({ id: filter.id, name: filter.nameUz }))}
              cartridges={cartridges.map((cartridge) => ({
                id: cartridge.id,
                name: cartridge.nameUz,
                resourceMonths: cartridge.cartridgeSpec?.resourceMonths ?? null,
              }))}
            />
          )}
        </div>
      </section>

      <section>
        <h2 className={styles.title} style={{ fontSize: 'var(--cw-text-lg)' }}>
          Arizalar
        </h2>

        <div className={styles.tableWrap}>
          {client.leads.length === 0 ? (
            <p className={styles.empty}>Ariza yo‘q.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Mahsulot</th>
                  <th>Izoh</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {client.leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className={styles.muted}>{formatTashkentDate(lead.createdAt)}</td>
                    <td>{lead.product?.nameUz ?? '—'}</td>
                    <td className={styles.muted}>{lead.comment ?? '—'}</td>
                    <td>
                      <span className={styles.badge} data-status={lead.status}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Link href="/admin/mijozlar" className={styles.filterLink}>
        ← Mijozlar ro‘yxati
      </Link>
    </main>
  );
}
