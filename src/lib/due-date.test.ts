import { describe, expect, test } from 'vitest';
import { addMonthsTashkent, computeDueAt } from './due-date';

/**
 * §5: «`due_at` buyurtma sanasidan emas, aniq kartrijning `installed_at` +
 * `resource_months` idan hisoblanadi.»
 *
 * Bu — butun eslatmalar tizimining tayanchi. Xato bir kunga siljisa, mijoz
 * eslatmani muddat o'tgandan keyin oladi.
 *
 * Hisob Toshkent kalendari bo'yicha yuritiladi (O'zbekiston — qat'iy UTC+5,
 * 1995 dan beri yozgi vaqt yo'q). Usta o'rnatishni mahalliy sanada qayd
 * qiladi, mijoz muddatni mahalliy sanada ko'radi — UTC da hisoblash oy
 * oxirlarida bir kunlik siljish beradi.
 */

/** Toshkent vaqtidagi sanani aniq instantga aylantiradi (o'qishni osonlashtirish uchun). */
function tashkent(iso: string): Date {
  return new Date(`${iso}+05:00`);
}

describe('addMonthsTashkent', () => {
  test('oddiy holat: 15-mart + 6 oy = 15-sentabr', () => {
    expect(addMonthsTashkent(tashkent('2026-03-15T10:00:00'), 6)).toEqual(
      tashkent('2026-09-15T10:00:00'),
    );
  });

  test('OY OXIRI: 31-yanvar + 1 oy = 28-fevral, 31-fevral emas', () => {
    expect(addMonthsTashkent(tashkent('2026-01-31T09:00:00'), 1)).toEqual(
      tashkent('2026-02-28T09:00:00'),
    );
  });

  test('KABISA YILI: 31-yanvar 2024 + 1 oy = 29-fevral', () => {
    expect(addMonthsTashkent(tashkent('2024-01-31T09:00:00'), 1)).toEqual(
      tashkent('2024-02-29T09:00:00'),
    );
  });

  test('KABISA YILI: 29-fevral + 12 oy = 28-fevral (keyingi yilda 29 si yo‘q)', () => {
    expect(addMonthsTashkent(tashkent('2024-02-29T09:00:00'), 12)).toEqual(
      tashkent('2025-02-28T09:00:00'),
    );
  });

  test('31-avgust + 6 oy = 28-fevral', () => {
    expect(addMonthsTashkent(tashkent('2026-08-31T09:00:00'), 6)).toEqual(
      tashkent('2027-02-28T09:00:00'),
    );
  });

  test('31-mart + 1 oy = 30-aprel', () => {
    expect(addMonthsTashkent(tashkent('2026-03-31T09:00:00'), 1)).toEqual(
      tashkent('2026-04-30T09:00:00'),
    );
  });

  test('yil chegarasidan o‘tadi: 30-noyabr + 24 oy = 30-noyabr, ikki yil keyin', () => {
    expect(addMonthsTashkent(tashkent('2026-11-30T09:00:00'), 24)).toEqual(
      tashkent('2028-11-30T09:00:00'),
    );
  });

  test('kun vaqti saqlanadi', () => {
    expect(addMonthsTashkent(tashkent('2026-05-10T18:45:30'), 12)).toEqual(
      tashkent('2027-05-10T18:45:30'),
    );
  });

  test('TOSHKENT KALENDARI: UTC da oldingi kunga tushadigan instant ham to‘g‘ri sanaydi', () => {
    // 31-mart soat 02:00 Toshkent = 30-mart 21:00 UTC.
    // UTC bo'yicha hisoblansa 30-aprel 21:00 UTC = 1-may Toshkent — bir kun ortiqcha.
    const installedAt = tashkent('2026-03-31T02:00:00');
    expect(installedAt.toISOString()).toBe('2026-03-30T21:00:00.000Z');

    expect(addMonthsTashkent(installedAt, 1)).toEqual(tashkent('2026-04-30T02:00:00'));
  });

  test('kirish sanasi o‘zgartirilmaydi', () => {
    const installedAt = tashkent('2026-03-15T10:00:00');
    const before = installedAt.getTime();

    addMonthsTashkent(installedAt, 6);

    expect(installedAt.getTime()).toBe(before);
  });
});

describe('computeDueAt', () => {
  test('6 oylik resurs (mexanika, ko‘mir)', () => {
    expect(computeDueAt(tashkent('2026-08-15T09:00:00'), 6)).toEqual(
      tashkent('2027-02-15T09:00:00'),
    );
  });

  test('12 oylik resurs (postfiltr)', () => {
    expect(computeDueAt(tashkent('2026-08-15T09:00:00'), 12)).toEqual(
      tashkent('2027-08-15T09:00:00'),
    );
  });

  test('24 oylik resurs (membrana)', () => {
    expect(computeDueAt(tashkent('2026-08-15T09:00:00'), 24)).toEqual(
      tashkent('2028-08-15T09:00:00'),
    );
  });

  test('bir xil o‘rnatish sanasida turli resurslar turli muddat beradi', () => {
    const installedAt = tashkent('2026-01-31T09:00:00');

    expect(computeDueAt(installedAt, 6)).toEqual(tashkent('2026-07-31T09:00:00'));
    expect(computeDueAt(installedAt, 12)).toEqual(tashkent('2027-01-31T09:00:00'));
    expect(computeDueAt(installedAt, 24)).toEqual(tashkent('2028-01-31T09:00:00'));
  });

  test('nol yoki manfiy resurs rad etiladi — bunday kartrij muddatsiz bo‘lib qolardi', () => {
    const installedAt = tashkent('2026-08-15T09:00:00');

    expect(() => computeDueAt(installedAt, 0)).toThrow();
    expect(() => computeDueAt(installedAt, -6)).toThrow();
  });

  test('butun bo‘lmagan resurs rad etiladi', () => {
    expect(() => computeDueAt(tashkent('2026-08-15T09:00:00'), 6.5)).toThrow();
  });

  test('yaroqsiz sana rad etiladi', () => {
    expect(() => computeDueAt(new Date('shunday sana yo‘q'), 6)).toThrow();
  });
});
