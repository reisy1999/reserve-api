import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Department } from '../../src/department/entities/department.entity';
import { Reservation } from '../../src/reservations/entities/reservation.entity';
import { ReservationSlot } from '../../src/reservations/entities/reservation-slot.entity';
import { ReservationType } from '../../src/reservation-type/entities/reservation-type.entity';
import { Staff } from '../../src/staff/entities/staff.entity';
import {
  adminHeaders,
  closeTestApp,
  initTestApp,
  resetDatabase,
} from './support/test-helpers';

describe('Admin Reservations API (e2e)', () => {
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

  async function seedReservations(): Promise<Reservation[]> {
    const departmentRepo = dataSource.getRepository(Department);
    const staffRepo = dataSource.getRepository(Staff);
    const typeRepo = dataSource.getRepository(ReservationType);
    const slotRepo = dataSource.getRepository(ReservationSlot);
    const reservationRepo = dataSource.getRepository(Reservation);

    const department = await departmentRepo.save({
      id: 'ER',
      name: 'Emergency',
      active: true,
    });

    const type = await typeRepo.save({
      name: '健康診断',
      description: '年次健診',
      active: true,
    });

    const staffActive = await staffRepo.save({
      staffId: '900100',
      emrPatientId: null,
      familyName: '山田',
      givenName: '太郎',
      familyNameKana: 'ヤマダ',
      givenNameKana: 'タロウ',
      jobTitle: '医師',
      department,
      departmentId: department.id,
      dateOfBirth: '1980-01-01',
      sexCode: '1',
      pinHash: 'hash',
      pinRetryCount: 2,
      pinLockedUntil: new Date('2025-01-02T00:00:00+09:00'),
      pinUpdatedAt: new Date('2025-01-01T00:00:00+09:00'),
      pinVersion: 1,
      pinMustChange: false,
      version: 0,
      status: 'active',
      role: 'STAFF',
      lastLoginAt: new Date('2025-01-03T09:00:00+09:00'),
    });

    const staffCanceled = await staffRepo.save({
      staffId: '900101',
      emrPatientId: null,
      familyName: '佐藤',
      givenName: '花子',
      familyNameKana: 'サトウ',
      givenNameKana: 'ハナコ',
      jobTitle: '看護師',
      department,
      departmentId: department.id,
      dateOfBirth: '1985-05-05',
      sexCode: '2',
      pinHash: 'hash',
      pinRetryCount: 0,
      pinLockedUntil: null,
      pinUpdatedAt: new Date('2025-01-01T00:00:00+09:00'),
      pinVersion: 1,
      pinMustChange: false,
      version: 0,
      status: 'active',
      role: 'STAFF',
      lastLoginAt: null,
    });

    const slotA = await slotRepo.save({
      reservationTypeId: type.id,
      reservationType: type,
      serviceDateLocal: '2025-12-15',
      startMinuteOfDay: 540,
      durationMinutes: 30,
      capacity: 10,
      bookedCount: 1,
      status: 'published',
      bookingStart: new Date('2025-10-01T00:00:00+09:00'),
      bookingEnd: new Date('2025-12-14T23:59:59+09:00'),
      cancelDeadlineDateLocal: '2025-12-14',
      cancelDeadlineMinuteOfDay: 1020,
      notes: null,
    });

    const slotB = await slotRepo.save({
      reservationTypeId: type.id,
      reservationType: type,
      serviceDateLocal: '2025-12-16',
      startMinuteOfDay: 600,
      durationMinutes: 30,
      capacity: 8,
      bookedCount: 1,
      status: 'published',
      bookingStart: new Date('2025-10-01T00:00:00+09:00'),
      bookingEnd: new Date('2025-12-15T23:59:59+09:00'),
      cancelDeadlineDateLocal: '2025-12-15',
      cancelDeadlineMinuteOfDay: 900,
      notes: null,
    });

    return reservationRepo.save([
      {
        staffUid: staffActive.staffUid,
        staffId: staffActive.staffId,
        staff: staffActive,
        reservationTypeId: type.id,
        reservationType: type,
        slotId: slotA.id,
        slot: slotA,
        serviceDateLocal: slotA.serviceDateLocal,
        startMinuteOfDay: slotA.startMinuteOfDay,
        durationMinutes: slotA.durationMinutes,
        periodKey: 'FY2025',
        canceledAt: null,
      },
      {
        staffUid: staffCanceled.staffUid,
        staffId: staffCanceled.staffId,
        staff: staffCanceled,
        reservationTypeId: type.id,
        reservationType: type,
        slotId: slotB.id,
        slot: slotB,
        serviceDateLocal: slotB.serviceDateLocal,
        startMinuteOfDay: slotB.startMinuteOfDay,
        durationMinutes: slotB.durationMinutes,
        periodKey: 'FY2025',
        canceledAt: new Date('2025-11-01T09:00:00+09:00'),
      },
    ]);
  }

  it('lists reservations with staff information and pagination', async () => {
    await seedReservations();

    const response = await request(httpServer)
      .get('/api/admin/reservations')
      .set(adminHeaders('admin-reservations-list'))
      .expect(200);

    expect(response.body.meta).toEqual({ total: 2, page: 1, limit: 50 });
    expect(response.body.data[0]).toMatchObject({
      staffName: expect.any(String),
      departmentId: 'ER',
      reservationTypeId: expect.any(Number),
    });
  });

  it('filters reservations by status and staffId', async () => {
    await seedReservations();

    const activeRes = await request(httpServer)
      .get('/api/admin/reservations')
      .query({ status: 'active' })
      .set(adminHeaders('admin-reservations-filter-active'))
      .expect(200);

    expect(activeRes.body.meta.total).toBe(1);
    expect(activeRes.body.data[0].canceledAt).toBeNull();

    const canceledRes = await request(httpServer)
      .get('/api/admin/reservations')
      .query({ status: 'canceled', staffId: '900101' })
      .set(adminHeaders('admin-reservations-filter-canceled'))
      .expect(200);

    expect(canceledRes.body.meta.total).toBe(1);
    expect(canceledRes.body.data[0].staffId).toBe('900101');
    expect(canceledRes.body.data[0].canceledAt).toBeTruthy();
  });

  it('admin cancellation is idempotent and decrements booked count', async () => {
    const [reservation] = await seedReservations();
    const slotRepo = dataSource.getRepository(ReservationSlot);

    await request(httpServer)
      .delete(`/api/admin/reservations/${reservation.id}`)
      .set(adminHeaders('admin-reservations-delete'))
      .expect(204);

    const updatedReservation = await dataSource
      .getRepository(Reservation)
      .findOne({ where: { id: reservation.id } });
    expect(updatedReservation?.canceledAt).toBeTruthy();

    const slot = await slotRepo.findOne({ where: { id: reservation.slotId } });
    expect(slot?.bookedCount).toBe(0);

    // Second call should remain 204 (idempotent)
    await request(httpServer)
      .delete(`/api/admin/reservations/${reservation.id}`)
      .set(adminHeaders('admin-reservations-delete-again'))
      .expect(204);
  });

  it('requires admin token', async () => {
    await seedReservations();
    await request(httpServer).get('/api/admin/reservations').expect(401);
  });
});
