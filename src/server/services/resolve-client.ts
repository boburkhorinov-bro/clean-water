import type { User } from '@/generated/prisma/client';
import { normalizePhone } from '@/lib/phone';
import { prisma } from '@/server/db';

export interface ResolveLeadClientInput {
  phone: string;
  name?: string | undefined;
  telegramId?: bigint | undefined;
}

/**
 * Ariza qoldirgan mijozni topadi yoki yaratadi va dublikatlarni birlashtiradi (§4.5, §5).
 *
 * Mijoz ikki yo'ldan kelishi mumkin: Telegramdan (telegram_id bor, telefon yo'q)
 * va saytdan (telefon bor, telegram_id yo'q). Bir odam ikkalasidan ham kelsa,
 * bazada ikkita yozuv paydo bo'ladi. Dublikat qolsa, uning o'rnatishlari bir
 * profilda, Telegram ulanishi esa boshqasida qoladi — natijada kartrij
 * eslatmalari unga umuman yetib bormaydi.
 *
 * Birlashtirishda Telegram yozuvi omon qoladi: aynan u orqali xabar yuboriladi.
 * Mehmon yozuvining arizalari va o'rnatishlari unga ko'chiriladi, ismi esa
 * bo'sh joyni to'ldiradi.
 */
export async function resolveLeadClient(input: ResolveLeadClientInput): Promise<User> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error(`Telefon raqamini normallashtirib bo‘lmadi: ${input.phone}`);
  }

  return prisma.$transaction(async (tx) => {
    if (input.telegramId === undefined) {
      const existing = await tx.user.findUnique({ where: { phone } });
      if (!existing) {
        return tx.user.create({ data: { phone, name: input.name ?? null } });
      }
      // Mavjud ism yangi ariza tufayli o'chirilmaydi — faqat bo'sh joy to'ladi.
      if (!existing.name && input.name) {
        return tx.user.update({ where: { id: existing.id }, data: { name: input.name } });
      }
      return existing;
    }

    const byTelegram = await tx.user.findUnique({ where: { telegramId: input.telegramId } });
    const byPhone = await tx.user.findUnique({ where: { phone } });

    if (byTelegram && byPhone && byTelegram.id !== byPhone.id) {
      // Dublikat: bir odam ikkita yozuvga bo'linib ketgan.
      await tx.lead.updateMany({ where: { userId: byPhone.id }, data: { userId: byTelegram.id } });
      await tx.installation.updateMany({
        where: { userId: byPhone.id },
        data: { userId: byTelegram.id },
      });
      await tx.auditLog.updateMany({
        where: { adminId: byPhone.id },
        data: { adminId: byTelegram.id },
      });

      const name = byTelegram.name ?? byPhone.name ?? input.name ?? null;
      // Telefon unique — dublikatni oldin o'chirish shart.
      await tx.user.delete({ where: { id: byPhone.id } });
      return tx.user.update({ where: { id: byTelegram.id }, data: { phone, name } });
    }

    if (byTelegram) {
      return tx.user.update({
        where: { id: byTelegram.id },
        data: { phone, name: byTelegram.name ?? input.name ?? null },
      });
    }

    if (byPhone) {
      return tx.user.update({
        where: { id: byPhone.id },
        data: { telegramId: input.telegramId, name: byPhone.name ?? input.name ?? null },
      });
    }

    return tx.user.create({
      data: { phone, telegramId: input.telegramId, name: input.name ?? null },
    });
  });
}
