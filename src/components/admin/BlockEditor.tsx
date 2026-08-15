'use client';

import { addBlock, emptyBlock, moveBlock, removeBlock, updateBlock } from '@/lib/block-editor';
import type { ContentBlock } from '@/lib/content-blocks';
import styles from './BlockEditor.module.css';

/**
 * Kontent-bloklar vizual muharriri (§4.8).
 *
 * IXTIYORIY HTML QABUL QILINMAYDI. Muharrir faqat tiplashtirilgan bloklarni
 * yasaydi va har bir maydon o'z turiga mos kirish elementiga bog'langan.
 * Saqlashda server yana bir bor `contentBlocksSchema` bilan tekshiradi —
 * klientdagi cheklov qulaylik, himoya emas.
 *
 * Bloklar ustidagi amallar sof funksiyalarda (`lib/block-editor.ts`) va
 * alohida test qilingan.
 */

const TYPE_LABELS: Record<ContentBlock['type'], string> = {
  heading: 'Sarlavha',
  paragraph: 'Matn',
  image: 'Rasm',
  specs: 'Xususiyatlar jadvali',
  video: 'Video',
};

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.addBar}>
        {(Object.keys(TYPE_LABELS) as ContentBlock['type'][]).map((type) => (
          <button
            key={type}
            type="button"
            className={styles.addButton}
            onClick={() => onChange(addBlock(blocks, type))}
          >
            + {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {blocks.length === 0 && <p className={styles.empty}>Tavsif bloklari hali qo‘shilmagan.</p>}

      <ol className={styles.list}>
        {blocks.map((block, index) => (
          <li key={index} className={styles.block}>
            <header className={styles.blockHead}>
              <span className={styles.blockType}>{TYPE_LABELS[block.type]}</span>
              <div className={styles.blockActions}>
                <button
                  type="button"
                  onClick={() => onChange(moveBlock(blocks, index, 'up'))}
                  disabled={index === 0}
                  aria-label="Yuqoriga"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onChange(moveBlock(blocks, index, 'down'))}
                  disabled={index === blocks.length - 1}
                  aria-label="Pastga"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(removeBlock(blocks, index))}
                  aria-label="O‘chirish"
                >
                  ×
                </button>
              </div>
            </header>

            <BlockFields
              block={block}
              onPatch={(patch) => onChange(updateBlock(blocks, index, patch))}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function BlockFields({
  block,
  onPatch,
}: {
  block: ContentBlock;
  onPatch: (patch: Partial<ContentBlock>) => void;
}) {
  if (block.type === 'heading' || block.type === 'paragraph') {
    const Field = block.type === 'paragraph' ? 'textarea' : 'input';
    return (
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>O‘zbekcha</span>
          <Field
            value={block.uz ?? ''}
            onChange={(event: { target: { value: string } }) =>
              onPatch({ uz: event.target.value } as Partial<ContentBlock>)
            }
          />
        </label>
        <label className={styles.field}>
          <span>Ruscha</span>
          <Field
            value={block.ru ?? ''}
            onChange={(event: { target: { value: string } }) =>
              onPatch({ ru: event.target.value } as Partial<ContentBlock>)
            }
          />
        </label>
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Manzil (/media/…)</span>
          <input
            value={block.src}
            onChange={(event) => onPatch({ src: event.target.value } as Partial<ContentBlock>)}
          />
        </label>
        <label className={styles.field}>
          <span>Izoh (uz)</span>
          <input
            value={block.alt.uz ?? ''}
            onChange={(event) =>
              onPatch({ alt: { ...block.alt, uz: event.target.value } } as Partial<ContentBlock>)
            }
          />
        </label>
        <label className={styles.field}>
          <span>Izoh (ru)</span>
          <input
            value={block.alt.ru ?? ''}
            onChange={(event) =>
              onPatch({ alt: { ...block.alt, ru: event.target.value } } as Partial<ContentBlock>)
            }
          />
        </label>
      </div>
    );
  }

  if (block.type === 'video') {
    return (
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Kinescope id</span>
          <input
            value={block.id}
            onChange={(event) => onPatch({ id: event.target.value } as Partial<ContentBlock>)}
          />
        </label>
      </div>
    );
  }

  return (
    <div className={styles.rows}>
      {block.rows.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.row}>
          <input
            value={row.k.uz ?? ''}
            placeholder="Nomi (uz)"
            onChange={(event) =>
              onPatch({
                rows: block.rows.map((item, i) =>
                  i === rowIndex ? { ...item, k: { ...item.k, uz: event.target.value } } : item,
                ),
              } as Partial<ContentBlock>)
            }
          />
          <input
            value={row.v.uz ?? ''}
            placeholder="Qiymati (uz)"
            onChange={(event) =>
              onPatch({
                rows: block.rows.map((item, i) =>
                  i === rowIndex ? { ...item, v: { ...item.v, uz: event.target.value } } : item,
                ),
              } as Partial<ContentBlock>)
            }
          />
          <input
            value={row.k.ru ?? ''}
            placeholder="Nomi (ru)"
            onChange={(event) =>
              onPatch({
                rows: block.rows.map((item, i) =>
                  i === rowIndex ? { ...item, k: { ...item.k, ru: event.target.value } } : item,
                ),
              } as Partial<ContentBlock>)
            }
          />
          <input
            value={row.v.ru ?? ''}
            placeholder="Qiymati (ru)"
            onChange={(event) =>
              onPatch({
                rows: block.rows.map((item, i) =>
                  i === rowIndex ? { ...item, v: { ...item.v, ru: event.target.value } } : item,
                ),
              } as Partial<ContentBlock>)
            }
          />
          <button
            type="button"
            onClick={() =>
              onPatch({
                rows: block.rows.filter((_, i) => i !== rowIndex),
              } as Partial<ContentBlock>)
            }
            aria-label="Qatorni o‘chirish"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.addRow}
        onClick={() => {
          const fresh = emptyBlock('specs');
          const row = fresh.type === 'specs' ? fresh.rows[0] : undefined;
          if (row) onPatch({ rows: [...block.rows, row] } as Partial<ContentBlock>);
        }}
      >
        + Qator
      </button>
    </div>
  );
}
