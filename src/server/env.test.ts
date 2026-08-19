import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { EnvError, assertEnv } from './env';

/**
 * Muhit o'zgaruvchilarini startda tekshirish (§6: «sirlar faqat env da»).
 *
 * Sirsiz ishga tushgan ilova jimgina buziladi: `JWT_SECRET` bo'sh bo'lsa
 * sessiya yaratilmaydi, `TELEGRAM_WEBHOOK_SECRET` bo'sh bo'lsa webhook
 * hamma so'rovni 401 bilan rad etadi — ikkalasi ham faqat mijoz shikoyat
 * qilganda ma'lum bo'lardi. Shuning uchun tekshiruv startda va qattiq.
 */

const validProdEnv = {
  DATABASE_URL: 'postgresql://cleanwater:parol@postgres:5432/cleanwater?schema=public',
  JWT_SECRET: 'a'.repeat(32),
  TELEGRAM_BOT_TOKEN: '123456:AAE-xyz',
  NEXT_PUBLIC_SITE_URL: 'https://cleanwater.uz',
  TELEGRAM_WEBHOOK_SECRET: 'b'.repeat(32),
  TELEGRAM_MANAGER_CHAT_ID: '-1001234567890',
  CRON_SECRET: 'c'.repeat(32),
};

describe('assertEnv — web (prod)', () => {
  const opts = { isProduction: true, service: 'web' as const };

  test('to‘liq to‘plam qabul qilinadi', () => {
    expect(() => assertEnv(validProdEnv, opts)).not.toThrow();
  });

  test('DATABASE_URL siz ishga tushmaydi', () => {
    expect(() => assertEnv({ ...validProdEnv, DATABASE_URL: '' }, opts)).toThrow(EnvError);
  });

  test('JWT_SECRET siz ishga tushmaydi', () => {
    expect(() => assertEnv({ ...validProdEnv, JWT_SECRET: undefined }, opts)).toThrow(/JWT_SECRET/);
  });

  test('kalta JWT_SECRET rad etiladi', () => {
    // 32 belgidan qisqa HS256 kaliti brute-force uchun ochiq.
    expect(() => assertEnv({ ...validProdEnv, JWT_SECRET: 'qisqa' }, opts)).toThrow(/32/);
  });

  test('namunadagi joy tutuvchi qiymat sir hisoblanmaydi', () => {
    expect(() =>
      assertEnv({ ...validProdEnv, JWT_SECRET: 'changeme-changeme-changeme-changeme' }, opts),
    ).toThrow(/JWT_SECRET/);
  });

  test('prodda sayt manzili HTTPS bo‘lishi shart', () => {
    // §6: HTTPS majburiy. HTTP manzil canonical va hreflang ga tushib,
    // qidiruv tizimida himoyasiz nusxani mustahkamlab qo'yardi.
    expect(() =>
      assertEnv({ ...validProdEnv, NEXT_PUBLIC_SITE_URL: 'http://cleanwater.uz' }, opts),
    ).toThrow(/HTTPS/);
  });

  test('xato xabari yetishmayotgan o‘zgaruvchilarni bir vaqtda sanaydi', () => {
    // Bittalab topish deployni bir necha marta qaytadan boshlashga majburlardi.
    try {
      assertEnv({ DATABASE_URL: '', JWT_SECRET: '', TELEGRAM_BOT_TOKEN: '' }, opts);
      expect.unreachable('xato kutilgan edi');
    } catch (error) {
      expect(String(error)).toContain('DATABASE_URL');
      expect(String(error)).toContain('JWT_SECRET');
      expect(String(error)).toContain('TELEGRAM_BOT_TOKEN');
    }
  });

  test('xato xabarida sir qiymati ko‘rinmaydi', () => {
    // Xato loglarga tushadi, loglar esa zaxiraga va monitoringga ketadi.
    try {
      assertEnv({ ...validProdEnv, JWT_SECRET: 'qisqa-sir-qiymati' }, opts);
      expect.unreachable('xato kutilgan edi');
    } catch (error) {
      expect(String(error)).not.toContain('qisqa-sir-qiymati');
    }
  });
});

describe('assertEnv — worker (prod)', () => {
  const opts = { isProduction: true, service: 'worker' as const };

  test('webhook siri siz ishga tushmaydi', () => {
    // Sirsiz webhook hamma so'rovni rad etadi — bot jim bo'lib qoladi.
    expect(() => assertEnv({ ...validProdEnv, TELEGRAM_WEBHOOK_SECRET: '' }, opts)).toThrow(
      /TELEGRAM_WEBHOOK_SECRET/,
    );
  });

  test('menejerlar guruhi siz ishga tushmaydi', () => {
    // Aksi holda arizalar bazaga tushadi, lekin hech kim ularni ko'rmaydi.
    expect(() => assertEnv({ ...validProdEnv, TELEGRAM_MANAGER_CHAT_ID: '' }, opts)).toThrow(
      /TELEGRAM_MANAGER_CHAT_ID/,
    );
  });

  /**
   * Eslatmalarni tashqi cron ishga tushiradi (bepul hostingda jarayon
   * uxlaydi va ichki taymer ishlamaydi). Sirsiz o'sha manzil butunlay
   * yopiq — ya'ni eslatmalar hech qachon ketmaydi, log da esa bitta ham
   * xato ko'rinmaydi. Bu `TELEGRAM_WEBHOOK_SECRET` bilan aynan bir xil
   * nosozlik turi.
   */
  test('cron siri siz ishga tushmaydi', () => {
    expect(() => assertEnv({ ...validProdEnv, CRON_SECRET: '' }, opts)).toThrow(/CRON_SECRET/);
  });

  test('worker uchun JWT_SECRET talab qilinmaydi', () => {
    // Worker sessiya bermaydi — ortiqcha talab deployni bekorga bloklardi.
    const { JWT_SECRET: _unused, ...withoutJwt } = validProdEnv;
    expect(() => assertEnv(withoutJwt, opts)).not.toThrow();
  });
});

describe('assertEnv — ishlab chiqish rejimi', () => {
  const opts = { isProduction: false, service: 'web' as const };

  test('faqat DATABASE_URL majburiy — qolgani ogohlantirish', () => {
    // Lokal ishda Telegram tokeni ko'pincha kerak emas; uni talab qilish
    // katalog ustida ishlashni bloklardi.
    expect(() => assertEnv({ DATABASE_URL: validProdEnv.DATABASE_URL }, opts)).not.toThrow();
  });

  test('DATABASE_URL dev da ham majburiy', () => {
    expect(() => assertEnv({}, opts)).toThrow(/DATABASE_URL/);
  });

  test('yetishmayotganlari ro‘yxati qaytariladi', () => {
    const result = assertEnv({ DATABASE_URL: validProdEnv.DATABASE_URL }, opts);
    expect(result.warnings).toContain('JWT_SECRET');
  });

  test('dev da HTTP sayt manzili qabul qilinadi', () => {
    expect(() =>
      assertEnv(
        { DATABASE_URL: validProdEnv.DATABASE_URL, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' },
        opts,
      ),
    ).not.toThrow();
  });
});

describe('sirlar repozitoriyga tushmaydi (§6)', () => {
  test('.env .gitignore da', () => {
    const gitignore = readFileSync(
      fileURLToPath(new URL('../../.gitignore', import.meta.url)),
      'utf8',
    );
    expect(gitignore).toMatch(/^\.env\*?$/m);
  });

  test('env.example da haqiqiy sir yo‘q', () => {
    // Namuna faylida sirlar bo'sh qoldiriladi — u repozitoriyda turadi.
    const example = readFileSync(
      fileURLToPath(new URL('../../env.example', import.meta.url)),
      'utf8',
    );
    for (const key of ['JWT_SECRET', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET']) {
      expect(example).toMatch(new RegExp(`^${key}=""$`, 'm'));
    }
  });
});
