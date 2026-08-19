import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/**
 * `setWebhook` dagi `allowed_updates` webhook kodiga mos keladimi (§4.5, §4.6).
 *
 * Telegram `allowed_updates` da sanalmagan turlarni UMUMAN yubormaydi.
 * Ro'yxatda faqat `callback_query` qolsa, `message.contact` hech qachon
 * kelmaydi va telefonsiz mijozdan raqam olish oqimi butunlay o'lik bo'ladi —
 * kod joyida, testlar yashil, log da bitta ham xato yo'q. Buni faqat
 * haqiqiy mijoz tugmani bosib, javob kelmaganda bilib olardik.
 *
 * Ro'yxat uchta faylda takrorlanadi (buyruq hujjatda, skriptda va namunada),
 * shuning uchun tekshiruv ham uchalasi bo'yicha.
 */

const REQUIRED = ['callback_query', 'message'];

const FILES = ['scripts/deploy.sh', 'docs/DEPLOY.md', 'env.example'];

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8');
}

describe('setWebhook: allowed_updates', () => {
  test.each(FILES)('%s da kerakli update turlari sanalgan', (file) => {
    const source = read(file);
    const match = /allowed_updates=(\[[^\]]*\])/.exec(source);

    expect(match, `${file} da allowed_updates topilmadi`).not.toBeNull();

    const listed = JSON.parse(match![1]!) as string[];
    for (const kind of REQUIRED) {
      expect(listed, `${file}: ${kind} yo‘q`).toContain(kind);
    }
  });
});
