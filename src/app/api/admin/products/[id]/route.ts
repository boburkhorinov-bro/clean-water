import { NextResponse } from 'next/server';
import { requireAdminOrNotFound } from '@/server/auth/api-guard';
import {
  ProductValidationError,
  setProductActive,
  updateProduct,
} from '@/server/services/admin-products';

/**
 * Admin: bitta mahsulotni tahrirlash (§7 dagi 5-band).
 *
 * Arxivlash alohida marshrut emas, `isActive` maydoni orqali — admin uchun bu
 * o'sha formaning bir qismi. Lekin jurnalda u ALOHIDA harakat bo'lib turadi
 * (`product.archive`), chunki «nomni tuzatdim» bilan «katalogdan olib
 * tashladim» bir xil vazn emas.
 */

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await requireAdminOrNotFound();
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { isActive, ...fields } = (raw ?? {}) as { isActive?: unknown } & Record<string, unknown>;

  try {
    if (Object.keys(fields).length > 0) {
      await updateProduct(id, fields as never, session.userId);
    }

    if (typeof isActive === 'boolean') {
      await setProductActive(id, isActive, session.userId);
    }

    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ProductValidationError) {
      return NextResponse.json(
        { error: 'invalid_product', message: error.message },
        { status: 400 },
      );
    }
    console.error('[api/admin/products/[id]] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
