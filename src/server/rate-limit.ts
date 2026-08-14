/**
 * Oddiy sirg'aluvchi oyna rate-limiter (§6).
 *
 * §4.1: «Redis va vazifalar navbati — startda yo'q... Redis administratsiya
 * qilinishi kerak bo'lgan yana bitta nosozlikka moyil komponent qo'shadi.»
 * Shuning uchun hisoblagich jarayon xotirasida turadi.
 *
 * CHEKLOVI: `web` bir nechta instansda ishga tushsa, har biri o'z hisobini
 * yuritadi va amaldagi limit instanslar soniga ko'payadi. Startdagi
 * yuklamada bu maqbul; nginx darajasidagi `limit_req` esa qo'shimcha
 * himoya bo'lib turadi (docker/nginx/conf.d/default.conf).
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface Options {
  limit: number;
  windowMs: number;
}

interface Entry {
  count: number;
  windowStart: number;
}

export function createRateLimiter({ limit, windowMs }: Options) {
  const entries = new Map<string, Entry>();

  /** Eskirgan yozuvlarni supuradi — aks holda xotira cheksiz o'sadi. */
  function sweep(now: number): void {
    for (const [key, entry] of entries) {
      if (now - entry.windowStart >= windowMs) entries.delete(key);
    }
  }

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      sweep(now);

      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { count: 1, windowStart: now });
        return { allowed: true, retryAfterMs: 0 };
      }

      if (entry.count < limit) {
        entry.count += 1;
        return { allowed: true, retryAfterMs: 0 };
      }

      return { allowed: false, retryAfterMs: entry.windowStart + windowMs - now };
    },

    /** Testlar va diagnostika uchun. */
    size(): number {
      return entries.size;
    },
  };
}
