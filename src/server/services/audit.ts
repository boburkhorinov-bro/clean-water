import type { Prisma } from '@/generated/prisma/client';

/**
 * Administrator harakatlari jurnali (§6, §7).
 *
 * Jurnal yozuvi asosiy amal bilan BITTA tranzaksiyada yoziladi — shuning
 * uchun bu yerda `prisma` emas, tranzaksiya klienti qabul qilinadi. Sabab
 * oddiy: to'liq bo'lmagan jurnal jurnal emas. Amal o'tib, yozuv esa yiqilsa,
 * o'zgarishni kim qilgani abadiy noma'lum bo'lib qolardi.
 */

/** Jurnalga hech qachon tushmaydigan kalitlar (§6 — sirlar faqat env da). */
const SECRET_KEY_PATTERN = /token|secret|password|passwd|apikey|api_key|authorization|cookie/i;

/** Bitta matn maydonining chegarasi — jurnal bazani to'ldirmasligi kerak. */
const MAX_STRING_LENGTH = 1_000;
const MAX_DEPTH = 8;

/**
 * Payload ni jurnalga yozishga tayyorlaydi.
 *
 * Filtr oq ro'yxat emas, QORA ro'yxat: yangi maydon qo'shilganda u jurnalga
 * o'z-o'zidan tushadi (aks holda jurnal jimgina bo'shab qolardi), lekin nomi
 * sirga o'xshagan maydon hech qachon tushmaydi.
 */
export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[…]';

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }

  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditPayload(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    result[key] = sanitizeAuditPayload(item, depth + 1);
  }

  return result;
}

export interface AuditInput {
  adminId: string;
  /** Nima qilindi: `product.create`, `lead.status`, `installation.create`. */
  action: string;
  /** Nimaga qilindi: `Product:<uuid>`. */
  entity: string;
  payload?: unknown;
}

/** Tranzaksiya klienti — `prisma` ning o'zi ham, `tx` ham bo'lishi mumkin. */
type AuditClient = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
};

export async function recordAudit(client: AuditClient, input: AuditInput): Promise<void> {
  await client.auditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      entity: input.entity,
      payload: (sanitizeAuditPayload(input.payload) ?? undefined) as Prisma.InputJsonValue,
    },
  });
}
