import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import type { ResourceProgress } from '@/server/services/my-filter';
import { ResourceBar } from './ResourceBar';

/**
 * §3: «Progress-shkalalar faqat real ma'lumot ko'rsatadi. Dekorativ shkala
 * yo'q.»
 *
 * Shuning uchun test shkalaning KO'RINISHINI emas, u ko'rsatayotgan SONNI
 * tekshiradi: kenglik `usedRatio` ga teng bo'lishi va o'sha son ekranga
 * o'qiladigan ko'rinishda ham chiqishi kerak.
 */
function progress(overrides: Partial<ResourceProgress> = {}): ResourceProgress {
  return { daysLeft: 90, daysTotal: 181, usedRatio: 0.5, state: 'OK', ...overrides };
}

describe('ResourceBar', () => {
  test('to‘ldirilgan qism haqiqiy nisbatga teng', () => {
    const html = renderToStaticMarkup(
      <ResourceBar progress={progress({ usedRatio: 0.42 })} locale="uz" />,
    );

    expect(html).toContain('42%');
  });

  test('qolgan kunlar ko‘rsatiladi', () => {
    const html = renderToStaticMarkup(
      <ResourceBar progress={progress({ daysLeft: 90 })} locale="uz" />,
    );

    expect(html).toContain('90');
    expect(html).toContain('kun qoldi');
  });

  test('MUDDAT O‘TGAN: kechikkan kunlar musbat son bilan aytiladi', () => {
    const html = renderToStaticMarkup(
      <ResourceBar
        progress={progress({ daysLeft: -12, usedRatio: 1, state: 'DUE' })}
        locale="uz"
      />,
    );

    expect(html).toContain('12');
    expect(html).toContain('kechikdi');
    expect(html).not.toContain('-12');
  });

  test('bugun muddat kelgan bo‘lsa alohida matn', () => {
    const html = renderToStaticMarkup(
      <ResourceBar progress={progress({ daysLeft: 0, usedRatio: 1, state: 'DUE' })} locale="uz" />,
    );

    expect(html).toContain('Bugun almashtirish kerak');
  });

  test('EKRAN O‘QUVCHISI uchun ham o‘sha sonlar — bezak emas', () => {
    const html = renderToStaticMarkup(
      <ResourceBar progress={progress({ usedRatio: 0.42 })} locale="uz" />,
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  test('holat ma‘lumot atributida — rang shundan tanlanadi', () => {
    const html = renderToStaticMarkup(<ResourceBar progress={progress()} locale="uz" />);

    expect(html).toContain('data-state="OK"');
  });

  test('ruscha matn', () => {
    const html = renderToStaticMarkup(
      <ResourceBar progress={progress({ daysLeft: 90 })} locale="ru" />,
    );

    expect(html).toContain('осталось');
  });
});
