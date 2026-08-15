import type { MyFilterInstallation, MyFilterPart } from './my-filter';

/**
 * Mini App dashboardi uchun tanlov (§3).
 *
 * Dastlabki g'oyada shkala «o'z-o'zidan to'lardi» — bu ongli ravishda rad
 * etilgan: dekorativ progress buzuqlik sifatida qabul qilinadi. Dashboard
 * mijozga HAQIQIY holatni ko'rsatadi yoki hech narsa ko'rsatmaydi.
 */

export interface UrgentPart {
  installation: MyFilterInstallation;
  part: MyFilterPart;
}

/**
 * Barcha o'rnatishlar bo'ylab eng kam kun qolgan kartrijni topadi.
 *
 * Mijozda bir nechta apparat bo'lishi mumkin (uy, dala hovli — §5), shuning
 * uchun qidiruv hammasi bo'ylab. Muddati o'tganlar tabiiy ravishda birinchi
 * bo'ladi: ularda `daysLeft` manfiy.
 */
export function pickMostUrgentPart(installations: MyFilterInstallation[]): UrgentPart | null {
  let best: UrgentPart | null = null;

  for (const installation of installations) {
    for (const part of installation.parts) {
      if (best === null || part.progress.daysLeft < best.part.progress.daysLeft) {
        best = { installation, part };
      }
    }
  }

  return best;
}
