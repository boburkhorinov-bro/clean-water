import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Lokal ishlab chiqishda admin sessiyasini olish (FAQAT dev).
 *
 * Mini App va admin panel Telegram `initData` si bilan ochiladi, uni esa
 * haqiqiy Telegram klienti imzolaydi. Lokal mashinada bunday klient yo'q,
 * shuning uchun sahifalar 404 qaytaradi va panelni umuman ko'rib bo'lmaydi.
 *
 * Bu skript `.env` dagi bot tokeni bilan o'sha imzoni yasaydi. Ya'ni u yangi
 * eshik ochmaydi: server tomonidagi tekshiruv o'zgarishsiz qoladi, imzo esa
 * tokenni bilgan odam uchungina yasaladi — token esa allaqachon `.env` da.
 *
 * Ishga tushirish:
 *   npx tsx scripts/dev-login.ts
 *
 * Chiqishdagi snippetni brauzer konsolida (http://localhost:3000 sahifasida)
 * bajaring — cookie `httpOnly`, shuning uchun uni JS bilan yozib bo'lmaydi,
 * lekin `fetch` javobidagi `Set-Cookie` ni brauzer o'zi saqlaydi.
 */

const DEFAULT_BASE_URL = 'http://localhost:3000';

interface BuildOptions {
  botToken: string;
  telegramId: number;
  firstName?: string;
  now?: Date;
}

/**
 * `initData` ni Telegram hujjatidagi algoritm bo'yicha yasaydi
 * (`src/server/auth/telegram-init-data.ts` dagi tekshiruvning teskarisi):
 * `hash` dan boshqa maydonlar saralanadi, kalit = HMAC(token, "WebAppData").
 */
export function buildInitData({
  botToken,
  telegramId,
  firstName = 'Dev Admin',
  now = new Date(),
}: BuildOptions): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(now.getTime() / 1000)),
    query_id: 'dev-login',
    user: JSON.stringify({ id: telegramId, first_name: firstName, language_code: 'uz' }),
  });

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));

  return params.toString();
}

/**
 * `TELEGRAM_ADMIN_IDS` vergul bilan yoziladi (§4.4) — birinchisini olamiz.
 *
 * Bo'sh yoki buzuq qiymatda xato: `Number('')` nolga, `Number('admin')` esa
 * `NaN` ga aylanadi va skript tushunarsiz 401 bilan tugardi.
 */
export function pickAdminId(raw: string | undefined): number {
  const first = (raw ?? '').split(',')[0]?.trim() ?? '';
  const parsed = Number(first);

  if (!first || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      'TELEGRAM_ADMIN_IDS bo‘sh yoki buzuq — .env da kamida bitta Telegram ID bo‘lishi kerak.',
    );
  }

  return parsed;
}

/**
 * Skript amaldagi ADMIN sessiyasini yasaydi, shuning uchun u faqat lokal
 * manzil bilan ishlaydi. Prod manzil berilsa, terminalda ishlaydigan admin
 * kaliti paydo bo'lardi.
 */
export function assertLocalTarget(baseUrl: string): void {
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new Error(`«${baseUrl}» manzil emas. Bu skript faqat lokal server bilan ishlaydi.`);
  }

  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
    throw new Error(`«${host}» lokal emas. Bu skript faqat lokal server bilan ishlaydi.`);
  }
}

async function main(): Promise<void> {
  const baseUrl = process.argv[2] ?? DEFAULT_BASE_URL;
  assertLocalTarget(baseUrl);

  // `.env` ni Next.js o'zi o'qiydi, `tsx` esa yo'q.
  try {
    process.loadEnvFile();
  } catch {
    // Fayl yo'q bo'lsa — muhit o'zgaruvchilari tashqaridan berilgan bo'lishi mumkin.
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN yo‘q — .env ni tekshiring.');

  const telegramId = pickAdminId(process.env.TELEGRAM_ADMIN_IDS);
  const initData = buildInitData({ botToken, telegramId });

  const response = await fetch(new URL('/api/auth/telegram', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`Server ${response.status} qaytardi: ${JSON.stringify(payload)}`);
  }

  const role = (payload as { user?: { role?: string } }).user?.role;
  if (role !== 'ADMIN') {
    console.warn(
      `\n⚠  Sessiya yaratildi, lekin rol ${role} — /admin baribir 404 qaytaradi.` +
        `\n   Sabab: ${telegramId} TELEGRAM_ADMIN_IDS da yo‘q yoki bazada roli tushirilgan.\n`,
    );
  }

  const snippet =
    `await fetch("/api/auth/telegram",{method:"POST",` +
    `headers:{"Content-Type":"application/json"},` +
    `body:JSON.stringify({initData:${JSON.stringify(initData)}})}).then(r=>r.json())`;

  console.log(`\nTelegram ID: ${telegramId} · rol: ${role} · sessiya 24 soat yashaydi\n`);
  console.log(`1. Brauzerda oching: ${baseUrl}/uz`);
  console.log('2. F12 → Console → shuni joylashtiring va Enter:\n');
  console.log(snippet);
  console.log(`\n3. Endi ${baseUrl}/admin va ${baseUrl}/app/mening-filtrim ochiladi.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
