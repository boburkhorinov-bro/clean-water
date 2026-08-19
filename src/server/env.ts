/**
 * Muhit o'zgaruvchilarini startda tekshirish (§6).
 *
 * Sirlar faqat muhitda yashaydi — repozitoriyda ham, kodda ham emas. Buning
 * narxi: noto'g'ri sozlangan deploy jimgina buzilgan ilova beradi
 * (`JWT_SECRET` bo'sh → sessiya yaratilmaydi; `TELEGRAM_WEBHOOK_SECRET` bo'sh
 * → webhook hamma so'rovni 401 qiladi). Shuning uchun tekshiruv startda
 * bo'ladi va prodda ilovani umuman ko'tarilishga qo'ymaydi.
 */

export class EnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Muhit o'zgaruvchilari noto'g'ri sozlangan:\n${missing.map((m) => `  — ${m}`).join('\n')}\n` +
        'Namuna: env.example. Sirlar repozitoriyga tushmaydi.',
    );
    this.name = 'EnvError';
  }
}

export type Service = 'web' | 'worker';

export interface EnvOptions {
  isProduction: boolean;
  service: Service;
}

export interface EnvCheckResult {
  /** Prodda majburiy bo'ladigan, lekin dev da yetishmayotgan o'zgaruvchilar. */
  warnings: string[];
}

type Env = Record<string, string | undefined>;

/**
 * env.example dan ko'chirilgan, lekin to'ldirilmagan qiymatlar. Bunday
 * «sir» sir emas: u repozitoriyda ochiq turadi.
 */
const PLACEHOLDERS = [/^changeme/i, /^your[-_]/i, /^xxx+$/i, /^<.*>$/, /^example$/i];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDERS.some((pattern) => pattern.test(value));
}

function present(env: Env, key: string): string | null {
  const value = env[key]?.trim();
  if (!value) return null;
  if (isPlaceholder(value)) return null;
  return value;
}

/** Har bir xizmat uchun prodda majburiy o'zgaruvchilar. */
const REQUIRED_IN_PRODUCTION: Record<Service, string[]> = {
  // `web` sessiya beradi va Telegram initData imzosini tekshiradi.
  web: ['JWT_SECRET', 'TELEGRAM_BOT_TOKEN', 'NEXT_PUBLIC_SITE_URL'],
  // `worker` sessiya bermaydi, lekin webhook va menejerlar guruhisiz keraksiz:
  // arizalar bazaga tushadi va hech kim ularni ko'rmaydi.
  //
  // `CRON_SECRET` shu ro'yxatda, chunki eslatmalarni tashqi cron ishga
  // tushiradi: bepul hostingda jarayon bekorchilikdan keyin uxlaydi va
  // ichidagi taymer umuman ishlamaydi. Sirsiz o'sha manzil butunlay yopiq —
  // eslatmalar hech qachon ketmaydi va log da bitta ham xato ko'rinmaydi.
  worker: [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'TELEGRAM_MANAGER_CHAT_ID',
    'CRON_SECRET',
  ],
};

/** HS256 kaliti uchun eng kam uzunlik — qisqasi brute-force uchun ochiq. */
const MIN_SECRET_LENGTH = 32;

export function assertEnv(env: Env, { isProduction, service }: EnvOptions): EnvCheckResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  // Baza har ikkala xizmat uchun ham, har qanday rejimda ham majburiy.
  if (!present(env, 'DATABASE_URL')) {
    problems.push('DATABASE_URL — bo‘sh yoki yo‘q.');
  }

  const required = REQUIRED_IN_PRODUCTION[service];
  for (const key of required) {
    if (present(env, key)) continue;
    if (isProduction) problems.push(`${key} — bo‘sh yoki namuna qiymati.`);
    else warnings.push(key);
  }

  // Sir uzunligi: qiymat bor, lekin ishonchsiz bo'lishi mumkin.
  const jwtSecret = present(env, 'JWT_SECRET');
  if (jwtSecret && jwtSecret.length < MIN_SECRET_LENGTH) {
    // Qiymatning o'zi xabarga TUSHMAYDI: xato log ga, log esa zaxiraga ketadi.
    problems.push(`JWT_SECRET — kamida ${MIN_SECRET_LENGTH} belgi bo‘lishi kerak.`);
  }

  const siteUrl = present(env, 'NEXT_PUBLIC_SITE_URL');
  if (isProduction && siteUrl && !siteUrl.startsWith('https://')) {
    problems.push('NEXT_PUBLIC_SITE_URL — prodda HTTPS manzil bo‘lishi shart.');
  }

  if (problems.length > 0) throw new EnvError(problems);

  return { warnings };
}

/**
 * Startda chaqiriladigan qulay o'ram: `process.env` ni oladi va dev dagi
 * yetishmovchiliklarni log ga chiqaradi.
 */
export function checkProcessEnv(service: Service): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const { warnings } = assertEnv(process.env, { isProduction, service });

  if (warnings.length > 0) {
    console.warn(
      `[env] ${service}: prodda majburiy bo‘lgan o‘zgaruvchilar yo‘q — ${warnings.join(', ')}. ` +
        'Lokal ishda bu normal; deploydan oldin to‘ldiring (env.example).',
    );
  }
}
