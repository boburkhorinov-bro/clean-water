/**
 * Kartrij almashtirish muddatini hisoblash (§5, §4.6).
 *
 * Qoida bitta: `due_at` = shu kartrijning `installed_at` + uning
 * `resource_months` i. Buyurtma sanasi, ariza sanasi yoki apparat o'rnatilgan
 * sana emas — aynan shu kartrij o'rnatilgan sana. Bitta apparatda 6, 12 va 24
 * oylik kartrijlar birga turadi va ularning muddatlari boshqa-boshqa.
 *
 * Hisob **Toshkent kalendari** bo'yicha yuritiladi. O'zbekiston 1995 dan beri
 * qat'iy UTC+5 da, yozgi vaqt yo'q — shuning uchun siljish o'zgarmas va
 * `Intl` siz ham to'g'ri chiqadi.
 */

/** O'zbekiston — UTC+5, yil davomida o'zgarmaydi. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Instantni Toshkent kalendaridagi yarim tunga qisqartiradi. */
function tashkentMidnight(instant: Date): number {
  const time = instant.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError('Yaroqsiz sana');
  }
  return Math.floor((time + TASHKENT_OFFSET_MS) / DAY_MS) * DAY_MS;
}

function daysInMonth(year: number, monthIndex: number): number {
  // Keyingi oyning «0-kuni» — joriy oyning oxirgi kuni.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Sanaga oy qo'shadi, oy oxirini qisqartirib.
 *
 * 31-yanvarga bir oy qo'shilsa 31-fevral yo'q — 28 (kabisa yilida 29) chiqadi.
 * `Date.setMonth` buni 3-martga «to'kib yuboradi», bu esa mijozga muddat
 * o'tganidan keyin eslatma yuborishga olib kelardi.
 */
export function addMonthsTashkent(instant: Date, months: number): Date {
  const time = instant.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError('Yaroqsiz sana');
  }
  if (!Number.isInteger(months)) {
    throw new RangeError(`Oylar soni butun bo‘lishi kerak: ${months}`);
  }

  // Toshkent kalendarida ishlash uchun instantni siljitamiz va UTC
  // getterlaridan foydalanamiz — server vaqt mintaqasi hech narsani buzmaydi.
  const local = new Date(time + TASHKENT_OFFSET_MS);

  const totalMonths = local.getUTCMonth() + months;
  const year = local.getUTCFullYear() + Math.floor(totalMonths / 12);
  const monthIndex = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(local.getUTCDate(), daysInMonth(year, monthIndex));

  const shifted = Date.UTC(
    year,
    monthIndex,
    day,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );

  return new Date(shifted - TASHKENT_OFFSET_MS);
}

/**
 * Kartrijning almashtirish muddati.
 *
 * `resourceMonths` — `CartridgeSpec.resource_months`. Nol yoki manfiy qiymat
 * xato: bunday kartrij hech qachon eslatma olmaydi va indeksda abadiy qoladi.
 */
export function computeDueAt(installedAt: Date, resourceMonths: number): Date {
  if (!Number.isInteger(resourceMonths) || resourceMonths <= 0) {
    throw new RangeError(`Kartrij resursi musbat butun son bo‘lishi kerak: ${resourceMonths}`);
  }

  return addMonthsTashkent(installedAt, resourceMonths);
}

/**
 * Ikki instant orasidagi KALENDAR kunlari farqi (Toshkent bo'yicha).
 *
 * Eslatma qarori shu son bilan qabul qilinadi (§4.6). Soatlar farqi emas,
 * aynan kalendar kunlari: mijoz uchun «7 kun qoldi» — bu 168 soat emas,
 * balki kalendarda yetti kun.
 */
export function tashkentDayDiff(from: Date, to: Date): number {
  return Math.round((tashkentMidnight(to) - tashkentMidnight(from)) / DAY_MS);
}

/**
 * Toshkent sanasi `KK.OO.YYYY` ko'rinishida.
 *
 * `Intl` ishlatilmaydi: Docker obrazida to'liq ICU bo'lishiga tayanmaslik
 * kerak, o'zgarmas siljish bilan hisob esa aniq va tekshirilgan.
 */
export function formatTashkentDate(instant: Date): string {
  const local = new Date(tashkentMidnight(instant));
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');

  return `${day}.${month}.${local.getUTCFullYear()}`;
}
