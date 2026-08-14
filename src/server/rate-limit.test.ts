import { describe, expect, test } from 'vitest';
import { createRateLimiter } from './rate-limit';

/**
 * §6: «Ariza va fikr formalarida rate-limit, ommaviy formada spam-botlardan
 * himoya.»
 * §4.1: «Redis va vazifalar navbati — startda yo'q», shuning uchun hisoblagich
 * jarayon xotirasida. Cheklovi: `web` ikkinchi instansda ishga tushsa, har
 * biri o'z hisobini yuritadi. Startdagi yuklamada bu maqbul.
 */
describe('createRateLimiter', () => {
  test('limitgacha bo‘lgan so‘rovlar o‘tadi', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const now = Date.now();

    expect(limiter.check('ip:1', now).allowed).toBe(true);
    expect(limiter.check('ip:1', now).allowed).toBe(true);
    expect(limiter.check('ip:1', now).allowed).toBe(true);
  });

  test('limitdan keyingi so‘rov bloklanadi', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const now = Date.now();

    limiter.check('ip:1', now);
    limiter.check('ip:1', now);

    expect(limiter.check('ip:1', now).allowed).toBe(false);
  });

  test('bloklanganda qancha kutish kerakligi aytiladi', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const now = Date.now();

    limiter.check('ip:1', now);
    const blocked = limiter.check('ip:1', now + 10_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(50_000);
  });

  test('oyna tugagach hisob nolga tushadi', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const now = Date.now();

    limiter.check('ip:1', now);
    expect(limiter.check('ip:1', now + 30_000).allowed).toBe(false);
    expect(limiter.check('ip:1', now + 60_001).allowed).toBe(true);
  });

  test('turli kalitlar bir-biriga ta’sir qilmaydi', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const now = Date.now();

    limiter.check('ip:1', now);

    expect(limiter.check('ip:2', now).allowed).toBe(true);
    expect(limiter.check('ip:1', now).allowed).toBe(false);
  });

  test('eski yozuvlar tozalanadi — uzoq ishlaydigan jarayonda xotira sizmasligi kerak', () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 1_000 });
    const now = Date.now();

    for (let i = 0; i < 500; i += 1) {
      limiter.check(`ip:${i}`, now);
    }
    expect(limiter.size()).toBe(500);

    // Oyna o'tgach, keyingi murojaat eskirganlarni supurib tashlashi kerak.
    limiter.check('ip:yangi', now + 2_000);

    expect(limiter.size()).toBe(1);
  });
});
