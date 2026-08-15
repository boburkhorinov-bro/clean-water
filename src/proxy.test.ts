import { NextRequest } from 'next/server';
import { describe, expect, test } from 'vitest';
import { proxy } from './proxy';

/**
 * Til prefiksi va statik fayllar (§4.7, §4.3).
 *
 * Bu testlar aniq bir xatodan keyin yozilgan: `manifest.webmanifest` va
 * `icon.svg` `/uz/...` ga yo'naltirilgan va PWA manifesti ham, favicon ham
 * ishlamagan. Xato jimgina bo'lgan — brauzer 307 ni kuzatib, HTML sahifani
 * olgan va uni «buzuq manifest» deb tashlab yuborgan.
 */

function requestTo(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3000'));
}

/** `NextResponse.next()` yo'naltirmaydi; redirect da `location` bo'ladi. */
function redirectTarget(pathname: string): string | null {
  const response = proxy(requestTo(pathname));
  const location = response.headers.get('location');
  return location === null ? null : new URL(location).pathname;
}

describe('proxy', () => {
  test('ildiz standart tilga yo‘naltiriladi', () => {
    expect(redirectTarget('/')).toBe('/uz');
  });

  test('til prefiksi yo‘q sahifa yo‘naltiriladi', () => {
    expect(redirectTarget('/filtrlar')).toBe('/uz/filtrlar');
  });

  test('til prefiksi bor sahifa tegilmaydi', () => {
    expect(redirectTarget('/uz')).toBeNull();
    expect(redirectTarget('/ru/filtrlar')).toBeNull();
  });

  test('PWA MANIFESTI yo‘naltirilmaydi', () => {
    expect(redirectTarget('/manifest.webmanifest')).toBeNull();
  });

  test('IKONKA yo‘naltirilmaydi', () => {
    expect(redirectTarget('/icon.svg')).toBeNull();
    expect(redirectTarget('/favicon.ico')).toBeNull();
  });

  test('indekslash fayllari yo‘naltirilmaydi', () => {
    expect(redirectTarget('/robots.txt')).toBeNull();
    expect(redirectTarget('/sitemap.xml')).toBeNull();
  });

  test('yuklangan media yo‘naltirilmaydi', () => {
    expect(redirectTarget('/media/osmos-5.jpg')).toBeNull();
  });

  test('KENGAYTMALI HAR QANDAY fayl yo‘naltirilmaydi', () => {
    // Ro'yxatni har safar to'ldirib borish o'rniga umumiy qoida: nuqtasi
    // bor yo'l — bu fayl, sahifa emas.
    for (const path of ['/apple-touch-icon.png', '/sw.js', '/.well-known/assetlinks.json']) {
      expect(redirectTarget(path), path).toBeNull();
    }
  });
});
