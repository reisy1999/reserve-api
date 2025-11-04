import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Department } from '../../src/department/entities/department.entity';
import { ReservationType } from '../../src/reservation-type/entities/reservation-type.entity';
import { ReservationSlot } from '../../src/reservations/entities/reservation-slot.entity';
import { ReservationSlotDepartment } from '../../src/reservations/entities/reservation-slot-department.entity';
import {
  adminHeaders,
  closeTestApp,
  initTestApp,
  resetDatabase,
} from './support/test-helpers';

describe('Slot-Department CRUD API (e2e)', () => {
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

  describe('POST /api/admin/slots/:id/departments', () => {
    let slotId: number;
    let departmentId: string;

    beforeEach(async () => {
      // Create department
      const deptRepo = dataSource.getRepository(Department);
      await deptRepo.save({ id: 'ER', name: 'Emergency', active: true });
      departmentId = 'ER';

      // Create reservation type
      const rtRepo = dataSource.getRepository(ReservationType);
      const rt = await rtRepo.save({
        name: 'Test Type',
        description: 'Test',
        active: true,
      });

      // Create slot
      const slotRepo = dataSource.getRepository(ReservationSlot);
      const slot = await slotRepo.save({
        reservationTypeId: rt.id,
        serviceDateLocal: '2025-12-01',
        startMinuteOfDay: 540,
        durationMinutes: 30,
        capacity: 10,
        status: 'draft',
        bookingStart: new Date('2025-11-01'),
        bookingEnd: null,
      });
      slotId = slot.id;
    });

    it('links department to slot successfully', async () => {
      const response = await request(httpServer)
        .post(`/api/admin/slots/${slotId}/departments`)
        .set(adminHeaders('link-dept-1'))
        .send({
          departmentId,
          enabled: true,
          capacityOverride: null,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        slotId,
        departmentId,
        enabled: true,
        capacityOverride: null,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('links department with capacity override', async () => {
      const response = await request(httpServer)
        .post(`/api/admin/slots/${slotId}/departments`)
        .set(adminHeaders('link-dept-2'))
        .send({
          departmentId,
          enabled: true,
          capacityOverride: 5,
        })
        .expect(201);

      expect(response.body.capacityOverride).toBe(5);
    });

    it('returns 401 without admin token', async () => {
      await request(httpServer)
        .post(`/api/admin/slots/${slotId}/departments`)
        .send({ departmentId, enabled: true })
        .expect(401);
    });

    it('returns 404 when slot does not exist', async () => {
      await request(httpServer)
        .post('/api/admin/slots/99999/departments')
        .set(adminHeaders('link-dept-3'))
        .send({ departmentId, enabled: true })
        .expect(404);
    });

    it('returns 404 when department does not exist', async () => {
      await request(httpServer)
        .post(`/api/admin/slots/${slotId}/departments`)
        .set(adminHeaders('link-dept-4'))
        .send({ departmentId: 'NONEXISTENT', enabled: true })
        .expect(404);
    });

    it('returns 409 when duplicate link', async () => {
      // First link
      await request(httpServer)
        .post(`/api/admin/slots/${slotId}/departments`)
        .set(adminHeaders('link-dept-5'))
        .send({ departmentId, enabled: true })
        .expect(201);

      // Duplicate link
      await request(httpServer)
        .post(`/api/admin/slots/${slotId}/departments`)
        .set(adminHeaders('link-dept-6'))
        .send({ departmentId, enabled: true })
        .expect(409);
    });
  });

  describe('PATCH /api/admin/slots/:slotId/departments/:deptId', () => {
    let slotId: number;
    let departmentId: string;

    beforeEach(async () => {
      // Create department
      const deptRepo = dataSource.getRepository(Department);
      await deptRepo.save({ id: 'ER', name: 'Emergency', active: true });
      departmentId = 'ER';

      // Create reservation type
      const rtRepo = dataSource.getRepository(ReservationType);
      const rt = await rtRepo.save({
        name: 'Test Type',
        description: 'Test',
        active: true,
      });

      // Create slot
      const slotRepo = dataSource.getRepository(ReservationSlot);
      const slot = await slotRepo.save({
        reservationTypeId: rt.id,
        serviceDateLocal: '2025-12-01',
        startMinuteOfDay: 540,
        durationMinutes: 30,
        capacity: 10,
        status: 'draft',
        bookingStart: new Date('2025-11-01'),
        bookingEnd: null,
      });
      slotId = slot.id;

      // Create link
      const linkRepo = dataSource.getRepository(ReservationSlotDepartment);
      await linkRepo.save({
        slotId,
        departmentId,
        enabled: true,
        capacityOverride: null,
      });
    });

    it('updates enabled status', async () => {
      const response = await request(httpServer)
        .patch(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('update-dept-1'))
        .send({ enabled: false })
        .expect(200);

      expect(response.body.enabled).toBe(false);
    });

    it('updates capacity override', async () => {
      const response = await request(httpServer)
        .patch(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('update-dept-2'))
        .send({ capacityOverride: 8 })
        .expect(200);

      expect(response.body.capacityOverride).toBe(8);
    });

    it('updates both enabled and capacityOverride', async () => {
      const response = await request(httpServer)
        .patch(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('update-dept-3'))
        .send({ enabled: false, capacityOverride: 3 })
        .expect(200);

      expect(response.body.enabled).toBe(false);
      expect(response.body.capacityOverride).toBe(3);
    });

    it('clears capacity override by setting to null', async () => {
      // First set an override
      await request(httpServer)
        .patch(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('update-dept-4a'))
        .send({ capacityOverride: 5 })
        .expect(200);

      // Then clear it
      const response = await request(httpServer)
        .patch(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('update-dept-4b'))
        .send({ capacityOverride: null })
        .expect(200);

      expect(response.body.capacityOverride).toBeNull();
    });

    it('returns 401 without admin token', async () => {
      await request(httpServer)
        .patch(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .send({ enabled: false })
        .expect(401);
    });

    it('returns 404 when link does not exist', async () => {
      await request(httpServer)
        .patch('/api/admin/slots/99999/departments/NONEXISTENT')
        .set(adminHeaders('update-dept-5'))
        .send({ enabled: false })
        .expect(404);
    });
  });

  describe('DELETE /api/admin/slots/:slotId/departments/:deptId', () => {
    let slotId: number;
    let departmentId: string;

    beforeEach(async () => {
      // Create department
      const deptRepo = dataSource.getRepository(Department);
      await deptRepo.save({ id: 'ER', name: 'Emergency', active: true });
      departmentId = 'ER';

      // Create reservation type
      const rtRepo = dataSource.getRepository(ReservationType);
      const rt = await rtRepo.save({
        name: 'Test Type',
        description: 'Test',
        active: true,
      });

      // Create slot
      const slotRepo = dataSource.getRepository(ReservationSlot);
      const slot = await slotRepo.save({
        reservationTypeId: rt.id,
        serviceDateLocal: '2025-12-01',
        startMinuteOfDay: 540,
        durationMinutes: 30,
        capacity: 10,
        status: 'draft',
        bookingStart: new Date('2025-11-01'),
        bookingEnd: null,
      });
      slotId = slot.id;

      // Create link
      const linkRepo = dataSource.getRepository(ReservationSlotDepartment);
      await linkRepo.save({
        slotId,
        departmentId,
        enabled: true,
        capacityOverride: null,
      });
    });

    it('deletes link successfully', async () => {
      await request(httpServer)
        .delete(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('delete-dept-1'))
        .expect(204);

      // Verify deletion
      const linkRepo = dataSource.getRepository(ReservationSlotDepartment);
      const link = await linkRepo.findOne({
        where: { slotId, departmentId },
      });
      expect(link).toBeNull();
    });

    it('is idempotent - second delete also returns 204', async () => {
      // First delete
      await request(httpServer)
        .delete(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('delete-dept-2a'))
        .expect(204);

      // Second delete (idempotent)
      await request(httpServer)
        .delete(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .set(adminHeaders('delete-dept-2b'))
        .expect(204);
    });

    it('returns 401 without admin token', async () => {
      await request(httpServer)
        .delete(`/api/admin/slots/${slotId}/departments/${departmentId}`)
        .expect(401);
    });
  });
});
