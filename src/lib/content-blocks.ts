import { z } from 'zod';

/**
 * Mahsulot tavsifi — tiplashtirilgan bloklar (§4.8).
 *
 * TZ dagi «HTML formatida yuklanadigan taqdimot» talabi shu bilan almashtirilgan:
 * ixtiyoriy HTML qabul qilinmaydi, chunki u to'g'ridan-to'g'ri XSS teshigi.
 * Verstka erkinligi bloklar to'plami bilan cheklanadi, hujum yuzasi esa nolga
 * teng bo'ladi.
 *
 * MUHIM: tekshiruv SAQLASHDA bo'ladi, chiqarishda emas. Bazadagi hamma narsa
 * allaqachon ishonchli bo'lishi kerak.
 */

const localizedText = z.object({
  uz: z.string().optional(),
  ru: z.string().optional(),
});

/**
 * Rasm faqat o'z serverimizdagi `/media/` dan. Tashqi manzil, `javascript:`,
 * `data:` va papkadan chiqish (`..`) rad etiladi.
 */
const mediaPath = z
  .string()
  .regex(/^\/media\/[\w./-]+$/, 'Rasm faqat /media/ ichidan bo‘lishi mumkin')
  .refine((value) => !value.includes('..'), 'Papkadan chiqish taqiqlanadi');

const headingBlock = z.object({
  type: z.literal('heading'),
  uz: z.string().optional(),
  ru: z.string().optional(),
});

const paragraphBlock = z.object({
  type: z.literal('paragraph'),
  uz: z.string().optional(),
  ru: z.string().optional(),
});

const imageBlock = z.object({
  type: z.literal('image'),
  src: mediaPath,
  alt: localizedText,
});

const specsBlock = z.object({
  type: z.literal('specs'),
  rows: z.array(z.object({ k: localizedText, v: localizedText })),
});

const videoBlock = z.object({
  type: z.literal('video'),
  // Oq ro'yxat: §4.1 da tashqi servis sifatida faqat Kinescope bor.
  provider: z.literal('kinescope'),
  // Bu qiymat iframe manziliga tushadi, shuning uchun qat'iy cheklanadi.
  id: z.string().regex(/^[\w-]+$/, 'Video id da faqat harf, raqam, `-` va `_`'),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  headingBlock,
  paragraphBlock,
  imageBlock,
  specsBlock,
  videoBlock,
]);

export const contentBlocksSchema = z.array(contentBlockSchema);

export type ContentBlock = z.infer<typeof contentBlockSchema>;

/**
 * Bazadan kelgan `jsonb` ni o'qiydi.
 *
 * Buzuq ma'lumotda xato tashlamaydi: baza eski yoki qo'lda tahrirlangan
 * bo'lishi mumkin, mahsulot sahifasi esa shu sababli 500 bermasligi kerak.
 */
export function parseContentBlocks(value: unknown): ContentBlock[] {
  const parsed = contentBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
