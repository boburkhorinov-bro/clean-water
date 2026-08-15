import type { ContentBlock } from './content-blocks';

/**
 * Kontent-bloklar muharririning sof mantiqi (§4.8).
 *
 * Muharrir ixtiyoriy HTML qabul qilmaydi — u faqat tiplashtirilgan bloklarni
 * yasaydi. Shu sababli bu yerdagi har bir «bo'sh» blok saqlash sxemasidan
 * (`contentBlocksSchema`) o'tishi shart: aks holda admin formani to'ldirib
 * bo'lib, saqlashda tushunarsiz xatoga urilardi.
 *
 * Barcha amallar YANGI massiv qaytaradi: React holati o'rnida o'zgartirilsa
 * qayta render bo'lmaydi.
 */

export type BlockType = ContentBlock['type'];

/** Rasm bloki bo'sh bo'lsa ham `/media/` cheklovidan o'tishi kerak. */
const PLACEHOLDER_IMAGE = '/media/placeholder.jpg';
/** Video id harf-raqamli bo'lishi shart — bo'sh satr sxemadan o'tmaydi. */
const PLACEHOLDER_VIDEO_ID = 'id';

export function emptyBlock(type: BlockType): ContentBlock {
  switch (type) {
    case 'heading':
      return { type: 'heading', uz: '', ru: '' };
    case 'paragraph':
      return { type: 'paragraph', uz: '', ru: '' };
    case 'image':
      return { type: 'image', src: PLACEHOLDER_IMAGE, alt: { uz: '', ru: '' } };
    case 'specs':
      return { type: 'specs', rows: [{ k: { uz: '', ru: '' }, v: { uz: '', ru: '' } }] };
    case 'video':
      return { type: 'video', provider: 'kinescope', id: PLACEHOLDER_VIDEO_ID };
  }
}

export function addBlock(blocks: ContentBlock[], type: BlockType): ContentBlock[] {
  return [...blocks, emptyBlock(type)];
}

export function removeBlock(blocks: ContentBlock[], index: number): ContentBlock[] {
  if (index < 0 || index >= blocks.length) return [...blocks];
  return blocks.filter((_, position) => position !== index);
}

export function moveBlock(
  blocks: ContentBlock[],
  index: number,
  direction: 'up' | 'down',
): ContentBlock[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= blocks.length || target < 0 || target >= blocks.length) {
    return [...blocks];
  }

  const next = [...blocks];
  const moved = next[index];
  const displaced = next[target];
  if (!moved || !displaced) return next;

  next[index] = displaced;
  next[target] = moved;
  return next;
}

/**
 * Blokning maydonlarini yangilaydi.
 *
 * `type` ataylab qayta yoziladi: turni o'zgartirish boshqa blok yasash
 * demak va u yarim to'ldirilgan, sxemadan o'tmaydigan obyekt berardi.
 */
export function updateBlock(
  blocks: ContentBlock[],
  index: number,
  patch: Partial<ContentBlock>,
): ContentBlock[] {
  if (index < 0 || index >= blocks.length) return [...blocks];

  return blocks.map((block, position) =>
    position === index ? ({ ...block, ...patch, type: block.type } as ContentBlock) : block,
  );
}
