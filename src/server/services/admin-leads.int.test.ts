import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { LeadStatusError, changeLeadStatus, listLeadsForAdmin } from './admin-leads';

/**
 * Admin panel: arizalar bilan ishlash (§4.5, 6-qadam).
 *
 * «Menejer statusni admin panelda yuritadi: `new → in_work → done |
 * rejected`.» Oqim qat'iy: ishga olinmagan ariza «bajarildi» bo'la olmaydi,
 * aks holda statistika yolg'on bo'ladi va menejerning ishi ko'rinmay qoladi.
 *
 * Orqaga qaytish esa cheklangan holda ruxsat etiladi — menejer tugmani xato
 * bosishi odatiy hol va uni tuzatib bo'lmasa, ariza abadiy noto'g'ri holatda
 * qolardi. Bajarilgan ishdan qaytish yo'q: u haqiqatda sodir bo'lgan.
 */
describe('admin: arizalar', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createAdmin() {
    return prisma.user.create({ data: { telegramId: 111000111n, name: 'Admin', role: 'ADMIN' } });
  }

  let seq = 0;
  beforeEach(() => {
    seq = 0;
  });

  async function createLead(status: 'NEW' | 'IN_WORK' | 'DONE' | 'REJECTED' = 'NEW') {
    seq += 1;
    const user = await prisma.user.create({
      data: { phone: `+99890111111${seq}`, name: `Mijoz ${seq}` },
    });
    return prisma.lead.create({
      data: {
        userId: user.id,
        phone: user.phone ?? '',
        name: user.name,
        source: 'WEB',
        status,
      },
    });
  }

  describe('changeLeadStatus', () => {
    test('NEW → IN_WORK', async () => {
      const admin = await createAdmin();
      const lead = await createLead('NEW');

      const updated = await changeLeadStatus(lead.id, 'IN_WORK', admin.id);

      expect(updated.status).toBe('IN_WORK');
    });

    test('IN_WORK → DONE', async () => {
      const admin = await createAdmin();
      const lead = await createLead('IN_WORK');

      expect((await changeLeadStatus(lead.id, 'DONE', admin.id)).status).toBe('DONE');
    });

    test('IN_WORK → REJECTED', async () => {
      const admin = await createAdmin();
      const lead = await createLead('IN_WORK');

      expect((await changeLeadStatus(lead.id, 'REJECTED', admin.id)).status).toBe('REJECTED');
    });

    test('NEW → REJECTED — ariza darhol rad etilishi mumkin', async () => {
      const admin = await createAdmin();
      const lead = await createLead('NEW');

      expect((await changeLeadStatus(lead.id, 'REJECTED', admin.id)).status).toBe('REJECTED');
    });

    test('NEW → DONE RAD ETILADI: ishga olinmagan ariza bajarilgan bo‘la olmaydi', async () => {
      const admin = await createAdmin();
      const lead = await createLead('NEW');

      await expect(changeLeadStatus(lead.id, 'DONE', admin.id)).rejects.toThrow(LeadStatusError);

      const stored = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(stored.status).toBe('NEW');
    });

    test('BAJARILGAN ARIZADAN chiqish yo‘q — ish haqiqatda sodir bo‘lgan', async () => {
      const admin = await createAdmin();
      const lead = await createLead('DONE');

      for (const target of ['NEW', 'IN_WORK', 'REJECTED'] as const) {
        await expect(changeLeadStatus(lead.id, target, admin.id)).rejects.toThrow(LeadStatusError);
      }
    });

    test('XATONI TUZATISH: rad etilgan ariza qaytariladi', async () => {
      const admin = await createAdmin();
      const lead = await createLead('REJECTED');

      expect((await changeLeadStatus(lead.id, 'NEW', admin.id)).status).toBe('NEW');
    });

    test('XATONI TUZATISH: ishga olingan ariza yangiga qaytariladi', async () => {
      const admin = await createAdmin();
      const lead = await createLead('IN_WORK');

      expect((await changeLeadStatus(lead.id, 'NEW', admin.id)).status).toBe('NEW');
    });

    test('bir xil statusga o‘tkazish rad etiladi — jurnalda ma‘nosiz yozuv qoldirardi', async () => {
      const admin = await createAdmin();
      const lead = await createLead('NEW');

      await expect(changeLeadStatus(lead.id, 'NEW', admin.id)).rejects.toThrow(LeadStatusError);
    });

    test('mavjud bo‘lmagan ariza rad etiladi', async () => {
      const admin = await createAdmin();

      await expect(
        changeLeadStatus('00000000-0000-0000-0000-000000000000', 'IN_WORK', admin.id),
      ).rejects.toThrow(LeadStatusError);
    });

    test('AUDIT: eski va yangi status jurnalga tushadi', async () => {
      const admin = await createAdmin();
      const lead = await createLead('NEW');

      await changeLeadStatus(lead.id, 'IN_WORK', admin.id);

      const log = await prisma.auditLog.findFirstOrThrow();
      expect(log.adminId).toBe(admin.id);
      expect(log.action).toBe('lead.status');
      expect(log.entity).toBe(`Lead:${lead.id}`);
      expect(log.payload).toMatchObject({ from: 'NEW', to: 'IN_WORK' });
    });

    test('menejer izohi jurnalga tushadi', async () => {
      const admin = await createAdmin();
      const lead = await createLead('NEW');

      await changeLeadStatus(lead.id, 'REJECTED', admin.id, 'Mijoz javob bermadi');

      const log = await prisma.auditLog.findFirstOrThrow();
      expect(log.payload).toMatchObject({ note: 'Mijoz javob bermadi' });
    });

    test('ATOMARLIK: rad etilgan o‘tish jurnalga ham tushmaydi', async () => {
      const admin = await createAdmin();
      const lead = await createLead('NEW');

      await expect(changeLeadStatus(lead.id, 'DONE', admin.id)).rejects.toThrow(LeadStatusError);

      expect(await prisma.auditLog.count()).toBe(0);
    });
  });

  describe('listLeadsForAdmin', () => {
    test('bo‘sh bazada bo‘sh ro‘yxat', async () => {
      const result = await listLeadsForAdmin({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('YANGI ARIZALAR BIRINCHI — menejer ular bilan ishlaydi', async () => {
      const first = await createLead('NEW');
      const second = await createLead('NEW');

      const result = await listLeadsForAdmin({});

      expect(result.items.map((l) => l.id)).toEqual([second.id, first.id]);
    });

    test('status bo‘yicha filtrlanadi', async () => {
      await createLead('NEW');
      const inWork = await createLead('IN_WORK');

      const result = await listLeadsForAdmin({ status: 'IN_WORK' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(inWork.id);
    });

    test('telefon bo‘yicha qidiriladi — raqam qanday yozilganidan qat‘i nazar', async () => {
      const lead = await createLead('NEW');
      await createLead('NEW');

      const result = await listLeadsForAdmin({ query: lead.phone.slice(-7) });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(lead.id);
    });

    test('ism bo‘yicha ham qidiriladi', async () => {
      await createLead('NEW');

      const result = await listLeadsForAdmin({ query: 'mijoz 1' });

      expect(result.items).toHaveLength(1);
    });

    test('ro‘yxatda mahsulot nomi ko‘rinadi — menejer nima haqida ekanini bilishi kerak', async () => {
      const product = await prisma.product.create({
        data: { kind: 'FILTER', slug: 'osmos-5', nameUz: 'Osmos 5', nameRu: 'Осмос 5', price: '1' },
      });
      const lead = await createLead('NEW');
      await prisma.lead.update({ where: { id: lead.id }, data: { productId: product.id } });

      const result = await listLeadsForAdmin({});

      expect(result.items[0]?.productName).toBe('Osmos 5');
    });

    test('mahsulotsiz ariza ham ro‘yxatda bo‘ladi', async () => {
      await createLead('NEW');

      const result = await listLeadsForAdmin({});

      expect(result.items[0]?.productName).toBeNull();
    });

    test('sahifalash ishlaydi', async () => {
      for (let i = 0; i < 5; i += 1) await createLead('NEW');

      const page = await listLeadsForAdmin({ limit: 2, offset: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.total).toBe(5);
    });
  });
});
