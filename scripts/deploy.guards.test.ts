import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';

/**
 * `scripts/deploy.sh` ning `.env` qo'riqchilari — HAQIQATAN ishga tushiriladi.
 *
 * Nega matn tekshiruvi yetarli emas: skript serverda BIR MARTA, ishonch talab
 * qiladigan paytda ishlaydi va bu mashinada uni to'liq sinab ko'rib bo'lmaydi
 * (Docker ko'tarilmaydi). Lekin birinchi ikkita bosqichni — muhit va `.env`
 * tekshiruvini — sinash MUMKIN: ular Docker ni faqat mavjudligi uchun
 * so'raydi. `PATH` ga soxta `docker` qo'yiladi va skript o'z qo'riqchilariga
 * yetib boradi.
 *
 * Tekshirilayotgan xatolar ikkalasi ham deployni oxirigacha olib boradi va
 * faqat ilova bazaga ulanmoqchi bo'lganda ko'rinadi — ya'ni obrazlar qurilib,
 * sertifikat olinganidan keyin. Bir necha o'n daqiqa.
 */

const scriptPath = fileURLToPath(new URL('deploy.sh', import.meta.url));
const workDir = join(tmpdir(), `cw-deploy-guards-${process.pid}`);
const fakeBin = join(workDir, 'bin');

/** Skript `docker` dan faqat mavjudligini va `info` ning muvaffaqiyatini so'raydi. */
function installFakeDocker(): void {
  mkdirSync(fakeBin, { recursive: true });
  const script = '#!/bin/sh\nexit 0\n';
  for (const name of ['docker', 'docker.exe']) {
    const file = join(fakeBin, name);
    writeFileSync(file, script);
    chmodSync(file, 0o755);
  }
}

function runDeploy(env: Record<string, string>): { code: number | null; output: string } {
  const lines = Object.entries(env).map(([key, value]) => `${key}="${value}"`);
  writeFileSync(join(workDir, '.env'), `${lines.join('\n')}\n`);

  const result = spawnSync('sh', [scriptPath], {
    cwd: workDir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ''}` },
  });

  return { code: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const VALID = {
  NEXT_PUBLIC_SITE_URL: 'https://cleanwater.duckdns.org',
  DATABASE_URL: 'postgresql://cleanwater:parol123@postgres:5432/cleanwater?schema=public',
  POSTGRES_PASSWORD: 'parol123',
};

beforeEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  // Skript loyiha ildizidan ishga tushirilganini shu fayl bo'yicha aniqlaydi.
  writeFileSync(join(workDir, 'docker-compose.yml'), 'services: {}\n');
  installFakeDocker();
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('deploy.sh — `.env` qo‘riqchilari', () => {
  test('`localhost` ga qaraydigan DATABASE_URL to‘xtatadi', () => {
    // `env.example` dagi namuna qiymat aynan shunday — u LOKAL ishlab
    // chiqish uchun. Konteyner ichida `localhost` konteynerning o'zi
    // bo'ladi va baza topilmaydi.
    const { code, output } = runDeploy({
      ...VALID,
      DATABASE_URL: 'postgresql://cleanwater:parol123@localhost:5432/cleanwater?schema=public',
    });

    expect(code).not.toBe(0);
    expect(output).toContain('localhost');
    // Xabar nima qilish kerakligini aytadi, muammoni sanab qo'ymaydi.
    expect(output).toContain('postgres:5432');
  });

  test('`127.0.0.1` ham to‘xtatadi', () => {
    const { code, output } = runDeploy({
      ...VALID,
      DATABASE_URL: 'postgresql://cleanwater:parol123@127.0.0.1:5432/cleanwater?schema=public',
    });

    expect(code).not.toBe(0);
    expect(output).toContain('DATABASE_URL');
  });

  test('parollar ajralib qolsa to‘xtatadi', () => {
    // `POSTGRES_PASSWORD` bazani YARATADI, `DATABASE_URL` unga ULANADI.
    const { code, output } = runDeploy({ ...VALID, POSTGRES_PASSWORD: 'boshqa-parol' });

    expect(code).not.toBe(0);
    expect(output).toContain('parol');
  });

  test(
    'to‘g‘ri `.env` bilan qo‘riqchilardan o‘tadi',
    () => {
      // Bu yerda deploy baribir to'xtaydi — keyingi qadam DNS ni tekshiradi va
      // sinov domeni hech qayerga qaramaydi. Muhimi: to'xtash SABABI boshqa,
      // ya'ni qo'riqchilar to'g'ri `.env` ni o'tkazib yubordi.
      const { output } = runDeploy(VALID);

      expect(output).not.toContain('DATABASE_URL konteyner ichida ishlamaydi');
      expect(output).not.toContain('parol mos kelmaydi');
      expect(output).toContain('2/8');
    },
    // Yagona test tarmoqqa chiqadi: DNS qadami server IP sini so'raydi
    // (`curl --max-time 10`) va domenni hal qilishga urinadi. Konfigdagi
    // umumiy 5 s bunga yetmaydi.
    60_000,
  );

  test('DATABASE_URL umuman yo‘q bo‘lsa to‘xtatadi', () => {
    const { DATABASE_URL: _unused, ...withoutDb } = VALID;
    const { code, output } = runDeploy(withoutDb);

    expect(code).not.toBe(0);
    expect(output).toContain('DATABASE_URL');
  });

  test('HTTPS bo‘lmagan manzil to‘xtatadi — qiymat obrazga muhrlanadi', () => {
    const { code, output } = runDeploy({ ...VALID, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' });

    expect(code).not.toBe(0);
    expect(output).toContain('https://');
  });
});
