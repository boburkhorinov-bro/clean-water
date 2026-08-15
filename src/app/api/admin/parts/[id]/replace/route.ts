import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseTashkentDate } from '@/lib/due-date';
import { requireAdminOrNotFound } from '@/server/auth/api-guard';
import { prisma } from '@/server/db';
import { recordAudit } from '@/server/services/audit';
import { InstallationError, markPartReplaced } from '@/server/services/installations';

/**
 * Admin: kartrij almashtirilganini belgilash (§7 dagi 6-band).
 *
 * Servis eski qatorni yopadi va yangisini yaratadi — keyingi `due_at`
 * almashtirish sanasidan hisoblanadi. Tafsilot `installations.ts` da.
 */

const bodySchema = z.object({
  replacedAt: z.string(),
  /** Boshqa modelga almashtirilgan bo'lsa. */
  cartridgeProductId: z.uuid().optional(),
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

  const replacedAt = parseTashkentDate(parsed.data.replacedAt);
  if (!replacedAt) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
  }

  try {
    const result = await markPartReplaced({
      installedPartId: id,
      replacedAt,
      cartridgeProductId: parsed.data.cartridgeProductId,
    });

    await recordAudit(prisma, {
      adminId: session.userId,
      action: 'part.replace',
      entity: `InstalledPart:${id}`,
      payload: { replacedAt: parsed.data.replacedAt, nextPartId: result.next.id },
    });

    return NextResponse.json({ id: result.next.id, dueAt: result.next.dueAt }, { status: 201 });
  } catch (error) {
    if (error instanceof InstallationError) {
      return NextResponse.json(
        { error: 'invalid_replacement', message: error.message },
        { status: 400 },
      );
    }
    console.error('[api/admin/parts/replace] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
