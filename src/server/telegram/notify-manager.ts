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

  constructor(retryAfterSeconds: number) {
    super(`Telegram 429, retry_after=${retryAfterSeconds}`);
    this.name = 'TelegramRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function retryAfterOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'retryAfterSeconds' in error) {
    const value = (error as { retryAfterSeconds: unknown }).retryAfterSeconds;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
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

      if (response.status === 429) {
        const body = (await response.json().catch(() => null)) as {
          parameters?: { retry_after?: number };
        } | null;
        throw new TelegramRateLimitError(body?.parameters?.retry_after ?? 30);
      }

      if (!response.ok) {
        throw new Error(`Telegram sendMessage ${response.status}`);
      }

      return response;
    },
    { attempts: 3, sleep },
  );
}
