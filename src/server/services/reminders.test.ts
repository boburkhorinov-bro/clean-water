import { describe, expect, test } from 'vitest';
import { buildReminderMessage, reminderKindFor } from './reminders';

/**
 * §4.6: worker «`due_at` gacha 30, 7 yoki 0 kun qolgan `InstalledPart` larni
 * tanlaydi».
 *
 * Ikkita qaror shu yerda va ikkalasi ham mijozga ko'rinadi:
 *
 * 1. Chegara AYNAN 30/7/0 kun emas, «shu chegaradan o'tgan» bo'lishi kerak.
 *    Worker bir kun ishlamay qolsa (konteyner qayta yuklandi, VPS o'chdi),
 *    aniq tenglikda qidiruv o'sha eslatmani butunlay o'tkazib yuborardi.
 *
 * 2. Bir vaqtning o'zida bir nechta chegara o'tilgan bo'lsa, faqat ENG
 *    SHOSHILINCH turi yuboriladi. Muddatiga uch kun qolgan kartrij uchun
 *    «30 kun qoldi» va «7 kun qoldi» xabarlarini birga yuborish — spam.
 */

function tashkent(iso: string): Date {
  return new Date(`${iso}+05:00`);
}

describe('reminderKindFor', () => {
  const now = tashkent('2026-08-15T09:00:00');

  test('31 kun qolganda hali eslatma yo‘q', () => {
    expect(reminderKindFor(tashkent('2026-09-15T09:00:00'), now)).toBeNull();
  });

  test('aynan 30 kun qolganda — DAYS_30', () => {
    expect(reminderKindFor(tashkent('2026-09-14T09:00:00'), now)).toBe('DAYS_30');
  });

  test('KECHIKKAN WORKER: 29 kun qolganda ham DAYS_30 yuboriladi', () => {
    expect(reminderKindFor(tashkent('2026-09-13T09:00:00'), now)).toBe('DAYS_30');
  });

  test('8 kun qolganda hali DAYS_30', () => {
    expect(reminderKindFor(tashkent('2026-08-23T09:00:00'), now)).toBe('DAYS_30');
  });

  test('aynan 7 kun qolganda — DAYS_7', () => {
    expect(reminderKindFor(tashkent('2026-08-22T09:00:00'), now)).toBe('DAYS_7');
  });

  test('SPAM YO‘Q: 3 kun qolganda faqat DAYS_7, DAYS_30 bilan birga emas', () => {
    expect(reminderKindFor(tashkent('2026-08-18T09:00:00'), now)).toBe('DAYS_7');
  });

  test('muddat bugun kelganda — DUE', () => {
    expect(reminderKindFor(tashkent('2026-08-15T20:00:00'), now)).toBe('DUE');
  });

  test('muddat o‘tib ketgan bo‘lsa ham DUE', () => {
    expect(reminderKindFor(tashkent('2026-07-01T09:00:00'), now)).toBe('DUE');
  });

  test('KALENDAR KUNI: ertaga tugaydigan kartrij bugun DAYS_7 oladi, DUE emas', () => {
    // Bugun 23:00, muddat ertaga 01:00 — atigi ikki soat, lekin kalendarda bir kun.
    expect(reminderKindFor(tashkent('2026-08-16T01:00:00'), tashkent('2026-08-15T23:00:00'))).toBe(
      'DAYS_7',
    );
  });
});

/**
 * Xabar matni HAQIQIY qolgan kunlarni aytadi, chegara raqamini emas (§3 —
 * «progress-shkalalar faqat real ma'lumot ko'rsatadi» degan qoidaning
 * mantiqiy davomi). Worker uch kun ishlamay qolib, DAYS_30 eslatmasi 27 kun
 * qolganda ketsa, mijozga «30 kun qoldi» deyish — yolg'on.
 */
describe('buildReminderMessage', () => {
  const base = {
    filterName: 'Osmos 5',
    cartridgeName: 'Mexanik kartrij',
    dueAt: tashkent('2026-09-14T09:00:00'),
    now: tashkent('2026-08-15T09:00:00'),
  } as const;

  test('DAYS_30 xabarida muddat sanasi va qolgan kun bor', () => {
    const text = buildReminderMessage({ ...base, kind: 'DAYS_30', locale: 'UZ' });

    expect(text).toContain('30 kun');
    expect(text).toContain('14.09.2026');
  });

  test('KECHIKKAN WORKER: xabarda haqiqiy qolgan kun turadi, chegara emas', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DAYS_30',
      now: tashkent('2026-08-20T09:00:00'),
      locale: 'UZ',
    });

    expect(text).toContain('25 kun');
    expect(text).not.toContain('30 kun');
  });

  test('DAYS_7 xabari', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DAYS_7',
      now: tashkent('2026-09-07T09:00:00'),
      locale: 'UZ',
    });

    expect(text).toContain('7 kun');
  });

  test('DUE xabari muddat kelganini aytadi', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DUE',
      now: tashkent('2026-09-14T09:00:00'),
      locale: 'UZ',
    });

    expect(text).toContain('muddati keldi');
  });

  test('muddat o‘tib ketgan bo‘lsa, necha kun o‘tgani aytiladi', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DUE',
      now: tashkent('2026-09-20T09:00:00'),
      locale: 'UZ',
    });

    expect(text).toContain('6 kun');
    expect(text).toContain('o‘tdi');
  });

  test('xabarda apparat va kartrij nomi bor — mijozda bir nechta filtr bo‘lishi mumkin', () => {
    const text = buildReminderMessage({ ...base, kind: 'DAYS_30', locale: 'UZ' });

    expect(text).toContain('Osmos 5');
    expect(text).toContain('Mexanik kartrij');
  });

  test('ruscha xabar ruscha yoziladi', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DAYS_7',
      now: tashkent('2026-09-07T09:00:00'),
      locale: 'RU',
    });

    expect(text).toContain('7 дней');
    expect(text).not.toContain('kun');
  });

  test('ruscha son shakli to‘g‘ri: 22 kun — «дня»', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DAYS_30',
      now: tashkent('2026-08-23T09:00:00'),
      locale: 'RU',
    });

    expect(text).toContain('22 дня');
  });

  test('ruscha son shakli to‘g‘ri: 21 kun — «день»', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DAYS_30',
      now: tashkent('2026-08-24T09:00:00'),
      locale: 'RU',
    });

    expect(text).toContain('21 день');
  });

  test('DUE ruscha', () => {
    const text = buildReminderMessage({
      ...base,
      kind: 'DUE',
      now: tashkent('2026-09-14T09:00:00'),
      locale: 'RU',
    });

    expect(text).toContain('срок замены');
  });

  test('MAHSULOT NOMI EKRANLANADI — u admin kiritgan matn va HTML rejimiga tushadi', () => {
    const text = buildReminderMessage({
      ...base,
      cartridgeName: '<b>Arzon</b> & "eng zo‘r"',
      kind: 'DAYS_30',
      locale: 'UZ',
    });

    expect(text).toContain('&lt;b&gt;Arzon&lt;/b&gt; &amp;');
    expect(text).not.toContain('<b>Arzon</b>');
  });

  test('sana Toshkent bo‘yicha ko‘rsatiladi', () => {
    const text = buildReminderMessage({
      ...base,
      dueAt: new Date('2026-09-14T20:00:00Z'),
      kind: 'DAYS_30',
      locale: 'UZ',
    });

    expect(text).toContain('15.09.2026');
  });
});
