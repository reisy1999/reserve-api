import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { ReservationSlotDepartment } from '../../src/reservations/entities/reservation-slot-department.entity';
import {
  adminHeaders,
  buildCsv,
  closeTestApp,
  initTestApp,
  resetDatabase,
  seedBaselineData,
} from './support/test-helpers';

describe('二段階登録と本人完了フローを検証する', () => {
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

  async function createReservationType(): Promise<number> {
    const res = await request(httpServer)
      .post('/api/admin/reservation-types')
      .set(adminHeaders('profile-rt-1'))
      .send({
        name: 'インフルエンザ予防接種',
        description: '年度1回制',
        active: true,
      })
      .expect(201);
    return res.body?.id ?? 1;
  }

  async function createPublishedSlot(
    reservationTypeId: number,
    overrides: Record<string, unknown> = {},
  ): Promise<number> {
    const baseSlot = {
      reservationTypeId,
      serviceDateLocal: '2025-04-10',
      startMinuteOfDay: 540,
      durationMinutes: 30,
      capacity: 1,
      status: 'published',
      bookingStart: '2025-03-01T00:00:00+09:00',
      bookingEnd: null,
    };

    const res = await request(httpServer)
      .post('/api/admin/slots/bulk')
      .set(adminHeaders(`profile-slot-${Math.random()}`))
      .send({
        slots: [{ ...baseSlot, ...overrides }],
      })
      .expect(201);
    const slotId = res.body?.slots?.[0]?.id ?? res.body?.[0]?.id ?? 1;
    await dataSource.getRepository(ReservationSlotDepartment).save({
      slotId,
      departmentId: 'IM',
      enabled: true,
      capacityOverride: null,
    });
    return slotId;
  }

  async function importStaff(
    staffId: string,
    name = '初回 登録',
  ): Promise<void> {
    const csv = buildCsv([
      ['名前(漢字)', '本部ID', '部署', '職種'],
      [name, staffId, 'IM', '事務職'],
    ]);

    await request(httpServer)
      .post('/api/admin/staffs/import?dryRun=false')
      .set(adminHeaders(`profile-import-${staffId}`))
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);
  }

  async function login(staffId: string, pin: string) {
    return request(httpServer).post('/api/auth/login').send({ staffId, pin });
  }

  it('プロフィール未完了の職員は予約APIで428を受けるが完了後は成功する', async () => {
    await importStaff('901000', '二段階 太郎');
    const reservationTypeId = await createReservationType();
    const slotId = await createPublishedSlot(reservationTypeId);

    const loginRes = await login('901000', '0000');
    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body.accessToken as string;

    // Health check: verify token works
    const healthCheck = await request(httpServer)
      .get('/api/staffs/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(healthCheck.status).toBe(200);

    const reservationBefore = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ slotId });
    expect(reservationBefore.status).toBe(428);

    const profileRes = await request(httpServer)
      .patch('/api/staffs/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        version: 0,
        currentPin: '0000',
        emrPatientId: '777001',
        dateOfBirth: '1985-05-05',
        sexCode: '1',
        familyNameKana: 'ニダンカイ',
        givenNameKana: 'タロウ',
      });
    expect(profileRes.status).toBe(200);
    expect(profileRes.body).toEqual(
      expect.objectContaining({
        pinMustChange: true,
        emrPatientId: '777001',
        version: expect.any(Number),
      }),
    );

    await request(httpServer)
      .post('/api/staffs/me/pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPin: '0000', newPin: '1234' })
      .expect(204);

    const relogin = await login('901000', '1234');
    expect(relogin.status).toBe(200);
    const newAccessToken = relogin.body.accessToken;

    const reservationAfter = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .send({ slotId });
    expect(reservationAfter.status).toBe(201);
  });

  it('楽観ロックversionが不一致なら409を返す', async () => {
    await importStaff('901001', '楽観 花子');
    await createReservationType();

    const loginRes = await login('901001', '0000');
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.accessToken;

    // Health check: verify token works
    const healthCheck = await request(httpServer)
      .get('/api/staffs/me')
      .set('Authorization', `Bearer ${token}`);
    expect(healthCheck.status).toBe(200);

    await request(httpServer)
      .patch('/api/staffs/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: 0,
        currentPin: '0000',
        emrPatientId: '777002',
        dateOfBirth: '1990-01-01',
        sexCode: '2',
      })
      .expect(200);

    const conflictRes = await request(httpServer)
      .patch('/api/staffs/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: 0,
        currentPin: '0000',
        jobTitle: '変更テスト',
      });
    expect(conflictRes.status).toBe(409);
  });

  it('センシティブ項目の更新には現PINの再入力が要求される', async () => {
    await importStaff('901002', '再認証 三郎');
    await createReservationType();

    const loginRes = await login('901002', '0000');
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.accessToken;

    // Health check: verify token works
    const healthCheck = await request(httpServer)
      .get('/api/staffs/me')
      .set('Authorization', `Bearer ${token}`);
    expect(healthCheck.status).toBe(200);

    const missingPinRes = await request(httpServer)
      .patch('/api/staffs/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: 0,
        emrPatientId: '777003',
        dateOfBirth: '1975-12-24',
        sexCode: '1',
      });
    expect(missingPinRes.status).toBe(428);
  });
});
