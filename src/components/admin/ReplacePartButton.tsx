'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './ReplacePartButton.module.css';

/**
 * Kartrij almashtirilganini belgilash (§7 dagi 6-band).
 *
 * Sana majburiy va standart qiymati BUGUN emas, balki bo'sh: menejer
 * ko'pincha o'tgan haftadagi almashtirishni kiritadi va standart sana
 * jimgina noto'g'ri `due_at` beradi.
 */
export function ReplacePartButton({ partId }: { partId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/parts/${partId}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replacedAt: date }),
      });

      if (response.ok) {
        setOpen(false);
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? 'Belgilab bo‘lmadi.');
    } catch {
      setError('Tarmoq xatosi.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        Almashtirildi
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        required
        aria-label="Almashtirilgan sana"
        className={styles.date}
      />
      <button type="submit" className={styles.confirm} disabled={busy || date === ''}>
        {busy ? '…' : 'Saqlash'}
      </button>
      <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
        Bekor
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </form>
  );
}
