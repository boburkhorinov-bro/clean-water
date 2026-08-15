'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import styles from './ReplaceButton.module.css';

/**
 * «Almashtirishga buyurtma» (§2, §4.6).
 *
 * Katalogdan o'tmaydi: qaysi kartrij ekani ekrandan ma'lum. Serverda kim
 * so'rayotgani sessiyadan olinadi — bu yerdan faqat kartrij identifikatori
 * ketadi va u baribir egalikka tekshiriladi (§6).
 */

type State = 'idle' | 'sending' | 'done' | 'error';

const RESULT_KEYS = {
  CREATED: 'replacementCreated',
  ALREADY_REQUESTED: 'replacementAlready',
  PHONE_REQUIRED: 'replacementPhoneRequired',
} as const;

export function ReplaceButton({
  installedPartId,
  locale,
}: {
  installedPartId: string;
  locale: Locale;
}) {
  const t = getMessages(locale);
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setState('sending');
    setMessage(null);

    try {
      const response = await fetch('/api/my-filter/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installedPartId }),
      });

      const body = (await response.json().catch(() => null)) as { status?: string } | null;
      const key = body?.status ? RESULT_KEYS[body.status as keyof typeof RESULT_KEYS] : undefined;

      if (!key) {
        setState('error');
        setMessage(t.replacementError);
        return;
      }

      setState('done');
      setMessage(t[key]);
    } catch {
      setState('error');
      setMessage(t.replacementError);
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={() => void submit()}
        disabled={state === 'sending' || state === 'done'}
      >
        {state === 'sending' ? t.replacementSending : t.orderReplacement}
      </button>

      {message && (
        <p className={styles.message} role="status" data-state={state}>
          {message}
        </p>
      )}
    </div>
  );
}
