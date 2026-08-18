import { describe, expect, test, vi } from 'vitest';
import {
  buildLeadMessage,
  buildTelegramError,
  sendWithRetry,
  TelegramRateLimitError,
  TelegramSendError,
} from './notify-manager';

/**
 * §4.5: «Menejerlar guruhiga «Ishga olish» inline tugmasi bilan asinxron
 * xabar yuborish, nosozlikda takrorlash bilan.»
 *
 * Xabar Telegram ning HTML rejimida yuboriladi, ya'ni mijoz kiritgan ism va
 * izoh markupga tushadi — ular ekranlanishi shart.
 */
describe('buildLeadMessage', () => {
  const base = {
    phone: '+998901234567',
    name: 'Aziz',
    productName: 'Osmos 5',
    source: 'WEB' as const,
    comment: null,
  };

  test('telefon, ism va mahsulot xabarda bo‘ladi', () => {
    const text = buildLeadMessage(base);

    expect(text).toContain('+998901234567');
    expect(text).toContain('Aziz');
    expect(text).toContain('Osmos 5');
  });

  test('manba ko‘rsatiladi — menejer qayerdan kelganini bilishi kerak', () => {
    expect(buildLeadMessage(base)).toMatch(/WEB|sayt/i);
    expect(buildLeadMessage({ ...base, source: 'MINIAPP' })).toMatch(/MINIAPP|Mini App/i);
  });

  test('ismsiz ariza ham xabar hosil qiladi', () => {
    const text = buildLeadMessage({ ...base, name: null });

    expect(text).toContain('+998901234567');
  });

  test('mahsulotsiz ariza ham xabar hosil qiladi', () => {
    const text = buildLeadMessage({ ...base, productName: null });

    expect(text).toContain('+998901234567');
  });

  test('INJECTION: mijoz ismidagi HTML ekranlanadi', () => {
    const text = buildLeadMessage({ ...base, name: '<b>qalin</b><script>x</script>' });

    expect(text).not.toContain('<b>qalin</b>');
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;b&gt;');
  });

  test('INJECTION: izohdagi HTML ham ekranlanadi', () => {
    const text = buildLeadMessage({ ...base, comment: '<a href="http://evil">bosing</a>' });

    expect(text).not.toContain('<a href');
    expect(text).toContain('&lt;a href');
  });

  test('ampersand ham ekranlanadi — Telegram uni buzuq HTML deb rad etadi', () => {
    const text = buildLeadMessage({ ...base, name: 'Ali & Vali' });

    expect(text).toContain('&amp;');
  });
});

describe('sendWithRetry', () => {
  test('birinchi urinishda muvaffaqiyat bo‘lsa qayta urinilmaydi', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });

    await sendWithRetry(send, { attempts: 3, sleep: vi.fn() });

    expect(send).toHaveBeenCalledOnce();
  });

  test('nosozlikda qayta urinadi', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('tarmoq'))
      .mockRejectedValueOnce(new Error('tarmoq'))
      .mockResolvedValue({ ok: true });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await sendWithRetry(send, { attempts: 3, sleep });

    expect(send).toHaveBeenCalledTimes(3);
  });

  test('urinishlar tugagach xato tashlaydi', async () => {
    const send = vi.fn().mockRejectedValue(new Error('tarmoq'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(sendWithRetry(send, { attempts: 2, sleep })).rejects.toThrow('tarmoq');
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('429 kelganda Telegram bergan retry_after hurmat qilinadi (§4.6)', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('429'), { retryAfterSeconds: 7 }))
      .mockResolvedValue({ ok: true });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await sendWithRetry(send, { attempts: 3, sleep });

    // O'z kechikishimiz emas, Telegram aytgan qiymat.
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  test('oddiy nosozlikda kechikish orta boradi', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('tarmoq'))
      .mockRejectedValueOnce(new Error('tarmoq'))
      .mockResolvedValue({ ok: true });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await sendWithRetry(send, { attempts: 3, sleep, baseDelayMs: 100 });

    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });
});

/**
 * Telegram xatosining TASHXIS QO'YILADIGAN bo'lishi.
 *
 * Haqiqiy holat (2026-08-16): bot menejerlar guruhidan chiqarilgan edi va log da
 * faqat `Telegram sendMessage 403` ko'rindi. Sababni bilish uchun Telegram API
 * ga QO'LDA murojaat qilishga to'g'ri keldi — javob tanasidagi `description`
 * («bot was kicked from the group chat») tashlab yuborilgan edi.
 *
 * Prodda bu qimmatga tushadi: menejer «arizalar kelmayapti» deydi, log esa
 * bot chiqarilganmi, huquq yo'qmi, guruh o'chganmi — ayta olmaydi.
 */
describe('buildTelegramError', () => {
  test('xato matnida Telegram ning description i bo‘ladi', () => {
    const error = buildTelegramError(403, {
      description: 'Forbidden: bot was kicked from the group chat',
    });

    expect(error.message).toContain('403');
    expect(error.message).toContain('bot was kicked from the group chat');
  });

  test('description yo‘q bo‘lsa ham status ko‘rinadi', () => {
    // Tarmoq oralig'idagi proksi JSON emas, HTML qaytarishi mumkin.
    const error = buildTelegramError(502, null);

    expect(error.message).toContain('502');
  });

  test('429 — retry_after ni olib yuruvchi alohida xato', () => {
    const error = buildTelegramError(429, { parameters: { retry_after: 7 } });

    expect(error).toBeInstanceOf(TelegramRateLimitError);
    expect((error as TelegramRateLimitError).retryAfterSeconds).toBe(7);
  });

  test('migrate_to_chat_id — YANGI ID xato matnida ko‘rinadi', () => {
    // Guruh supergruppaga aylanganda `chat_id` o'zgaradi va eskisi ishlamaydi.
    // Kod uni o'zi tuzata olmaydi — `chat_id` env da statik. Yagona foydali
    // narsa: yangi ID ni log ga aniq chiqarish, aks holda xabarnomalar
    // JIMGINA to'xtaydi va sababi topilmaydi.
    const error = buildTelegramError(400, {
      description: 'Bad Request: group chat was upgraded to a supergroup chat',
      parameters: { migrate_to_chat_id: -1001234567890 },
    });

    expect(error).toBeInstanceOf(TelegramSendError);
    expect((error as TelegramSendError).migrateToChatId).toBe('-1001234567890');
    expect(error.message).toContain('-1001234567890');
    expect(error.message).toContain('TELEGRAM_MANAGER_CHAT_ID');
  });

  test('4xx doimiy deb belgilanadi', () => {
    // Bot chiqarilgan bo'lsa, uch marta urinish ham yordam bermaydi.
    expect((buildTelegramError(403, null) as TelegramSendError).permanent).toBe(true);
    expect((buildTelegramError(400, null) as TelegramSendError).permanent).toBe(true);
  });

  test('5xx vaqtinchalik — qayta urinishga arziydi', () => {
    expect((buildTelegramError(500, null) as TelegramSendError).permanent).toBe(false);
    expect((buildTelegramError(502, null) as TelegramSendError).permanent).toBe(false);
  });

  test('429 doimiy EMAS — u kutishni talab qiladi, taslim bo‘lishni emas', () => {
    expect(buildTelegramError(429, null)).toBeInstanceOf(TelegramRateLimitError);
  });
});

describe('sendWithRetry — doimiy xatolar', () => {
  test('doimiy xatoda qayta urinilmaydi', async () => {
    // O'lchangan oqibat: bot guruhdan chiqarilganda `POST /api/leads` 15.4 s
    // davom etdi (3 urinish + kechikishlar), tuzatilgach 2.4 s. Xabarnoma
    // javobdan oldin kutiladi, ya'ni buni MIJOZ kutadi.
    const send = vi.fn().mockRejectedValue(buildTelegramError(403, { description: 'kicked' }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(sendWithRetry(send, { attempts: 3, sleep })).rejects.toThrow('403');

    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('vaqtinchalik xatoda avvalgidek qayta urinadi', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(buildTelegramError(503, null))
      .mockResolvedValue({ ok: true });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await sendWithRetry(send, { attempts: 3, sleep });

    expect(send).toHaveBeenCalledTimes(2);
  });
});
