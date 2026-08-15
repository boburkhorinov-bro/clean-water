import { tashkentDayDiff } from '@/lib/due-date';
import { localized } from '@/lib/i18n/localized';
import type { Locale } from '@/lib/i18n/locales';
import { findInstallationsByUser } from '@/server/repositories/installation-repository';

/**
 * «Mening filtrim» ekrani (§2, §7 dagi 7-band).
 *
 * Ekranning butun ma'nosi — mijoz o'z apparatining haqiqiy holatini ko'rishi.
 * §3 dagi qoida shu yerda eng muhim: shkala DEKORATIV EMAS, u ikkita haqiqiy
 * sanadan hisoblanadi. O'ylab topilgan «taxminan yarmi» mijozni keraksiz
 * xaridga yoki aksincha, kechikishga olib borardi.
 */

/** §4.6 dagi birinchi chegara bilan bir xil: 30 kun. */
const SOON_DAYS = 30;

export type ResourceState = 'OK' | 'SOON' | 'DUE';

export interface ResourceProgress {
  daysLeft: number;
  daysTotal: number;
  /** 0..1 — sarflangan qism. Muddat o'tgan bo'lsa ham 1 dan oshmaydi. */
  usedRatio: number;
  state: ResourceState;
}

export interface ResourceProgressInput {
  installedAt: Date;
  dueAt: Date;
  now: Date;
}

export function computeResourceProgress(input: ResourceProgressInput): ResourceProgress {
  const daysTotal = tashkentDayDiff(input.installedAt, input.dueAt);
  const daysLeft = tashkentDayDiff(input.now, input.dueAt);
  const daysUsed = daysTotal - daysLeft;

  // `daysTotal <= 0` — buzuq ma'lumot (resurssiz yoki qo'lda tahrirlangan
  // yozuv). Shkalani nolga bo'lishdan ko'ra «muddati keldi» deb ko'rsatish
  // to'g'ri: bunday kartrij baribir tekshirishni talab qiladi.
  const usedRatio = daysTotal <= 0 ? 1 : Math.min(Math.max(daysUsed / daysTotal, 0), 1);

  const state: ResourceState = daysLeft <= 0 ? 'DUE' : daysLeft <= SOON_DAYS ? 'SOON' : 'OK';

  return { daysLeft, daysTotal, usedRatio, state };
}

export interface MyFilterPart {
  id: string;
  cartridgeName: string;
  cartridgeSlug: string;
  installedAt: Date;
  dueAt: Date;
  progress: ResourceProgress;
}

export interface MyFilterInstallation {
  id: string;
  filterName: string;
  filterSlug: string;
  installedAt: Date;
  address: string | null;
  parts: MyFilterPart[];
}

/**
 * Mijozning o'rnatishlari va ularning amaldagi kartrijlari.
 *
 * Almashtirilgan kartrijlar ko'rsatilmaydi: ekran «hozir nima turibdi va
 * qachon almashtirish kerak» degan savolga javob beradi, tarix esa CRM da.
 */
export async function getMyFilterView(
  userId: string,
  locale: Locale,
  now: Date = new Date(),
): Promise<MyFilterInstallation[]> {
  const installations = await findInstallationsByUser(userId);

  return installations.map((installation) => ({
    id: installation.id,
    filterName: localized(
      { uz: installation.filterProduct.nameUz, ru: installation.filterProduct.nameRu },
      locale,
    ),
    filterSlug: installation.filterProduct.slug,
    installedAt: installation.installedAt,
    address: installation.address,
    parts: installation.parts
      .filter((part) => part.replacedAt === null)
      .map((part) => ({
        id: part.id,
        cartridgeName: localized(
          { uz: part.cartridgeProduct.nameUz, ru: part.cartridgeProduct.nameRu },
          locale,
        ),
        cartridgeSlug: part.cartridgeProduct.slug,
        installedAt: part.installedAt,
        dueAt: part.dueAt,
        progress: computeResourceProgress({
          installedAt: part.installedAt,
          dueAt: part.dueAt,
          now,
        }),
      })),
  }));
}
