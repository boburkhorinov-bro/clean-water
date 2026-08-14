import { describe, expect, test, vi } from 'vitest';
import { buildLeadMessage, sendWithRetry } from './notify-manager';

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
