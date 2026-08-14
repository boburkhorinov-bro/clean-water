import { isBootstrapAdmin } from '@/server/auth/admin-allowlist';

export type Role = 'CLIENT' | 'ADMIN';

interface ResolveRoleInput {
  telegramId: string | number | bigint;
  /** Bazadagi joriy rol; yangi foydalanuvchi uchun `null`. */
  currentRole: Role | null;
  /** `TELEGRAM_ADMIN_IDS` qiymati. */
  adminIds: string | undefined;
}

/**
 * Kirish paytida foydalanuvchining rolini aniqlaydi (§4.4).
 *
 * Qoida: `TELEGRAM_ADMIN_IDS` faqat KO'TARADI. Admin panel orqali berilgan
 * ADMIN roli env da yo'qligi uchun tushirilmaydi — aks holda har kirishda
 * adminlar huquqini yo'qotardi.
 */
export function resolveRole({ telegramId, currentRole, adminIds }: ResolveRoleInput): Role {
  if (currentRole === 'ADMIN') return 'ADMIN';
  if (isBootstrapAdmin(telegramId, adminIds)) return 'ADMIN';
  return 'CLIENT';
}
