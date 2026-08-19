import type { User } from '@/generated/prisma/client';
import { normalizePhone } from '@/lib/phone';
import {
  countClients,
  findClientWithHistory,
  findClients,
  type ClientFilter,
} from '@/server/repositories/client-repository';
import { resolveLeadClient } from './resolve-client';

/**
 * CRM: mijozlar bazasi (§7 dagi 6-band).
 *
 * Bu qatlamning ikkita vazifasi bor: menejerning qidiruv satrini tushunish va
 * mijoz kartochkasini yig'ish. Dublikat birlashtirish alohida yozilgan
 * (`resolve-client.ts`) va bu yerdan qayta ishlatiladi — CRM da qo'lda
 * qo'shilgan mijoz Telegramdan kelganida ikkinchi yozuv paydo bo'lmasligi
 * kerak, aks holda eslatmalar unga yetib bormaydi (§5).
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** Bir-ikki raqam bo'yicha qidiruv butun bazani qaytaradi — foydasi yo'q. */
const MIN_PHONE_FRAGMENT = 3;

export interface ListClientsParams {
  query?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ClientListItem {
  id: string;
  phone: string | null;
  name: string | null;
  telegramId: bigint | null;
  createdAt: Date;
  leadCount: number;
  installationCount: number;
}

export interface ListClientsResult {
  items: ClientListItem[];
  total: number;
}

/**
 * Qidiruv satrini tushunadi.
 *
 * Menejer raqamni mijoz aytganicha yozadi: `+998 90 123-45-67`, `901234567`
 * yoki oxirgi to'rt raqam. Ism ham shu maydonga kiritiladi — alohida
 * «telefon» va «ism» maydonlari CRM da ortiqcha bosqich bo'lardi.
 */
function toFilter(query: string | undefined): ClientFilter {
  const trimmed = query?.trim();
  if (!trimmed) return {};

  const digits = trimmed.replace(/\D/g, '');
  const phoneExact = normalizePhone(trimmed) ?? undefined;

  return {
    phoneExact,
    phoneFragment: !phoneExact && digits.length >= MIN_PHONE_FRAGMENT ? digits : undefined,
    nameFragment: trimmed,
  };
}

export async function listClients(params: ListClientsParams): Promise<ListClientsResult> {
  const filter = toFilter(params.query);
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  const [rows, total] = await Promise.all([
    findClients(filter, { limit, offset }),
    countClients(filter),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      name: row.name,
      telegramId: row.telegramId,
      createdAt: row.createdAt,
      leadCount: row._count.leads,
      installationCount: row._count.installations,
    })),
    total,
  };
}

export type ClientProfile = NonNullable<Awaited<ReturnType<typeof findClientWithHistory>>>;

export function getClientProfile(userId: string): Promise<ClientProfile | null> {
  return findClientWithHistory(userId);
}

export interface RegisterClientInput {
  phone: string;
  name?: string | undefined;
  telegramId?: bigint | undefined;
}

/**
 * Menejer mijozni qo'lda qo'shadi (qo'ng'iroq yoki do'kondan kelgan mijoz).
 *
 * Ataylab `resolveLeadClient` orqali: shu raqam bilan mijoz allaqachon bor
 * bo'lsa, yangisi yaratilmaydi va tarixi bir joyda qoladi.
 *
 * §6: raqam TASDIQLANGAN hisoblanadi — uni admin panelga menejer kiritadi,
 * ya'ni ortida haqiqiy odam va qo'ng'iroq turadi. Aynan shu yerda
 * dublikatlarni birlashtirish ishlashi kerak: mijoz Mini App ga kirgan
 * bo'lsa, uning Telegram yozuvi bilan o'rnatish bitta profilda qoladi.
 */
export async function registerClient(input: RegisterClientInput): Promise<User> {
  const { user } = await resolveLeadClient({ ...input, verified: true });
  return user;
}
