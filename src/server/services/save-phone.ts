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
 *
 * §6: birlashtirish faqat TASDIQLANGAN raqamda. Botdagi tugma buni beradi,
 * ilovadagi forma esa yo'q — u yerda mijoz begona raqam yozishi mumkin va
 * o'sha mijozning yozuvi egallanib ketardi.
 */

export type SavePhoneStatus = 'SAVED' | 'INVALID_PHONE' | 'PHONE_TAKEN';

export interface SavePhoneInput {
  telegramId: bigint;
  /** Xom qiymat: Telegram `contact.phone_number` yoki forma maydoni. */
  phone: string;
  name?: string | undefined;
  /**
   * §6: raqamni Telegram tasdiqlaganmi.
   *
   * Botdagi «Raqamni yuborish» tugmasi uchun `true` — raqamni Telegram ning
   * o'zi yuboradi. Mini App dagi forma uchun `false`: mijoz uni qo'lda
   * yozadi va begona raqam bo'lishi mumkin.
   */
  verified?: boolean | undefined;
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

  const { user, phoneTaken } = await resolveLeadClient({
    phone,
    name: input.name,
    telegramId: input.telegramId,
    verified: input.verified,
  });

  // Raqam boshqa mijozda va tasdiqlanmagan — hech narsa o'zgartirilmadi.
  // Mijozga «botdagi tugmadan foydalaning» deyiladi: u yerda raqamni
  // Telegram tasdiqlaydi va birlashtirish ishlaydi.
  if (phoneTaken) {
    return { status: 'PHONE_TAKEN' };
  }

  return { status: 'SAVED', user };
}
