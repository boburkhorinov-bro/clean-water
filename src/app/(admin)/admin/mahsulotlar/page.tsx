import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import { listProductsForAdmin } from '@/server/services/admin-products';
import styles from '../admin.module.css';

/**
 * Mahsulotlar ro'yxati (§7 dagi 5-band).
 *
 * Katalogdan farqi: ARXIVLANGANLAR ham ko'rinadi. Aks holda arxivlangan
 * mahsulotni qaytarib bo'lmasdi.
 */
export const dynamic = 'force-dynamic';

const KINDS = [
  { value: undefined, label: 'Hammasi' },
  { value: 'FILTER', label: 'Filtrlar' },
  { value: 'CARTRIDGE', label: 'Kartrijlar' },
] as const;

type SearchParams = Promise<{ kind?: string; q?: string }>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const { kind, q } = await searchParams;
  const activeKind = KINDS.find((item) => item.value === kind)?.value;

  const { items, total } = await listProductsForAdmin({ kind: activeKind, query: q });

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Mahsulotlar</h1>
      <p className={styles.lead}>Jami: {total}</p>

      <div className={styles.toolbar}>
        {KINDS.map((item) => {
          const href = item.value ? `/admin/mahsulotlar?kind=${item.value}` : '/admin/mahsulotlar';
          return (
            <Link
              key={item.label}
              href={href}
              className={styles.filterLink}
              data-active={item.value === activeKind}
            >
              {item.label}
            </Link>
          );
        })}

        <form action="/admin/mahsulotlar">
          {activeKind && <input type="hidden" name="kind" value={activeKind} />}
          <input
            className={styles.search}
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Nomi yoki slug"
            aria-label="Mahsulotlarni qidirish"
          />
        </form>

        <Link href="/admin/mahsulotlar/yangi" className={`${styles.primary} ${styles.spacer}`}>
          Yangi mahsulot
        </Link>
      </div>

      <div className={styles.tableWrap}>
        {items.length === 0 ? (
          <p className={styles.empty}>Mahsulot topilmadi.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Slug</th>
                <th>Tur</th>
                <th>Narxi</th>
                <th>Resurs</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link href={`/admin/mahsulotlar/${product.id}`}>{product.nameUz}</Link>
                  </td>
                  <td className={styles.muted}>{product.slug}</td>
                  <td className={styles.muted}>
                    {product.kind === 'FILTER' ? 'Filtr' : 'Kartrij'}
                  </td>
                  <td>{formatPrice(product.price)}</td>
                  <td className={styles.muted}>
                    {product.resourceMonths === null ? '—' : `${product.resourceMonths} oy`}
                  </td>
                  <td>
                    {product.isActive ? (
                      <span className={styles.badge} data-status="DONE">
                        Sotuvda
                      </span>
                    ) : (
                      <span className={styles.badge} data-status="REJECTED">
                        Arxivda
                      </span>
                    )}
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
