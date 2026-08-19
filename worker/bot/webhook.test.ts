import { describe, expect, test, vi } from 'vitest';
import { handleTelegramUpdate, type WebhookDeps } from './webhook';

/**
 * §4.6: bot `worker` konteynerida webhook orqali ishlaydi, «Almashtirishga
 * buyurtma» tugmasi darhol ariza yaratadi.
 *
 * Xavfsizlik (§6): Telegram webhook manzili ochiq internetda turadi. Yagona
 * himoya — `X-Telegram-Bot-Api-Secret-Token`. Usiz istalgan odam soxta
 * `callback_query` yuborib, boshqa mijozlar nomidan ariza yaratardi.
 */
describe('handleTelegramUpdate', () => {
  function deps(overrides: Partial<WebhookDeps> = {}): WebhookDeps {
    return {
      secret: 'sir',
      requestReplacement: vi.fn(async () => ({ status: 'CREATED' as const })),
      answerCallback: vi.fn(async () => {}),
      savePhone: vi.fn(async () => ({ status: 'SAVED' as const })),
      sendMessage: vi.fn(async () => {}),
      ...overrides,
    };
  }

  function contactUpdate(
    contact: { phone_number: string; user_id?: number; first_name?: string },
    fromId = 555000111,
    languageCode = 'uz',
  ) {
    return {
      update_id: 2,
      message: {
        message_id: 10,
        chat: { id: fromId },
        from: { id: fromId, language_code: languageCode },
        contact,
      },
    };
  }

  function callbackUpdate(data: string, fromId = 555000111) {
    return {
      update_id: 1,
      callback_query: {
        id: 'cbq-1',
        from: { id: fromId, language_code: 'uz' },
        data,
      },
    };
  }

  test('maxfiy token mos kelmasa rad etiladi', async () => {
    const d = deps();

    const response = await handleTelegramUpdate(
      { secretToken: 'boshqa', body: callbackUpdate('replace:part-1') },
      d,
    );

    expect(response.status).toBe(401);
    expect(d.requestReplacement).not.toHaveBeenCalled();
  });

  test('maxfiy token umuman kelmasa rad etiladi', async () => {
    const d = deps();

    const response = await handleTelegramUpdate(
      { secretToken: undefined, body: callbackUpdate('replace:part-1') },
      d,
    );

    expect(response.status).toBe(401);
    expect(d.requestReplacement).not.toHaveBeenCalled();
  });

  test('SERVERDA SIR SOZLANMAGAN BO‘LSA hamma so‘rov rad etiladi', async () => {
    // Ochiq qoldirishdan ko'ra ishlamagani afzal: sirsiz webhook — bu
    // istalgan odam uchun ochiq ariza generatori.
    const d = deps({ secret: undefined });

    const response = await handleTelegramUpdate(
      { secretToken: 'sir', body: callbackUpdate('replace:part-1') },
      d,
    );

    expect(response.status).toBe(401);
    expect(d.requestReplacement).not.toHaveBeenCalled();
  });

  test('«Almashtirishga buyurtma» tugmasi arizani yaratadi', async () => {
    const d = deps();

    const response = await handleTelegramUpdate(
      { secretToken: 'sir', body: callbackUpdate('replace:part-42', 777000222) },
      d,
    );

    expect(response.status).toBe(200);
    expect(d.requestReplacement).toHaveBeenCalledWith({
      installedPartId: 'part-42',
      telegramId: 777000222n,
    });
  });

  test('foydalanuvchiga tasdiq ko‘rsatiladi', async () => {
    const d = deps();

    await handleTelegramUpdate({ secretToken: 'sir', body: callbackUpdate('replace:part-42') }, d);

    expect(d.answerCallback).toHaveBeenCalledWith(
      expect.objectContaining({ callbackQueryId: 'cbq-1' }),
    );
    const call = vi.mocked(d.answerCallback).mock.calls[0]?.[0];
    expect(call?.text).toContain('qabul qilindi');
  });

  test('takroriy bosishda boshqa javob beriladi', async () => {
    const d = deps({
      requestReplacement: vi.fn(async () => ({ status: 'ALREADY_REQUESTED' as const })),
    });

    await handleTelegramUpdate({ secretToken: 'sir', body: callbackUpdate('replace:p') }, d);

    const call = vi.mocked(d.answerCallback).mock.calls[0]?.[0];
    expect(call?.text).toContain('allaqachon');
  });

  test('telefonsiz mijozdan raqam so‘raladi', async () => {
    const d = deps({
      requestReplacement: vi.fn(async () => ({ status: 'PHONE_REQUIRED' as const })),
    });

    await handleTelegramUpdate({ secretToken: 'sir', body: callbackUpdate('replace:p') }, d);

    const call = vi.mocked(d.answerCallback).mock.calls[0]?.[0];
    expect(call?.text).toContain('telefon');
  });

  test('begona kartrij uchun neytral javob — boshqa mijoz haqida ma‘lumot bermaydi', async () => {
    const d = deps({
      requestReplacement: vi.fn(async () => ({ status: 'NOT_FOUND' as const })),
    });

    await handleTelegramUpdate({ secretToken: 'sir', body: callbackUpdate('replace:p') }, d);

    const call = vi.mocked(d.answerCallback).mock.calls[0]?.[0];
    expect(call?.text).toContain('topilmadi');
    expect(call?.text).not.toContain('boshqa');
  });

  test('ruscha foydalanuvchi ruscha javob oladi', async () => {
    const d = deps();
    const update = {
      update_id: 1,
      callback_query: {
        id: 'cbq-1',
        from: { id: 555000111, language_code: 'ru' },
        data: 'replace:p',
      },
    };

    await handleTelegramUpdate({ secretToken: 'sir', body: update }, d);

    const call = vi.mocked(d.answerCallback).mock.calls[0]?.[0];
    expect(call?.text).toContain('принята');
  });

  test('notanish tugma e‘tiborsiz qoldiriladi', async () => {
    const d = deps();

    const response = await handleTelegramUpdate(
      { secretToken: 'sir', body: callbackUpdate('boshqa:narsa') },
      d,
    );

    expect(response.status).toBe(200);
    expect(d.requestReplacement).not.toHaveBeenCalled();
  });

  test('oddiy xabar (tugma emas) e‘tiborsiz qoldiriladi', async () => {
    const d = deps();

    const response = await handleTelegramUpdate(
      { secretToken: 'sir', body: { update_id: 2, message: { text: 'salom' } } },
      d,
    );

    expect(response.status).toBe(200);
    expect(d.requestReplacement).not.toHaveBeenCalled();
  });

  test('buzuq so‘rov 200 bilan yopiladi — Telegram uni cheksiz qayta yubormasin', async () => {
    const d = deps();

    const response = await handleTelegramUpdate({ secretToken: 'sir', body: 'salom' }, d);

    expect(response.status).toBe(200);
    expect(d.requestReplacement).not.toHaveBeenCalled();
  });

  test('bo‘sh `installed_part_id` bilan urinish e‘tiborsiz qoldiriladi', async () => {
    const d = deps();

    await handleTelegramUpdate({ secretToken: 'sir', body: callbackUpdate('replace:') }, d);

    expect(d.requestReplacement).not.toHaveBeenCalled();
  });

  test('JAVOB BERISH yiqilsa ham 200 qaytadi — ariza allaqachon yaratilgan', async () => {
    // Telegram 200 dan boshqa javobda updateni qayta yuboradi. Qayta yuborilsa
    // ikkinchi ariza chiqmaydi (takroriy bosish himoyasi bor), lekin menejer
    // logi behuda shovqinga to'ladi va tugma foydalanuvchida osilib qoladi.
    const d = deps({
      answerCallback: vi.fn(async () => {
        throw new Error('Telegram javob bermadi');
      }),
    });

    const response = await handleTelegramUpdate(
      { secretToken: 'sir', body: callbackUpdate('replace:p') },
      d,
    );

    expect(response.status).toBe(200);
    expect(d.requestReplacement).toHaveBeenCalled();
  });

  test('SERVIS YIQILSA ham 200 qaytadi va foydalanuvchi xabardor bo‘ladi', async () => {
    const d = deps({
      requestReplacement: vi.fn(async () => {
        throw new Error('baza yiqildi');
      }),
    });

    const response = await handleTelegramUpdate(
      { secretToken: 'sir', body: callbackUpdate('replace:p') },
      d,
    );

    expect(response.status).toBe(200);
    const call = vi.mocked(d.answerCallback).mock.calls[0]?.[0];
    expect(call?.text).toBeTruthy();
  });
  /**
   * §4.5: telefonsiz mijoz tuzog'i.
   *
   * Telegram avtorizatsiyasi telefon bermaydi. Ilovaga birinchi kirgan mijoz
   * `phone` siz qoladi va tugmani bosganda `PHONE_REQUIRED` oladi. Avval bot
   * «raqamni ilovada qoldiring» derdi, lekin Mini App da bunday forma yo'q
   * edi: mijoz boshi berk ko'chada qolardi va menejer urinish bo'lganini
   * bilmasdi ham (na ariza, na xabarnoma).
   */
  describe('telefonsiz mijoz', () => {
    test('PHONE_REQUIRED da raqam so‘rovchi tugma yuboriladi', async () => {
      const d = deps({
        requestReplacement: vi.fn(async () => ({ status: 'PHONE_REQUIRED' as const })),
      });

      const response = await handleTelegramUpdate(
        { secretToken: 'sir', body: callbackUpdate('replace:p') },
        d,
      );

      expect(response.status).toBe(200);
      const sent = vi.mocked(d.sendMessage).mock.calls[0]?.[0];
      expect(sent?.requestContact).toBe(true);
      expect(sent?.chatId).toBe(555000111n);
    });

    test('boshqa natijalarda qo‘shimcha xabar yuborilmaydi', async () => {
      const d = deps();

      await handleTelegramUpdate({ secretToken: 'sir', body: callbackUpdate('replace:p') }, d);

      expect(d.sendMessage).not.toHaveBeenCalled();
    });

    test('tugma yuborilmasa ham 200 qaytadi', async () => {
      // Qalqib chiquvchi javob (`answerCallback`) mijozga baribir yetib boradi.
      const d = deps({
        requestReplacement: vi.fn(async () => ({ status: 'PHONE_REQUIRED' as const })),
        sendMessage: vi.fn(async () => {
          throw new Error('Telegram javob bermadi');
        }),
      });

      const response = await handleTelegramUpdate(
        { secretToken: 'sir', body: callbackUpdate('replace:p') },
        d,
      );

      expect(response.status).toBe(200);
    });
  });

  describe('kontakt ulashilganda', () => {
    test('raqam saqlanadi va mijozga tasdiq boradi', async () => {
      const d = deps();

      const response = await handleTelegramUpdate(
        {
          secretToken: 'sir',
          body: contactUpdate({ phone_number: '998901234567', user_id: 555000111, first_name: 'Aziz' }),
        },
        d,
      );

      expect(response.status).toBe(200);
      expect(d.savePhone).toHaveBeenCalledWith({
        telegramId: 555000111n,
        phone: '998901234567',
        name: 'Aziz',
      });
      expect(vi.mocked(d.sendMessage).mock.calls[0]?.[0]?.text).toBeTruthy();
    });

    /**
     * Telegram da manzillar kitobidan BEGONA odamning kontaktini ham
     * ulashish mumkin. Tekshirilmasa, istalgan odam boshqa mijozning
     * raqamini yuborib, uning CRM dagi yozuviga — o'rnatishlari va
     * eslatmalari bilan birga — ulanib olardi.
     */
    test('BEGONA kontakt rad etiladi', async () => {
      const d = deps();

      const response = await handleTelegramUpdate(
        {
          secretToken: 'sir',
          body: contactUpdate({ phone_number: '998901234567', user_id: 999000111 }),
        },
        d,
      );

      expect(response.status).toBe(200);
      expect(d.savePhone).not.toHaveBeenCalled();
      expect(vi.mocked(d.sendMessage).mock.calls[0]?.[0]?.text).toBeTruthy();
    });

    test('`user_id` siz kontakt ham rad etiladi — egasini tekshirib bo‘lmaydi', async () => {
      // Manzillar kitobidagi Telegram da yo'q kontakt shunday keladi.
      const d = deps();

      await handleTelegramUpdate(
        { secretToken: 'sir', body: contactUpdate({ phone_number: '998901234567' }) },
        d,
      );

      expect(d.savePhone).not.toHaveBeenCalled();
    });

    test('yaroqsiz raqamda tushunarli javob beriladi', async () => {
      const d = deps({ savePhone: vi.fn(async () => ({ status: 'INVALID_PHONE' as const })) });

      await handleTelegramUpdate(
        {
          secretToken: 'sir',
          body: contactUpdate({ phone_number: '123', user_id: 555000111 }),
        },
        d,
      );

      expect(vi.mocked(d.sendMessage).mock.calls[0]?.[0]?.text).toBeTruthy();
    });

    test('SAQLASH YIQILSA ham 200 qaytadi va mijoz xabardor bo‘ladi', async () => {
      const d = deps({
        savePhone: vi.fn(async () => {
          throw new Error('baza yiqildi');
        }),
      });

      const response = await handleTelegramUpdate(
        {
          secretToken: 'sir',
          body: contactUpdate({ phone_number: '998901234567', user_id: 555000111 }),
        },
        d,
      );

      expect(response.status).toBe(200);
      expect(vi.mocked(d.sendMessage).mock.calls[0]?.[0]?.text).toBeTruthy();
    });

    test('oddiy matnli xabar e’tiborsiz qoldiriladi', async () => {
      const d = deps();

      const response = await handleTelegramUpdate(
        {
          secretToken: 'sir',
          body: { update_id: 3, message: { message_id: 1, chat: { id: 555000111 }, text: 'salom' } },
        },
        d,
      );

      expect(response.status).toBe(200);
      expect(d.savePhone).not.toHaveBeenCalled();
      expect(d.sendMessage).not.toHaveBeenCalled();
    });

    test('ruscha mijozga ruscha javob', async () => {
      const d = deps();

      await handleTelegramUpdate(
        {
          secretToken: 'sir',
          body: contactUpdate({ phone_number: '998901234567', user_id: 555000111 }, 555000111, 'ru'),
        },
        d,
      );

      const sent = vi.mocked(d.sendMessage).mock.calls[0]?.[0];
      expect(sent?.text).toMatch(/[Ѐ-ӿ]/);
      // Klaviatura tugmasining matni ham shu tildan quriladi: xabar ruscha,
      // tugma o‘zbekcha bo‘lib qolmasligi kerak.
      expect(sent?.locale).toBe('ru');
    });
  });
});
