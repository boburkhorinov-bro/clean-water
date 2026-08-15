import { afterEach, describe, expect, test } from 'vitest';
import { FORM_TOKEN_MIN_AGE_MS, verifyFormToken } from '@/server/form-token';
import { GET } from './route';

/**
 * `GET /api/form-token` — ommaviy forma ochilganda chaqiriladi (§6).
 *
 * Nega alohida manzil, tokenni sahifaning o'ziga qo'yish o'rniga: katalog
 * sahifalari ISR bilan keshlanadi (60 s) va token HTML ga muzlab qolardi —
 * bir necha soatdan keyin barcha mijozlar «eskirgan token» olardi.
 */

const SECRET = 'test-sir-kaliti-kamida-32-belgi-uzunlikda';
const saved = process.env.JWT_SECRET;

afterEach(() => {
  process.env.JWT_SECRET = saved;
});

describe('GET /api/form-token', () => {
  test('tekshiruvdan o‘tadigan token beradi', async () => {
    process.env.JWT_SECRET = SECRET;

    const response = GET();
    const body = (await response.json()) as { token: string };

    expect(response.status).toBe(200);
    expect(
      verifyFormToken(body.token, SECRET, { now: Date.now() + FORM_TOKEN_MIN_AGE_MS }),
    ).toEqual({ ok: true });
  });

  test('javob keshlanmaydi', () => {
    // Keshlangan token hamma mijozga bitta bo'lardi va bir sutkadan keyin
    // birdaniga hamma ariza rad etilardi.
    process.env.JWT_SECRET = SECRET;

    expect(GET().headers.get('Cache-Control')).toContain('no-store');
  });

  test('sir sozlanmagan bo‘lsa 500 — jimgina token bermaydi', () => {
    delete process.env.JWT_SECRET;

    expect(GET().status).toBe(500);
  });
});
