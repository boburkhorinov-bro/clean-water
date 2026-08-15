import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/admin/ProductForm';
import { parseContentBlocks } from '@/lib/content-blocks';
import { findProductForEdit, findProductsByKind } from '@/server/repositories/product-repository';
import styles from '../../admin.module.css';

/** Mahsulotni tahrirlash (§7 dagi 5-band). */
export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;

  const [product, filters] = await Promise.all([
    findProductForEdit(id),
    findProductsByKind('FILTER'),
  ]);

  if (!product) notFound();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{product.nameUz}</h1>
      <p className={styles.lead}>
        {product.kind === 'FILTER' ? 'Filtr' : 'Kartrij'} · /{product.slug}
      </p>

      <ProductForm
        // Arxivlangan filtr ham ro'yxatda qolishi kerak: mavjud moslikni
        // tasodifan yo'qotib qo'ymaslik uchun.
        filters={filters.map((filter) => ({ id: filter.id, name: filter.nameUz }))}
        initial={{
          id: product.id,
          kind: product.kind,
          slug: product.slug,
          nameUz: product.nameUz,
          nameRu: product.nameRu,
          price: product.price.toString(),
          images: product.images,
          videoId: product.videoId ?? '',
          isActive: product.isActive,
          resourceMonths: product.cartridgeSpec?.resourceMonths?.toString() ?? '',
          compatibleFilterIds: product.compatibleFilters.map((link) => link.filterId),
          contentBlocks: parseContentBlocks(product.contentBlocks),
        }}
      />
    </main>
  );
}
