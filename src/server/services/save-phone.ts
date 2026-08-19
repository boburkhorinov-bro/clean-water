import type { User } from '@/generated/prisma/client';
import { normalizePhone } from '@/lib/phone';
import { resolveLeadClient } from './resolve-client';

/**
 * Telegram mijozining telefon raqamini saqlash (§4.5).
 *
 * Telegram avtorizatsiyasi telefon bermaydi, shuning uchun Mini App ga
 * birinchi kirgan mijoz `phone` siz qoladi va «Almashtirishga buyurtma»
 * tugmasi unga ishlamaydi (`PHONE_REQUIRED`). Raqamni olishning ikkita yo'li
 * bor va ikkalasi ham shu yerga keladi:
 *
 *   1. botdagi «Raqamni ulashish» tugmasi (`request_contact`) —
 *      raqamni Telegram ning o'zi beradi;
 *   2. Mini App dagi forma — mijoz qo'lda yozadi.
 *
 * Birlashtirish shu yerda QAYTA yozilmaydi: `resolveLeadClient` mijozni
 * telefon bo'yicha topadi va dublikatni yopishtiradi. Aynan shu kerak —
 * mijoz odatda CRM da (telefon bilan, o'rnatishi bor) va Mini App da
 * (telegram_id bilan, bo'sh) ikkita yozuv bo'lib turadi. Ikkinchi nusxa
 * mantiq ikkita farqli xatti-harakat degani bo'lardi.
 */

export type SavePhoneStatus = 'SAVED' | 'INVALID_PHONE';

export interface SavePhoneInput {
  telegramId: bigint;
  /** Xom qiymat: Telegram `contact.phone_number` yoki forma maydoni. */
  phone: string;
  name?: string | undefined;
}

export interface SavePhoneResult {
  status: SavePhoneStatus;
  user?: User | undefined;
}

export async function savePhoneForTelegramUser(input: SavePhoneInput): Promise<SavePhoneResult> {
  // Normalizatsiya SHU YERDA tekshiriladi: `resolveLeadClient` yaroqsiz
  // raqamda istisno tashlaydi, mijozning xato yozgani esa istisno emas —
  // unga tushunarli javob qaytarilishi kerak.
  const phone = normalizePhone(input.phone);
  if (!phone) {
    return { status: 'INVALID_PHONE' };
  }

  const user = await resolveLeadClient({
    phone,
    name: input.name,
    telegramId: input.telegramId,
  });

  return { status: 'SAVED', user };
}
