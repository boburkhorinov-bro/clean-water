import { describe, expect, test } from 'vitest';
import { computeResourceProgress } from './my-filter';

/**
 * §3: «progress-shkalalar faqat real ma'lumot ko'rsatadi. Dekorativ shkala
 * yo'q.»
 *
 * Shkala ikkita haqiqiy sanadan hisoblanadi: kartrij o'rnatilgan kun va
 * uning `due_at` i. O'ylab topilgan «taxminan yarmi» yo'q — mijoz shu
 * ko'rsatkichga qarab pul sarflaydi.
 */

function tashkent(iso: string): Date {
  return new Date(`${iso}+05:00`);
}

describe('computeResourceProgress', () => {
  // 6 oylik kartrij: 15-fevraldan 15-avgustgacha, 181 kun.
  const installedAt = tashkent('2026-02-15T09:00:00');
  const dueAt = tashkent('2026-08-15T09:00:00');

  test('yangi o‘rnatilgan kartrij — nol foiz sarflangan', () => {
    const progress = computeResourceProgress({ installedAt, dueAt, now: installedAt });

    expect(progress.usedRatio).toBe(0);
    expect(progress.daysLeft).toBe(181);
    expect(progress.state).toBe('OK');
  });

  test('yarim yo‘lda — taxminan yarmi', () => {
    const progress = computeResourceProgress({
      installedAt,
      dueAt,
      now: tashkent('2026-05-16T09:00:00'),
    });

    expect(progress.usedRatio).toBeGreaterThan(0.45);
    expect(progress.usedRatio).toBeLessThan(0.55);
  });

  test('muddat kelgan kuni — to‘liq sarflangan', () => {
    const progress = computeResourceProgress({ installedAt, dueAt, now: dueAt });

    expect(progress.usedRatio).toBe(1);
    expect(progress.daysLeft).toBe(0);
    expect(progress.state).toBe('DUE');
  });

  test('MUDDAT O‘TGAN: shkala 100% dan oshmaydi, lekin kunlar manfiy ko‘rsatiladi', () => {
    const progress = computeResourceProgress({
      installedAt,
      dueAt,
      now: tashkent('2026-09-15T09:00:00'),
    });

    expect(progress.usedRatio).toBe(1);
    expect(progress.daysLeft).toBe(-31);
    expect(progress.state).toBe('DUE');
  });

  test('31 kun qolganda holat hali xotirjam', () => {
    const progress = computeResourceProgress({
      installedAt,
      dueAt,
      now: tashkent('2026-07-15T09:00:00'),
    });

    expect(progress.daysLeft).toBe(31);
    expect(progress.state).toBe('OK');
  });

  test('30 kun qolganda holat ogohlantiruvchi — eslatma ham shu kuni ketadi', () => {
    const progress = computeResourceProgress({
      installedAt,
      dueAt,
      now: tashkent('2026-07-16T09:00:00'),
    });

    expect(progress.daysLeft).toBe(30);
    expect(progress.state).toBe('SOON');
  });

  test('umumiy muddat kunlarda qaytadi', () => {
    const progress = computeResourceProgress({ installedAt, dueAt, now: installedAt });

    expect(progress.daysTotal).toBe(181);
  });

  test('BUZUQ MA’LUMOT: `due_at` o‘rnatish sanasiga teng bo‘lsa nolga bo‘linmaydi', () => {
    const progress = computeResourceProgress({
      installedAt,
      dueAt: installedAt,
      now: installedAt,
    });

    expect(Number.isFinite(progress.usedRatio)).toBe(true);
    expect(progress.usedRatio).toBe(1);
    expect(progress.state).toBe('DUE');
  });

  test('o‘rnatish sanasidan oldingi vaqt shkalani manfiy qilmaydi', () => {
    const progress = computeResourceProgress({
      installedAt,
      dueAt,
      now: tashkent('2026-01-01T09:00:00'),
    });

    expect(progress.usedRatio).toBe(0);
  });

  test('KALENDAR KUNI: soatlar farqi kunni surmaydi', () => {
    const progress = computeResourceProgress({
      installedAt,
      dueAt,
      now: tashkent('2026-08-14T23:30:00'),
    });

    expect(progress.daysLeft).toBe(1);
  });
});
