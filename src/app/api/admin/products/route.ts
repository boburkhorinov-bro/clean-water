import { NextResponse } from 'next/server';
import { requireAdminOrNotFound } from '@/server/auth/api-guard';
import {
  ProductValidationError,
  createProduct,
  listProductsForAdmin,
} from '@/server/services/admin-products';

/**
 * Admin: mahsulotlar (§7 dagi 5-band).
 *
 * Rol har so'rovda serverda tekshiriladi (§6). Validatsiya va biznes-qoidalar
 * servis qatlamida — bu yerda faqat HTTP.
 */

export async function GET(request: Request) {
  const session = await requireAdminOrNotFound();
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');

  const result = await listProductsForAdmin({
    kind: kind === 'FILTER' || kind === 'CARTRIDGE' ? kind : undefined,
    query: url.searchParams.get('q') ?? undefined,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await requireAdminOrNotFound();
  if (session instanceof NextResponse) return session;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const product = await createProduct(raw as never, session.userId);
    return NextResponse.json({ id: product.id, slug: product.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductValidationError) {
      // Sabab adminga ko'rsatiladi: bu ichki sir emas, u formani tuzatishi kerak.
      return NextResponse.json(
        { error: 'invalid_product', message: error.message },
        { status: 400 },
      );
    }
    console.error('[api/admin/products] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
