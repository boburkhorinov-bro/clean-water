'use client';

import { useState } from 'react';
import type { Messages } from '@/lib/i18n/messages';
import styles from './LeadForm.module.css';

/**
 * Ariza formasi (§4.5).
 *
 * Mehmon rejimida ishlaydi: kirish talab qilinmaydi, telefon yetarli.
 * Xato matnlari aniq — nima noto'g'ri va nima qilish kerakligini aytadi.
 */

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function LeadForm({
  t,
  productId,
  source,
}: {
  t: Messages;
  productId?: string | undefined;
  source: 'WEB' | 'MINIAPP';
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setStatus('sending');
    setError(null);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: String(form.get('phone') ?? ''),
          name: String(form.get('name') ?? '').trim() || undefined,
          comment: String(form.get('comment') ?? '').trim() || undefined,
          productId,
          source,
        }),
      });

      if (response.ok) {
        setStatus('sent');
        return;
      }

      // Har bir holat uchun o'z matni: «xato yuz berdi» foydalanuvchiga
      // nima qilishni aytmaydi.
      setStatus('error');
      if (response.status === 429) setError(t.formErrorRate);
      else if (response.status === 400) setError(t.formErrorPhone);
      else setError(t.formErrorGeneric);
    } catch {
      setStatus('error');
      setError(t.formErrorGeneric);
    }
  }

  if (status === 'sent') {
    return (
      <p className={styles.success} role="status">
        {t.formSuccess}
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h2 className={styles.title}>{t.orderTitle}</h2>
      <p className={styles.lead}>{t.orderLead}</p>

      <label className={styles.field}>
        <span className={styles.label}>{t.formPhone}</span>
        <input
          className={styles.input}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="+998 90 123 45 67"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          {t.formName} <span className={styles.optional}>{t.formOptional}</span>
        </span>
        <input className={styles.input} name="name" type="text" autoComplete="name" />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          {t.formComment} <span className={styles.optional}>{t.formOptional}</span>
        </span>
        <textarea className={styles.textarea} name="comment" rows={3} />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? t.formSending : t.formSubmit}
      </button>
    </form>
  );
}
