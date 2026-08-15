# Clean Water — ilovaning marshrutlari (§4.1).
#
# Bu faylni HTTP (`default.conf`) va TLS (`tls.conf`) server bloklarining
# ikkalasi ham `include` qiladi. Nusxalash ikki xil rate-limit ga olib kelardi:
# bir faylda tuzatilgan cheklov ikkinchisida eskiligicha qolardi.
#
# XAVFSIZLIK SARLAVHALARI BU YERDA YO'Q — ularni ilovaning o'zi beradi
# (`src/lib/security-headers.ts`, `next.config.ts`). nginx ularni takrorlasa,
# javobda ikkita FARQLI CSP paydo bo'lishi mumkin va brauzer ikkalasini ham
# qo'llaydi: nginx dagi eskirgan siyosat ilovaning yangi ruxsatlarini
# jimgina bloklardi. Yagona istisno — `/media/`, u ilovadan o'tmaydi.

# ── Yuklangan media: diskdan to'g'ridan-to'g'ri (§4.1) ────────────────────────
location /media/ {
    alias /var/app/media/;
    access_log off;
    expires 30d;

    # Bu yo'l ilovadan o'tmaydi, shuning uchun sarlavhalarni nginx beradi va
    # ular qat'iyroq: papkaga qandaydir yo'l bilan HTML tushsa, u to'liq
    # huquqli sahifa sifatida ochilardi. `sandbox` skript, forma va
    # navigatsiyani butunlay o'chiradi.
    add_header Cache-Control "public, immutable" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'none'; sandbox; base-uri 'none'; form-action 'none'" always;
}

# ── Ariza formasi: qattiq rate-limit (§4.5, §6) ──────────────────────────────
location /api/leads {
    limit_req zone=leads burst=3 nodelay;
    proxy_pass http://web_upstream;
    include /etc/nginx/conf.d/proxy_params.inc;
}

# ── Telegram bot webhooki → worker (§4.6) ────────────────────────────────────
# Manzil ochiq internetda turadi; yagona himoya —
# `X-Telegram-Bot-Api-Secret-Token`, u worker da tekshiriladi.
# rate-limit Telegram ning o'z tezligiga mos: bir mijoz emas, butun bot.
location /telegram/webhook {
    limit_req zone=general burst=60 nodelay;
    proxy_pass http://worker_upstream;
    include /etc/nginx/conf.d/proxy_params.inc;
}

location / {
    limit_req zone=general burst=120 nodelay;
    proxy_pass http://web_upstream;
    include /etc/nginx/conf.d/proxy_params.inc;
}
