/**
 * Kunlik rejalashtiruvchi (§4.6).
 *
 * Cron o'rniga oddiy `setTimeout`: konteynerda bitta jarayon, bitta vazifa.
 * Har ishga tushishdan keyin keyingisi qaytadan hisoblanadi — `setInterval`
 * bo'lganda drift to'planardi.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** O'zbekiston — UTC+5, yozgi vaqt yo'q. */
const TASHKENT_OFFSET_MS = 5 * HOUR_MS;

/**
 * Belgilangan Toshkent soatigacha necha millisekund qolgani.
 *
 * Hisob konteynerning `TZ` iga bog'liq emas: `TZ` noto'g'ri qo'yilsa
 * eslatmalar tunda ketardi.
 */
export function msUntilNextRun(now: Date, hour: number): number {
  const local = now.getTime() + TASHKENT_OFFSET_MS;
  const sinceMidnight = ((local % DAY_MS) + DAY_MS) % DAY_MS;
  const target = hour * HOUR_MS;

  // Aynan belgilangan soatda ertangi kunga o'tamiz: aks holda vazifa
  // tugagach `setTimeout(0)` bilan darhol qayta ishga tushardi.
  const delay = target - sinceMidnight;
  return delay > 0 ? delay : delay + DAY_MS;
}

export interface DailyJobOptions {
  hour: number;
  run: () => Promise<void>;
  /** Testlar uchun; standart — tizim vaqti. */
  now?: () => Date;
}

export interface DailyJob {
  stop: () => void;
}

export function startDailyJob(options: DailyJobOptions): DailyJob {
  const now = options.now ?? (() => new Date());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = (): void => {
    if (stopped) return;

    timer = setTimeout(
      () => {
        void (async () => {
          try {
            await options.run();
          } catch (error) {
            // Bir kunlik nosozlik jadvalni butunlay to'xtatmasligi kerak:
            // aks holda bitta baza uzilishi eslatmalarni abadiy o'chirardi.
            console.error('[worker] kunlik vazifa yiqildi', error);
          }
          schedule();
        })();
      },
      msUntilNextRun(now(), options.hour),
    );
  };

  schedule();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
