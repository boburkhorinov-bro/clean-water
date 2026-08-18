import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * Zaxira va tiklash (§7).
 *
 * Bu testlar HAQIQIY `pg_dump` va `pg_restore` ni haqiqiy bazaga qarshi
 * ishlatadi. Boshqacha bo'lishi mumkin emas: yozilgan, lekin hech qachon
 * tiklab ko'rilmagan zaxira — zaxira emas. Aynan tiklash bosqichi buziladi
 * (format mos kelmaydi, huquqlar yetmaydi, jadval tartibi noto'g'ri) va buni
 * ma'lumot yo'qolgan kunda bilib olish juda kech bo'ladi.
 *
 * Testlar `cleanwater_test` bazasida ishlaydi (`src/test/int-setup.ts` buni
 * majburlaydi) — ishlab chiqish ma'lumotiga tegilmaydi.
 */
// Har bir `verify-restore.sh` chaqiruvi to'rtta tashqi jarayon ishga tushiradi
// (`pg_dump`, `CREATE DATABASE`, `pg_restore`, `DROP DATABASE`). Bo'sh
// mashinada bu ~15 s, ya'ni konfigdagi umumiy 30 s limitning yarmi — zaxira
// qolmaydi. To'liq to'plam ketma-ket ishlaganda o'sha test 61 s gacha
// cho'zilgan va YOLG'ON yiqilgan (2026-08-18). Bu yerdagi da'vo tiklash
// TEZLIGI emas, tiklash BO'LISHI haqida, shuning uchun limit muhit
// tebranishini qoplaydigan darajada olinadi.
vi.setConfig({ testTimeout: 120_000 });

const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const backupDir = join(tmpdir(), `cw-backup-test-${process.pid}`);

/**
 * Windows da PostgreSQL binarlari PATH da emas. Docker konteynerida ular
 * PATH da bo'ladi va bu o'zgaruvchi kerak bo'lmaydi.
 */
const PG_BIN = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/17/bin';

function run(script: string, args: string[] = [], env: Record<string, string> = {}) {
  return execFileSync('sh', [join(scriptsDir, script), ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PG_BIN,
      BACKUP_DIR: backupDir,
      ...env,
    },
  });
}

function dumps(): string[] {
  return existsSync(backupDir) ? readdirSync(backupDir).filter((f) => f.endsWith('.dump')) : [];
}

async function seedProduct(slug: string): Promise<void> {
  await prisma.product.create({
    data: {
      slug,
      kind: 'FILTER',
      nameUz: 'Zaxira sinovi',
      nameRu: 'Проверка бэкапа',
      price: 1_000_000,
      isActive: true,
    },
  });
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

describe('backup.sh', () => {
  test('dump fayl yaratadi', async () => {
    await seedProduct('zaxira-1');

    run('backup.sh');

    expect(dumps()).toHaveLength(1);
  });

  test('fayl nomida sana va vaqt bo‘ladi', async () => {
    await seedProduct('zaxira-2');

    run('backup.sh');

    // Bir kunda bir necha zaxira bo'lishi mumkin; nom faqat sanadan iborat
    // bo'lsa, ikkinchisi birinchisini o'chirib yuborardi.
    expect(dumps()[0]).toMatch(/^cleanwater-\d{8}-\d{6}\.dump$/);
  });

  test('eski zaxiralar saqlash muddatidan keyin o‘chiriladi', async () => {
    const old = join(backupDir, 'cleanwater-20200101-000000.dump');
    writeFileSync(old, 'eski');
    const longAgo = Date.now() / 1000 - 40 * 24 * 60 * 60;
    utimesSync(old, longAgo, longAgo);

    run('backup.sh', [], { RETENTION_DAYS: '30' });

    expect(existsSync(old)).toBe(false);
    expect(dumps()).toHaveLength(1);
  });

  test('saqlash muddati ichidagi zaxira tegilmaydi', () => {
    const recent = join(backupDir, 'cleanwater-20260814-120000.dump');
    writeFileSync(recent, 'yangi');

    run('backup.sh', [], { RETENTION_DAYS: '30' });

    expect(existsSync(recent)).toBe(true);
  });

  test('baza yo‘q bo‘lsa xato bilan tugaydi va bo‘sh fayl qoldirmaydi', () => {
    // Yarim yozilgan dump eng xavfli natija: u zaxira ro'yxatida turadi va
    // «zaxira bor» degan yolg'on ishonch beradi.
    expect(() =>
      run('backup.sh', [], {
        DATABASE_URL: 'postgresql://cleanwater:cleanwater@127.0.0.1:5432/yoq_bunday_baza',
      }),
    ).toThrow();

    expect(dumps()).toHaveLength(0);
  });
});

describe('restore.sh', () => {
  test('dump dan ma’lumot qaytadi', async () => {
    await seedProduct('tiklanadigan-mahsulot');
    run('backup.sh');
    const dump = join(backupDir, dumps()[0]!);

    // Falokatni taqlid qilamiz: ma'lumot yo'qoldi.
    await resetDatabase();
    expect(await prisma.product.count()).toBe(0);

    run('restore.sh', [dump, '--yes']);

    const restored = await prisma.product.findMany();
    expect(restored).toHaveLength(1);
    expect(restored[0]!.slug).toBe('tiklanadigan-mahsulot');
  });

  test('tasdiqsiz hech narsa o‘chirmaydi', async () => {
    await seedProduct('himoyalangan');
    run('backup.sh');
    const dump = join(backupDir, dumps()[0]!);

    // Tiklash — buzuvchi amal: u mavjud jadvallarni tashlab yuboradi.
    // Tasodifiy chaqiruv ishlab chiqish bazasini yo'q qilishi mumkin edi.
    expect(() => run('restore.sh', [dump])).toThrow();
    expect(await prisma.product.count()).toBe(1);
  });

  test('mavjud bo‘lmagan fayl bilan xato qaytaradi', () => {
    expect(() => run('restore.sh', [join(backupDir, 'yoq.dump'), '--yes'])).toThrow();
  });
});

describe('verify-restore.sh', () => {
  test('zaxirani vaqtinchalik bazaga tiklab tekshiradi', async () => {
    await seedProduct('tekshiruv');
    run('backup.sh');
    const dump = join(backupDir, dumps()[0]!);

    const output = run('verify-restore.sh', [dump]);

    // Tekshiruv nafaqat «xatosiz o'tdi» deyishi, balki nima topilganini
    // ko'rsatishi kerak: bo'sh dump ham xatosiz tiklanadi.
    expect(output).toMatch(/jadval/i);
    expect(output).toMatch(/products/);
  });

  test('qatorlar soni haqiqiy — statistika emas', async () => {
    // `pg_stat_user_tables` tiklashdan keyin darhol nolni ko'rsatadi:
    // COPY statistikani yangilamaydi, autovacuum esa keyinroq keladi.
    // Nol ko'rsatgan tekshiruv bo'sh zaxirani ham «sog'lom» deb o'tkazardi.
    await seedProduct('sanaladigan');
    run('backup.sh');

    expect(run('verify-restore.sh', [join(backupDir, dumps()[0]!)])).toMatch(/products: 1\b/);
  });

  test('ishchi bazaga tegmaydi', async () => {
    await seedProduct('asl-yozuv');
    run('backup.sh');
    const dump = join(backupDir, dumps()[0]!);

    run('verify-restore.sh', [dump]);

    expect(await prisma.product.count()).toBe(1);
  });

  test('vaqtinchalik bazani o‘zidan keyin o‘chiradi', async () => {
    await seedProduct('vaqtinchalik');
    run('backup.sh');
    const dump = join(backupDir, dumps()[0]!);

    run('verify-restore.sh', [dump]);

    const rows = await prisma.$queryRawUnsafe<{ datname: string }[]>(
      `SELECT datname FROM pg_database WHERE datname LIKE '%restore_check%'`,
    );
    expect(rows).toHaveLength(0);
  });

  test('buzilgan dump tekshiruvdan o‘tmaydi', () => {
    const broken = join(backupDir, 'cleanwater-20260101-000000.dump');
    writeFileSync(broken, 'bu dump emas');

    expect(() => run('verify-restore.sh', [broken])).toThrow();
  });
});
