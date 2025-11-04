import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Department } from '../../src/department/entities/department.entity';
import { Staff } from '../../src/staff/entities/staff.entity';
import {
  adminHeaders,
  closeTestApp,
  initTestApp,
  resetDatabase,
} from './support/test-helpers';

describe('Admin Staffs API via Token (e2e)', () => {
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
    await seedStaffs();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  async function seedStaffs(): Promise<Staff[]> {
    const departmentRepo = dataSource.getRepository(Department);
    const staffRepo = dataSource.getRepository(Staff);

    const departments = await departmentRepo.save([
      { id: 'ER', name: 'Emergency', active: true },
      { id: 'RAD', name: 'Radiology', active: true },
    ]);

    return staffRepo.save([
      {
        staffId: '900100',
        emrPatientId: null,
        familyName: '山田',
        givenName: '太郎',
        familyNameKana: 'ヤマダ',
        givenNameKana: 'タロウ',
        jobTitle: '医師',
        department: departments[0],
        departmentId: departments[0].id,
        dateOfBirth: '1980-01-01',
        sexCode: '1',
        pinHash: 'hash',
        pinRetryCount: 3,
        pinLockedUntil: new Date('2025-01-01T09:00:00+09:00'),
        pinUpdatedAt: new Date('2025-01-01T08:00:00+09:00'),
        pinVersion: 1,
        pinMustChange: false,
        version: 0,
        status: 'active',
        role: 'STAFF',
        lastLoginAt: new Date('2025-01-05T09:00:00+09:00'),
      },
      {
        staffId: '900101',
        emrPatientId: null,
        familyName: '佐藤',
        givenName: '花子',
        familyNameKana: 'サトウ',
        givenNameKana: 'ハナコ',
        jobTitle: '放射線技師',
        department: departments[1],
        departmentId: departments[1].id,
        dateOfBirth: '1985-05-05',
        sexCode: '2',
        pinHash: 'hash',
        pinRetryCount: 0,
        pinLockedUntil: null,
        pinUpdatedAt: new Date('2025-01-02T08:00:00+09:00'),
        pinVersion: 1,
        pinMustChange: false,
        version: 0,
        status: 'suspended',
        role: 'STAFF',
        lastLoginAt: null,
      },
    ]);
  }

  it('lists staffs with pagination and supports search/filter', async () => {
    const response = await request(httpServer)
      .get('/api/admin/staffs')
      .set(adminHeaders('admin-staffs-list'))
      .expect(200);

    expect(response.body.meta).toEqual({ total: 2, page: 1, limit: 50 });
    expect(response.body.data[0]).toMatchObject({
      staffUid: expect.any(String),
      staffId: expect.any(String),
      jobTitle: expect.any(String),
      departmentId: expect.any(String),
      status: expect.any(String),
    });

    const filtered = await request(httpServer)
      .get('/api/admin/staffs')
      .query({ search: '佐藤', status: 'inactive' })
      .set(adminHeaders('admin-staffs-filter'))
      .expect(200);

    expect(filtered.body.meta.total).toBe(1);
    expect(filtered.body.data[0].staffId).toBe('900101');
  });

  it('filters by departmentId', async () => {
    const response = await request(httpServer)
      .get('/api/admin/staffs')
      .query({ departmentId: 'RAD' })
      .set(adminHeaders('admin-staffs-dept'))
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].departmentId).toBe('RAD');
  });

  it('unlocks staff PIN retry counters idempotently', async () => {
    const staffRepo = dataSource.getRepository(Staff);
    const staff = await staffRepo.findOne({ where: { staffId: '900100' } });
    expect(staff).toBeTruthy();

    await request(httpServer)
      .post(`/api/admin/staffs/${staff?.staffUid}/unlock`)
      .set(adminHeaders('admin-staffs-unlock'))
      .expect(204);

    const unlocked = await staffRepo.findOne({ where: { staffId: '900100' } });
    expect(unlocked?.pinRetryCount).toBe(0);
    expect(unlocked?.pinLockedUntil).toBeNull();

    // Second call should also succeed (idempotent)
    await request(httpServer)
      .post(`/api/admin/staffs/${staff?.staffUid}/unlock`)
      .set(adminHeaders('admin-staffs-unlock-again'))
      .expect(204);
  });

  it('returns 204 even when staff does not exist', async () => {
    await request(httpServer)
      .post('/api/admin/staffs/00000000-0000-0000-0000-000000000000/unlock')
      .set(adminHeaders('admin-staffs-unlock-missing'))
      .expect(204);
  });

  it('requires admin token', async () => {
    await request(httpServer).get('/api/admin/staffs').expect(401);
  });
});
