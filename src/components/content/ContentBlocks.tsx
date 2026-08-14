import type { Locale } from '@/lib/i18n/locales';
import { localized } from '@/lib/i18n/localized';
import type { ContentBlock } from '@/lib/content-blocks';

/**
 * Kontent-bloklar rendereri (§4.8).
 *
 * `type` → React komponenti solishtiruvi. `dangerouslySetInnerHTML` bu yerda
 * ham, boshqa hech qayerda ishlatilmaydi — matn React orqali chiqadi va
 * avtomatik ekranlanadi. Aynan shu sabab TZ dagi «HTML yuklash» talabi bloklar
 * bilan almashtirilgan.
 */

interface Props {
  blocks: ContentBlock[];
  locale: Locale;
}

function Block({ block, locale }: { block: ContentBlock; locale: Locale }) {
  switch (block.type) {
    case 'heading': {
      const text = localized(block, locale);
      // Bo'sh sarlavha sahifada buzuqlikka o'xshaydi — umuman chiqarmaymiz.
      return text.trim() ? <h2>{text}</h2> : null;
    }

    case 'paragraph': {
      const text = localized(block, locale);
      return text.trim() ? <p>{text}</p> : null;
    }

    case 'image':
      // Manba har doim o'z serverimizdagi `/media/` va o'lchamlari oldindan
      // noma'lum. `next/image` dizayn-tokenlar bosqichida qo'shiladi.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.src} alt={localized(block.alt, locale)} loading="lazy" />;

    case 'specs':
      return (
        <table>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>
                <th scope="row">{localized(row.k, locale)}</th>
                <td>{localized(row.v, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case 'video':
      return (
        <iframe
          src={`https://kinescope.io/embed/${block.id}`}
          title="video"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          loading="lazy"
        />
      );
  }
}

export function ContentBlocks({ blocks, locale }: Props) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={index} block={block} locale={locale} />
      ))}
    </>
  );
}
