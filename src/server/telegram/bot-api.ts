import type { Locale } from '@/generated/prisma/client';
import { buildTelegramError } from './notify-manager';

/**
 * Telegram Bot API ning mijozga xabar yuborish qismi (§4.6).
 *
 * Menejerlarga xabar (`notify-manager.ts`) dan farqi: u yerda nosozlikda
 * darhol qayta uriniladi, bu yerda esa YO'Q. Eslatmalar uchun qayta urinish
 * mexanizmi — kunlik o'tishning o'zi: yuborilmagan satr `FAILED` bo'lib
 * qoladi va ertasi kuni qayta olinadi (§4.6 — «keyingi o'tishga ko'chiradi»).
 */

const TELEGRAM_API = 'https://api.telegram.org';

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboard {
  inline_keyboard: InlineButton[][];
}

/** §4.6: «Almashtirishga buyurtma» — katalogdan o'tmasdan darhol ariza. */
export function buildReplaceKeyboard(installedPartId: string, locale: Locale): InlineKeyboard {
  const text = locale === 'RU' ? 'Заказать замену' : 'Almashtirishga buyurtma';

  return { inline_keyboard: [[{ text, callback_data: `replace:${installedPartId}` }]] };
}

function requireToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN o‘rnatilmagan');
  }
  return token;
}

/**
 * Telegram javobidan xato quradi — sababi bilan birga.
 *
 * Sabab shu yerdan `notifications.error` ustuniga tushadi. Faqat status kodi
 * yozilsa, satr har kuni qayta olinadi va nima uchun yetib bormayotgani hech
 * qachon aniqlanmaydi: mijoz botni bloklaganmi, chat o'chganmi, token
 * bekor qilinganmi — hammasi bir xil `403` ko'rinadi.
 */
async function errorOf(response: Response, method: string): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  return buildTelegramError(response.status, body, method);
}

export interface SendBotMessageInput {
  chatId: bigint;
  text: string;
  replyMarkup?: InlineKeyboard | undefined;
}

export async function sendBotMessage(input: SendBotMessageInput): Promise<void> {
  const token = requireToken();

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // `bigint` JSON ga sig'maydi; Telegram satr ko'rinishidagi chat_id ni
      // qabul qiladi va katta ID lar shu yo'l bilan aniq qoladi.
      chat_id: input.chatId.toString(),
      text: input.text,
      parse_mode: 'HTML',
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
    }),
  });

  if (!response.ok) {
    // 429 ham shu yerdan o'tadi: `buildTelegramError` uni `retry_after` ni
    // olib yuruvchi alohida xatoga aylantiradi va o'tish uni hurmat qiladi.
    throw await errorOf(response, 'sendMessage');
  }
}

export interface AnswerCallbackInput {
  callbackQueryId: string;
  text: string;
}

/**
 * Tugma bosilganidagi qalqib chiquvchi javob.
 *
 * Javobsiz tugma foydalanuvchida «yuklanmoqda» holatida osilib qoladi va u
 * qayta-qayta bosadi.
 */
export async function answerCallbackQuery(input: AnswerCallbackInput): Promise<void> {
  const token = requireToken();

  const response = await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: input.callbackQueryId,
      text: input.text,
      show_alert: true,
    }),
  });

  if (!response.ok) {
    throw await errorOf(response, 'answerCallbackQuery');
  }
}
