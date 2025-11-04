import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { ReservationType } from '../../src/reservation-type/entities/reservation-type.entity';
import {
  adminHeaders,
  closeTestApp,
  initTestApp,
  resetDatabase,
} from './support/test-helpers';

describe('ReservationTypes API (e2e)', () => {
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

  describe('Public API', () => {
    it('GET /api/reservation-types returns only active types', async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      await rtRepo.save([
        { name: 'Flu Shot', description: 'Annual flu shot', active: true },
        {
          name: 'COVID Vaccine',
          description: 'COVID-19 vaccine',
          active: true,
        },
        {
          name: 'Archived Type',
          description: 'Old type',
          active: false,
        },
      ]);

      const response = await request(httpServer)
        .get('/api/reservation-types')
        .expect(200);

      expect(response.body).toHaveLength(2);
      response.body.forEach((type: any) => {
        expect(['Flu Shot', 'COVID Vaccine']).toContain(type.name);
      });
    });
  });

  describe('Admin API - RBAC', () => {
    it('GET /api/admin/reservation-types returns 401 without admin token', async () => {
      await request(httpServer).get('/api/admin/reservation-types').expect(401);
    });

    it('GET /api/admin/reservation-types/:id returns 401 without admin token', async () => {
      await request(httpServer).get('/api/admin/reservation-types/1').expect(401);
    });

    it('POST /api/admin/reservation-types returns 401 without admin token', async () => {
      await request(httpServer)
        .post('/api/admin/reservation-types')
        .send({ name: 'Test', description: 'Test' })
        .expect(401);
    });

    it('PATCH /api/admin/reservation-types/:id returns 401 without admin token', async () => {
      await request(httpServer)
        .patch('/api/admin/reservation-types/1')
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('DELETE /api/admin/reservation-types/:id returns 401 without admin token', async () => {
      await request(httpServer)
        .delete('/api/admin/reservation-types/1')
        .expect(401);
    });
  });

  describe('Admin API - List', () => {
    beforeEach(async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      await rtRepo.save([
        { name: 'Flu Shot', description: 'Annual flu shot', active: true },
        {
          name: 'COVID Vaccine',
          description: 'COVID-19 vaccine',
          active: true,
        },
        {
          name: 'Archived Type',
          description: 'Old type',
          active: false,
        },
        { name: 'Physical Exam', description: 'Annual exam', active: true },
        {
          name: 'Blood Test',
          description: 'Laboratory test',
          active: true,
        },
      ]);
    });

    it('GET /api/admin/reservation-types returns all types with full fields and pagination meta', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .set(adminHeaders('rt-list-1'))
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toHaveLength(5);
      expect(response.body.meta).toEqual({
        total: 5,
        page: 1,
        limit: 50,
      });

      // Check full fields are present
      const firstType = response.body.data[0];
      expect(firstType).toHaveProperty('id');
      expect(firstType).toHaveProperty('name');
      expect(firstType).toHaveProperty('description');
      expect(firstType).toHaveProperty('active');
      expect(firstType).toHaveProperty('createdAt');
      expect(firstType).toHaveProperty('updatedAt');
    });

    it('GET /api/admin/reservation-types has default sort by id asc', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .set(adminHeaders('rt-list-2'))
        .expect(200);

      const ids = response.body.data.map((t: any) => t.id);
      // Should be in ascending ID order
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThan(ids[i - 1]);
      }
    });

    it('GET /api/admin/reservation-types supports sort by name asc', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ sort: 'name', order: 'asc' })
        .set(adminHeaders('rt-list-3'))
        .expect(200);

      const names = response.body.data.map((t: any) => t.name);
      expect(names).toEqual([
        'Archived Type',
        'Blood Test',
        'COVID Vaccine',
        'Flu Shot',
        'Physical Exam',
      ]);
    });

    it('GET /api/admin/reservation-types supports sort by name desc', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ sort: 'name', order: 'desc' })
        .set(adminHeaders('rt-list-4'))
        .expect(200);

      const names = response.body.data.map((t: any) => t.name);
      expect(names).toEqual([
        'Physical Exam',
        'Flu Shot',
        'COVID Vaccine',
        'Blood Test',
        'Archived Type',
      ]);
    });

    it('GET /api/admin/reservation-types supports filtering by name (case-insensitive partial match)', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ name: 'vaccine' })
        .set(adminHeaders('rt-list-5'))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('COVID Vaccine');
      expect(response.body.meta.total).toBe(1);
    });

    it('GET /api/admin/reservation-types supports filtering by active=true', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ active: true })
        .set(adminHeaders('rt-list-6'))
        .expect(200);

      expect(response.body.data).toHaveLength(4);
      expect(response.body.meta.total).toBe(4);
      response.body.data.forEach((type: any) => {
        expect(type.active).toBe(true);
      });
    });

    it('GET /api/admin/reservation-types supports filtering by active=false', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ active: false })
        .set(adminHeaders('rt-list-7'))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Archived Type');
      expect(response.body.data[0].active).toBe(false);
    });

    it('GET /api/admin/reservation-types supports pagination with limit', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ limit: 2, page: 1 })
        .set(adminHeaders('rt-list-8'))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        total: 5,
        page: 1,
        limit: 2,
      });
    });

    it('GET /api/admin/reservation-types supports pagination with page 2', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ limit: 2, page: 2 })
        .set(adminHeaders('rt-list-9'))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        total: 5,
        page: 2,
        limit: 2,
      });
    });

    it('GET /api/admin/reservation-types rejects limit > 100 with 400', async () => {
      await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ limit: 101 })
        .set(adminHeaders('rt-list-10'))
        .expect(400);
    });

    it('GET /api/admin/reservation-types combined: filter + sort + pagination', async () => {
      const response = await request(httpServer)
        .get('/api/admin/reservation-types')
        .query({ active: true, sort: 'name', order: 'asc', limit: 2, page: 1 })
        .set(adminHeaders('rt-list-11'))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(4); // 4 active types
      const names = response.body.data.map((t: any) => t.name);
      expect(names).toEqual(['Blood Test', 'COVID Vaccine']);
    });
  });

  describe('Admin API - Detail', () => {
    beforeEach(async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      await rtRepo.save([
        { name: 'Flu Shot', description: 'Annual flu shot', active: true },
        {
          name: 'Archived Type',
          description: 'Old type',
          active: false,
        },
      ]);
    });

    it('GET /api/admin/reservation-types/:id returns full type details', async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      const type = await rtRepo.findOne({ where: { name: 'Flu Shot' } });

      const response = await request(httpServer)
        .get(`/api/admin/reservation-types/${type!.id}`)
        .set(adminHeaders('rt-detail-1'))
        .expect(200);

      expect(response.body).toEqual({
        id: type!.id,
        name: 'Flu Shot',
        description: 'Annual flu shot',
        active: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('GET /api/admin/reservation-types/:id returns 404 for non-existent type', async () => {
      await request(httpServer)
        .get('/api/admin/reservation-types/99999')
        .set(adminHeaders('rt-detail-2'))
        .expect(404);
    });

    it('GET /api/admin/reservation-types/:id returns inactive types', async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      const type = await rtRepo.findOne({ where: { name: 'Archived Type' } });

      const response = await request(httpServer)
        .get(`/api/admin/reservation-types/${type!.id}`)
        .set(adminHeaders('rt-detail-3'))
        .expect(200);

      expect(response.body.name).toBe('Archived Type');
      expect(response.body.active).toBe(false);
    });
  });

  describe('Admin API - CRUD Operations', () => {
    it('POST /api/admin/reservation-types creates a new type', async () => {
      const response = await request(httpServer)
        .post('/api/admin/reservation-types')
        .set(adminHeaders('rt-create-1'))
        .send({
          name: 'New Vaccine',
          description: 'New vaccine type',
          active: true,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New Vaccine',
        description: 'New vaccine type',
        active: true,
      });
      expect(response.body).toHaveProperty('id');
    });

    it('PATCH /api/admin/reservation-types/:id updates a type', async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      const type = await rtRepo.save({
        name: 'Original Name',
        description: 'Original description',
        active: true,
      });

      const response = await request(httpServer)
        .patch(`/api/admin/reservation-types/${type.id}`)
        .set(adminHeaders('rt-update-1'))
        .send({
          name: 'Updated Name',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.description).toBe('Updated description');
    });

    it('PATCH /api/admin/reservation-types/:id can deactivate a type', async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      const type = await rtRepo.save({
        name: 'Active Type',
        description: 'Active',
        active: true,
      });

      const response = await request(httpServer)
        .patch(`/api/admin/reservation-types/${type.id}`)
        .set(adminHeaders('rt-update-2'))
        .send({ active: false })
        .expect(200);

      expect(response.body.active).toBe(false);
    });

    it('DELETE /api/admin/reservation-types/:id deletes a type', async () => {
      const rtRepo = dataSource.getRepository(ReservationType);
      const type = await rtRepo.save({
        name: 'To Delete',
        description: 'Will be deleted',
        active: true,
      });

      await request(httpServer)
        .delete(`/api/admin/reservation-types/${type.id}`)
        .set(adminHeaders('rt-delete-1'))
        .expect(200);

      const deleted = await rtRepo.findOne({ where: { id: type.id } });
      expect(deleted).toBeNull();
    });
  });
});
