import type { Lead } from '@/generated/prisma/client';
import { normalizePhone } from '@/lib/phone';
import { prisma } from '@/server/db';
import { resolveLeadClient } from './resolve-client';

/**
 * Ariza oqimi (§4.5).
 *
 * Tartib ataylab shunday: avval baza, keyin xabarnoma. TZ ning aniq talabi —
 * «Telegram API ning ishlamay qolishi arizani yo'qotmasligi kerak». Shuning
 * uchun xabarnoma nosozligi ham, osilib qolishi ham mijozga qaytariladigan
 * javobga ta'sir qilmaydi.
 */

export interface CreateLeadInput {
  phone: string;
  name?: string | undefined;
  productId?: string | undefined;
  source: 'MINIAPP' | 'WEB';
  comment?: string | undefined;
  telegramId?: bigint | undefined;
}

export interface CreateLeadDeps {
  notify?: ((lead: Lead) => Promise<void>) | undefined;
  notifyTimeoutMs?: number | undefined;
}

/** Tashqi servis osilib qolsa ham javob kutib qolmasligi kerak. */
const DEFAULT_NOTIFY_TIMEOUT_MS = 5_000;

export class LeadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeadValidationError';
  }
}

async function notifySafely(
  lead: Lead,
  { notify, notifyTimeoutMs }: CreateLeadDeps,
): Promise<void> {
  if (!notify) return;

  const timeout = notifyTimeoutMs ?? DEFAULT_NOTIFY_TIMEOUT_MS;

  try {
    await Promise.race([
      notify(lead),
      new Promise<void>((resolve) => setTimeout(resolve, timeout)),
    ]);
  } catch (error) {
    // Ariza allaqachon bazada. Xabarnoma yo'qolgani — kuzatiladigan hodisa,
    // lekin mijoz uchun xato emas.
    console.error('[leads] xabarnoma yuborilmadi', { leadId: lead.id, error });
  }
}

export async function createLead(input: CreateLeadInput, deps: CreateLeadDeps = {}): Promise<Lead> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new LeadValidationError('Telefon raqami noto‘g‘ri');
  }

  if (input.productId) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, isActive: true },
      select: { id: true },
    });
    if (!product) {
      throw new LeadValidationError('Mahsulot topilmadi yoki sotuvda emas');
    }
  }

  // §4.5, 3-qadam: normalizatsiya → mavjud mijozni qidirish → dublikatlarni
  // birlashtirish. Bu ariza yozilishidan oldin bo'ladi, chunki `userId` kerak.
  //
  // §6: raqam bu yerda TASDIQLANMAGAN — uni istalgan odam formaga yozishi
  // mumkin. Shuning uchun u begona yozuvga biriktirilmaydi. Ariza baribir
  // yaratiladi va `Lead.phone` da yozilgan raqam qoladi: menejer ko'radi va
  // kerak bo'lsa CRM da qo'lda birlashtiradi. Arizani rad etish mumkin emas —
  // haqiqiy mijoz shu yo'ldan keladi.
  const { user: client } = await resolveLeadClient({
    phone,
    name: input.name,
    telegramId: input.telegramId,
  });

  const lead = await prisma.lead.create({
    data: {
      userId: client.id,
      phone,
      name: input.name ?? null,
      productId: input.productId ?? null,
      source: input.source,
      status: 'NEW',
      comment: input.comment ?? null,
    },
  });

  // §4.5, 4-qadam: «Mijozga javob shu yerda qaytariladi» — shundan keyingi
  // hamma narsa muvaffaqiyatga ta'sir qilmaydi.
  await notifySafely(lead, deps);

  return lead;
}
