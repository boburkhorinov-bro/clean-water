# `web` konteyneri — Next.js (§4.1).
# next.config.ts da `output: 'standalone'`, shuning uchun runner bosqichi
# node_modules ni to'liq ko'chirmaydi.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` ulanmaydi, lekin prisma.config.ts o'zgaruvchini talab qiladi.
# Haqiqiy URL ish vaqtida beriladi.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1

# `NEXT_PUBLIC_*` QURISH paytida kodga muhrlanadi (§4.7). Uni faqat
# docker-compose dagi `environment:` da berish yetarli emas — obraz o'shanda
# allaqachon qurilgan bo'ladi va canonical, hreflang, robots.txt, sitemap.xml
# ichida `http://localhost:3000` qolib ketadi. Ilova ko'tariladi, sahifalar 200
# qaytaradi, buzilish esa faqat qidiruv indeksida ko'rinadi.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# Bu yerda to'xtash — yagona imkoniyat: ish vaqtidagi tekshiruv
# (instrumentation.ts) muhrlangan qiymatni emas, `environment:` dagisini ko'radi
# va noto'g'ri obrazni o'tkazib yuboradi.
RUN case "$NEXT_PUBLIC_SITE_URL" in \
      https://*) ;; \
      *) echo "XATO: NEXT_PUBLIC_SITE_URL build vaqtida https:// manzil bo'lishi shart." >&2; \
         echo "  --build-arg NEXT_PUBLIC_SITE_URL=https://<domen> bering," >&2; \
         echo "  yoki .env da NEXT_PUBLIC_SITE_URL ni to'ldiring (docker compose o'zi uzatadi)." >&2; \
         exit 1 ;; \
    esac

RUN npx prisma generate && npm run build

# Migratsiyalar va seed uchun bosqich.
#
# Nega alohida: pastdagi `runner` faqat `.next/standalone` ni oladi va u
# yerda `prisma` CLI ham, `prisma/migrations/` ham, `prisma.config.ts` ham
# YO'Q — obraz ataylab kichik. `builder` da esa to'liq `node_modules`
# (prisma CLI va `tsx`) va butun manba daraxti bor, ya'ni qo'shimcha
# yuklab olishsiz ishlaydi.
#
# Bu obraz doimiy ishlamaydi: `docker-compose.yml` dagi `migrate` xizmati
# uni bir marta ishga tushiradi va `web` uning tugashini kutadi.
FROM builder AS migrator
ENV NODE_ENV=production
# `DATABASE_URL` ish vaqtida beriladi (builder dagi qiymat qurish uchun edi).
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
