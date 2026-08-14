import Link from 'next/link';
import type { Locale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import type { FilterStage } from '@/server/services/catalog';
import styles from './StageStack.module.css';

/**
 * Filtrning tozalash bosqichlari (§3).
 *
 * Bu shkala DEKORATIV EMAS: har bir bosqich — bazadagi haqiqiy kartrij,
 * tartibi `Compatibility.stage` dan, muddati `CartridgeSpec.resourceMonths`
 * dan keladi. §3 «o'z-o'zidan to'ladigan» shkalani aynan shuning uchun rad
 * etgan — u buzuqlik bo'lib ko'rinadi.
 *
 * Raqamlar faqat tartib HAQIQATAN ma'lum bo'lganda chiqadi. Tartib
 * berilmagan bo'lsa — oddiy ro'yxat, chunki suv qaysi ketma-ketlikda
 * o'tishini bilmasdan raqam qo'yish yolg'on bo'lardi.
 */
export function StageStack({ stages, locale }: { stages: FilterStage[]; locale: Locale }) {
  const t = getMessages(locale);

  if (stages.length === 0) {
    return <p className={styles.empty}>{t.noCompatible}</p>;
  }

  const numbered = stages.every((stage) => stage.stage !== null);

  return (
    <ol className={numbered ? styles.stack : styles.plain}>
      {stages.map((stage) => {
        const name = locale === 'ru' ? stage.nameRu : stage.nameUz;

        return (
          <li key={stage.id} className={styles.stage}>
            {numbered && (
              <span className={styles.index} aria-hidden="true">
                {String(stage.stage).padStart(2, '0')}
              </span>
            )}

            <div className={styles.info}>
              <Link href={`/${locale}/kartrijlar/${stage.slug}`} className={styles.name}>
                {name}
              </Link>
              {stage.resourceMonths !== null && (
                <span className={styles.resource}>
                  {stage.resourceMonths} {t.months}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
