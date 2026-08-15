import { describe, expect, test } from 'vitest';
import { pickMostUrgentPart } from './dashboard';
import type { MyFilterInstallation } from './my-filter';

/**
 * Mini App dashboardidagi «diqqat talab qiladigan kartrij» (§3).
 *
 * Dastlabki g'oyada shkala «o'z-o'zidan to'lardi». U rad etilgan: dashboard
 * mijozga HAQIQIY holatni ko'rsatadi yoki hech narsa ko'rsatmaydi. Shuning
 * uchun bu funksiya ham `null` qaytarishdan tortinmaydi — o'rnatish yo'q
 * bo'lsa, dashboardda kartrij bloki umuman chiqmaydi.
 */

function part(overrides: {
  id: string;
  daysLeft: number;
  state: 'OK' | 'SOON' | 'DUE';
}): MyFilterInstallation['parts'][number] {
  return {
    id: overrides.id,
    cartridgeName: `Kartrij ${overrides.id}`,
    cartridgeSlug: overrides.id,
    installedAt: new Date('2026-01-01T00:00:00Z'),
    dueAt: new Date('2026-07-01T00:00:00Z'),
    progress: {
      daysLeft: overrides.daysLeft,
      daysTotal: 181,
      usedRatio: 0.5,
      state: overrides.state,
    },
  };
}

function installation(parts: MyFilterInstallation['parts']): MyFilterInstallation {
  return {
    id: 'i1',
    filterName: 'Osmos 5',
    filterSlug: 'osmos-5',
    installedAt: new Date('2026-01-01T00:00:00Z'),
    address: null,
    parts,
  };
}

describe('pickMostUrgentPart', () => {
  test('o‘rnatish yo‘q bo‘lsa `null` — dashboardda blok umuman chiqmaydi', () => {
    expect(pickMostUrgentPart([])).toBeNull();
  });

  test('kartrijsiz o‘rnatishda ham `null`', () => {
    expect(pickMostUrgentPart([installation([])])).toBeNull();
  });

  test('eng kam kun qolgani tanlanadi', () => {
    const result = pickMostUrgentPart([
      installation([
        part({ id: 'uzoq', daysLeft: 300, state: 'OK' }),
        part({ id: 'yaqin', daysLeft: 12, state: 'SOON' }),
        part({ id: 'orta', daysLeft: 90, state: 'OK' }),
      ]),
    ]);

    expect(result?.part.id).toBe('yaqin');
  });

  test('MUDDATI O‘TGAN eng shoshilinch — kunlar manfiy', () => {
    const result = pickMostUrgentPart([
      installation([
        part({ id: 'yaqin', daysLeft: 5, state: 'SOON' }),
        part({ id: 'otgan', daysLeft: -20, state: 'DUE' }),
      ]),
    ]);

    expect(result?.part.id).toBe('otgan');
  });

  test('bir nechta o‘rnatish bo‘ylab qidiriladi (§5 — uy va dala hovli)', () => {
    const home = installation([part({ id: 'uy', daysLeft: 100, state: 'OK' })]);
    const dacha = { ...installation([part({ id: 'dala', daysLeft: 3, state: 'SOON' })]), id: 'i2' };

    const result = pickMostUrgentPart([home, dacha]);

    expect(result?.part.id).toBe('dala');
    expect(result?.installation.id).toBe('i2');
  });

  test('natijada apparat ham qaytadi — mijoz qaysi filtr ekanini bilishi kerak', () => {
    const result = pickMostUrgentPart([
      installation([part({ id: 'p', daysLeft: 5, state: 'SOON' })]),
    ]);

    expect(result?.installation.filterName).toBe('Osmos 5');
  });

  test('hammasi xotirjam bo‘lsa ham eng yaqini qaytadi — bu ham real ma‘lumot', () => {
    const result = pickMostUrgentPart([
      installation([
        part({ id: 'a', daysLeft: 300, state: 'OK' }),
        part({ id: 'b', daysLeft: 200, state: 'OK' }),
      ]),
    ]);

    expect(result?.part.id).toBe('b');
  });
});
