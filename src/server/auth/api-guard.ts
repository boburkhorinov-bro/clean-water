import { NextResponse } from 'next/server';
import { getSession } from './require-admin';
import type { SessionPayload } from './session';

/**
 * Admin API marshrutlari uchun qo'riqchi (§6).
 *
 * Javob 403 emas, 404 — `(admin)/admin/layout.tsx` dagi qoida bilan bir xil:
 * begonaga panel MAVJUDLIGINI ham bildirmaymiz. 403 «bu yerda nimadir bor,
 * lekin sizga ruxsat yo'q» degani va u qidirishga undaydi.
 *
 * Chaqirish namunasi:
 *
 *     const session = await requireAdminOrNotFound();
 *     if (session instanceof NextResponse) return session;
 */
export async function requireAdminOrNotFound(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();

  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return session;
}
