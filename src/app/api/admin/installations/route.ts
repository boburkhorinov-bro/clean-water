import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseTashkentDate } from '@/lib/due-date';
import { requireAdminOrNotFound } from '@/server/auth/api-guard';
import { prisma } from '@/server/db';
import { recordAudit } from '@/server/services/audit';
import { InstallationError, registerInstallation } from '@/server/services/installations';

/**
 * Admin: o'rnatishni qayd qilish (§7 dagi 6-band).
 *
 * Sanalar Toshkent kalendari bo'yicha o'qiladi: menejer formaga mahalliy
 * sanani yozadi va u `due_at` hisobiga to'g'ridan-to'g'ri ta'sir qiladi
 * (§5). UTC deb talqin qilinsa, kun chegarasida muddat bir kunga siljirdi.
 */

const bodySchema = z.object({
  userId: z.uuid(),
  filterProductId: z.uuid(),
  installedAt: z.string(),
  address: z.string().trim().max(300).optional(),
  note: z.string().trim().max(1000).optional(),
  parts: z
    .array(z.object({ cartridgeProductId: z.uuid(), installedAt: z.string().optional() }))
    .default([]),
});

export async function POST(request: Request) {
  const session = await requireAdminOrNotFound();
  if (session instanceof NextResponse) return session;

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

  const installedAt = parseTashkentDate(parsed.data.installedAt);
  if (!installedAt) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
  }

  const parts: { cartridgeProductId: string; installedAt?: Date }[] = [];
  for (const part of parsed.data.parts) {
    if (part.installedAt === undefined) {
      parts.push({ cartridgeProductId: part.cartridgeProductId });
      continue;
    }

    const partDate = parseTashkentDate(part.installedAt);
    if (!partDate) {
      return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
    }
    parts.push({ cartridgeProductId: part.cartridgeProductId, installedAt: partDate });
  }

  try {
    const installation = await registerInstallation({
      userId: parsed.data.userId,
      filterProductId: parsed.data.filterProductId,
      installedAt,
      address: parsed.data.address,
      note: parsed.data.note,
      parts,
    });

    // Jurnal o'rnatishdan KEYIN yoziladi: `registerInstallation` o'z
    // tranzaksiyasini yopib bo'lgan va uni buzmaslik kerak. Yozuv yiqilsa
    // o'rnatish qoladi — bu ariza oqimidagi tartib bilan bir xil mantiq.
    await recordAudit(prisma, {
      adminId: session.userId,
      action: 'installation.create',
      entity: `Installation:${installation.id}`,
      payload: {
        userId: parsed.data.userId,
        filterProductId: parsed.data.filterProductId,
        parts: parts.length,
      },
    });

    return NextResponse.json({ id: installation.id }, { status: 201 });
  } catch (error) {
    if (error instanceof InstallationError) {
      return NextResponse.json(
        { error: 'invalid_installation', message: error.message },
        { status: 400 },
      );
    }
    console.error('[api/admin/installations] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
