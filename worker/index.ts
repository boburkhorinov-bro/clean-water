import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { checkProcessEnv } from '@/server/env';
import {
  runReminderSweep,
  type ReminderSweepResult,
} from '@/server/services/reminder-sweep';
import { requestReplacement } from '@/server/services/replacement-request';
import { savePhoneForTelegramUser } from '@/server/services/save-phone';
import {
  answerCallbackQuery,
  buildContactKeyboard,
  buildReplaceKeyboard,
  sendBotMessage,
} from '@/server/telegram/bot-api';
import { handleTelegramUpdate } from './bot/webhook';
import { startDailyJob } from './jobs/schedule';
import { handleReminderTrigger } from './jobs/trigger';

/**
 * `worker` konteynerining kirish nuqtasi (§4.1, §4.6).
 *
 * Ikkita vazifa: kunlik eslatmalar rejalashtiruvchisi va Telegram bot
 * webhooki.
 *
 * Nega alohida jarayon: veb-jarayon ichidagi rejalashtiruvchi ikkinchi instans
 * ishga tushganda dublikatlanadi (bitta mijozga ikkita eslatma) va har qayta
 * deployda o'ladi — o'sha kungi eslatmalar bilan birga. Bot webhooki esa
 * barqaror ishlab turuvchi jarayon talab qiladi.
 */

/** §4.6: har kuni Toshkent vaqti bilan 09:00. */
const REMINDER_HOUR = 9;
const DEFAULT_PORT = 8081;
const WEBHOOK_PATH = '/telegram/webhook';
/**
 * Eslatmalarni tashqaridan ishga tushirish (§4.6).
 *
 * Bepul hostingda jarayon bekorchilikdan keyin uxlaydi va ichidagi kunlik
 * taymer umuman ishlamaydi. Tashqi cron xizmati shu manzilga so'rov yuboradi:
 * so'rov konteynerni uyg'otadi va o'tishni boshlaydi.
 */
const REMINDERS_PATH = '/jobs/reminders';
/** Telegram updatelari kichik; kattaroq tanani o'qishning hojati yo'q. */
const MAX_BODY_BYTES = 64 * 1024;

async function sweep(): Promise<ReminderSweepResult> {
  const result = await runReminderSweep({
    send: async (target) => {
      await sendBotMessage({
        chatId: target.chatId,
        text: target.text,
        replyMarkup: buildReplaceKeyboard(target.installedPartId, target.locale),
      });
    },
  });

  console.log(
    `[worker] eslatmalar: yuborildi=${result.sent} o‘tkazildi=${result.skipped} ` +
      `xato=${result.failed}` +
      (result.rateLimited ? ` (429, retry_after=${result.retryAfterSeconds})` : ''),
  );

  // Natija tashqi cron chaqiruviga ham qaytariladi: u javob tanasida
  // ko'rinsa, egasi eslatmalar haqiqatan ketayotganini tekshira oladi.
  return result;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');
      if (body.length > MAX_BODY_BYTES) {
        request.destroy();
        reject(new Error('So‘rov tanasi juda katta'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function headerOf(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
    return;
  }

  if (request.method === 'POST' && request.url === REMINDERS_PATH) {
    const result = await handleReminderTrigger(
      { authorization: headerOf(request, 'authorization') },
      { secret: process.env.CRON_SECRET, runSweep: sweep },
    );

    response.writeHead(result.status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(result.body));
    return;
  }

  if (request.method !== 'POST' || request.url !== WEBHOOK_PATH) {
    response.writeHead(404).end();
    return;
  }

  let body: unknown = null;
  try {
    body = JSON.parse(await readBody(request));
  } catch {
    // Buzuq tana ham 200 bilan yopiladi — aks holda Telegram uni qayta
    // yuboraveradi. Tekshiruv `handleTelegramUpdate` ichida.
    body = null;
  }

  const result = await handleTelegramUpdate(
    { secretToken: headerOf(request, 'x-telegram-bot-api-secret-token'), body },
    {
      secret: process.env.TELEGRAM_WEBHOOK_SECRET,
      requestReplacement,
      answerCallback: answerCallbackQuery,
      savePhone: savePhoneForTelegramUser,
      // Qaror qatlami Telegram tiplarini bilmaydi: u faqat «tugma kerak»
      // deydi, klaviatura shu yerda quriladi.
      sendMessage: async ({ chatId, text, locale, requestContact }) => {
        await sendBotMessage({
          chatId,
          text,
          ...(requestContact
            ? { replyMarkup: buildContactKeyboard(locale === 'ru' ? 'RU' : 'UZ') }
            : {}),
        });
      },
    },
  );

  response.writeHead(result.status).end();
}

function main(): void {
  // Sozlama tekshiruvi eng boshida: sirsiz worker jim ishlab turadi
  // (webhook hamma so'rovni 401 qiladi, eslatmalar hech kimga ketmaydi) —
  // bu eng yomon nosozlik turi, chunki u sog'lom ko'rinadi.
  checkProcessEnv('worker');

  // `PORT` — PaaS larning (Render, Railway) standarti; ular portni o'zi
  // tanlaydi va boshqa portda tinglagan xizmat «ishga tushmadi» deb
  // hisoblanadi. `WORKER_PORT` Docker uchun qoladi.
  const port = Number(process.env.PORT ?? process.env.WORKER_PORT ?? DEFAULT_PORT);

  // Rejalashtiruvchi natijani ishlatmaydi — u faqat o'tishni chaqiradi.
  const job = startDailyJob({
    hour: REMINDER_HOUR,
    run: async () => {
      await sweep();
    },
  });
  console.log(`[worker] eslatmalar rejalashtiruvchisi: har kuni ${REMINDER_HOUR}:00 (Toshkent)`);

  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      console.error('[worker] webhook xatosi', error);
      // Telegram uchun 200: qayta yuborish bu xatoni tuzatmaydi.
      response.writeHead(200).end();
    });
  });

  server.listen(port, () => {
    console.log(`[worker] webhook tinglanmoqda: :${port}${WEBHOOK_PATH}`);
  });

  const shutdown = (): void => {
    console.log('[worker] SIGTERM, to‘xtatilmoqda');
    job.stop();
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
