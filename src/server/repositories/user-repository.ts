import type { Locale as PrismaLocale, User } from '@/generated/prisma/client';
import { prisma } from '@/server/db';
import { resolveRole } from '@/server/services/resolve-role';

export interface TelegramUserInput {
  telegramId: bigint;
  firstName: string | undefined;
  lastName: string | undefined;
  languageCode: string | undefined;
}

function toName(firstName: string | undefined, lastName: string | undefined): string | null {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
}

/** §4.7: noma'lum til o'zbekchaga tushadi. */
function toLocale(languageCode: string | undefined): PrismaLocale {
  return languageCode?.toLowerCase().startsWith('ru') ? 'RU' : 'UZ';
}

/**
 * Telegram foydalanuvchisini yaratadi yoki yangilaydi (§4.4).
 *
 * Rol alohida hisoblanadi: `TELEGRAM_ADMIN_IDS` faqat ko'taradi, admin panel
 * orqali berilgan ADMIN ni tushirmaydi — `resolveRole` ga qarang.
 */
export async function upsertTelegramUser(input: TelegramUserInput): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { telegramId: input.telegramId } });

  const role = resolveRole({
    telegramId: input.telegramId,
    currentRole: existing?.role ?? null,
    adminIds: process.env.TELEGRAM_ADMIN_IDS,
  });

  const name = toName(input.firstName, input.lastName);
  const lang = toLocale(input.languageCode);

  return prisma.user.upsert({
    where: { telegramId: input.telegramId },
    create: { telegramId: input.telegramId, name, lang, role },
    // Mavjud foydalanuvchida tilni qayta yozmaymiz: u profilda qo'lda
    // o'zgartirgan bo'lishi mumkin (§4.7).
    update: { name, role },
  });
}
