import type { Lead } from '@/generated/prisma/client';
import { prisma } from '@/server/db';
import { escapeHtml } from './html';

/**
 * Menejerlar guruhiga ariza haqida xabar (§4.5).
 *
 * Xabar Telegram ning HTML rejimida ketadi, ya'ni mijoz kiritgan ism va izoh
 * markupga tushadi. Ular ekranlanmasa: eng yaxshi holatda Telegram xabarni
 * «buzuq HTML» deb rad etadi va menejer arizani ko'rmaydi, eng yomonida —
 * soxta havola qo'yiladi.
 */

const TELEGRAM_API = 'https://api.telegram.org';

export interface LeadMessageInput {
  phone: string;
  name: string | null;
  productName: string | null;
  source: 'MINIAPP' | 'WEB';
  comment: string | null;
}

export function buildLeadMessage(input: LeadMessageInput): string {
  const sourceLabel = input.source === 'MINIAPP' ? 'Mini App' : 'Sayt';

  const lines = ['<b>Yangi ariza</b>', `Telefon: <code>${escapeHtml(input.phone)}</code>`];

  if (input.name) lines.push(`Ism: ${escapeHtml(input.name)}`);
  if (input.productName) lines.push(`Mahsulot: ${escapeHtml(input.productName)}`);
  lines.push(`Manba: ${sourceLabel}`);
  if (input.comment) lines.push(`Izoh: ${escapeHtml(input.comment)}`);

  return lines.join('\n');
}

interface RetryOptions {
  attempts: number;
  sleep: (ms: number) => Promise<void> | void;
  baseDelayMs?: number;
}

/** Telegram 429 bilan javob berganda qancha kutish kerakligini olib yuruvchi xato. */
export class TelegramRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  /** 429 taslim bo'lishni emas, kutishni talab qiladi. */
  readonly permanent = false;

  constructor(retryAfterSeconds: number) {
    super(`Telegram 429, retry_after=${retryAfterSeconds}`);
    this.name = 'TelegramRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Telegram javobidagi tashxis uchun zarur hamma narsani olib yuruvchi xato.
 *
 * `description` ni tashlab yubormaslik muhim: `403` ning o'zi bot
 * chiqarilganini ham, huquq yo'qligini ham, guruh o'chganini ham bildirishi
 * mumkin. Bularning har biri boshqacha harakat talab qiladi, va farqni faqat
 * Telegram ning matni aytadi.
 */
export class TelegramSendError extends Error {
  readonly status: number;
  readonly description: string | null;
  /** 4xx — qayta urinish yordam bermaydi, faqat mijozni kuttiradi. */
  readonly permanent: boolean;
  /** Guruh supergruppaga aylanganda Telegram beradigan yangi `chat_id`. */
  readonly migrateToChatId: string | null;

  constructor(params: {
    status: number;
    description: string | null;
    migrateToChatId: string | null;
    method: string;
  }) {
    const parts = [`Telegram ${params.method} ${params.status}`];
    if (params.description) parts.push(params.description);
    if (params.migrateToChatId) {
      parts.push(
        `guruh supergruppaga aylandi — TELEGRAM_MANAGER_CHAT_ID ni ` +
          `${params.migrateToChatId} ga o‘zgartiring va xizmatni qayta ishga tushiring`,
      );
    }

    super(parts.join(': '));
    this.name = 'TelegramSendError';
    this.status = params.status;
    this.description = params.description;
    this.migrateToChatId = params.migrateToChatId;
    this.permanent = params.status >= 400 && params.status < 500;
  }
}

interface TelegramErrorBody {
  description?: unknown;
  parameters?: {
    retry_after?: unknown;
    migrate_to_chat_id?: unknown;
  };
}

/**
 * Telegram javobidan xato quradi.
 *
 * Tana JSON bo'lmasligi mumkin (oradagi proksi HTML qaytarishi mumkin), shuning
 * uchun har bir maydon alohida tekshiriladi — tashxis xabari yo'qolgani
 * xatoning o'zini yo'qotmasligi kerak.
 */
export function buildTelegramError(
  status: number,
  body: unknown,
  method = 'sendMessage',
): Error {
  const parsed: TelegramErrorBody = typeof body === 'object' && body !== null ? body : {};

  if (status === 429) {
    const retryAfter = parsed.parameters?.retry_after;
    return new TelegramRateLimitError(typeof retryAfter === 'number' ? retryAfter : 30);
  }

  const migrate = parsed.parameters?.migrate_to_chat_id;

  return new TelegramSendError({
    status,
    method,
    description: typeof parsed.description === 'string' ? parsed.description : null,
    migrateToChatId: typeof migrate === 'number' ? String(migrate) : null,
  });
}

function retryAfterOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'retryAfterSeconds' in error) {
    const value = (error as { retryAfterSeconds: unknown }).retryAfterSeconds;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function isPermanent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'permanent' in error &&
    (error as { permanent: unknown }).permanent === true
  );
}

export async function sendWithRetry<T>(
  send: () => Promise<T>,
  { attempts, sleep, baseDelayMs = 1_000 }: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await send();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;

      // Doimiy xatoda (bot chiqarilgan, guruh o'chgan, chat topilmadi) qayta
      // urinish natijani o'zgartirmaydi, faqat vaqt yeydi — va bu vaqtni MIJOZ
      // kutadi: xabarnoma javobdan oldin bajariladi. O'lchangan farq:
      // 3 urinish bilan 15.4 s, bittasi bilan 2.4 s.
      if (isPermanent(error)) break;

      // §4.6: 429 da o'z kechikishimizni emas, Telegram bergan qiymatni
      // hurmat qilamiz — aks holda blokdan chiqa olmaymiz.
      const retryAfter = retryAfterOf(error);
      await sleep(retryAfter !== null ? retryAfter * 1_000 : baseDelayMs * attempt);
    }
  }

  throw lastError;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Arizani menejerlar guruhiga yuboradi.
 *
 * Chaqiruvchi (`createLead`) bu funksiyaning xatosini yutadi — ariza
 * allaqachon bazada va mijoz uchun muvaffaqiyatli.
 */
export async function notifyManagers(lead: Lead): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN yoki TELEGRAM_MANAGER_CHAT_ID o‘rnatilmagan');
  }

  const product = lead.productId
    ? await prisma.product.findUnique({
        where: { id: lead.productId },
        select: { nameUz: true },
      })
    : null;

  const text = buildLeadMessage({
    phone: lead.phone,
    name: lead.name,
    productName: product?.nameUz ?? null,
    source: lead.source,
    comment: lead.comment,
  });

  await sendWithRetry(
    async () => {
      const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: 'Ishga olish', callback_data: `lead:take:${lead.id}` }]],
          },
        }),
      });

      if (!response.ok) {
        // Tana faqat shu yerda o'qiladi: muvaffaqiyatli javobda u kerak emas.
        const body: unknown = await response.json().catch(() => null);
        throw buildTelegramError(response.status, body);
      }

      return response;
    },
    { attempts: 3, sleep },
  );
}
