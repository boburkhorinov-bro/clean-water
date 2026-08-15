/**
 * Forma tokenining vaqt chegaralari (§6).
 *
 * Alohida modul, chunki bu qiymatlar ikkala tomonga kerak: server tokenni
 * shu chegaralar bo'yicha tekshiradi, klient esa yangi olingan token bilan
 * darhol yubormaslikni bilishi kerak. `src/server/form-token.ts` ni klientga
 * import qilib bo'lmaydi — u `node:crypto` ga tayanadi.
 */

/** Haqiqiy odam telefon raqamini bundan tezroq yozib ulgurmaydi. */
export const FORM_TOKEN_MIN_AGE_MS = 3_000;

/** Sahifa bir sutkadan uzoq ochiq turgan bo'lsa — yangilash so'raladi. */
export const FORM_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
