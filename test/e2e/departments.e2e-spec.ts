import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Department } from '../../src/department/entities/department.entity';
import {
  adminHeaders,
  closeTestApp,
  initTestApp,
  resetDatabase,
} from './support/test-helpers';

describe('Departments API (e2e)', () => {
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
    it('GET /api/departments?active=true returns active departments in ascending order', async () => {
      const departmentRepo = dataSource.getRepository(Department);
      await departmentRepo.save([
        { id: 'ER', name: 'Emergency', active: true },
        { id: 'CARD', name: 'Cardiology', active: true },
        { id: 'ARCH', name: 'Archive', active: false },
      ]);

      const response = await request(httpServer)
        .get('/api/departments')
        .query({ active: true })
        .expect(200);

      expect(response.body).toEqual([
        { id: 'CARD', name: 'Cardiology' },
        { id: 'ER', name: 'Emergency' },
      ]);
    });

    it('GET /api/departments returns minimal fields (active-only)', async () => {
      const departmentRepo = dataSource.getRepository(Department);
      await departmentRepo.save([
        { id: 'ER', name: 'Emergency', active: true },
        { id: 'ARCH', name: 'Archive', active: false },
      ]);

      const response = await request(httpServer)
        .get('/api/departments')
        .expect(200);

      expect(response.body).toEqual([{ id: 'ER', name: 'Emergency' }]);
      // Should NOT include createdAt, updatedAt, active field
      expect(response.body[0]).not.toHaveProperty('createdAt');
      expect(response.body[0]).not.toHaveProperty('updatedAt');
      expect(response.body[0]).not.toHaveProperty('active');
    });
  });

  describe('Admin API - RBAC', () => {
    it('GET /api/admin/departments returns 401 without admin token', async () => {
      await request(httpServer).get('/api/admin/departments').expect(401);
    });

    it('GET /api/admin/departments/:id returns 401 without admin token', async () => {
      await request(httpServer).get('/api/admin/departments/ER').expect(401);
    });
  });

  describe('Admin API - List', () => {
    beforeEach(async () => {
      const departmentRepo = dataSource.getRepository(Department);
      // Seed data with different timestamps for sorting tests
      await departmentRepo.save([
        { id: 'ER', name: 'Emergency', active: true },
        { id: 'CARD', name: 'Cardiology', active: true },
        { id: 'RAD', name: 'Radiology', active: false },
        { id: 'SURG', name: 'Surgery', active: true },
        { id: 'PEDI', name: 'Pediatrics', active: true },
      ]);
    });

    it('GET /api/admin/departments returns all departments with full fields and pagination meta', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .set(adminHeaders('dept-list-1'))
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
      const firstDept = response.body.data[0];
      expect(firstDept).toHaveProperty('id');
      expect(firstDept).toHaveProperty('name');
      expect(firstDept).toHaveProperty('active');
      expect(firstDept).toHaveProperty('createdAt');
      expect(firstDept).toHaveProperty('updatedAt');
    });

    it('GET /api/admin/departments has default sort by id asc', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .set(adminHeaders('dept-list-2'))
        .expect(200);

      const ids = response.body.data.map((d: any) => d.id);
      expect(ids).toEqual(['CARD', 'ER', 'PEDI', 'RAD', 'SURG']);
    });

    it('GET /api/admin/departments supports sort by name asc', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ sort: 'name', order: 'asc' })
        .set(adminHeaders('dept-list-3'))
        .expect(200);

      const names = response.body.data.map((d: any) => d.name);
      expect(names).toEqual([
        'Cardiology',
        'Emergency',
        'Pediatrics',
        'Radiology',
        'Surgery',
      ]);
    });

    it('GET /api/admin/departments supports sort by name desc with stable id tie-break', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ sort: 'name', order: 'desc' })
        .set(adminHeaders('dept-list-4'))
        .expect(200);

      const names = response.body.data.map((d: any) => d.name);
      expect(names).toEqual([
        'Surgery',
        'Radiology',
        'Pediatrics',
        'Emergency',
        'Cardiology',
      ]);
    });

    it('GET /api/admin/departments supports filtering by name (case-insensitive partial match)', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ name: 'card' })
        .set(adminHeaders('dept-list-5'))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Cardiology');
      expect(response.body.meta.total).toBe(1);
    });

    it('GET /api/admin/departments supports filtering by active=true', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ active: true })
        .set(adminHeaders('dept-list-6'))
        .expect(200);

      expect(response.body.data).toHaveLength(4);
      expect(response.body.meta.total).toBe(4);
      response.body.data.forEach((dept: any) => {
        expect(dept.active).toBe(true);
      });
    });

    it('GET /api/admin/departments supports filtering by active=false', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ active: false })
        .set(adminHeaders('dept-list-7'))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('RAD');
      expect(response.body.data[0].active).toBe(false);
    });

    it('GET /api/admin/departments supports pagination with limit', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ limit: 2, page: 1 })
        .set(adminHeaders('dept-list-8'))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        total: 5,
        page: 1,
        limit: 2,
      });
    });

    it('GET /api/admin/departments supports pagination with page 2', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ limit: 2, page: 2 })
        .set(adminHeaders('dept-list-9'))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        total: 5,
        page: 2,
        limit: 2,
      });
      // With default sort (id asc), page 2 should have PEDI, RAD
      const ids = response.body.data.map((d: any) => d.id);
      expect(ids).toEqual(['PEDI', 'RAD']);
    });

    it('GET /api/admin/departments rejects limit > 100 with 400', async () => {
      await request(httpServer)
        .get('/api/admin/departments')
        .query({ limit: 101 })
        .set(adminHeaders('dept-list-10'))
        .expect(400);
    });

    it('GET /api/admin/departments combined: filter + sort + pagination', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments')
        .query({ active: true, sort: 'name', order: 'asc', limit: 2, page: 1 })
        .set(adminHeaders('dept-list-11'))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(4); // 4 active departments
      const names = response.body.data.map((d: any) => d.name);
      expect(names).toEqual(['Cardiology', 'Emergency']);
    });
  });

  describe('Admin API - Detail', () => {
    beforeEach(async () => {
      const departmentRepo = dataSource.getRepository(Department);
      await departmentRepo.save([
        { id: 'ER', name: 'Emergency', active: true },
        { id: 'ARCH', name: 'Archive', active: false },
      ]);
    });

    it('GET /api/admin/departments/:id returns full department details', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments/ER')
        .set(adminHeaders('dept-detail-1'))
        .expect(200);

      expect(response.body).toEqual({
        id: 'ER',
        name: 'Emergency',
        active: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('GET /api/admin/departments/:id returns 404 for non-existent department', async () => {
      await request(httpServer)
        .get('/api/admin/departments/NONEXISTENT')
        .set(adminHeaders('dept-detail-2'))
        .expect(404);
    });

    it('GET /api/admin/departments/:id returns inactive departments', async () => {
      const response = await request(httpServer)
        .get('/api/admin/departments/ARCH')
        .set(adminHeaders('dept-detail-3'))
        .expect(200);

      expect(response.body.id).toBe('ARCH');
      expect(response.body.active).toBe(false);
    });
  });

  describe('Admin API - Mutations', () => {
    it('creates a new department', async () => {
      const response = await request(httpServer)
        .post('/api/admin/departments')
        .set(adminHeaders('dept-create-1'))
        .send({ id: 'LAB', name: 'Laboratory', active: true })
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'LAB',
        name: 'Laboratory',
        active: true,
      });

      const repo = dataSource.getRepository(Department);
      const created = await repo.findOne({ where: { id: 'LAB' } });
      expect(created).toBeTruthy();
    });

    it('returns 409 when department already exists', async () => {
      const repo = dataSource.getRepository(Department);
      await repo.save({ id: 'HR', name: 'Human Resources', active: true });

      await request(httpServer)
        .post('/api/admin/departments')
        .set(adminHeaders('dept-create-409'))
        .send({ id: 'HR', name: 'Human Resources', active: true })
        .expect(409);
    });

    it('updates name and active flag', async () => {
      const repo = dataSource.getRepository(Department);
      await repo.save({ id: 'QA', name: 'Quality Assurance', active: true });

      const response = await request(httpServer)
        .patch('/api/admin/departments/QA')
        .set(adminHeaders('dept-update-1'))
        .send({ name: 'QA Center', active: false })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'QA',
        name: 'QA Center',
        active: false,
      });

      const updated = await repo.findOne({ where: { id: 'QA' } });
      expect(updated?.name).toBe('QA Center');
      expect(updated?.active).toBe(false);
    });
  });
});
