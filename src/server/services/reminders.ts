import type { Locale, NotificationKind } from '@/generated/prisma/client';
import { formatTashkentDate, tashkentDayDiff } from '@/lib/due-date';
import { escapeHtml } from '@/server/telegram/html';

/**
 * Almashtirish eslatmalari (§4.6).
 *
 * Bu fayl — qaror qismi: qaysi kartrijga qaysi eslatma tegishli va matn qanday
 * bo'ladi. Bazaga yozish va yuborish `reminder-sweep.ts` da.
 */

export type ReminderKind = NotificationKind;

/** §4.6: 30 kun, 7 kun va muddat kelgan kun. */
const THRESHOLDS: ReadonlyArray<{ kind: ReminderKind; daysLeft: number }> = [
  { kind: 'DUE', daysLeft: 0 },
  { kind: 'DAYS_7', daysLeft: 7 },
  { kind: 'DAYS_30', daysLeft: 30 },
];

/**
 * Shu kartrij uchun bugun qaysi eslatma tegishli.
 *
 * Ikkita qoida:
 * — chegara «aynan teng» emas, «o'tilgan» bo'lishi kerak: worker bir kun
 *   ishlamay qolsa, tenglik bo'yicha qidiruv eslatmani butunlay yo'qotardi;
 * — bir vaqtda bir nechta chegara o'tilgan bo'lsa, faqat eng shoshilinchi
 *   qaytadi. Muddatiga uch kun qolganda «30 kun qoldi» ni ham yuborish spam,
 *   va u mijozning keyingi xabarlarga ishonchini yo'qotadi.
 */
export function reminderKindFor(dueAt: Date, now: Date): ReminderKind | null {
  const daysLeft = tashkentDayDiff(now, dueAt);

  return THRESHOLDS.find((threshold) => daysLeft <= threshold.daysLeft)?.kind ?? null;
}

/** Rus tilida «1 день / 22 дня / 7 дней». */
function ruDays(count: number): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} дней`;

  const mod10 = count % 10;
  if (mod10 === 1) return `${count} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} дня`;

  return `${count} дней`;
}

export interface ReminderMessageInput {
  kind: ReminderKind;
  filterName: string;
  cartridgeName: string;
  dueAt: Date;
  now: Date;
  locale: Locale;
}

/**
 * Mijozga ketadigan xabar matni.
 *
 * Qolgan kunlar HAQIQIY holatdan hisoblanadi, chegara raqamidan emas: worker
 * kechikib, DAYS_30 eslatmasi 27 kun qolganda ketishi mumkin va «30 kun qoldi»
 * degan matn shunda yolg'on bo'lardi.
 */
export function buildReminderMessage(input: ReminderMessageInput): string {
  const daysLeft = tashkentDayDiff(input.now, input.dueAt);
  const date = formatTashkentDate(input.dueAt);
  const filter = escapeHtml(input.filterName);
  const cartridge = escapeHtml(input.cartridgeName);

  if (input.locale === 'RU') {
    const head = '<b>Замена картриджа</b>';
    const body = [`Аппарат: ${filter}`, `Картридж: ${cartridge}`];

    if (daysLeft > 0) {
      body.push(`Срок замены: ${date} — осталось ${ruDays(daysLeft)}.`);
    } else if (daysLeft === 0) {
      body.push(`Сегодня наступил срок замены: ${date}.`);
    } else {
      body.push(`Срок замены истёк ${date} — ${ruDays(-daysLeft)} назад.`);
    }

    return [head, ...body].join('\n');
  }

  const head = '<b>Kartrijni almashtirish</b>';
  const body = [`Apparat: ${filter}`, `Kartrij: ${cartridge}`];

  if (daysLeft > 0) {
    body.push(`Almashtirish muddati: ${date} — ${daysLeft} kun qoldi.`);
  } else if (daysLeft === 0) {
    body.push(`Bugun almashtirish muddati keldi: ${date}.`);
  } else {
    body.push(`Almashtirish muddati ${date} da o‘tdi — ${-daysLeft} kun oldin.`);
  }

  return [head, ...body].join('\n');
}
