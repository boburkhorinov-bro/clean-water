import { describe, expect, test } from 'vitest';
import { percentile, summarize } from './loadtest.mjs';

/**
 * Yuklama o'lchovining statistikasi (§7).
 *
 * Bu qism test qilinadi, chunki noto'g'ri hisoblangan p95 relizga tayyorlik
 * haqidagi qarorni buzadi: o'rtacha kechikish yaxshi ko'rinib, har yigirmanchi
 * mijoz uzoq kutayotgan bo'lishi mumkin.
 */

describe('percentile', () => {
  test('median o‘rtadagi qiymatni beradi', () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
  });

  test('p95 eng sekin 5% ni kesib tashlamaydi', () => {
    // 100 o'lchov: 95 tasi tez, 5 tasi sekin. p95 hali tez qiymatni beradi,
    // p96 dan boshlab esa sekin dum ko'rinadi — aynan shuning uchun relizga
    // tayyorlik p50 bo'yicha emas, p95/p99 bo'yicha baholanadi.
    const samples = [...Array(95).fill(10), ...Array(5).fill(1000)];

    expect(percentile(samples, 95)).toBe(10);
    expect(percentile(samples, 96)).toBe(1000);
    expect(percentile(samples, 99)).toBe(1000);
  });

  test('tartiblanmagan ro‘yxatda ham to‘g‘ri ishlaydi', () => {
    expect(percentile([50, 10, 40, 20, 30], 50)).toBe(30);
  });

  test('bitta o‘lchov', () => {
    expect(percentile([42], 99)).toBe(42);
  });

  test('bo‘sh ro‘yxat nolga bo‘linmaydi', () => {
    expect(percentile([], 95)).toBe(0);
  });
});

describe('summarize', () => {
  const results = [
    { status: 200, ms: 10 },
    { status: 200, ms: 20 },
    { status: 429, ms: 5 },
    { status: 500, ms: 30 },
    { status: 0, ms: 100 },
  ];

  test('status kodlari bo‘yicha sanaydi', () => {
    expect(summarize(results, 1000).statuses).toEqual({ 200: 2, 429: 1, 500: 1, 0: 1 });
  });

  test('xatolar alohida ajratiladi', () => {
    // 4xx/5xx va tarmoq uzilishi (status 0) — «muvaffaqiyatli» emas.
    // Ular o'rtachaga qo'shilib ketsa, yiqilgan server tez ko'rinardi.
    const summary = summarize(results, 1000);
    expect(summary.ok).toBe(2);
    expect(summary.failed).toBe(3);
  });

  test('RPS o‘tgan vaqtdan hisoblanadi', () => {
    expect(summarize(results, 2000).rps).toBeCloseTo(2.5, 5);
  });

  test('kechikish faqat javob qaytgan so‘rovlardan olinadi', () => {
    // Uzilgan ulanish (status 0, 100 ms) kechikish emas: u shunchaki taymaut.
    // U hisobga olinsa, o'lchovlar [5,10,20,30,100] bo'lib p50 20 ga sakrardi.
    const summary = summarize(results, 1000);

    expect(summary.p50).toBe(10);
    expect(summary.max).toBe(30);
  });
});
