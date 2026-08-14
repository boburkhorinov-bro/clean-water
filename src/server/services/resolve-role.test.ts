import { describe, expect, test } from 'vitest';
import { resolveRole } from './resolve-role';

/**
 * §4.4: «Birlamchi adminlar `TELEGRAM_ADMIN_IDS` bilan beriladi (bootstrap),
 * keyingilari admin panel orqali beriladi.»
 *
 * Bu ikki manba to'qnashadi. Sodda yechim — har kirishda env bo'yicha rolni
 * yozib yuborish — admin panel orqali berilgan adminlarni har safar
 * CLIENT ga tushirib yuboradi. Shuning uchun qoida: env faqat KO'TARADI,
 * hech qachon tushirmaydi.
 */
describe('resolveRole', () => {
  test('yangi foydalanuvchi bootstrap ro‘yxatida bo‘lsa — ADMIN', () => {
    expect(resolveRole({ telegramId: 111n, currentRole: null, adminIds: '111,222' })).toBe('ADMIN');
  });

  test('yangi foydalanuvchi ro‘yxatda bo‘lmasa — CLIENT', () => {
    expect(resolveRole({ telegramId: 333n, currentRole: null, adminIds: '111,222' })).toBe(
      'CLIENT',
    );
  });

  test('mavjud CLIENT ro‘yxatga qo‘shilsa — ADMIN ga ko‘tariladi', () => {
    expect(resolveRole({ telegramId: 111n, currentRole: 'CLIENT', adminIds: '111' })).toBe('ADMIN');
  });

  test('admin panel orqali berilgan ADMIN env da yo‘q bo‘lsa ham ADMIN bo‘lib qoladi', () => {
    // Aynan shu holat sodda implementatsiyada buziladi.
    expect(resolveRole({ telegramId: 999n, currentRole: 'ADMIN', adminIds: '111,222' })).toBe(
      'ADMIN',
    );
  });

  test('env bo‘sh bo‘lsa mavjud ADMIN tushirilmaydi', () => {
    expect(resolveRole({ telegramId: 999n, currentRole: 'ADMIN', adminIds: undefined })).toBe(
      'ADMIN',
    );
  });

  test('env bo‘sh bo‘lsa yangi foydalanuvchi ADMIN bo‘lmaydi', () => {
    expect(resolveRole({ telegramId: 111n, currentRole: null, adminIds: undefined })).toBe(
      'CLIENT',
    );
  });
});
