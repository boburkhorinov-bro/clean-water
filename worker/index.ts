/**
 * `worker` konteynerining kirish nuqtasi (§4.1).
 *
 * Nega alohida jarayon: veb-jarayon ichidagi rejalashtiruvchi ikkinchi instans
 * ishga tushganda dublikatlanadi (bitta mijozga ikkita eslatma) va har qayta
 * deployda o'ladi. Bot webhooki esa barqaror ishlab turuvchi jarayon talab qiladi.
 *
 * Hozircha skelet: bot handlerlari `worker/bot/`, kunlik rejalashtiruvchi
 * `worker/jobs/` ga qo'shiladi (kritik yo'l 7).
 */

function main() {
  const timeZone = process.env.TZ ?? 'Asia/Tashkent';
  console.log(`[worker] ishga tushdi, vaqt mintaqasi: ${timeZone}`);

  // Konteyner tirik qolishi kerak — rejalashtiruvchi qo'shilgunga qadar.
  process.on('SIGTERM', () => {
    console.log('[worker] SIGTERM, to‘xtatilmoqda');
    process.exit(0);
  });
}

main();
