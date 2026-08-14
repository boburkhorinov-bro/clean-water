import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import type { ContentBlock } from '@/lib/content-blocks';
import { ContentBlocks } from './ContentBlocks';

/**
 * §4.8: «Renderer `type` ni React komponenti bilan solishtiradi.
 * `dangerouslySetInnerHTML` hech qayerda ishlatilmaydi.»
 *
 * Eng muhim test — matn ichidagi HTML belgilari MARKUP ga aylanmasligi.
 * Agar aylanib qolsa, TZ ning butun §4.8 yechimi ma'nosini yo'qotadi.
 */
function render(blocks: ContentBlock[], locale: 'uz' | 'ru' = 'uz'): string {
  return renderToStaticMarkup(<ContentBlocks blocks={blocks} locale={locale} />);
}

describe('ContentBlocks', () => {
  test('sarlavha va matn chiqariladi', () => {
    const html = render([
      { type: 'heading', uz: 'Sarlavha', ru: 'Заголовок' },
      { type: 'paragraph', uz: 'Matn', ru: 'Текст' },
    ]);

    expect(html).toContain('Sarlavha');
    expect(html).toContain('Matn');
  });

  test('so‘ralgan til tanlanadi', () => {
    const html = render([{ type: 'heading', uz: 'Sarlavha', ru: 'Заголовок' }], 'ru');

    expect(html).toContain('Заголовок');
    expect(html).not.toContain('Sarlavha');
  });

  test('tarjima yo‘q bo‘lsa o‘zbekchaga tushadi (§4.7)', () => {
    const html = render([{ type: 'heading', uz: 'Faqat o‘zbekcha' }], 'ru');

    expect(html).toContain('Faqat o‘zbekcha');
  });

  test('XSS: matndagi HTML belgilari ekranlanadi, markupga aylanmaydi', () => {
    const html = render([
      { type: 'paragraph', uz: '<script>alert(1)</script>' },
      { type: 'heading', uz: '<img src=x onerror=alert(1)>' },
    ]);

    // Muhim xossa: HAQIQIY teg hosil bo'lmasligi. `onerror=` satri ekranlangan
    // matn ichida uchrashi mumkin va bu zararsiz — brauzer uni atribut sifatida
    // o'qimaydi, chunki `<` allaqachon `&lt;` ga aylangan.
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  test('XSS: rasm alt matni ham ekranlanadi', () => {
    const html = render([
      { type: 'image', src: '/media/a.jpg', alt: { uz: '"><script>alert(1)</script>' } },
    ]);

    expect(html).not.toContain('<script>');
  });

  test('rasm src va alt bilan chiqadi', () => {
    const html = render([{ type: 'image', src: '/media/filtr.jpg', alt: { uz: 'Filtr' } }]);

    expect(html).toContain('src="/media/filtr.jpg"');
    expect(html).toContain('alt="Filtr"');
  });

  test('xarakteristikalar jadvali qatorlari chiqadi', () => {
    const html = render([
      {
        type: 'specs',
        rows: [
          { k: { uz: 'Bosqichlar' }, v: { uz: '5' } },
          { k: { uz: 'Ishlab chiqaruvchi' }, v: { uz: 'Demo' } },
        ],
      },
    ]);

    expect(html).toContain('Bosqichlar');
    expect(html).toContain('Ishlab chiqaruvchi');
    expect(html).toContain('Demo');
  });

  test('video kinescope iframe i sifatida chiqadi', () => {
    const html = render([{ type: 'video', provider: 'kinescope', id: 'abc123' }]);

    expect(html).toContain('<iframe');
    expect(html).toContain('kinescope.io/embed/abc123');
  });

  test('bo‘sh ro‘yxatda hech narsa chiqmaydi va xato bo‘lmaydi', () => {
    expect(render([])).toBe('');
  });

  test('matni bo‘sh blok chiqarilmaydi — bo‘sh sarlavha buzuqlikka o‘xshaydi', () => {
    const html = render([
      { type: 'heading', uz: '' },
      { type: 'paragraph', uz: '   ' },
    ]);

    expect(html).toBe('');
  });
});
