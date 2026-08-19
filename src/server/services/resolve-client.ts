import type { User } from '@/generated/prisma/client';
import { normalizePhone } from '@/lib/phone';
import { prisma } from '@/server/db';

export interface ResolveLeadClientInput {
  phone: string;
  name?: string | undefined;
  telegramId?: bigint | undefined;
  /**
   * Raqam AYNAN shu odamnikiligi isbotlangan (§6).
   *
   * Faqat ikkita manba beradi:
   *   - Telegram ning «Raqamni yuborish» tugmasi — raqamni Telegram o'zi
   *     yuboradi va u foydalanuvchi bilan bog'langanini kafolatlaydi;
   *   - CRM — raqamni menejer kiritadi, ya'ni ortida haqiqiy odam turadi.
   *
   * Ommaviy formalarda (sayt arizasi, Mini App dagi telefon maydoni) raqam
   * shunchaki YOZILADI va tasdiqlanmagan hisoblanadi.
   */
  verified?: boolean | undefined;
}

export interface ResolveLeadClientResult {
  user: User;
  /**
   * Raqam boshqa mijozning yozuvida va u tasdiqlanmagani uchun
   * biriktirilmadi. Chaqiruvchi buni foydalanuvchiga aytishi mumkin
   * (Mini App formasi) yoki e'tiborsiz qoldirishi (ariza baribir
   * yaratiladi va menejer qo'lda hal qiladi).
   */
  phoneTaken: boolean;
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
 *
 * §6 — NIMA UCHUN `verified` KERAK. Bu funksiyada telefon shaxsni aniqlash
 * kaliti: raqam bo'yicha topilgan yozuv «o'sha odam» deb qabul qilinadi.
 * Tasdiqsiz bu hisobni egallash yo'li bo'lardi — Telegram orqali kirgan
 * istalgan odam ariza formasiga boshqa mijozning raqamini yozib, uning
 * o'rnatishlarini (manzili bilan), arizalarini va eslatmalarini o'ziga
 * ko'chirib olardi, mijozning yozuvi esa o'chib ketardi. Raqamni bilish esa
 * qiyin emas.
 *
 * Shuning uchun MAVJUD begona yozuvga tegadigan ikkita amal — birlashtirish
 * va telegram_id ni ulash — `verified` siz bajarilmaydi. Qolgan hollarda
 * hech kimning ma'lumoti xavf ostida emas va oqim o'zgarmaydi.
 */
export async function resolveLeadClient(
  input: ResolveLeadClientInput,
): Promise<ResolveLeadClientResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error(`Telefon raqamini normallashtirib bo‘lmadi: ${input.phone}`);
  }

  return prisma.$transaction(async (tx) => {
    if (input.telegramId === undefined) {
      const existing = await tx.user.findUnique({ where: { phone } });
      if (!existing) {
        return {
          user: await tx.user.create({ data: { phone, name: input.name ?? null } }),
          phoneTaken: false,
        };
      }
      // Mavjud ism yangi ariza tufayli o'chirilmaydi — faqat bo'sh joy to'ladi.
      if (!existing.name && input.name) {
        return {
          user: await tx.user.update({ where: { id: existing.id }, data: { name: input.name } }),
          phoneTaken: false,
        };
      }
      return { user: existing, phoneTaken: false };
    }

    const byTelegram = await tx.user.findUnique({ where: { telegramId: input.telegramId } });
    const byPhone = await tx.user.findUnique({ where: { phone } });

    if (byTelegram && byPhone && byTelegram.id !== byPhone.id) {
      if (!input.verified) {
        // Egallashga urinish bo'lishi mumkin. Hech narsa ko'chirilmaydi va
        // o'chirilmaydi: buzg'unchi o'z yozuvida qoladi, mijozniki tegilmaydi.
        // Haqiqiy mijoz uchun ham yo'l yopiq emas — botdagi «Raqamni
        // yuborish» tugmasi tasdiqlangan raqam beradi va birlashtiradi.
        return { user: byTelegram, phoneTaken: true };
      }

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
      return {
        user: await tx.user.update({ where: { id: byTelegram.id }, data: { phone, name } }),
        phoneTaken: false,
      };
    }

    if (byTelegram) {
      // O'z yozuvi: raqam bo'sh edi yoki allaqachon o'shaniki.
      return {
        user: await tx.user.update({
          where: { id: byTelegram.id },
          data: { phone, name: byTelegram.name ?? input.name ?? null },
        }),
        phoneTaken: false,
      };
    }

    if (byPhone) {
      if (!input.verified) {
        // Begona yozuvga telegram_id ni ulash — eng oson egallash yo'li:
        // bitta amal bilan mijozning butun profili boshqa odamga o'tardi.
        // Raqamsiz yangi yozuv yaratiladi: ariza yo'qolmaydi, mijozniki esa
        // tegilmaydi.
        return {
          user: await tx.user.create({
            data: { telegramId: input.telegramId, name: input.name ?? null },
          }),
          phoneTaken: true,
        };
      }

      return {
        user: await tx.user.update({
          where: { id: byPhone.id },
          data: { telegramId: input.telegramId, name: byPhone.name ?? input.name ?? null },
        }),
        phoneTaken: false,
      };
    }

    return {
      user: await tx.user.create({
        data: { phone, telegramId: input.telegramId, name: input.name ?? null },
      }),
      phoneTaken: false,
    };
  });
}
