import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  adminHeaders,
  buildCsv,
  closeTestApp,
  initTestApp,
  resetDatabase,
  seedBaselineData,
} from './support/test-helpers';

describe('予約APIの制約とトランザクションを確認する', () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;

  beforeAll(async () => {
    const ctx = await initTestApp();
    app = ctx.app;
    httpServer = ctx.httpServer;
    dataSource = ctx.dataSource;
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await seedBaselineData(dataSource);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  async function adminImport(staffId: string, name: string): Promise<void> {
    const csv = buildCsv([
      ['名前(漢字)', '本部ID', '部署', '職種'],
      [name, staffId, 'VAC', '看護師'],
    ]);

    await request(httpServer)
      .post('/api/admin/staffs/import?dryRun=false')
      .set(adminHeaders(`reserve-import-${staffId}`))
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);
  }

  async function createTypeAndSlot(
    slotOverrides: Record<string, unknown> = {},
    reuseReservationTypeId?: number,
  ) {
    let reservationTypeId = reuseReservationTypeId;
    if (!reservationTypeId) {
      const typeRes = await request(httpServer)
        .post('/api/admin/reservation-types')
        .set(adminHeaders(`reserve-type-${Math.random()}`))
        .send({ name: '健診', active: true })
        .expect(201);
      reservationTypeId = typeRes.body?.id ?? 1;
    }

    const slotRes = await request(httpServer)
      .post('/api/admin/slots/bulk')
      .set(adminHeaders(`reserve-slot-${Math.random()}`))
      .send({
        slots: [
          {
            reservationTypeId,
            serviceDateLocal: '2025-04-15',
            startMinuteOfDay: 600,
            durationMinutes: 30,
            capacity: 1,
            status: 'published',
            bookingStart: '2025-01-01T00:00:00+09:00',
            bookingEnd: null,
            ...slotOverrides,
          },
        ],
      })
      .expect(201);

    const slotId = slotRes.body?.slots?.[0]?.id ?? slotRes.body?.[0]?.id ?? 1;
    return { reservationTypeId: reservationTypeId ?? 1, slotId };
  }

  async function completeProfile(
    staffId: string,
    accessToken: string,
    emrPatientId: string,
  ) {
    // Health check: verify token works before profile update
    await request(httpServer)
      .get('/api/staffs/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(httpServer)
      .patch('/api/staffs/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: 0,
        currentPin: '0000',
        emrPatientId,
        dateOfBirth: '1980-04-02',
        sexCode: '1',
      })
      .expect(200);

    await request(httpServer)
      .post('/api/staffs/me/pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPin: '0000', newPin: '2468' })
      .expect(204);

    const relogin = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId, pin: '2468' })
      .expect(200);

    const newToken = relogin.body.accessToken as string;

    // Health check: verify new token works after PIN change
    await request(httpServer)
      .get('/api/staffs/me')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);

    return newToken;
  }

  it('予約は公開状態かつ受付期間内でなければ403となる', async () => {
    await adminImport('902000', '枠制約 太郎');
    const loginRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '902000', pin: '0000' })
      .expect(200);

    const accessToken = await completeProfile(
      '902000',
      loginRes.body.accessToken,
      '888000',
    );

    // Create slot with booking period in the future (not yet open)
    const futureSlot = await createTypeAndSlot({
      serviceDateLocal: '2025-12-01',
      bookingStart: '2025-12-01T09:00:00+09:00',
    });

    const forbiddenRes = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ slotId: futureSlot.slotId });
    expect(forbiddenRes.status).toBe(403);
  });

  it('同一年度同一種別は1回のみ予約可能', async () => {
    await adminImport('902001', '年度制 花子');
    const typeAndSlot = await createTypeAndSlot({
      serviceDateLocal: '2025-06-01',
    });
    const anotherSlot = await createTypeAndSlot(
      {
        serviceDateLocal: '2025-07-01',
      },
      typeAndSlot.reservationTypeId,
    );

    const loginRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '902001', pin: '0000' })
      .expect(200);

    const accessToken = await completeProfile(
      '902001',
      loginRes.body.accessToken,
      '888001',
    );

    await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ slotId: typeAndSlot.slotId })
      .expect(201);

    const secondRes = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ slotId: anotherSlot.slotId });
    expect(secondRes.status).toBe(409);
    expect(secondRes.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('fiscal year'),
      }),
    );
  });

  it('枠の定員や重複予約を越えると409になる', async () => {
    await adminImport('902002', '重複 一郎');
    await adminImport('902003', '重複 二郎');
    const { reservationTypeId, slotId } = await createTypeAndSlot({
      capacity: 1,
    });

    const loginA = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '902002', pin: '0000' })
      .expect(200);
    const tokenA = await completeProfile(
      '902002',
      loginA.body.accessToken,
      '888002',
    );

    const loginB = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '902003', pin: '0000' })
      .expect(200);
    const tokenB = await completeProfile(
      '902003',
      loginB.body.accessToken,
      '888003',
    );

    await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ slotId })
      .expect(201);

    const doubleBooking = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ slotId });
    expect(doubleBooking.status).toBe(409);

    const capacityExceeded = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ slotId });
    expect(capacityExceeded.status).toBe(409);
    expect(capacityExceeded.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('capacity'),
      }),
    );

    // 年度が変われば予約できることを示す（FY2026枠）
    const futureSlot = await createTypeAndSlot(
      {
        serviceDateLocal: '2026-04-02',
      },
      reservationTypeId,
    );
    const nextYearRes = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ slotId: futureSlot.slotId })
      .expect(201);

    expect(nextYearRes.body).toEqual(
      expect.objectContaining({ slotId: futureSlot.slotId }),
    );
  });
});
