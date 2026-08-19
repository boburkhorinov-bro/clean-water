import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { getMessages } from '@/lib/i18n/messages';
import { PhoneForm } from './PhoneForm';

/**
 * Telefonsiz mijoz uchun forma (§4.5).
 *
 * Bu ekran tuzoqning chiqish yo'li: Telegram avtorizatsiyasi raqam bermaydi,
 * shuning uchun mijoz «Almashtirishga buyurtma» tugmasini bosganda ariza
 * yaratilmasdi va u nima qilishni bilmasdi — ilovada raqam qoldiradigan joy
 * umuman yo'q edi.
 *
 * Shuning uchun testlar ikki narsani ushlab turadi: forma NIMA UCHUN
 * kerakligini aytadimi va telefonda uni to'ldirish qulaymi.
 */

function render(locale: 'uz' | 'ru' = 'uz'): string {
  return renderToStaticMarkup(<PhoneForm t={getMessages(locale)} />);
}

describe('PhoneForm', () => {
  test('raqam nima uchun kerakligi tushuntiriladi', () => {
    // «Telefon raqami» degan quruq sarlavha savol qoldiradi: mijoz raqamini
    // nima uchun berayotganini bilishi kerak.
    expect(render()).toContain(getMessages('uz').phoneNeededLead);
  });

  test('telefonda raqamli klaviatura ochiladi', () => {
    // `type="text"` bo'lsa mijozga harflar klaviaturasi chiqadi va raqam
    // kiritish noqulay bo'lardi — bu Mini App, ya'ni deyarli har doim telefon.
    const html = render();
    expect(html).toContain('type="tel"');
    expect(html.toLowerCase()).toContain('inputmode="tel"');
  });

  test('brauzer saqlagan raqamni taklif qiladi', () => {
    expect(render().toLowerCase()).toContain('autocomplete="tel"');
  });

  test('kutilayotgan ko‘rinish namuna sifatida ko‘rsatiladi', () => {
    expect(render()).toContain('+998');
  });

  test('ruscha mijozga ruscha forma', () => {
    expect(render('ru')).toContain(getMessages('ru').phoneSave);
  });
});
