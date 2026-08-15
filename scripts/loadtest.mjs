#!/usr/bin/env node
/**
 * Yuklama tekshiruvi (§7: «relizga tayyorlik»).
 *
 * Tashqi kutubxona ishlatilmaydi (autocannon, k6): ular bu loyihaga faqat
 * shu maqsad uchun kirardi va bir mashinada 3.8 GB xotira bilan har bir
 * qo'shimcha paket qimmatga tushadi. Node ning o'z `fetch` i yetarli —
 * bizga ming emas, o'nlab parallel so'rov kerak.
 *
 * Ishlatish:
 *   node scripts/loadtest.mjs http://localhost:3000/uz --concurrency 10 --duration 15
 *   node scripts/loadtest.mjs http://localhost:3000/uz/filtrlar -c 20 -d 30
 */

/** Tartiblanmagan o'lchovlardan protsentil. */
export function percentile(samples, p) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  // «Eng yaqin daraja» usuli: p95 uchun ro'yxatning 95% i shu qiymatdan
  // kichik yoki teng bo'ladi.
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

export function summarize(results, elapsedMs) {
  const statuses = {};
  let ok = 0;
  let failed = 0;
  const latencies = [];

  for (const result of results) {
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;

    // 4xx/5xx va tarmoq uzilishi (status 0) muvaffaqiyat emas. Ularni
    // umumiy o'rtachaga qo'shish yiqilgan serverni «tez» ko'rsatardi.
    if (result.status >= 200 && result.status < 400) {
      ok += 1;
      latencies.push(result.ms);
    } else {
      failed += 1;
      if (result.status !== 0) latencies.push(result.ms);
    }
  }

  return {
    total: results.length,
    ok,
    failed,
    statuses,
    rps: results.length / (elapsedMs / 1000),
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies.length > 0 ? Math.max(...latencies) : 0,
  };
}

async function hit(url) {
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: 'manual' });
    // Tanani oxirigacha o'qiymiz: aks holda o'lchov faqat sarlavhalar
    // kelgan paytni ko'rsatadi va HTML render vaqti hisobga olinmaydi.
    await response.arrayBuffer();
    return { status: response.status, ms: performance.now() - started };
  } catch {
    return { status: 0, ms: performance.now() - started };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => a.startsWith('http'));
  if (!url) {
    console.error('Foydalanish: node scripts/loadtest.mjs <url> [-c N] [-d SONIYA]');
    process.exit(2);
  }

  const flag = (long, short, fallback) => {
    const index = args.findIndex((a) => a === long || a === short);
    return index === -1 ? fallback : Number(args[index + 1]);
  };

  const concurrency = flag('--concurrency', '-c', 10);
  const durationMs = flag('--duration', '-d', 15) * 1000;

  console.log(`[loadtest] ${url}`);
  console.log(`[loadtest] parallel: ${concurrency}, davomiylik: ${durationMs / 1000} s`);

  const results = [];
  const deadline = performance.now() + durationMs;
  const started = performance.now();

  // Har bir «ishchi» ketma-ket so'rov yuboradi: shu bilan parallellik
  // darajasi aniq ushlab turiladi (barcha so'rovlarni birdan otish
  // serverni emas, mijozni sinovdan o'tkazardi).
  const workers = Array.from({ length: concurrency }, async () => {
    while (performance.now() < deadline) {
      results.push(await hit(url));
    }
  });

  await Promise.all(workers);
  const elapsed = performance.now() - started;
  const summary = summarize(results, elapsed);

  console.log('');
  console.log(
    `  so‘rovlar:    ${summary.total} (muvaffaqiyatli ${summary.ok}, xato ${summary.failed})`,
  );
  console.log(`  RPS:          ${summary.rps.toFixed(1)}`);
  console.log(`  kechikish p50: ${summary.p50.toFixed(0)} ms`);
  console.log(`  kechikish p95: ${summary.p95.toFixed(0)} ms`);
  console.log(`  kechikish p99: ${summary.p99.toFixed(0)} ms`);
  console.log(`  eng sekin:     ${summary.max.toFixed(0)} ms`);
  console.log(`  status kodlari: ${JSON.stringify(summary.statuses)}`);

  // Xato bo'lsa chiqish kodi ham xato: skript CI da yoki deploy oldidan
  // avtomatik tekshiruv sifatida ishlatilishi mumkin.
  if (summary.failed > 0 && summary.ok === 0) process.exit(1);
}

// Test import qilganda `main` ishga tushmasligi kerak.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  await main();
}
