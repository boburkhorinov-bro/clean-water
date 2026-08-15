import { ProductForm } from '@/components/admin/ProductForm';
import { findProductsByKind } from '@/server/repositories/product-repository';
import styles from '../../admin.module.css';

/** Yangi mahsulot (§7 dagi 5-band). */
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const filters = await findProductsByKind('FILTER');

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Yangi mahsulot</h1>

      <ProductForm
        filters={filters.map((filter) => ({ id: filter.id, name: filter.nameUz }))}
        initial={{
          kind: 'FILTER',
          slug: '',
          nameUz: '',
          nameRu: '',
          price: '',
          images: [],
          videoId: '',
          isActive: true,
          resourceMonths: '',
          compatibleFilterIds: [],
          contentBlocks: [],
        }}
      />
    </main>
  );
}
