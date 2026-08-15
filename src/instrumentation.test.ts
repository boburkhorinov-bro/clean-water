import { afterEach, describe, expect, test } from 'vitest';
import { register } from './instrumentation';
import { EnvError } from './server/env';

/**
 * Startdagi env tekshiruvi haqiqatan ham ulanganini tasdiqlaydi (§6).
 * Tekshiruv yozilib, chaqirilmay qolsa hech narsani himoya qilmaydi.
 */

// `process.env` obyektini butunlay almashtirish mumkin emas: Node uni maxsus
// proksi sifatida saqlaydi va nusxa bilan almashtirilganda o'zgarishlar
// jarayonga yetib bormaydi.
const saved = {
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  DATABASE_URL: process.env.DATABASE_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('instrumentation.register', () => {
  test('Node runtime da sozlama tekshiriladi', () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    delete process.env.DATABASE_URL;

    expect(() => register()).toThrow(EnvError);
  });

  test('Edge runtime da tekshirilmaydi — u Node API siga ega emas', () => {
    process.env.NEXT_RUNTIME = 'edge';
    delete process.env.DATABASE_URL;

    expect(() => register()).not.toThrow();
  });

  test('to‘g‘ri sozlamada jim o‘tadi', () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5432/db?schema=public';

    expect(() => register()).not.toThrow();
  });
});
