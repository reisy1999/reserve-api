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

describe('GET /api/reservations/slots - Fetch Available Slots', () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;
  let accessToken: string;

  beforeAll(async () => {
    const ctx = await initTestApp();
    app = ctx.app;
    httpServer = ctx.httpServer;
    dataSource = ctx.dataSource;
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await seedBaselineData(dataSource);

    // Create and login staff
    const csv = buildCsv([
      ['名前(漢字)', '本部ID', '部署', '職種'],
      ['山田太郎', '900100', 'VAC', '看護師'],
    ]);

    await request(httpServer)
      .post('/api/admin/staffs/import?dryRun=false')
      .set(adminHeaders('import-staff-900100'))
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);

    const loginRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '900100', pin: '0000' })
      .expect(200);

    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  async function createReservationType(name: string): Promise<number> {
    const res = await request(httpServer)
      .post('/api/admin/reservation-types')
      .set(adminHeaders(`create-type-${Math.random()}`))
      .send({ name, active: true })
      .expect(201);
    return res.body.id;
  }

  async function createSlot(
    reservationTypeId: number,
    overrides: Record<string, unknown> = {},
  ): Promise<number> {
    const res = await request(httpServer)
      .post('/api/admin/slots/bulk')
      .set(adminHeaders(`create-slot-${Math.random()}`))
      .send({
        slots: [
          {
            reservationTypeId,
            serviceDateLocal: '2025-05-01',
            startMinuteOfDay: 540,
            durationMinutes: 30,
            capacity: 10,
            status: 'published',
            bookingStart: '2025-01-01T00:00:00+09:00',
            bookingEnd: null,
            ...overrides,
          },
        ],
      })
      .expect(201);
    return res.body.slots[0].id;
  }

  async function linkDepartment(slotId: number, departmentId: string) {
    await dataSource.getRepository(ReservationSlotDepartment).save({
      slotId,
      departmentId,
      enabled: true,
      capacityOverride: null,
    });
  }

  it('should require JWT authentication', async () => {
    const reservationTypeId = await createReservationType('健診');
    await request(httpServer)
      .get(`/api/reservations/slots?reservationTypeId=${reservationTypeId}`)
      .expect(401);
  });

  it('should require reservationTypeId parameter', async () => {
    await request(httpServer)
      .get('/api/reservations/slots')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('should return published slots for a reservation type', async () => {
    const reservationTypeId = await createReservationType('予防接種');
    const slotId1 = await createSlot(reservationTypeId, {
      serviceDateLocal: '2025-05-01',
      startMinuteOfDay: 540,
    });
    const slotId2 = await createSlot(reservationTypeId, {
      serviceDateLocal: '2025-05-02',
      startMinuteOfDay: 600,
    });

    const res = await request(httpServer)
      .get(`/api/reservations/slots?reservationTypeId=${reservationTypeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(2);
    expect(res.body[0].id).toBe(slotId1);
    expect(res.body[1].id).toBe(slotId2);
    expect(res.body[0].status).toBe('published');
  });

  it('should not return draft or closed slots by default', async () => {
    const reservationTypeId = await createReservationType('健診');
    await createSlot(reservationTypeId, { status: 'published' });
    await createSlot(reservationTypeId, { status: 'draft' });
    await createSlot(reservationTypeId, { status: 'closed' });

    const res = await request(httpServer)
      .get(`/api/reservations/slots?reservationTypeId=${reservationTypeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('published');
  });

  it('should filter by serviceDateFrom and serviceDateTo', async () => {
    const reservationTypeId = await createReservationType('予防接種');
    await createSlot(reservationTypeId, { serviceDateLocal: '2025-04-30' });
    const slotId2 = await createSlot(reservationTypeId, {
      serviceDateLocal: '2025-05-01',
    });
    const slotId3 = await createSlot(reservationTypeId, {
      serviceDateLocal: '2025-05-15',
    });
    await createSlot(reservationTypeId, { serviceDateLocal: '2025-06-01' });

    const res = await request(httpServer)
      .get(
        `/api/reservations/slots?reservationTypeId=${reservationTypeId}&serviceDateFrom=2025-05-01&serviceDateTo=2025-05-31`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBe(2);
    expect(res.body[0].id).toBe(slotId2);
    expect(res.body[1].id).toBe(slotId3);
  });

  it('should filter by departmentId', async () => {
    const reservationTypeId = await createReservationType('予防接種');
    const slotId1 = await createSlot(reservationTypeId);
    const slotId2 = await createSlot(reservationTypeId);
    await createSlot(reservationTypeId); // No department link

    await linkDepartment(slotId1, 'VAC');
    await linkDepartment(slotId2, 'VAC');

    const res = await request(httpServer)
      .get(
        `/api/reservations/slots?reservationTypeId=${reservationTypeId}&departmentId=VAC`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBe(2);
    expect(res.body[0].id).toBe(slotId1);
    expect(res.body[1].id).toBe(slotId2);
  });

  it('should return empty array when no slots match criteria', async () => {
    const reservationTypeId = await createReservationType('健診');

    const res = await request(httpServer)
      .get(`/api/reservations/slots?reservationTypeId=${reservationTypeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('should order slots by date and time', async () => {
    const reservationTypeId = await createReservationType('予防接種');
    const slotId1 = await createSlot(reservationTypeId, {
      serviceDateLocal: '2025-05-01',
      startMinuteOfDay: 600,
    });
    const slotId2 = await createSlot(reservationTypeId, {
      serviceDateLocal: '2025-05-01',
      startMinuteOfDay: 540,
    });
    const slotId3 = await createSlot(reservationTypeId, {
      serviceDateLocal: '2025-05-02',
      startMinuteOfDay: 540,
    });

    const res = await request(httpServer)
      .get(`/api/reservations/slots?reservationTypeId=${reservationTypeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBe(3);
    expect(res.body[0].id).toBe(slotId2); // 2025-05-01 09:00
    expect(res.body[1].id).toBe(slotId1); // 2025-05-01 10:00
    expect(res.body[2].id).toBe(slotId3); // 2025-05-02 09:00
  });

  it('should allow explicit status filter', async () => {
    const reservationTypeId = await createReservationType('健診');
    const slotId = await createSlot(reservationTypeId, { status: 'closed' });

    const res = await request(httpServer)
      .get(
        `/api/reservations/slots?reservationTypeId=${reservationTypeId}&status=closed`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(slotId);
    expect(res.body[0].status).toBe('closed');
  });

  it('should reject invalid date format', async () => {
    const reservationTypeId = await createReservationType('健診');
    await request(httpServer)
      .get(
        `/api/reservations/slots?reservationTypeId=${reservationTypeId}&serviceDateFrom=2025/05/01`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('should reject serviceDateFrom > serviceDateTo', async () => {
    const reservationTypeId = await createReservationType('健診');
    await request(httpServer)
      .get(
        `/api/reservations/slots?reservationTypeId=${reservationTypeId}&serviceDateFrom=2025-05-31&serviceDateTo=2025-05-01`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });
});
