'use client';

import { useEffect, useRef, useState } from 'react';
import { FORM_TOKEN_MIN_AGE_MS } from '@/lib/form-token-timing';
import type { Messages } from '@/lib/i18n/messages';
import styles from './LeadForm.module.css';

/**
 * Ariza formasi (§4.5).
 *
 * Mehmon rejimida ishlaydi: kirish talab qilinmaydi, telefon yetarli.
 * Xato matnlari aniq — nima noto'g'ri va nima qilish kerakligini aytadi.
 *
 * Spam himoyasi (§6) ikki qismdan iborat va ikkalasi ham mijozga ko'rinmaydi:
 * ko'zdan yashirilgan `website` maydoni (honeypot) va serverda imzolangan
 * forma tokeni — u formaning to'ldirilishiga sarflangan vaqtni o'lchaydi.
 * CAPTCHA ataylab yo'q: u har bir haqiqiy mijozga soliq soladi.
 */

type Status = 'idle' | 'sending' | 'sent' | 'error';

/** Yangi olingan token darhol ishlatilsa server uni «juda tez» deb rad etadi. */
const TOKEN_WARMUP_MS = FORM_TOKEN_MIN_AGE_MS + 500;

async function fetchFormToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/form-token');
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

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
  const tokenRef = useRef<string | null>(null);

  // Token forma ochilganda olinadi: shu paytdan boshlab to'ldirish vaqti
  // sanaladi. Sahifaning o'ziga qo'yib bo'lmasdi — katalog sahifalari ISR
  // bilan keshlanadi va token HTML ga muzlab qolardi.
  useEffect(() => {
    let cancelled = false;
    void fetchFormToken().then((token) => {
      if (!cancelled) tokenRef.current = token;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Token yo'q bo'lsa oladi va uni «yetiltirish» uchun kutadi. */
  async function ensureToken(): Promise<string | null> {
    if (tokenRef.current) return tokenRef.current;

    const token = await fetchFormToken();
    if (!token) return null;
    tokenRef.current = token;
    await new Promise((resolve) => setTimeout(resolve, TOKEN_WARMUP_MS));
    return token;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setStatus('sending');
    setError(null);

    try {
      const token = await ensureToken();
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: String(form.get('phone') ?? ''),
          name: String(form.get('name') ?? '').trim() || undefined,
          comment: String(form.get('comment') ?? '').trim() || undefined,
          website: String(form.get('website') ?? '').trim() || undefined,
          formToken: token ?? undefined,
          productId,
          source,
        }),
      });

      if (response.ok) {
        setStatus('sent');
        return;
      }

      // Eskirgan token qayta ishlatilmaydi: keyingi urinish yangisini oladi.
      if (response.status === 400) tokenRef.current = null;

      // Har bir holat uchun o'z matni: «xato yuz berdi» foydalanuvchiga
      // nima qilishni aytmaydi.
      setStatus('error');
      if (response.status === 429) {
        setError(t.formErrorRate);
        return;
      }
      if (response.status === 400) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error === 'stale_form' ? t.formErrorStale : t.formErrorPhone);
        return;
      }
      setError(t.formErrorGeneric);
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

      {/*
        Honeypot (§6). Ekrandan tashqariga chiqariladi, `display:none` bilan
        emas: ba'zi botlar ko'rinmas maydonlarni ataylab o'tkazib yuboradi.
        Uslub inline — CSS fayli yuklanmay qolsa ham maydon ko'rinmasligi
        kerak, aks holda haqiqiy mijozlar uni to'ldirib qo'yardi.
      */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
      />

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
