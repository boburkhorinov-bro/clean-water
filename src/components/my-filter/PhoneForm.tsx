'use client';

import { useState } from 'react';
import type { Messages } from '@/lib/i18n/messages';
import styles from './PhoneForm.module.css';

/**
 * Mini App da telefon raqamini qoldirish (§4.5).
 *
 * Telegram avtorizatsiyasi raqam bermaydi — faqat `telegram_id`. Shu sababli
 * ilovaga birinchi kirgan mijozning profilida telefon bo'lmaydi va u
 * «Almashtirishga buyurtma» tugmasini bosganda ariza yaratilmasdi: bot
 * «raqamni ilovada qoldiring» derdi, ilovada esa bunday joy yo'q edi.
 *
 * Forma faqat raqami yo'q mijozga ko'rsatiladi. Saqlangandan keyin sahifa
 * qayta yuklanmaydi: tugma serverda mijozni bazadan o'qiydi, ya'ni keyingi
 * bosishda ariza yaratiladi.
 *
 * Ariza formasidagi (`LeadForm`) spam to'siqlari bu yerda YO'Q: mijoz
 * allaqachon Telegram orqali kirgan va cheklov sessiyaga bog'lab qo'yilgan
 * (`/api/my-filter/phone`). Honeypot va forma tokeni mehmon oqimi uchun.
 */

type Status = 'idle' | 'sending' | 'saved' | 'error';

export function PhoneForm({ t }: { t: Messages }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = String(new FormData(event.currentTarget).get('phone') ?? '');

    setStatus('sending');
    setError(null);

    try {
      const response = await fetch('/api/my-filter/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (response.ok) {
        setStatus('saved');
        return;
      }

      // Har bir holat uchun o'z matni: «xato yuz berdi» mijozga nima
      // qilishni aytmaydi.
      setStatus('error');
      setError(response.status === 429 ? t.formErrorRate : t.phoneErrorInvalid);
    } catch {
      setStatus('error');
      setError(t.phoneErrorGeneric);
    }
  }

  if (status === 'saved') {
    return (
      <p className={styles.success} role="status">
        {t.phoneSaved}
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h2 className={styles.title}>{t.phoneNeededTitle}</h2>
      <p className={styles.lead}>{t.phoneNeededLead}</p>

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

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? t.phoneSaving : t.phoneSave}
      </button>
    </form>
  );
}
