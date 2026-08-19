import { describe, expect, test, vi } from 'vitest';
import { handleReminderTrigger, type ReminderTriggerDeps } from './trigger';

/**
 * Eslatmalarni TASHQARIDAN ishga tushirish (§4.6).
 *
 * Nega kerak: bepul hostingda (Render) xizmat 15 daqiqa bekorchilikdan keyin
 * uxlaydi. Jarayon ichidagi kunlik rejalashtiruvchi uxlab yotgan konteynerda
 * ishlamaydi — ya'ni o'sha kungi eslatmalar hech kimga ketmasdi va buni
 * faqat mijoz kartriji o'tib ketganda bilib olardik. Tashqi cron xizmati
 * belgilangan vaqtda shu manzilga so'rov yuboradi: so'rov konteynerni
 * uyg'otadi va o'tishni boshlaydi.
 *
 * Jarayon ichidagi rejalashtiruvchi OLIB TASHLANMAYDI — ikkalasi ham
 * ishlaydi. Ikki marta ishga tushish xavfsiz: eslatmalar idempotentligi
 * kodda emas, bazada (`notifications` dagi unikal indeks), ya'ni ikkinchi
 * o'tish shunchaki `skipped` beradi. Zaxira sifatida turgani afzal: tashqi
 * cron xizmati ham to'xtab qolishi mumkin.
 *
 * Bu fayl — sof qaror qatlami, xuddi `bot/webhook.ts` kabi: HTTP ham,
 * Telegram ham bu yerda yo'q.
 */
describe('handleReminderTrigger', () => {
  function deps(overrides: Partial<ReminderTriggerDeps> = {}): ReminderTriggerDeps {
    return {
      secret: 'sir',
      runSweep: vi.fn(async () => ({
        sent: 2,
        skipped: 1,
        failed: 0,
        rateLimited: false,
        retryAfterSeconds: null,
      })),
      ...overrides,
    };
  }

  test('to‘g‘ri sir bilan o‘tish boshlanadi', async () => {
    const d = deps();

    const response = await handleReminderTrigger({ authorization: 'Bearer sir' }, d);

    expect(response.status).toBe(200);
    expect(d.runSweep).toHaveBeenCalled();
    expect(response.body).toMatchObject({ sent: 2, skipped: 1, failed: 0 });
  });

  test('sir mos kelmasa 401 va o‘tish boshlanmaydi', async () => {
    const d = deps();

    const response = await handleReminderTrigger({ authorization: 'Bearer boshqa' }, d);

    expect(response.status).toBe(401);
    expect(d.runSweep).not.toHaveBeenCalled();
  });

  test('sarlavha umuman bo‘lmasa 401', async () => {
    const d = deps();

    const response = await handleReminderTrigger({ authorization: undefined }, d);

    expect(response.status).toBe(401);
    expect(d.runSweep).not.toHaveBeenCalled();
  });

  /**
   * §6 — webhook bilan bir xil qoida: sirsiz manzil ochiq internetda
   * turadi va uni istalgan odam chaqirib, mijozlarga eslatma yog'dirardi.
   */
  test('SERVERDA SIR SOZLANMAGAN BO‘LSA hamma so‘rov rad etiladi', async () => {
    const d = deps({ secret: undefined });

    const response = await handleReminderTrigger({ authorization: 'Bearer sir' }, d);

    expect(response.status).toBe(401);
    expect(d.runSweep).not.toHaveBeenCalled();
  });

  test('bo‘sh sir ham himoya emas', async () => {
    const d = deps({ secret: '' });

    expect((await handleReminderTrigger({ authorization: 'Bearer ' }, d)).status).toBe(401);
  });

  test('`Bearer` siz xom sir ham qabul qilinadi', async () => {
    // Ba'zi cron xizmatlari `Authorization` ni o'zgartirmasdan uzatadi va
    // foydalanuvchi u yerga faqat qiymatni yozib qo'yishi mumkin. Bu
    // himoyani zaiflashtirmaydi — sir baribir to'liq solishtiriladi.
    const d = deps();

    expect((await handleReminderTrigger({ authorization: 'sir' }, d)).status).toBe(200);
  });

  /**
   * Cron xizmati javob kodiga qarab tarixida «muvaffaqiyatsiz» deb
   * belgilaydi va egasiga xat yuboradi. Shuning uchun o'tish yiqilsa 500
   * qaytishi SHART: 200 bilan jimgina yutib yuborilgan xato eslatmalar
   * bir necha kun ketmayotganini yashirardi.
   */
  test('o‘tish yiqilsa 500 qaytadi — cron buni ko‘rsin', async () => {
    const d = deps({
      runSweep: vi.fn(async () => {
        throw new Error('baza yiqildi');
      }),
    });

    const response = await handleReminderTrigger({ authorization: 'Bearer sir' }, d);

    expect(response.status).toBe(500);
  });

  test('429 ga urilgan o‘tish natijada ko‘rinadi', async () => {
    // Telegram cheklovi butun botga tegishli: qolgan eslatmalar keyingi
    // o'tishga qoladi va bu javobda aytiladi.
    const d = deps({
      runSweep: vi.fn(async () => ({
        sent: 5,
        skipped: 0,
        failed: 1,
        rateLimited: true,
        retryAfterSeconds: 42,
      })),
    });

    const response = await handleReminderTrigger({ authorization: 'Bearer sir' }, d);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ rateLimited: true, retryAfterSeconds: 42 });
  });
});
