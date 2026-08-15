import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/**
 * nginx konfiguratsiyasi va ilova siyosati o'rtasidagi kelishuv (§6, §7).
 *
 * Bu testlar konfiguratsiya faylini matn sifatida o'qiydi. Ular nginx ni ishga
 * tushirmaydi — maqsad boshqa: ikki qatlam bir-biriga zid bo'lib qolishini
 * ushlash. Ziddiyat jimgina buzadi (ikkita FARQLI CSP — brauzer ikkalasini
 * ham qo'llaydi), shuning uchun uni testsiz sezib bo'lmaydi.
 */

function readConf(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../docker/nginx/conf.d/${name}`, import.meta.url)),
    'utf8',
  );
}

/** `location <prefix>` blokining tanasini qaytaradi. */
function locationBlock(conf: string, prefix: string): string {
  const start = conf.indexOf(`location ${prefix}`);
  if (start === -1) throw new Error(`nginx konfiguratsiyasida "location ${prefix}" yo'q`);

  const open = conf.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < conf.length; i += 1) {
    if (conf[i] === '{') depth += 1;
    if (conf[i] === '}') {
      depth -= 1;
      if (depth === 0) return conf.slice(open + 1, i);
    }
  }
  throw new Error(`"location ${prefix}" bloki yopilmagan`);
}

describe('nginx: ilova bilan sarlavha dublikati', () => {
  test('proxy javoblariga CSP qo‘shilmaydi — uni ilova beradi', () => {
    // Ikkita CSP sarlavhasi qo'shilmaydi, kesishadi: nginx dagisi eskirib
    // qolsa, ilovaning yangi ruxsatlari jimgina bloklanardi.
    const locations = readConf('app_locations.inc');
    expect(locationBlock(locations, '/api/leads')).not.toContain('Content-Security-Policy');
    expect(locationBlock(locations, '/ ')).not.toContain('Content-Security-Policy');
    expect(readConf('default.conf')).not.toContain('add_header Content-Security-Policy');
  });

  test('X-Frame-Options hech qayerda berilmaydi', () => {
    // CSP frame-ancestors bilan ziddiyat: `SAMEORIGIN` Mini App ni bloklardi.
    for (const name of ['default.conf', 'app_locations.inc', 'tls.conf.disabled']) {
      expect(readConf(name)).not.toContain('X-Frame-Options');
    }
  });
});

describe('nginx: /media/ — ilovadan o‘tmaydigan yagona yo‘l', () => {
  const media = locationBlock(readConf('app_locations.inc'), '/media/');

  test('yuklangan fayl uchun eng qattiq CSP', () => {
    // Bu fayllarni nginx diskdan to'g'ridan-to'g'ri beradi, ilova qatnashmaydi.
    // Papkaga qandaydir yo'l bilan HTML tushsa, u sahifa sifatida ochilardi.
    expect(media).toContain("default-src 'none'");
    expect(media).toContain('sandbox');
  });

  test('MIME turini taxmin qilish o‘chiriladi', () => {
    expect(media).toContain('nosniff');
  });
});

describe('nginx: HTTPS majburiy (§6)', () => {
  const tls = readConf('tls.conf.disabled');

  test('80-port HTTPS ga yo‘naltiradi', () => {
    expect(tls).toMatch(/return\s+301\s+https:\/\//);
  });

  test('ACME tekshiruvi redirectdan mustasno — usiz sertifikat yangilanmaydi', () => {
    expect(tls).toContain('/.well-known/acme-challenge/');
  });

  test('HSTS beriladi', () => {
    expect(tls).toMatch(/add_header\s+Strict-Transport-Security\s+"max-age=31536000/);
  });

  test('eskirgan TLS protokollari o‘chirilgan', () => {
    expect(tls).toMatch(/ssl_protocols\s+TLSv1\.2\s+TLSv1\.3;/);
  });
});

describe('nginx: location lar bitta joyda', () => {
  test('HTTP va TLS konfiguratsiyalari umumiy include ni ishlatadi', () => {
    // Nusxalash ikki xil rate-limit ga olib kelardi: bir faylda tuzatilgan
    // cheklov ikkinchisida eskiligicha qolardi.
    expect(readConf('default.conf')).toContain('include /etc/nginx/conf.d/app_locations.inc;');
    expect(readConf('tls.conf.disabled')).toContain('include /etc/nginx/conf.d/app_locations.inc;');
  });

  test('ariza formasiga rate-limit umumiy blokda', () => {
    expect(locationBlock(readConf('app_locations.inc'), '/api/leads')).toContain(
      'limit_req zone=leads',
    );
  });

  test('zonalar va upstream lar alohida faylda — ikki server bloki uchun bir marta', () => {
    // `limit_req_zone` va `upstream` `http` darajasida bo'ladi va ikki marta
    // e'lon qilinsa nginx umuman ishga tushmaydi.
    const shared = readConf('upstreams.conf');
    expect(shared).toContain('limit_req_zone');
    expect(shared).toContain('upstream web_upstream');
    expect(readConf('default.conf')).not.toContain('limit_req_zone');
    expect(readConf('tls.conf.disabled')).not.toContain('limit_req_zone');
  });
});
