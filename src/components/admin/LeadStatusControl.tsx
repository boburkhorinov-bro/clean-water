'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './LeadStatusControl.module.css';

/**
 * Ariza statusini o'zgartirish (§4.5, 6-qadam).
 *
 * Tugmalar RUXSAT ETILGAN o'tishlarni ko'rsatadi. Bu klientdagi qulaylik,
 * himoya emas: serverdagi `changeLeadStatus` baribir grafni tekshiradi va
 * taqiqlangan o'tishni 409 bilan rad etadi.
 */

type Status = 'NEW' | 'IN_WORK' | 'DONE' | 'REJECTED';

const LABELS: Record<Status, string> = {
  NEW: 'Yangi',
  IN_WORK: 'Ishga olish',
  DONE: 'Bajarildi',
  REJECTED: 'Rad etish',
};

const TRANSITIONS: Record<Status, readonly Status[]> = {
  NEW: ['IN_WORK', 'REJECTED'],
  IN_WORK: ['DONE', 'REJECTED', 'NEW'],
  REJECTED: ['NEW'],
  DONE: [],
};

export function LeadStatusControl({ leadId, status }: { leadId: string; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: Status) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });

      if (response.ok) {
        router.refresh();
        return;
      }

      // 409 — ariza boshqa oynada allaqachon o'zgartirilgan bo'lishi mumkin.
      setError(
        response.status === 409
          ? 'Ariza holati o‘zgargan. Sahifani yangilang.'
          : 'O‘zgartirib bo‘lmadi.',
      );
    } catch {
      setError('Tarmoq xatosi.');
    } finally {
      setBusy(false);
    }
  }

  const available = TRANSITIONS[status];
  if (available.length === 0) {
    return <span className={styles.done}>—</span>;
  }

  return (
    <div className={styles.wrap}>
      {available.map((next) => (
        <button
          key={next}
          type="button"
          className={styles.button}
          data-target={next}
          disabled={busy}
          onClick={() => void change(next)}
        >
          {LABELS[next]}
        </button>
      ))}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
