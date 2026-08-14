import { describe, expect, test } from 'vitest';
import { contentBlocksSchema, parseContentBlocks } from './content-blocks';

/**
 * §4.8: «Ixtiyoriy HTML yuklash — bu XSS teshigi, injection himoyasi talabiga
 * bevosita zid... Verstka erkinligi bloklar to'plami bilan cheklanadi, buning
 * evaziga hujum yuzasi nolga teng.»
 *
 * Sxema — asosiy chegara. Sanitizatsiya CHIQARISHDA emas, SAQLASHDA bo'ladi,
 * shuning uchun bazaga tushgan hamma narsa allaqachon ishonchli bo'lishi kerak.
 */
describe('contentBlocksSchema', () => {
  test('bo‘sh massiv joiz — yangi mahsulotda tavsif bo‘lmasligi mumkin', () => {
    expect(contentBlocksSchema.safeParse([]).success).toBe(true);
  });

  test('to‘g‘ri bloklar to‘plami qabul qilinadi', () => {
    const blocks = [
      { type: 'heading', uz: 'Sarlavha', ru: 'Заголовок' },
      { type: 'paragraph', uz: 'Matn', ru: 'Текст' },
      { type: 'image', src: '/media/filtr.jpg', alt: { uz: 'Filtr', ru: 'Фильтр' } },
      { type: 'specs', rows: [{ k: { uz: 'Bosqich', ru: 'Ступень' }, v: { uz: '5', ru: '5' } }] },
      { type: 'video', provider: 'kinescope', id: 'abc123XYZ' },
    ];

    expect(contentBlocksSchema.safeParse(blocks).success).toBe(true);
  });

  test('notanish blok turi rad etiladi', () => {
    const result = contentBlocksSchema.safeParse([{ type: 'html', value: '<script>x</script>' }]);
    expect(result.success).toBe(false);
  });

  describe('rasm manzili', () => {
    test('`/media/` dan boshlanadigan yo‘l qabul qilinadi', () => {
      const r = contentBlocksSchema.safeParse([{ type: 'image', src: '/media/a.jpg', alt: {} }]);
      expect(r.success).toBe(true);
    });

    test('javascript: sxemasi rad etiladi', () => {
      const r = contentBlocksSchema.safeParse([
        { type: 'image', src: 'javascript:alert(1)', alt: {} },
      ]);
      expect(r.success).toBe(false);
    });

    test('data: sxemasi rad etiladi', () => {
      const r = contentBlocksSchema.safeParse([
        { type: 'image', src: 'data:text/html;base64,PHNjcmlwdD4=', alt: {} },
      ]);
      expect(r.success).toBe(false);
    });

    test('tashqi manzil rad etiladi — rasm faqat o‘z serverimizdan', () => {
      const r = contentBlocksSchema.safeParse([
        { type: 'image', src: 'https://evil.example/x.jpg', alt: {} },
      ]);
      expect(r.success).toBe(false);
    });

    test('papkadan chiqish (../) rad etiladi', () => {
      const r = contentBlocksSchema.safeParse([
        { type: 'image', src: '/media/../../etc/passwd', alt: {} },
      ]);
      expect(r.success).toBe(false);
    });
  });

  describe('video', () => {
    test('faqat kinescope provayderi joiz', () => {
      const r = contentBlocksSchema.safeParse([{ type: 'video', provider: 'youtube', id: 'abc' }]);
      expect(r.success).toBe(false);
    });

    test('video id da faqat harf-raqam va chiziqcha — u iframe manziliga tushadi', () => {
      const bad = contentBlocksSchema.safeParse([
        { type: 'video', provider: 'kinescope', id: 'abc"></iframe><script>' },
      ]);
      expect(bad.success).toBe(false);
    });

    test('normal id qabul qilinadi', () => {
      const ok = contentBlocksSchema.safeParse([
        { type: 'video', provider: 'kinescope', id: 'aBc-123_XY' },
      ]);
      expect(ok.success).toBe(true);
    });
  });
});

describe('parseContentBlocks', () => {
  test('bazadan kelgan to‘g‘ri jsonb o‘qiladi', () => {
    const blocks = parseContentBlocks([{ type: 'paragraph', uz: 'Matn' }]);
    expect(blocks).toHaveLength(1);
  });

  test('buzuq ma’lumot xato tashlamaydi, bo‘sh ro‘yxat qaytaradi', () => {
    // Baza eski yoki qo'lda tahrirlangan bo'lishi mumkin. Mahsulot sahifasi
    // shu sababli 500 bermasligi kerak.
    expect(parseContentBlocks([{ type: 'html', value: '<script>' }])).toEqual([]);
    expect(parseContentBlocks('umuman massiv emas')).toEqual([]);
    expect(parseContentBlocks(null)).toEqual([]);
  });
});
