import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Staff } from '../../src/staff/entities/staff.entity';
import {
  buildCsv,
  closeTestApp,
  initTestApp,
  resetDatabase,
  seedBaselineData,
} from './support/test-helpers';

describe('Admin Staff API (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;
  let adminToken: string;
  let regularStaffUid: string;
  let regularToken: string;

  beforeAll(async () => {
    const ctx = await initTestApp();
    app = ctx.app;
    httpServer = ctx.httpServer;
    dataSource = ctx.dataSource;
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await seedBaselineData(dataSource);

    // 管理者職員を作成
    await importStaff('900001', '管理者 太郎', 'ADMIN');
    const adminLoginRes = await login('900001', '0000');
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.accessToken;
    expect(adminToken).toBeDefined();
    const adminMe = await request(httpServer)
      .get('/api/staffs/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminMe.status).toBe(200);
    expect(adminMe.body.role).toBe('ADMIN');

    // 一般職員を作成
    await importStaff('900002', '一般 花子', 'STAFF');
    const staffLoginRes = await login('900002', '0000');
    regularToken = staffLoginRes.body.accessToken;
    const staffMe = await request(httpServer)
      .get('/api/staffs/me')
      .set('Authorization', `Bearer ${regularToken}`);
    regularStaffUid = staffMe.body.staffUid;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  async function importStaff(
    staffId: string,
    name: string,
    role: 'STAFF' | 'ADMIN' = 'STAFF',
  ): Promise<void> {
    const csv = buildCsv([
      ['名前(漢字)', '本部ID', '部署', '職種'],
      [name, staffId, 'IM', '事務職'],
    ]);

    await request(httpServer)
      .post('/api/admin/staffs/import?dryRun=false')
      .set('X-Admin-Token', process.env.ADMIN_TOKEN || '')
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);

    // ロールを設定
    if (role === 'ADMIN') {
      const staffRepo = dataSource.getRepository(Staff);
      const staff = await staffRepo.findOne({ where: { staffId } });
      if (staff) {
        staff.role = 'ADMIN';
        await staffRepo.save(staff);
      }
    }
  }

  async function login(staffId: string, pin: string) {
    return request(httpServer).post('/api/auth/login').send({ staffId, pin });
  }

  describe('PATCH /api/admin/staffs/:staffUid', () => {
    it('認証なしの場合は401エラー', async () => {
      await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .send({ version: 0, jobTitle: '看護師' })
        .expect(401);
    });

    it('一般職員の場合は403エラー', async () => {
      await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ version: 0, jobTitle: '看護師' })
        .expect(403);
    });

    it('存在しない職員の場合は404エラー', async () => {
      await request(httpServer)
        .patch('/api/admin/staffs/non-existent-uid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ version: 0, jobTitle: '看護師' })
        .expect(404);
    });

    it('管理者は職員情報を更新できる', async () => {
      const updateRes = await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          familyName: '更新',
          givenName: '太郎',
          jobTitle: '看護師',
          status: 'active',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body).toMatchObject({
        familyName: '更新',
        givenName: '太郎',
        jobTitle: '看護師',
        status: 'active',
        version: 1,
      });
    });

    it('管理者はロールを変更できる', async () => {
      const updateRes = await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          role: 'ADMIN',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.role).toBe('ADMIN');
      expect(updateRes.body.version).toBe(1);
    });

    it('管理者はステータスを変更できる', async () => {
      const updateRes = await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          status: 'suspended',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.status).toBe('suspended');
      expect(updateRes.body.version).toBe(1);
    });

    it('管理者は複数フィールドを同時に更新できる', async () => {
      const updateRes = await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          familyName: '山田',
          givenName: '次郎',
          familyNameKana: 'ヤマダ',
          givenNameKana: 'ジロウ',
          jobTitle: '医師',
          departmentId: 'ER',
          emrPatientId: '888001',
          dateOfBirth: '1985-03-15',
          sexCode: '1',
          status: 'active',
          role: 'ADMIN',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body).toMatchObject({
        familyName: '山田',
        givenName: '次郎',
        familyNameKana: 'ヤマダ',
        givenNameKana: 'ジロウ',
        jobTitle: '医師',
        departmentId: 'ER',
        emrPatientId: '888001',
        dateOfBirth: '1985-03-15',
        sexCode: '1',
        status: 'active',
        role: 'ADMIN',
        version: 1,
      });
    });

    it('バージョン不一致の場合は409エラー', async () => {
      // 最初の更新
      await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          jobTitle: '看護師',
        })
        .expect(200);

      // 古いバージョンで更新を試みる
      await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          jobTitle: '医師',
        })
        .expect(409);
    });

    it('EMR患者ID重複の場合は400エラー', async () => {
      // 別の職員を作成
      await importStaff('900003', '別職員 太郎');

      // regularStaffのEMR患者IDを設定
      await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          emrPatientId: '999001',
        })
        .expect(200);

      // 900003に同じEMR患者IDを設定しようとする
      const staff003Login = await login('900003', '0000');
      const staff003Me = await request(httpServer)
        .get('/api/staffs/me')
        .set('Authorization', `Bearer ${staff003Login.body.accessToken}`);
      const staff003Uid = staff003Me.body.staffUid;

      const dupRes = await request(httpServer)
        .patch(`/api/admin/staffs/${staff003Uid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          emrPatientId: '999001',
        });

      expect(dupRes.status).toBe(400);
      expect(dupRes.body.message).toContain('emrPatientId already exists');
    });

    it('存在しない部署IDの場合は404エラー', async () => {
      await request(httpServer)
        .patch(`/api/admin/staffs/${regularStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 0,
          departmentId: 'INVALID_DEPT',
        })
        .expect(404);
    });
  });

  describe('POST /api/admin/staffs/:staffUid/reset-pin', () => {
    it('認証なしの場合は401エラー', async () => {
      await request(httpServer)
        .post(`/api/admin/staffs/${regularStaffUid}/reset-pin`)
        .expect(401);
    });

    it('一般職員の場合は403エラー', async () => {
      await request(httpServer)
        .post(`/api/admin/staffs/${regularStaffUid}/reset-pin`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('存在しない職員の場合は404エラー', async () => {
      await request(httpServer)
        .post('/api/admin/staffs/non-existent-uid/reset-pin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('管理者はPINをリセットできる', async () => {
      // PINリセット
      await request(httpServer)
        .post(`/api/admin/staffs/${regularStaffUid}/reset-pin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // リセット後、pinMustChangeがtrueになっていることを確認
      const staffRepo = dataSource.getRepository(Staff);
      const staff = await staffRepo.findOne({
        where: { staffUid: regularStaffUid },
      });

      expect(staff).toBeDefined();
      expect(staff!.pinMustChange).toBe(true);
      expect(staff!.pinRetryCount).toBe(0);
      expect(staff!.pinLockedUntil).toBeNull();

      // 初期PIN（0000）でログインできることを確認
      const loginRes = await request(httpServer)
        .post('/api/auth/login')
        .send({ staffId: '900002', pin: '0000' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.accessToken).toBeDefined();
    });
  });
});
