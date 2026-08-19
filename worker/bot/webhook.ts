import { z } from 'zod';
import type { ReplacementRequestStatus } from '@/server/services/replacement-request';
import type { SavePhoneStatus } from '@/server/services/save-phone';

/**
 * Telegram webhook (§4.6).
 *
 * Bu fayl — sof qaror qatlami: HTTP ham, Telegram API ham bu yerda yo'q,
 * ular `worker/index.ts` da ulanadi. Shu sababli butun oqim (sirni tekshirish,
 * marshrutlash, javob matni) tarmoqsiz test qilinadi.
 *
 * Ikkita update turi qabul qilinadi:
 *   - `callback_query` — eslatmadagi «Almashtirishga buyurtma» tugmasi;
 *   - `message.contact` — telefonsiz mijoz raqamini ulashgani (§4.5).
 */

export const REPLACE_CALLBACK_PREFIX = 'replace:';

/**
 * Telegram updatening bizga keraklik qismi.
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
  message: z
    .object({
      // Xabarning qolgan maydonlari ataylab tasvirlanmagan: bot matnli
      // xabarlarga javob bermaydi va ular jimgina o'tkazib yuboriladi.
      chat: z.object({ id: z.number().int() }).optional(),
      from: z
        .object({
          id: z.number().int(),
          language_code: z.string().optional(),
        })
        .optional(),
      contact: z
        .object({
          phone_number: z.string(),
          /**
           * Kontakt Telegram foydalanuvchisiga tegishli bo'lsa to'ladi.
           * Manzillar kitobidagi Telegram da yo'q odam uchun bo'sh keladi —
           * bunday kontaktning egasini tekshirib bo'lmaydi.
           */
          user_id: z.number().int().optional(),
          first_name: z.string().optional(),
        })
        .optional(),
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
  savePhone: (input: {
    telegramId: bigint;
    phone: string;
    name?: string | undefined;
  }) => Promise<{ status: SavePhoneStatus }>;
  /**
   * `requestContact` — xabarga «Raqamni yuborish» klaviaturasini ulaydi.
   * `locale` o'sha tugmaning matni uchun: xabar ruscha, tugma o'zbekcha
   * bo'lib qolmasligi kerak.
   */
  sendMessage: (input: {
    chatId: bigint;
    text: string;
    locale: 'uz' | 'ru';
    requestContact?: boolean;
  }) => Promise<void>;
}

export interface WebhookResponse {
  status: number;
}

type ReplyKey =
  | ReplacementRequestStatus
  | 'ERROR'
  | 'PHONE_PROMPT'
  | 'PHONE_SAVED'
  | 'PHONE_FOREIGN'
  | 'PHONE_INVALID'
  | 'PHONE_ERROR';

const REPLIES: Record<'uz' | 'ru', Record<ReplyKey, string>> = {
  uz: {
    CREATED: 'Arizangiz qabul qilindi. Menejer tez orada bog‘lanadi.',
    ALREADY_REQUESTED: 'Bu kartrij bo‘yicha ariza allaqachon qabul qilingan.',
    PHONE_REQUIRED: 'Ariza uchun telefon raqami kerak. Uni quyidagi tugma orqali yuboring.',
    NOT_FOUND: 'Kartrij topilmadi.',
    ERROR: 'Ariza yuborilmadi. Birozdan so‘ng qayta urinib ko‘ring.',
    PHONE_PROMPT:
      'Menejer siz bilan bog‘lanishi uchun telefon raqamingiz kerak.\n' +
      'Quyidagi tugmani bosing — raqamni Telegram o‘zi yuboradi.',
    PHONE_SAVED:
      'Raqamingiz saqlandi.\n' +
      'Endi eslatmadagi «Almashtirishga buyurtma» tugmasini qayta bosing.',
    PHONE_FOREIGN:
      'Bu raqam sizniki emas. Iltimos, «Raqamni yuborish» tugmasidan foydalaning.',
    PHONE_INVALID: 'Raqamni o‘qib bo‘lmadi. Kutilgan ko‘rinish: +998 XX XXX XX XX.',
    PHONE_ERROR: 'Raqam saqlanmadi. Birozdan so‘ng qayta urinib ko‘ring.',
  },
  ru: {
    CREATED: 'Заявка принята. Менеджер скоро свяжется с вами.',
    ALREADY_REQUESTED: 'Заявка на этот картридж уже принята.',
    PHONE_REQUIRED: 'Для заявки нужен номер телефона. Отправьте его кнопкой ниже.',
    NOT_FOUND: 'Картридж не найден.',
    ERROR: 'Заявка не отправлена. Попробуйте чуть позже.',
    PHONE_PROMPT:
      'Чтобы менеджер мог связаться с вами, нужен номер телефона.\n' +
      'Нажмите кнопку ниже — Telegram отправит его сам.',
    PHONE_SAVED:
      'Номер сохранён.\n' + 'Теперь нажмите кнопку «Заказать замену» в напоминании ещё раз.',
    PHONE_FOREIGN: 'Это не ваш номер. Воспользуйтесь кнопкой «Отправить номер».',
    PHONE_INVALID: 'Не удалось распознать номер. Ожидаемый вид: +998 XX XXX XX XX.',
    PHONE_ERROR: 'Номер не сохранён. Попробуйте чуть позже.',
  },
};

function replyLocale(languageCode: string | undefined): 'uz' | 'ru' {
  return languageCode?.toLowerCase().startsWith('ru') ? 'ru' : 'uz';
}

type Update = z.infer<typeof updateSchema>;
type CallbackQuery = NonNullable<Update['callback_query']>;
type Message = NonNullable<Update['message']>;

async function handleCallback(query: CallbackQuery, deps: WebhookDeps): Promise<void> {
  const data = query.data;
  if (!data?.startsWith(REPLACE_CALLBACK_PREFIX)) {
    return;
  }

  const installedPartId = data.slice(REPLACE_CALLBACK_PREFIX.length).trim();
  if (!installedPartId) {
    return;
  }

  const locale = replyLocale(query.from.language_code);
  const replies = REPLIES[locale];
  const telegramId = BigInt(query.from.id);

  let text: string;
  let phoneRequired = false;
  try {
    const result = await deps.requestReplacement({ installedPartId, telegramId });
    text = replies[result.status];
    phoneRequired = result.status === 'PHONE_REQUIRED';
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

  if (!phoneRequired) {
    return;
  }

  // §4.5: qalqib chiquvchi javobga tugma qo'yib bo'lmaydi, shuning uchun
  // raqam so'rovi alohida xabar bilan boradi. Avval bu yerda «raqamni
  // ilovada qoldiring» deyilardi, lekin Mini App da bunday forma yo'q edi
  // va mijoz boshi berk ko'chada qolardi.
  try {
    await deps.sendMessage({
      // Eslatma mijozning shaxsiy chatiga ketadi, ya'ni `chat_id` = `from.id`.
      chatId: telegramId,
      text: replies.PHONE_PROMPT,
      locale,
      requestContact: true,
    });
  } catch (error) {
    console.error('[worker] raqam so‘rovi yuborilmadi', error);
  }
}

async function handleContact(message: Message, deps: WebhookDeps): Promise<void> {
  const contact = message.contact;
  const from = message.from;
  const chatId = message.chat?.id;
  if (!contact || !from || chatId === undefined) {
    return;
  }

  const locale = replyLocale(from.language_code);
  const replies = REPLIES[locale];

  /**
   * §6: Telegram da manzillar kitobidan BEGONA odamning kontaktini ham
   * ulashish mumkin. Tekshirilmasa, istalgan odam boshqa mijozning raqamini
   * yuborib, uning CRM dagi yozuviga — o'rnatishlari, manzili va eslatmalari
   * bilan birga — ulanib olardi (`resolveLeadClient` telefonni shaxsni
   * aniqlash kaliti deb biladi).
   */
  let text: string;
  if (contact.user_id === undefined || contact.user_id !== from.id) {
    text = replies.PHONE_FOREIGN;
  } else {
    try {
      const result = await deps.savePhone({
        telegramId: BigInt(from.id),
        phone: contact.phone_number,
        name: contact.first_name,
      });
      text = result.status === 'SAVED' ? replies.PHONE_SAVED : replies.PHONE_INVALID;
    } catch (error) {
      console.error('[worker] telefon raqami saqlanmadi', error);
      text = replies.PHONE_ERROR;
    }
  }

  try {
    await deps.sendMessage({ chatId: BigInt(chatId), text, locale });
  } catch (error) {
    console.error('[worker] kontakt javobi yuborilmadi', error);
  }
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

  const { callback_query: query, message } = parsed.data;

  if (query) {
    await handleCallback(query, deps);
  } else if (message?.contact) {
    await handleContact(message, deps);
  }

  return { status: 200 };
}
