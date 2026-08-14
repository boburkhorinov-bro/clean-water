import { describe, expect, test } from 'vitest';
import { buildAlternates } from './alternates';

/**
 * §4.7: «Alohida URL lar indekslash uchun kerak... `hreflang` va kanonik
 * havolalar qo'yiladi.»
 *
 * Noto'g'ri kanonik havola ikkala tilni bir-birining dublikati sifatida
 * ko'rsatadi va qidiruvda bittasini yo'qotadi.
 */
describe('buildAlternates', () => {
  const base = 'https://cleanwater.uz';

  test('kanonik havola so‘ralgan tilniki bo‘ladi', () => {
    const result = buildAlternates('/mahsulot/osmos-5', 'ru', base);
    expect(result.canonical).toBe('https://cleanwater.uz/ru/mahsulot/osmos-5');
  });

  test('har ikkala til uchun hreflang beriladi', () => {
    const result = buildAlternates('/mahsulot/osmos-5', 'uz', base);
    expect(result.languages).toEqual({
      uz: 'https://cleanwater.uz/uz/mahsulot/osmos-5',
      ru: 'https://cleanwater.uz/ru/mahsulot/osmos-5',
    });
  });

  test('bosh sahifada til prefiksidan keyin ortiqcha slash qo‘shilmaydi', () => {
    const result = buildAlternates('/', 'uz', base);
    expect(result.canonical).toBe('https://cleanwater.uz/uz');
    expect(result.languages.ru).toBe('https://cleanwater.uz/ru');
  });

  test('bazaviy manzildagi ortiqcha slash ikkilanmaydi', () => {
    const result = buildAlternates('/katalog', 'uz', 'https://cleanwater.uz/');
    expect(result.canonical).toBe('https://cleanwater.uz/uz/katalog');
  });

  test('yo‘l boshida slash bo‘lmasa ham to‘g‘ri yig‘iladi', () => {
    const result = buildAlternates('katalog', 'uz', base);
    expect(result.canonical).toBe('https://cleanwater.uz/uz/katalog');
  });

  test('yo‘lda til prefiksi allaqachon bo‘lsa, u ikki marta qo‘shilmaydi', () => {
    const result = buildAlternates('/uz/katalog', 'ru', base);
    expect(result.canonical).toBe('https://cleanwater.uz/ru/katalog');
  });
});
