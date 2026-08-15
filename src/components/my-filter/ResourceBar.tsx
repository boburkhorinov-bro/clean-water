import type { Locale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import type { ResourceProgress } from '@/server/services/my-filter';
import styles from './ResourceBar.module.css';

/**
 * Kartrij resursi shkalasi (§3).
 *
 * Shkala DEKORATIV EMAS: kengligi `installed_at` va `due_at` orasidagi
 * haqiqiy nisbatdan chiqadi. Shu sababli u ekran o'quvchisi uchun ham
 * `progressbar` bo'lib e'lon qilinadi va aynan o'sha son beriladi — agar
 * ko'rsatkich haqiqiy bo'lmasa, uni ovoz bilan o'qitish uyat bo'lardi.
 */
export function ResourceBar({ progress, locale }: { progress: ResourceProgress; locale: Locale }) {
  const t = getMessages(locale);
  const percent = Math.round(progress.usedRatio * 100);

  const label =
    progress.daysLeft > 0
      ? `${progress.daysLeft} ${t.daysLeft}`
      : progress.daysLeft === 0
        ? t.dueToday
        : `${-progress.daysLeft} ${t.daysOverdue}`;

  return (
    <div className={styles.wrap} data-state={progress.state}>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
