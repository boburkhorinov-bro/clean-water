import type { Lead, LeadStatus } from '@/generated/prisma/client';
import { normalizePhone } from '@/lib/phone';
import { prisma } from '@/server/db';
import {
  countAdminLeads,
  findAdminLeads,
  type LeadFilter,
} from '@/server/repositories/lead-repository';
import { recordAudit } from './audit';

/**
 * Admin panel: arizalar bilan ishlash (§4.5, 6-qadam).
 *
 * Oqim qat'iy: `new → in_work → done | rejected`. Ishga olinmagan ariza
 * «bajarildi» bo'la olmaydi — aks holda statistika yolg'on bo'ladi va
 * menejerning haqiqiy ishi ko'rinmay qoladi.
 *
 * Orqaga qaytish cheklangan holda ruxsat etiladi: menejer tugmani xato
 * bosishi odatiy hol va uni tuzatib bo'lmasa, ariza abadiy noto'g'ri
 * holatda qolardi. Bajarilgan ishdan qaytish esa yo'q — u sodir bo'lgan.
 */

export class LeadStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeadStatusError';
  }
}

/** Ruxsat etilgan o'tishlar. `DONE` — yakuniy holat. */
const ALLOWED_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ['IN_WORK', 'REJECTED'],
  IN_WORK: ['DONE', 'REJECTED', 'NEW'],
  REJECTED: ['NEW'],
  DONE: [],
};

export async function changeLeadStatus(
  leadId: string,
  status: LeadStatus,
  adminId: string,
  note?: string,
): Promise<Lead> {
  const current = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!current) {
    throw new LeadStatusError(`Ariza topilmadi: ${leadId}`);
  }

  if (current.status === status) {
    throw new LeadStatusError(`Ariza allaqachon «${status}» holatida`);
  }

  if (!ALLOWED_TRANSITIONS[current.status].includes(status)) {
    throw new LeadStatusError(`«${current.status}» dan «${status}» ga o‘tib bo‘lmaydi`);
  }

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.update({ where: { id: leadId }, data: { status } });

    await recordAudit(tx, {
      adminId,
      action: 'lead.status',
      entity: `Lead:${leadId}`,
      payload: { from: current.status, to: status, ...(note ? { note } : {}) },
    });

    return lead;
  });
}

export interface AdminLeadListItem {
  id: string;
  phone: string;
  name: string | null;
  status: LeadStatus;
  source: 'MINIAPP' | 'WEB';
  comment: string | null;
  productName: string | null;
  clientId: string | null;
  createdAt: Date;
}

export interface ListAdminLeadsParams {
  status?: LeadStatus | undefined;
  query?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** Bir-ikki raqam bo'yicha qidiruv butun bazani qaytaradi — foydasi yo'q. */
const MIN_PHONE_FRAGMENT = 3;

/**
 * Qidiruv satrini tushunadi — mijozlar bazasidagi bilan bir xil qoida:
 * menejer raqamni mijoz aytganicha yozadi yoki ismni kiritadi.
 */
function toFilter(params: ListAdminLeadsParams): LeadFilter {
  const trimmed = params.query?.trim();
  if (!trimmed) return { status: params.status };

  const digits = trimmed.replace(/\D/g, '');
  const phoneExact = normalizePhone(trimmed) ?? undefined;

  return {
    status: params.status,
    phoneExact,
    phoneFragment: !phoneExact && digits.length >= MIN_PHONE_FRAGMENT ? digits : undefined,
    nameFragment: trimmed,
  };
}

export async function listLeadsForAdmin(
  params: ListAdminLeadsParams,
): Promise<{ items: AdminLeadListItem[]; total: number }> {
  const filter = toFilter(params);
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  const [rows, total] = await Promise.all([
    findAdminLeads(filter, { limit, offset }),
    countAdminLeads(filter),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      name: row.name,
      status: row.status,
      source: row.source,
      comment: row.comment,
      productName: row.product?.nameUz ?? null,
      clientId: row.userId,
      createdAt: row.createdAt,
    })),
    total,
  };
}
