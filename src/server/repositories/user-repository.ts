import type { Locale as PrismaLocale, User } from '@/generated/prisma/client';
import { prisma } from '@/server/db';
import { resolveRole } from '@/server/services/resolve-role';

/**
 * Mini App interfeysi tili (§4.7).
 *
 * Foydalanuvchi profilda tanlagan til shu yerda saqlanadi; u yo'q bo'lsa
 * o'zbekchaga tushamiz — bo'sh ekran ko'rsatmaymiz.
 */
export async function findUserLocale(userId: string): Promise<'uz' | 'ru'> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lang: true } });
  return user?.lang === 'RU' ? 'ru' : 'uz';
}

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
