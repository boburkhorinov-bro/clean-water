import { describe, expect, test } from 'vitest';
import { sanitizeAuditPayload } from './audit';

/**
 * §6: «Administratorlar harakatlari jurnali (`AuditLog`)».
 *
 * Sxemadagi izoh aniq: «O'zgarish tafsiloti; sirlar bu yerga yozilmaydi».
 * Jurnal admin panelda ko'rinadi va zaxira nusxalarga tushadi — unga tushgan
 * token yoki parol o'sha zahoti ikkinchi joyga ko'chgan bo'ladi.
 *
 * Shuning uchun filtr KALIT NOMI bo'yicha ishlaydi va oq ro'yxat emas, qora
 * ro'yxat: yangi maydon qo'shilganda u jurnalga tushadi, lekin `token` deb
 * atalgan maydon hech qachon tushmaydi.
 */
describe('sanitizeAuditPayload', () => {
  test('oddiy maydonlar o‘zgarishsiz qoladi', () => {
    expect(sanitizeAuditPayload({ slug: 'osmos-5', price: '2500000' })).toEqual({
      slug: 'osmos-5',
      price: '2500000',
    });
  });

  test('SIR MAYDONLAR olib tashlanadi', () => {
    const clean = sanitizeAuditPayload({
      slug: 'osmos-5',
      token: 'abc',
      password: 'x',
      secret: 'y',
      jwtSecret: 'z',
    });

    expect(clean).toEqual({ slug: 'osmos-5' });
  });

  test('kalit nomining registri ahamiyatsiz', () => {
    expect(sanitizeAuditPayload({ TOKEN: 'a', Secret: 'b', ok: 1 })).toEqual({ ok: 1 });
  });

  test('ICHKI OBYEKTLARDA ham tozalanadi', () => {
    const clean = sanitizeAuditPayload({
      product: { slug: 'osmos-5', apiKey: 'maxfiy' },
    });

    expect(clean).toEqual({ product: { slug: 'osmos-5' } });
  });

  test('massivlar ichidagi obyektlar ham tozalanadi', () => {
    const clean = sanitizeAuditPayload({
      rows: [{ k: 'a', token: 'x' }],
    });

    expect(clean).toEqual({ rows: [{ k: 'a' }] });
  });

  test('`null` va oddiy qiymatlar shundayligicha o‘tadi', () => {
    expect(sanitizeAuditPayload(null)).toBeNull();
    expect(sanitizeAuditPayload('matn')).toBe('matn');
    expect(sanitizeAuditPayload(42)).toBe(42);
  });

  test('JUDA KATTA payload kesiladi — jurnal bazani to‘ldirmasligi kerak', () => {
    const long = 'x'.repeat(10_000);

    const clean = sanitizeAuditPayload({ note: long }) as { note: string };

    expect(clean.note.length).toBeLessThan(2_000);
    expect(clean.note).toMatch(/…$/);
  });

  test('chuqur ichma-ich obyekt cheklanadi — cheksiz rekursiya bo‘lmaydi', () => {
    // Ichma-ich 100 daraja: hisob to'xtashi kerak.
    let deep: unknown = 'tub';
    for (let i = 0; i < 100; i += 1) deep = { level: deep };

    expect(() => sanitizeAuditPayload(deep)).not.toThrow();
  });
});
