import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminOrNotFound } from '@/server/auth/api-guard';
import { LeadStatusError, changeLeadStatus } from '@/server/services/admin-leads';

/**
 * Admin: ariza statusini yuritish (§4.5, 6-qadam).
 *
 * Taqiqlangan o'tish 400 emas, 409: so'rov o'zi to'g'ri, arizaning HOLATI
 * unga yo'l bermayapti. Interfeys uchun bu farq muhim — 409 da menejerga
 * «ariza allaqachon boshqa holatda, sahifani yangilang» deb aytish kerak.
 */

const bodySchema = z.object({
  status: z.enum(['NEW', 'IN_WORK', 'DONE', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await requireAdminOrNotFound();
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const lead = await changeLeadStatus(id, parsed.data.status, session.userId, parsed.data.note);
    return NextResponse.json({ id: lead.id, status: lead.status });
  } catch (error) {
    if (error instanceof LeadStatusError) {
      return NextResponse.json({ error: 'conflict', message: error.message }, { status: 409 });
    }
    console.error('[api/admin/leads/status] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
