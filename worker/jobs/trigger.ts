import type { ReminderSweepResult } from '@/server/services/reminder-sweep';

/**
 * Eslatmalar o'tishini TASHQARIDAN ishga tushirish (§4.6).
 *
 * Jarayon ichidagi kunlik rejalashtiruvchi bitta narsani nazarda tutadi:
 * jarayon uzluksiz ishlab turadi. Bepul hostingda bu shart bajarilmaydi —
 * xizmat bekorchilikdan keyin uxlaydi va uxlab yotgan konteynerda hech
 * qanday taymer ishlamaydi. Nosozlik jimgina: log ham, xato ham yo'q,
 * shunchaki o'sha kungi eslatmalar hech kimga ketmaydi.
 *
 * Yechim — tashqi cron xizmati (masalan cron-job.org) shu manzilga so'rov
 * yuboradi: so'rov konteynerni uyg'otadi va o'tishni boshlaydi.
 *
 * Rejalashtiruvchi OLIB TASHLANMAYDI. Ikkalasi ham ishlaydi va bu xavfsiz:
 * eslatmalar idempotentligi kodda emas, bazada — `notifications` dagi
 * `(installed_part_id, kind)` unikal indeksi. Ikkinchi o'tish yangi xabar
 * yubormaydi, shunchaki `skipped` beradi. Zaxira sifatida turgani afzal:
 * tashqi xizmat ham to'xtab qolishi mumkin.
 *
 * Bu fayl — sof qaror qatlami, xuddi `bot/webhook.ts` kabi: HTTP ham,
 * Telegram ham bu yerda yo'q, ular `worker/index.ts` da ulanadi.
 */

export interface ReminderTriggerRequest {
  /** `Authorization` sarlavhasi. */
  authorization: string | undefined;
}

export interface ReminderTriggerDeps {
  secret: string | undefined;
  runSweep: () => Promise<ReminderSweepResult>;
}

export interface ReminderTriggerResponse {
  status: number;
  body: Record<string, unknown>;
}

const BEARER_PREFIX = 'Bearer ';

function tokenOf(authorization: string | undefined): string | undefined {
  if (authorization === undefined) return undefined;
  // Ba'zi cron xizmatlari sarlavhani o'zgartirmasdan uzatadi va foydalanuvchi
  // u yerga faqat qiymatni yozib qo'yishi mumkin. Ikkala shaklni ham qabul
  // qilamiz — sir baribir to'liq solishtiriladi.
  return authorization.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length)
    : authorization;
}

export async function handleReminderTrigger(
  request: ReminderTriggerRequest,
  deps: ReminderTriggerDeps,
): Promise<ReminderTriggerResponse> {
  // §6: webhook bilan bir xil qoida — sir sozlanmagan bo'lsa manzil butunlay
  // yopiq. Ochiq qoldirish istalgan odamga mijozlarga eslatma yog'dirish
  // imkonini berardi.
  if (!deps.secret || tokenOf(request.authorization) !== deps.secret) {
    return { status: 401, body: { error: 'unauthorized' } };
  }

  try {
    const result = await deps.runSweep();
    return { status: 200, body: { ...result } };
  } catch (error) {
    // 500 SHART: cron xizmati javob kodiga qarab tarixida «muvaffaqiyatsiz»
    // deb belgilaydi va ogohlantiradi. 200 bilan yutib yuborilgan xato
    // eslatmalar bir necha kun ketmayotganini yashirardi.
    console.error('[worker] eslatmalar o‘tishi yiqildi', error);
    return { status: 500, body: { error: 'sweep_failed' } };
  }
}
