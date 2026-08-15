import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { TelegramRateLimitError } from '@/server/telegram/notify-manager';
import { resetDatabase } from '@/test/db-helpers';
import { registerInstallation, markPartReplaced } from './installations';
import { runReminderSweep, type ReminderTarget } from './reminder-sweep';

/**
 * §4.6 — kunlik eslatma o'tishi.
 *
 * Idempotentlik bu yerda ixtiyoriy emas: «bitta kartrij haqidagi takroriy
 * eslatma mijoz tomonidan spam sifatida o'qiladi va o'tkazib yuborilgan
 * eslatmadan qimmatroqqa tushadi». Kafolat mantiqda emas, BAZADA —
 * `(installed_part_id, kind)` unikal indeksi. Aynan shuning uchun bu testlar
 * haqiqiy PostgreSQL ga qarshi ishlaydi: mock indeksni tekshirmaydi.
 */
describe('runReminderSweep', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function tashkent(iso: string): Date {
    return new Date(`${iso}+05:00`);
  }

  /** Yuborilgan xabarlarni yig'ib boruvchi soxta transport. */
  function recorder() {
    const sent: ReminderTarget[] = [];
    return {
      sent,
      send: async (target: ReminderTarget) => {
        sent.push(target);
      },
    };
  }

  /** Har bir chaqiruvda yangi mijoz va yangi mahsulot — unikal cheklovlar to'qnashmasin. */
  let seq = 0;
  beforeEach(() => {
    seq = 0;
  });

  /**
   * Mijoz + apparat + bitta kartrij. `dueAt` ni boshqarish uchun o'rnatish
   * sanasi teskari hisoblanadi: 6 oylik kartrij `installedAt` + 6 oy da tugaydi.
   */
  async function setupPart(options: {
    installedAt: Date;
    resourceMonths?: number;
    telegramId?: bigint | null;
    lang?: 'UZ' | 'RU';
    slug?: string;
  }) {
    seq += 1;
    const user = await prisma.user.create({
      data: {
        phone: `+99890123456${seq}`,
        name: 'Aziz',
        telegramId:
          options.telegramId === null ? null : (options.telegramId ?? BigInt(555000000 + seq)),
        lang: options.lang ?? 'UZ',
      },
    });
    const filter = await prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: `filtr-${options.slug ?? 'a'}`,
        nameUz: 'Osmos 5',
        nameRu: 'Осмос 5',
        price: '2500000',
      },
    });
    const cartridge = await prisma.product.create({
      data: {
        kind: 'CARTRIDGE',
        slug: `kartrij-${options.slug ?? 'a'}`,
        nameUz: 'Mexanik kartrij',
        nameRu: 'Механический картридж',
        price: '150000',
        cartridgeSpec: { create: { resourceMonths: options.resourceMonths ?? 6 } },
      },
    });

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: options.installedAt,
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = installation.parts[0];
    if (!part) throw new Error('test sozlamasi buzilgan');

    return { user, filter, cartridge, installation, part };
  }

  test('bo‘sh bazada hech narsa yuborilmaydi', async () => {
    const transport = recorder();

    const result = await runReminderSweep({ now: tashkent('2026-08-15T09:00:00'), ...transport });

    expect(result.sent).toBe(0);
    expect(transport.sent).toHaveLength(0);
  });

  test('30 kun qolganda DAYS_30 yuboriladi va bazada SENT bo‘lib qoladi', async () => {
    // 6 oylik kartrij 15-fevralda o'rnatilgan → muddati 15-avgust.
    const { part } = await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    const result = await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });

    expect(result.sent).toBe(1);
    expect(transport.sent[0]?.kind).toBe('DAYS_30');

    const notification = await prisma.notification.findFirstOrThrow({
      where: { installedPartId: part.id },
    });
    expect(notification.kind).toBe('DAYS_30');
    expect(notification.status).toBe('SENT');
    expect(notification.sentAt).not.toBeNull();
  });

  test('31 kun qolganda hali hech narsa yuborilmaydi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    const result = await runReminderSweep({ now: tashkent('2026-07-15T09:00:00'), ...transport });

    expect(result.sent).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  test('7 kun qolganda DAYS_7 yuboriladi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-08-08T09:00:00'), ...transport });

    expect(transport.sent[0]?.kind).toBe('DAYS_7');
  });

  test('muddat kelgan kuni DUE yuboriladi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-08-15T09:00:00'), ...transport });

    expect(transport.sent[0]?.kind).toBe('DUE');
  });

  test('SPAM YO‘Q: uch kun qolganda faqat bitta xabar (DAYS_7), DAYS_30 bilan birga emas', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-08-12T09:00:00'), ...transport });

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.kind).toBe('DAYS_7');
  });

  test('IDEMPOTENTLIK: ikkinchi o‘tishda o‘sha eslatma qayta yuborilmaydi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    const first = await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });
    const second = await runReminderSweep({ now: tashkent('2026-07-17T09:00:00'), ...transport });

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);
    expect(transport.sent).toHaveLength(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  test('BOSQICHMA-BOSQICH: DAYS_30 dan keyin DAYS_7, keyin DUE yuboriladi', async () => {
    const { part } = await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });
    await runReminderSweep({ now: tashkent('2026-08-08T09:00:00'), ...transport });
    await runReminderSweep({ now: tashkent('2026-08-15T09:00:00'), ...transport });

    expect(transport.sent.map((t) => t.kind)).toEqual(['DAYS_30', 'DAYS_7', 'DUE']);
    expect(await prisma.notification.count({ where: { installedPartId: part.id } })).toBe(3);
  });

  test('ALMASHTIRILGAN kartrij tanlanmaydi', async () => {
    const { part } = await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2026-07-01T09:00:00'),
    });
    const transport = recorder();

    const result = await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });

    // Yangi kartrijning muddati 2027-01-01 — hali uzoq.
    expect(result.sent).toBe(0);
  });

  test('ALMASHTIRISHDAN KEYIN yangi qator o‘z eslatmasini oladi', async () => {
    const { part } = await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });
    const replacement = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2026-08-15T09:00:00'),
    });

    // Yangi kartrij 2027-02-15 da tugaydi; 30 kun oldin eslatma ketishi kerak.
    await runReminderSweep({ now: tashkent('2027-01-16T09:00:00'), ...transport });

    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[1]?.installedPartId).toBe(replacement.next.id);
  });

  test('TELEGRAM SIZ MIJOZ o‘tkazib yuboriladi — yuboradigan manzil yo‘q', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00'), telegramId: null });
    const transport = recorder();

    const result = await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });

    expect(result.sent).toBe(0);
    expect(transport.sent).toHaveLength(0);
    // Satr ham yaratilmaydi: mijoz keyinchalik Telegramga ulansa,
    // eslatma o'sha zahoti tiklanishi kerak.
    expect(await prisma.notification.count()).toBe(0);
  });

  test('xabar mijozning Telegram ID siga ketadi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00'), telegramId: 777000222n });
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });

    expect(transport.sent[0]?.chatId).toBe(777000222n);
  });

  test('xabar mijozning tilida yoziladi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00'), lang: 'RU' });
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });

    expect(transport.sent[0]?.text).toContain('Замена картриджа');
    expect(transport.sent[0]?.text).toContain('Механический картридж');
  });

  test('XATO YUBORISHDA satr FAILED bo‘ladi va keyingi o‘tishda qayta uriniladi', async () => {
    const { part } = await setupPart({ installedAt: tashkent('2026-02-15T09:00:00') });

    const failing = await runReminderSweep({
      now: tashkent('2026-07-16T09:00:00'),
      send: async () => {
        throw new Error('tarmoq uzildi');
      },
    });

    expect(failing.failed).toBe(1);
    const afterFailure = await prisma.notification.findFirstOrThrow({
      where: { installedPartId: part.id },
    });
    expect(afterFailure.status).toBe('FAILED');
    expect(afterFailure.error).toContain('tarmoq uzildi');
    expect(afterFailure.sentAt).toBeNull();

    // Keyingi kunlik o'tish o'sha eslatmani qayta yuborishi kerak —
    // aks holda nosozlik tufayli mijoz eslatmani butunlay yo'qotardi.
    const transport = recorder();
    const retry = await runReminderSweep({ now: tashkent('2026-07-17T09:00:00'), ...transport });

    expect(retry.sent).toBe(1);
    expect(transport.sent[0]?.kind).toBe('DAYS_30');
    const afterRetry = await prisma.notification.findFirstOrThrow({
      where: { installedPartId: part.id },
    });
    expect(afterRetry.status).toBe('SENT');
    // Takroriy satr emas, o'sha satr yangilanadi.
    expect(await prisma.notification.count()).toBe(1);
  });

  test('429: o‘tish to‘xtaydi, `retry_after` qaytadi, qolganlari keyingi o‘tishga qoladi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00'), slug: 'a' });
    await setupPart({ installedAt: tashkent('2026-02-16T09:00:00'), slug: 'b' });

    let calls = 0;
    const result = await runReminderSweep({
      now: tashkent('2026-07-16T09:00:00'),
      send: async () => {
        calls += 1;
        throw new TelegramRateLimitError(42);
      },
    });

    expect(calls).toBe(1);
    expect(result.rateLimited).toBe(true);
    expect(result.retryAfterSeconds).toBe(42);
    // Ikkinchi kartrijga umuman tegilmaydi.
    expect(await prisma.notification.count()).toBe(1);
    expect(await prisma.notification.count({ where: { status: 'SENT' } })).toBe(0);
  });

  test('SHOSHILINCHI OLDIN: muddat kelganlar 30 kunlilardan oldin yuboriladi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00'), slug: 'keyin' }); // 15-avgust
    await setupPart({ installedAt: tashkent('2026-01-16T09:00:00'), slug: 'oldin' }); // 16-iyul
    const transport = recorder();

    await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });

    expect(transport.sent.map((t) => t.kind)).toEqual(['DUE', 'DAYS_30']);
  });

  test('bir necha mijozning kartrijlari bir o‘tishda yuboriladi', async () => {
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00'), slug: 'a' });
    await setupPart({ installedAt: tashkent('2026-02-15T09:00:00'), slug: 'b', telegramId: 999n });
    const transport = recorder();

    const result = await runReminderSweep({ now: tashkent('2026-07-16T09:00:00'), ...transport });

    expect(result.sent).toBe(2);
  });
});
