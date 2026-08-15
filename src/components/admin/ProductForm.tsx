'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ContentBlock } from '@/lib/content-blocks';
import { BlockEditor } from './BlockEditor';
import styles from './ProductForm.module.css';

/**
 * Mahsulot formasi (§7 dagi 5-band, §4.8).
 *
 * Klientdagi tekshiruvlar qulaylik uchun: haqiqiy validatsiya serverda
 * (`admin-products.ts`) va u xatoni matn bilan qaytaradi. Shuning uchun
 * bu yerda «forma to'g'ri bo'lmaguncha yubormaslik» qoidasi yo'q —
 * serverning javobi ko'rsatiladi.
 */

export interface ProductFormValues {
  id?: string;
  kind: 'FILTER' | 'CARTRIDGE';
  slug: string;
  nameUz: string;
  nameRu: string;
  price: string;
  images: string[];
  videoId: string;
  isActive: boolean;
  resourceMonths: string;
  compatibleFilterIds: string[];
  contentBlocks: ContentBlock[];
}

export interface FilterOption {
  id: string;
  name: string;
}

export function ProductForm({
  initial,
  filters,
}: {
  initial: ProductFormValues;
  filters: FilterOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCartridge = values.kind === 'CARTRIDGE';

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      slug: values.slug,
      nameUz: values.nameUz,
      nameRu: values.nameRu,
      price: values.price,
      images: values.images.filter((image) => image.trim().length > 0),
      videoId: values.videoId.trim() === '' ? null : values.videoId.trim(),
      contentBlocks: values.contentBlocks,
      isActive: values.isActive,
    };

    if (isCartridge) {
      payload.resourceMonths = Number(values.resourceMonths);
      payload.compatibleFilterIds = values.compatibleFilterIds;
    }
    if (!values.id) {
      payload.kind = values.kind;
    }

    try {
      const response = await fetch(
        values.id ? `/api/admin/products/${values.id}` : '/api/admin/products',
        {
          method: values.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        router.push('/admin/mahsulotlar');
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

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <div className={styles.grid}>
        {!values.id && (
          <label className={styles.field}>
            <span>Tur</span>
            <select
              value={values.kind}
              onChange={(event) => set('kind', event.target.value as 'FILTER' | 'CARTRIDGE')}
            >
              <option value="FILTER">Filtr</option>
              <option value="CARTRIDGE">Kartrij</option>
            </select>
          </label>
        )}

        <label className={styles.field}>
          <span>Slug (manzilda ko‘rinadi)</span>
          <input
            value={values.slug}
            onChange={(event) => set('slug', event.target.value)}
            placeholder="osmos-5"
          />
        </label>

        <label className={styles.field}>
          <span>Nomi (uz)</span>
          <input value={values.nameUz} onChange={(event) => set('nameUz', event.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Nomi (ru)</span>
          <input
            value={values.nameRu}
            onChange={(event) => set('nameRu', event.target.value)}
            placeholder="Bo‘sh qolsa o‘zbekchasi ishlatiladi"
          />
        </label>

        <label className={styles.field}>
          <span>Narxi (so‘m)</span>
          <input
            value={values.price}
            onChange={(event) => set('price', event.target.value)}
            inputMode="decimal"
          />
        </label>

        {isCartridge && (
          <label className={styles.field}>
            <span>Resurs (oy)</span>
            <input
              value={values.resourceMonths}
              onChange={(event) => set('resourceMonths', event.target.value)}
              inputMode="numeric"
            />
            <small className={styles.hint}>
              Almashtirish muddati shu songa qarab hisoblanadi. Usiz kartrij eslatma olmaydi.
            </small>
          </label>
        )}

        <label className={styles.field}>
          <span>Kinescope video id</span>
          <input value={values.videoId} onChange={(event) => set('videoId', event.target.value)} />
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => set('isActive', event.target.checked)}
          />
          <span>Sotuvda (belgilanmasa arxivga tushadi)</span>
        </label>
      </div>

      <label className={styles.field}>
        <span>Rasmlar (har biri yangi qatorda, /media/…)</span>
        <textarea
          value={values.images.join('\n')}
          onChange={(event) => set('images', event.target.value.split('\n'))}
          rows={3}
        />
      </label>

      {isCartridge && filters.length > 0 && (
        <fieldset className={styles.fieldset}>
          <legend>Mos filtrlar</legend>
          <div className={styles.checks}>
            {filters.map((filter) => (
              <label key={filter.id} className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={values.compatibleFilterIds.includes(filter.id)}
                  onChange={(event) =>
                    set(
                      'compatibleFilterIds',
                      event.target.checked
                        ? [...values.compatibleFilterIds, filter.id]
                        : values.compatibleFilterIds.filter((id) => id !== filter.id),
                    )
                  }
                />
                <span>{filter.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Tavsif bloklari</legend>
        <BlockEditor
          blocks={values.contentBlocks}
          onChange={(blocks) => set('contentBlocks', blocks)}
        />
      </fieldset>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? 'Saqlanmoqda…' : 'Saqlash'}
      </button>
    </form>
  );
}
