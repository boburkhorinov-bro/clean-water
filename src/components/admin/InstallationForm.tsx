'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './InstallationForm.module.css';

/**
 * O'rnatishni qayd qilish (§7 dagi 6-band).
 *
 * Bu formadan keyin eslatmalar ishlay boshlaydi: har bir kartrijning
 * `due_at` i uning o'z sanasidan va o'z resursidan hisoblanadi (§5).
 * Shuning uchun kartrij sanasi alohida kiritiladi — apparat avgustda,
 * membrana esa oktabrda qo'yilgan bo'lishi mumkin.
 */

export interface ProductOption {
  id: string;
  name: string;
  resourceMonths?: number | null;
}

interface PartRow {
  cartridgeProductId: string;
  installedAt: string;
}

export function InstallationForm({
  userId,
  filters,
  cartridges,
}: {
  userId: string;
  filters: ProductOption[];
  cartridges: ProductOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filterProductId, setFilterProductId] = useState(filters[0]?.id ?? '');
  const [installedAt, setInstalledAt] = useState('');
  const [address, setAddress] = useState('');
  const [parts, setParts] = useState<PartRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          filterProductId,
          installedAt,
          address: address.trim() === '' ? undefined : address.trim(),
          parts: parts
            .filter((part) => part.cartridgeProductId !== '')
            .map((part) => ({
              cartridgeProductId: part.cartridgeProductId,
              ...(part.installedAt === '' ? {} : { installedAt: part.installedAt }),
            })),
        }),
      });

      if (response.ok) {
        setOpen(false);
        setParts([]);
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? 'Saqlab bo‘lmadi.');
    } catch {
      setError('Tarmoq xatosi.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        O‘rnatish qo‘shish
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Apparat</span>
          <select
            value={filterProductId}
            onChange={(event) => setFilterProductId(event.target.value)}
          >
            {filters.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>O‘rnatilgan sana</span>
          <input
            type="date"
            value={installedAt}
            onChange={(event) => setInstalledAt(event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Manzil</span>
          <input value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Kartrijlar</legend>

        {parts.map((part, index) => (
          <div key={index} className={styles.partRow}>
            <select
              value={part.cartridgeProductId}
              onChange={(event) =>
                setParts((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, cartridgeProductId: event.target.value } : item,
                  ),
                )
              }
            >
              <option value="">— tanlang —</option>
              {cartridges.map((cartridge) => (
                <option key={cartridge.id} value={cartridge.id}>
                  {cartridge.name}
                  {cartridge.resourceMonths ? ` (${cartridge.resourceMonths} oy)` : ''}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={part.installedAt}
              onChange={(event) =>
                setParts((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, installedAt: event.target.value } : item,
                  ),
                )
              }
              aria-label="Kartrij o‘rnatilgan sana"
            />

            <button
              type="button"
              onClick={() => setParts((current) => current.filter((_, i) => i !== index))}
              aria-label="O‘chirish"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          className={styles.addPart}
          onClick={() =>
            setParts((current) => [...current, { cartridgeProductId: '', installedAt: '' }])
          }
        >
          + Kartrij
        </button>
        <p className={styles.hint}>Kartrij sanasi bo‘sh qolsa, apparat o‘rnatilgan sana olinadi.</p>
      </fieldset>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.confirm} disabled={busy}>
          {busy ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
        <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}
