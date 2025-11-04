import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { ReservationSlot } from '../../src/reservations/entities/reservation-slot.entity';
import { ReservationType } from '../../src/reservation-type/entities/reservation-type.entity';
import {
  adminHeaders,
  closeTestApp,
  initTestApp,
  resetDatabase,
} from './support/test-helpers';

describe('Admin Slots API (e2e)', () => {
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
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  async function seedSlots(): Promise<ReservationSlot[]> {
    const typeRepo = dataSource.getRepository(ReservationType);
    const slotRepo = dataSource.getRepository(ReservationSlot);

    const type = await typeRepo.save({
      name: 'インフルエンザ予防接種',
      description: '冬季ワクチン接種',
      active: true,
    });

    return slotRepo.save([
      {
        reservationTypeId: type.id,
        reservationType: type,
        serviceDateLocal: '2025-12-15',
        startMinuteOfDay: 540,
        durationMinutes: 30,
        capacity: 10,
        bookedCount: 3,
        status: 'published',
        bookingStart: new Date('2025-10-01T00:00:00+09:00'),
        bookingEnd: new Date('2025-12-14T23:59:59+09:00'),
        cancelDeadlineDateLocal: '2025-12-14',
        cancelDeadlineMinuteOfDay: 1020,
        notes: '午前枠',
      },
      {
        reservationTypeId: type.id,
        reservationType: type,
        serviceDateLocal: '2025-12-16',
        startMinuteOfDay: 600,
        durationMinutes: 30,
        capacity: 8,
        bookedCount: 0,
        status: 'draft',
        bookingStart: null,
        bookingEnd: null,
        cancelDeadlineDateLocal: null,
        cancelDeadlineMinuteOfDay: null,
        notes: null,
      },
    ]);
  }

  it('lists slots with pagination meta and exposes cancel deadlines', async () => {
    await seedSlots();

    const response = await request(httpServer)
      .get('/api/admin/slots')
      .set(adminHeaders('admin-slots-list'))
      .expect(200);

    expect(response.body).toMatchObject({
      meta: { total: 2, page: 1, limit: 50 },
    });
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        reservationTypeId: expect.any(Number),
        serviceDateLocal: expect.any(String),
        cancelDeadlineDateLocal: expect.any(String),
        cancelDeadlineMinuteOfDay: 1020,
        notes: '午前枠',
      }),
    );
  });

  it('filters by status and reservationTypeId', async () => {
    const slots = await seedSlots();

    const response = await request(httpServer)
      .get('/api/admin/slots')
      .query({ status: 'draft', reservationTypeId: slots[0].reservationTypeId })
      .set(adminHeaders('admin-slots-filter'))
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].status).toBe('draft');
  });

  it('updates slot attributes including cancel deadline', async () => {
    const [slot] = await seedSlots();

    const response = await request(httpServer)
      .patch(`/api/admin/slots/${slot.id}`)
      .set(adminHeaders('admin-slots-update'))
      .send({
        capacity: 12,
        status: 'closed',
        notes: '午後に変更',
        bookingStart: '2025-09-01T00:00:00+09:00',
        bookingEnd: '2025-12-13T23:59:59+09:00',
        cancelDeadlineDateLocal: '2025-12-13',
        cancelDeadlineMinuteOfDay: 1200,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: slot.id,
      capacity: 12,
      status: 'closed',
      notes: '午後に変更',
      cancelDeadlineDateLocal: '2025-12-13',
      cancelDeadlineMinuteOfDay: 1200,
    });

    const updated = await dataSource
      .getRepository(ReservationSlot)
      .findOne({ where: { id: slot.id } });
    expect(updated?.capacity).toBe(12);
    expect(updated?.cancelDeadlineDateLocal).toBe('2025-12-13');
    expect(updated?.cancelDeadlineMinuteOfDay).toBe(1200);
  });

  it('rejects mismatched cancel deadline fields on update', async () => {
    const [slot] = await seedSlots();

    const res = await request(httpServer)
      .patch(`/api/admin/slots/${slot.id}`)
      .set(adminHeaders('admin-slots-update-invalid'))
      .send({ cancelDeadlineDateLocal: '2025-12-13' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('cancelDeadline');
  });

  it('supports cancel deadline fields on bulk creation', async () => {
    const typeRepo = dataSource.getRepository(ReservationType);
    const type = await typeRepo.save({ name: '産業医面談', active: true });

    const response = await request(httpServer)
      .post('/api/admin/slots/bulk')
      .set(adminHeaders('admin-slots-bulk'))
      .send({
        slots: [
          {
            reservationTypeId: type.id,
            serviceDateLocal: '2026-01-10',
            startMinuteOfDay: 480,
            durationMinutes: 60,
            capacity: 5,
            status: 'draft',
            cancelDeadlineDateLocal: '2026-01-09',
            cancelDeadlineMinuteOfDay: 900,
          },
        ],
      })
      .expect(201);

    expect(response.body.slots[0]).toMatchObject({
      cancelDeadlineDateLocal: '2026-01-09',
      cancelDeadlineMinuteOfDay: 900,
    });
  });

  it('requires admin token for listing', async () => {
    await seedSlots();

    await request(httpServer).get('/api/admin/slots').expect(401);
  });
});
