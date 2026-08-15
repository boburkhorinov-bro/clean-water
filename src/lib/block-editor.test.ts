import { describe, expect, test } from 'vitest';
import { addBlock, emptyBlock, moveBlock, removeBlock, updateBlock } from './block-editor';
import { contentBlocksSchema } from './content-blocks';

/**
 * Kontent-bloklar muharririning sof mantiqi (§4.8).
 *
 * Muharrir ixtiyoriy HTML qabul qilmaydi — u faqat tiplashtirilgan bloklarni
 * YASAYDI. Shuning uchun eng muhim tekshiruv: muharrir yaratgan har qanday
 * holat saqlash sxemasidan o'tishi kerak. O'tmasa, admin formani to'ldirib,
 * saqlashda tushunarsiz xatoga urilardi.
 *
 * Barcha amallar yangi massiv qaytaradi: React holati o'rnida o'zgartirilsa
 * qayta render bo'lmaydi.
 */
describe('emptyBlock', () => {
  test('har bir tur uchun bo‘sh blok yasaladi', () => {
    for (const type of ['heading', 'paragraph', 'image', 'specs', 'video'] as const) {
      expect(emptyBlock(type).type, type).toBe(type);
    }
  });

  test('BO‘SH RASM BLOKI saqlash sxemasidan o‘tadi — `/media/` shart', () => {
    const block = emptyBlock('image');

    expect(contentBlocksSchema.safeParse([block]).success).toBe(true);
  });

  test('bo‘sh video bloki saqlash sxemasidan o‘tadi', () => {
    expect(contentBlocksSchema.safeParse([emptyBlock('video')]).success).toBe(true);
  });

  test('bo‘sh specs bloki bitta qator bilan boshlanadi', () => {
    const block = emptyBlock('specs');

    expect(block.type === 'specs' && block.rows).toHaveLength(1);
  });
});

describe('addBlock', () => {
  test('blok oxiriga qo‘shiladi', () => {
    const blocks = addBlock([emptyBlock('heading')], 'paragraph');

    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph']);
  });

  test('ASL MASSIV o‘zgarmaydi — React holati o‘rnida o‘zgartirilmaydi', () => {
    const original = [emptyBlock('heading')];

    addBlock(original, 'paragraph');

    expect(original).toHaveLength(1);
  });
});

describe('removeBlock', () => {
  test('ko‘rsatilgan blok o‘chiriladi', () => {
    const blocks = [emptyBlock('heading'), emptyBlock('paragraph'), emptyBlock('video')];

    expect(removeBlock(blocks, 1).map((b) => b.type)).toEqual(['heading', 'video']);
  });

  test('chegaradan tashqari indeks hech narsani buzmaydi', () => {
    const blocks = [emptyBlock('heading')];

    expect(removeBlock(blocks, 5)).toHaveLength(1);
    expect(removeBlock(blocks, -1)).toHaveLength(1);
  });
});

describe('moveBlock', () => {
  const blocks = [emptyBlock('heading'), emptyBlock('paragraph'), emptyBlock('video')];

  test('yuqoriga ko‘tariladi', () => {
    expect(moveBlock(blocks, 1, 'up').map((b) => b.type)).toEqual([
      'paragraph',
      'heading',
      'video',
    ]);
  });

  test('pastga tushiriladi', () => {
    expect(moveBlock(blocks, 1, 'down').map((b) => b.type)).toEqual([
      'heading',
      'video',
      'paragraph',
    ]);
  });

  test('birinchi blokni yuqoriga ko‘tarib bo‘lmaydi', () => {
    expect(moveBlock(blocks, 0, 'up').map((b) => b.type)).toEqual(blocks.map((b) => b.type));
  });

  test('oxirgi blokni pastga tushirib bo‘lmaydi', () => {
    expect(moveBlock(blocks, 2, 'down').map((b) => b.type)).toEqual(blocks.map((b) => b.type));
  });
});

describe('updateBlock', () => {
  test('faqat ko‘rsatilgan blok o‘zgaradi', () => {
    const blocks = [emptyBlock('heading'), emptyBlock('heading')];

    const updated = updateBlock(blocks, 0, { uz: 'Sarlavha' });

    expect(updated[0]).toMatchObject({ uz: 'Sarlavha' });
    expect(updated[1]).toMatchObject({ uz: '' });
  });

  test('boshqa maydonlar saqlanadi', () => {
    const blocks = [{ type: 'heading' as const, uz: 'Uz', ru: 'Ru' }];

    const updated = updateBlock(blocks, 0, { uz: 'Yangi' });

    expect(updated[0]).toEqual({ type: 'heading', uz: 'Yangi', ru: 'Ru' });
  });

  test('BLOK TURINI o‘zgartirib bo‘lmaydi — bu boshqa blok bo‘lardi', () => {
    const blocks = [emptyBlock('heading')];

    const updated = updateBlock(blocks, 0, { type: 'video' } as never);

    expect(updated[0]?.type).toBe('heading');
  });

  test('chegaradan tashqari indeks hech narsani buzmaydi', () => {
    const blocks = [emptyBlock('heading')];

    expect(updateBlock(blocks, 5, { uz: 'x' })).toEqual(blocks);
  });
});
