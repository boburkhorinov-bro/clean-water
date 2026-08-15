import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { msUntilNextRun, startDailyJob } from './schedule';

/**
 * §4.6: «Har kuni Toshkent vaqti bilan 09:00 da worker...».
 *
 * Rejalashtiruvchi faqat `worker` konteynerida ishlaydi (§4.1). Nega Next.js
 * ichida emas: veb-jarayon bir nechta instansda ko'tarilsa eslatma
 * dublikatlanadi, va har deployda jarayon o'ladi — o'sha kungi eslatmalar
 * bilan birga.
 */

function tashkent(iso: string): Date {
  return new Date(`${iso}+05:00`);
}

const HOUR_MS = 60 * 60 * 1000;

describe('msUntilNextRun', () => {
  test('bir soat oldin — bir soat kutadi', () => {
    expect(msUntilNextRun(tashkent('2026-08-15T08:00:00'), 9)).toBe(HOUR_MS);
  });

  test('yarim tundan keyin — to‘qqiz soat', () => {
    expect(msUntilNextRun(tashkent('2026-08-15T00:00:00'), 9)).toBe(9 * HOUR_MS);
  });

  test('vaqt o‘tgan bo‘lsa — ertangi kunga', () => {
    expect(msUntilNextRun(tashkent('2026-08-15T10:00:00'), 9)).toBe(23 * HOUR_MS);
  });

  test('AYNAN 09:00 da — ertangi kunga, ya‘ni ikki marta ishlamaydi', () => {
    expect(msUntilNextRun(tashkent('2026-08-15T09:00:00'), 9)).toBe(24 * HOUR_MS);
  });

  test('daqiqalar hisobga olinadi', () => {
    expect(msUntilNextRun(tashkent('2026-08-15T08:30:00'), 9)).toBe(30 * 60 * 1000);
  });

  test('TOSHKENT VAQTI, server mintaqasi emas: 04:00 UTC = 09:00 Toshkent', () => {
    // Konteynerda TZ noto'g'ri qo'yilgan bo'lsa ham hisob siljimasligi kerak.
    expect(msUntilNextRun(new Date('2026-08-15T04:00:00Z'), 9)).toBe(24 * HOUR_MS);
  });
});

describe('startDailyJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('darhol ishga tushmaydi — belgilangan soatni kutadi', async () => {
    vi.setSystemTime(tashkent('2026-08-15T08:00:00'));
    const run = vi.fn(async () => {});

    const job = startDailyJob({ hour: 9, run });

    expect(run).not.toHaveBeenCalled();
    job.stop();
  });

  test('belgilangan soatda ishga tushadi', async () => {
    vi.setSystemTime(tashkent('2026-08-15T08:00:00'));
    const run = vi.fn(async () => {});

    const job = startDailyJob({ hour: 9, run });
    await vi.advanceTimersByTimeAsync(HOUR_MS);

    expect(run).toHaveBeenCalledTimes(1);
    job.stop();
  });

  test('ertasi kuni yana ishga tushadi', async () => {
    vi.setSystemTime(tashkent('2026-08-15T08:00:00'));
    const run = vi.fn(async () => {});

    const job = startDailyJob({ hour: 9, run });
    await vi.advanceTimersByTimeAsync(HOUR_MS + 24 * HOUR_MS);

    expect(run).toHaveBeenCalledTimes(2);
    job.stop();
  });

  test('XATO JADVALNI BUZMAYDI: bir kun yiqilsa, ertasi kuni yana uriniladi', async () => {
    vi.setSystemTime(tashkent('2026-08-15T08:00:00'));
    const run = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('baza yiqildi'))
      .mockResolvedValue(undefined);

    const job = startDailyJob({ hour: 9, run });
    await vi.advanceTimersByTimeAsync(HOUR_MS + 24 * HOUR_MS);

    expect(run).toHaveBeenCalledTimes(2);
    job.stop();
  });

  test('`stop` keyingi ishga tushishni bekor qiladi', async () => {
    vi.setSystemTime(tashkent('2026-08-15T08:00:00'));
    const run = vi.fn(async () => {});

    const job = startDailyJob({ hour: 9, run });
    job.stop();
    await vi.advanceTimersByTimeAsync(2 * 24 * HOUR_MS);

    expect(run).not.toHaveBeenCalled();
  });
});
