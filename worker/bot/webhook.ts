import { z } from 'zod';
import type { ReplacementRequestStatus } from '@/server/services/replacement-request';

/**
 * Telegram webhook (§4.6).
 *
 * Bu fayl — sof qaror qatlami: HTTP ham, Telegram API ham bu yerda yo'q,
 * ular `worker/index.ts` da ulanadi. Shu sababli butun oqim (sirni tekshirish,
 * marshrutlash, javob matni) tarmoqsiz test qilinadi.
 */

export const REPLACE_CALLBACK_PREFIX = 'replace:';

/**
 * Telegram `callback_query` ning bizga keraklik qismi.
 *
 * `from.id` — JSON soni. Telegram foydalanuvchi ID lari 52 bitga sig'adi
 * (rasman e'lon qilingan chegara), shuning uchun `Number` orqali o'tish
 * aniqlikni yo'qotmaydi; bazada esa u `BigInt` bo'lib saqlanadi.
 */
const updateSchema = z.object({
  callback_query: z
    .object({
      id: z.string(),
      from: z.object({
        id: z.number().int(),
        language_code: z.string().optional(),
      }),
      data: z.string().optional(),
    })
    .optional(),
});

export interface WebhookRequest {
  /** `X-Telegram-Bot-Api-Secret-Token` sarlavhasi. */
  secretToken: string | undefined;
  body: unknown;
}

export interface WebhookDeps {
  secret: string | undefined;
  requestReplacement: (input: {
    installedPartId: string;
    telegramId: bigint;
  }) => Promise<{ status: ReplacementRequestStatus }>;
  answerCallback: (input: { callbackQueryId: string; text: string }) => Promise<void>;
}

export interface WebhookResponse {
  status: number;
}

const REPLIES: Record<'uz' | 'ru', Record<ReplacementRequestStatus | 'ERROR', string>> = {
  uz: {
    CREATED: 'Arizangiz qabul qilindi. Menejer tez orada bog‘lanadi.',
    ALREADY_REQUESTED: 'Bu kartrij bo‘yicha ariza allaqachon qabul qilingan.',
    PHONE_REQUIRED: 'Ariza uchun telefon raqami kerak. Uni ilovada qoldiring.',
    NOT_FOUND: 'Kartrij topilmadi.',
    ERROR: 'Ariza yuborilmadi. Birozdan so‘ng qayta urinib ko‘ring.',
  },
  ru: {
    CREATED: 'Заявка принята. Менеджер скоро свяжется с вами.',
    ALREADY_REQUESTED: 'Заявка на этот картридж уже принята.',
    PHONE_REQUIRED: 'Для заявки нужен номер телефона. Оставьте его в приложении.',
    NOT_FOUND: 'Картридж не найден.',
    ERROR: 'Заявка не отправлена. Попробуйте чуть позже.',
  },
};

function replyLocale(languageCode: string | undefined): 'uz' | 'ru' {
  return languageCode?.toLowerCase().startsWith('ru') ? 'ru' : 'uz';
}

export async function handleTelegramUpdate(
  request: WebhookRequest,
  deps: WebhookDeps,
): Promise<WebhookResponse> {
  // §6: sir sozlanmagan bo'lsa webhook umuman ishlamaydi. Ochiq qoldirish —
  // istalgan odam uchun boshqa mijozlar nomidan ariza generatori demak.
  if (!deps.secret || request.secretToken !== deps.secret) {
    return { status: 401 };
  }

  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success) {
    // Telegram 200 dan boshqa javobda updateni qayta yuboraveradi.
    return { status: 200 };
  }

  const query = parsed.data.callback_query;
  const data = query?.data;
  if (!query || !data?.startsWith(REPLACE_CALLBACK_PREFIX)) {
    return { status: 200 };
  }

  const installedPartId = data.slice(REPLACE_CALLBACK_PREFIX.length).trim();
  if (!installedPartId) {
    return { status: 200 };
  }

  const replies = REPLIES[replyLocale(query.from.language_code)];

  let text: string;
  try {
    const result = await deps.requestReplacement({
      installedPartId,
      telegramId: BigInt(query.from.id),
    });
    text = replies[result.status];
  } catch (error) {
    // Mijoz tugmani bosdi va javob kutmoqda — jimlik eng yomon javob.
    console.error('[worker] almashtirish arizasi yaratilmadi', error);
    text = replies.ERROR;
  }

  try {
    await deps.answerCallback({ callbackQueryId: query.id, text });
  } catch (error) {
    // Ariza allaqachon bazada. Javob ko'rsatilmagani noqulaylik, lekin
    // 200 dan boshqa javob Telegramni updateni qayta yuborishga majbur
    // qilardi — bu esa hech narsani tuzatmaydi.
    console.error('[worker] tugmaga javob berilmadi', error);
  }

  return { status: 200 };
}
