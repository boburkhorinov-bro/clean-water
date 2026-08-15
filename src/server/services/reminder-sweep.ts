import type { Locale } from '@/generated/prisma/client';
import { addMonthsTashkent } from '@/lib/due-date';
import { localized } from '@/lib/i18n/localized';
import { prisma } from '@/server/db';
import { findPartsNeedingReminder } from '@/server/repositories/reminder-repository';
import { TelegramRateLimitError } from '@/server/telegram/notify-manager';
import { buildReminderMessage, reminderKindFor, type ReminderKind } from './reminders';

/**
 * Kunlik eslatma o'tishi (§4.6).
 *
 * Yuborish transport sifatida beriladi: worker haqiqiy Telegram ni ulaydi,
 * testlar esa yozib boruvchi soxta transportni. Mantiqning o'zi — qaysi
 * kartrijga qaysi eslatma va u allaqachon ketganmi — bazaga bog'liq va
 * haqiqiy bazada tekshiriladi.
 */

/** Eng uzoq chegara — 30 kun. Undan narigi kartrijlarni tanlashning hojati yo'q. */
const HORIZON_MONTHS = 2;

export interface ReminderTarget {
  installedPartId: string;
  kind: ReminderKind;
  chatId: bigint;
  text: string;
  locale: Locale;
}

export interface ReminderSweepDeps {
  send: (target: ReminderTarget) => Promise<void>;
  now?: Date | undefined;
}

export interface ReminderSweepResult {
  sent: number;
  /** Allaqachon yuborilgan — unikal indeks dublikatni to'sgan. */
  skipped: number;
  failed: number;
  rateLimited: boolean;
  retryAfterSeconds: number | null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runReminderSweep(deps: ReminderSweepDeps): Promise<ReminderSweepResult> {
  const now = deps.now ?? new Date();
  const result: ReminderSweepResult = {
    sent: 0,
    skipped: 0,
    failed: 0,
    rateLimited: false,
    retryAfterSeconds: null,
  };

  // Gorizont sanasi: 30 kunlik chegaradan narigi kartrijlar bugun hech qanday
  // eslatma olmaydi, ularni bazadan tortishning ma'nosi yo'q.
  const parts = await findPartsNeedingReminder(addMonthsTashkent(now, HORIZON_MONTHS));

  for (const part of parts) {
    const chatId = part.installation.user.telegramId;
    // Telegram siz mijozga yuboradigan manzil yo'q. Satr ham yaratilmaydi:
    // u keyinchalik Mini App ga kirsa, eslatma o'sha zahoti tiklanishi kerak.
    if (chatId === null) continue;

    const kind = reminderKindFor(part.dueAt, now);
    if (!kind) continue;

    const existing = await prisma.notification.findUnique({
      where: { installed_part_kind: { installedPartId: part.id, kind } },
    });

    // §4.6: idempotentlik. Yuborilgani qayta yuborilmaydi.
    if (existing?.status === 'SENT') {
      result.skipped += 1;
      continue;
    }

    // Yuborilmagan satr qayta ishlatiladi: nosozlikdan keyin yangi satr
    // yaratib bo'lmaydi — unikal indeks ruxsat bermaydi va eslatma
    // butunlay yo'qolardi.
    const notification =
      existing ??
      (await prisma.notification.create({
        data: { installedPartId: part.id, kind, scheduledAt: now, status: 'PENDING' },
      }));

    // §4.7: mijoz o'z tilida oladi. Tarjima bo'sh bo'lsa o'zbekchaga tushadi.
    const locale = part.installation.user.lang;
    const target: ReminderTarget = {
      installedPartId: part.id,
      kind,
      chatId,
      locale,
      text: buildReminderMessage({
        kind,
        filterName: localized(
          {
            uz: part.installation.filterProduct.nameUz,
            ru: part.installation.filterProduct.nameRu,
          },
          locale === 'RU' ? 'ru' : 'uz',
        ),
        cartridgeName: localized(
          { uz: part.cartridgeProduct.nameUz, ru: part.cartridgeProduct.nameRu },
          locale === 'RU' ? 'ru' : 'uz',
        ),
        dueAt: part.dueAt,
        now,
        locale,
      }),
    };

    try {
      await deps.send(target);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date(), error: null },
      });
      result.sent += 1;
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', error: errorText(error) },
      });
      result.failed += 1;

      // §4.6: 429 da `retry_after` ni hurmat qilamiz va qolganini keyingi
      // o'tishga qoldiramiz. Cheklov botga umumiy qo'yiladi — davom etish
      // faqat blokni uzaytirardi.
      if (error instanceof TelegramRateLimitError) {
        result.rateLimited = true;
        result.retryAfterSeconds = error.retryAfterSeconds;
        break;
      }
    }
  }

  return result;
}
