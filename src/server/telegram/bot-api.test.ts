import { afterEach, describe, expect, test, vi } from 'vitest';
import { buildReplaceKeyboard, sendBotMessage } from './bot-api';
import { TelegramRateLimitError } from './notify-manager';

/**
 * §4.6, 3-qadam: eslatma xabarida «Almashtirishga buyurtma» tugmasi bo'ladi
 * va u `worker` dagi webhook ga `callback_data` yuboradi.
 */
describe('buildReplaceKeyboard', () => {
  test('tugma bosilganda kartrij identifikatori qaytadi', () => {
    const keyboard = buildReplaceKeyboard('part-42', 'UZ');

    expect(keyboard.inline_keyboard[0]?.[0]?.callback_data).toBe('replace:part-42');
  });

  test('o‘zbekcha tugma matni', () => {
    expect(buildReplaceKeyboard('p', 'UZ').inline_keyboard[0]?.[0]?.text).toContain('buyurtma');
  });

  test('ruscha tugma matni', () => {
    expect(buildReplaceKeyboard('p', 'RU').inline_keyboard[0]?.[0]?.text).toContain('Заказать');
  });
});

describe('sendBotMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stubFetch(response: Partial<Response> & { status: number }) {
    const fetchMock = vi.fn(async () => response as Response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  test('xabar Telegram ga HTML rejimida ketadi', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token-123');
    const fetchMock = stubFetch({ status: 200, ok: true });

    await sendBotMessage({ chatId: 555n, text: 'salom' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/bottoken-123/sendMessage');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.chat_id).toBe('555');
    expect(body.text).toBe('salom');
    expect(body.parse_mode).toBe('HTML');
  });

  test('CHAT ID SATR sifatida ketadi — `bigint` JSON ga sig‘maydi', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token-123');
    const fetchMock = stubFetch({ status: 200, ok: true });

    await sendBotMessage({ chatId: 9007199254740995n, text: 'salom' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).chat_id).toBe('9007199254740995');
  });

  test('429 da `retry_after` bilan xato tashlanadi — o‘tish uni hurmat qiladi', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token-123');
    stubFetch({
      status: 429,
      ok: false,
      json: async () => ({ parameters: { retry_after: 42 } }),
    } as Partial<Response> & { status: number });

    await expect(sendBotMessage({ chatId: 555n, text: 'salom' })).rejects.toThrow(
      TelegramRateLimitError,
    );
  });

  test('boshqa xatoda ham yiqiladi — o‘tish buni FAILED deb yozadi', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token-123');
    stubFetch({ status: 500, ok: false });

    await expect(sendBotMessage({ chatId: 555n, text: 'salom' })).rejects.toThrow();
  });

  test('token sozlanmagan bo‘lsa aniq xato beradi', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');

    await expect(sendBotMessage({ chatId: 555n, text: 'salom' })).rejects.toThrow(
      /TELEGRAM_BOT_TOKEN/,
    );
  });
});
