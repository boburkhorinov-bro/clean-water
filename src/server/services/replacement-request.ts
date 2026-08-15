import type { Lead } from '@/generated/prisma/client';
import { prisma } from '@/server/db';
import { createLead, type CreateLeadDeps } from './leads';

/**
 * Eslatmadagi «Almashtirishga buyurtma» tugmasi (§4.6, 3-qadam).
 *
 * Mijoz katalogdan o'tmaydi: qaysi kartrij ekani eslatmadan ma'lum, ariza
 * darhol yaratiladi.
 *
 * Xavfsizlik (§6): `installedPartId` tugmaning `callback_data` sida ketadi va
 * uni istalgan odam qo'lda yasab yuborishi mumkin. Shuning uchun kartrij
 * AYNAN shu Telegram foydalanuvchisiga tegishli ekani serverda tekshiriladi.
 * Topilmasa «yo'q» deb javob beriladi — «bu sizniki emas» degan javob begona
 * odamga boshqa mijozning kartriji borligini tasdiqlardi.
 */

export type ReplacementRequestStatus =
  'CREATED' | 'ALREADY_REQUESTED' | 'PHONE_REQUIRED' | 'NOT_FOUND';

export interface RequestReplacementInput {
  installedPartId: string;
  telegramId: bigint;
}

export interface RequestReplacementResult {
  status: ReplacementRequestStatus;
  lead?: Lead | undefined;
}

/** Bir sutkalik oyna: eski xabardagi tugma qayta bosilishi odatiy hol. */
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function requestReplacement(
  input: RequestReplacementInput,
  deps: CreateLeadDeps = {},
): Promise<RequestReplacementResult> {
  const part = await prisma.installedPart.findFirst({
    where: {
      id: input.installedPartId,
      installation: { user: { telegramId: input.telegramId } },
    },
    include: {
      installation: { include: { user: true } },
    },
  });

  if (!part) {
    return { status: 'NOT_FOUND' };
  }

  const user = part.installation.user;
  if (!user.phone) {
    // Ariza telefonsiz ma'nosiz: menejer qo'ng'iroq qila olmaydi.
    return { status: 'PHONE_REQUIRED' };
  }

  // Takroriy bosish menejerga ikkita bir xil ariza bermasligi kerak.
  // Yopilgan ariza to'smaydi: kartrij keyingi siklda yana kerak bo'ladi.
  const recent = await prisma.lead.findFirst({
    where: {
      userId: user.id,
      productId: part.cartridgeProductId,
      status: { in: ['NEW', 'IN_WORK'] },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
  });
  if (recent) {
    return { status: 'ALREADY_REQUESTED', lead: recent };
  }

  const address = part.installation.address;
  const lead = await createLead(
    {
      phone: user.phone,
      name: user.name ?? undefined,
      productId: part.cartridgeProductId,
      source: 'MINIAPP',
      comment: address
        ? `Kartrij almashtirish (eslatma). Manzil: ${address}`
        : 'Kartrij almashtirish (eslatma)',
      telegramId: input.telegramId,
    },
    deps,
  );

  return { status: 'CREATED', lead };
}
