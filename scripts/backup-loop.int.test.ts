import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * Zaxira jadvali (§7) — `backup` konteynerining kirish nuqtasi.
 *
 * cron demoni o'rniga oddiy tsikl ishlatiladi: crond bola jarayonga
 * konteyner muhitini to'liq bermaydi va `DATABASE_URL` yo'qolib qolardi —
 * bu esa faqat birinchi tiklash kerak bo'lgan kuni ma'lum bo'lardi.
 *
 * Tsikl bir qadamini alohida ishga tushirish mumkin (`BACKUP_ONCE=1`),
 * shu tufayli jadval mantig'i sinovdan o'tadi.
 */

const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const backupDir = join(tmpdir(), `cw-loop-test-${process.pid}`);
const PG_BIN = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/17/bin';

function runOnce(env: Record<string, string> = {}): string {
  return execFileSync('sh', [join(scriptsDir, 'backup-loop.sh')], {
    encoding: 'utf8',
    env: { ...process.env, PG_BIN, BACKUP_DIR: backupDir, BACKUP_ONCE: '1', ...env },
  });
}

function dumps(): string[] {
  return existsSync(backupDir) ? readdirSync(backupDir).filter((f) => f.endsWith('.dump')) : [];
}

/** Konteyner soatiga mos keladigan «hozir» qiymati. */
function currentHour(): string {
  return String(new Date().getHours()).padStart(2, '0');
}

function otherHour(): string {
  return String((new Date().getHours() + 3) % 24).padStart(2, '0');
}

beforeEach(async () => {
  await resetDatabase();
  rmSync(backupDir, { recursive: true, force: true });
  mkdirSync(backupDir, { recursive: true });
});

afterAll(async () => {
  rmSync(backupDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('backup-loop.sh', () => {
  test('belgilangan soatda zaxira oladi', () => {
    runOnce({ BACKUP_HOUR: currentHour() });

    expect(dumps()).toHaveLength(1);
  });

  test('boshqa soatda hech narsa qilmaydi', () => {
    runOnce({ BACKUP_HOUR: otherHour() });

    expect(dumps()).toHaveLength(0);
  });

  test('bir kunda ikkinchi marta zaxira olmaydi', () => {
    // Konteyner qayta ishga tushsa yoki tsikl soat ichida ikki marta
    // uyg'onsa, kun davomida zaxira takrorlanib joyni to'ldirardi.
    runOnce({ BACKUP_HOUR: currentHour() });
    runOnce({ BACKUP_HOUR: currentHour() });

    expect(dumps()).toHaveLength(1);
  });

  test('zaxiradan keyin tiklash tekshiriladi', () => {
    // Tekshirilmagan zaxira — zaxira emas. Tekshiruv avtomatik bo'lishi
    // kerak: qo'lda bajariladigan qadam birinchi band haftada unutiladi.
    const output = runOnce({ BACKUP_HOUR: currentHour() });

    expect(output).toContain('[verify]');
    expect(output).toMatch(/tekshiruv muvaffaqiyatli/);
  });

  test('tekshiruvni o‘chirib qo‘yish mumkin', () => {
    // Katta bazada har kunlik tiklash qimmat bo'lishi mumkin.
    const output = runOnce({ BACKUP_HOUR: currentHour(), VERIFY_RESTORE: '0' });

    expect(output).not.toContain('[verify]');
    expect(dumps()).toHaveLength(1);
  });

  test('zaxira yiqilsa xato kodi bilan tugaydi', () => {
    // `restart: unless-stopped` bilan bu konteynerni qayta ko'taradi va
    // nosozlik `docker compose ps` da ko'rinadi.
    expect(() =>
      runOnce({
        BACKUP_HOUR: currentHour(),
        DATABASE_URL: 'postgresql://cleanwater:cleanwater@127.0.0.1:5432/yoq_bunday_baza',
      }),
    ).toThrow();
  });
});
