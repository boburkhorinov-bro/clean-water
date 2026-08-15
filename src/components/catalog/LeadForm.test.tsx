import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { getMessages } from '@/lib/i18n/messages';
import { LeadForm } from './LeadForm';

/**
 * Honeypot — formadagi ko'rinmas maydon (§6).
 *
 * Bot HTML ni o'qiydi va barcha `input` larni to'ldiradi; odam esa bu
 * maydonni na ko'radi, na tab bilan unga tusha oladi. Shuning uchun test
 * uning MAVJUDLIGINI emas, aynan YASHIRINLIGINI tekshiradi: ko'rinib qolsa,
 * haqiqiy mijozlar uni to'ldirib, arizalari rad etilardi.
 */

function render(): string {
  return renderToStaticMarkup(<LeadForm t={getMessages('uz')} source="WEB" />);
}

/** Honeypot maydonining butun tegi. */
function honeypotTag(): string {
  const html = render();
  const end = html.indexOf('name="website"');
  const start = html.lastIndexOf('<input', end);
  return html.slice(start, html.indexOf('>', end) + 1);
}

describe('LeadForm — honeypot', () => {
  test('formada `website` maydoni bor', () => {
    expect(render()).toContain('name="website"');
  });

  test('maydon ekrandan tashqarida', () => {
    // `display:none` emas: ba'zi botlar ko'rinmas maydonlarni ataylab
    // o'tkazib yuboradi, ekran ortidagisini esa oddiy maydon deb biladi.
    expect(render()).toMatch(/left:\s*-9999px/);
  });

  test('tab bilan unga tushib bo‘lmaydi', () => {
    expect(render()).toContain('tabindex="-1"');
  });

  test('brauzer avtoto‘ldirishi o‘chirilgan', () => {
    // Aks holda parol menejeri maydonni to'ldirib, haqiqiy mijozning
    // arizasi spam deb rad etilardi.
    // HTML atributlari registrga sezgir emas, React esa camelCase yozadi.
    expect(honeypotTag().toLowerCase()).toContain('autocomplete="off"');
  });

  test('ekran o‘quvchisidan yashirilgan', () => {
    expect(render()).toContain('aria-hidden="true"');
  });

  test('majburiy maydon emas', () => {
    // `required` bo'lsa brauzer uni to'ldirishni talab qilardi — va uni
    // ko'rsata olmagani uchun forma umuman yuborilmasdi.
    expect(honeypotTag()).not.toContain('required');
  });
});

describe('LeadForm — asosiy maydonlar', () => {
  test('telefon maydoni majburiy', () => {
    expect(render()).toMatch(/name="phone"[^>]*required|required[^>]*name="phone"/);
  });

  test('ism va izoh ixtiyoriy', () => {
    const html = render();
    expect(html).toContain('name="name"');
    expect(html).toContain('name="comment"');
  });
});
