import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  initTestApp,
  resetDatabase,
  seedBaselineData,
  closeTestApp,
  buildCsv,
  adminHeaders,
} from './support/test-helpers';

describe('認証API+トークン発行を確認する', () => {
  const baseCsv = buildCsv([
    ['名前(漢字)', '本部ID', '部署', '職種'],
    ['山田太郎', '900100', 'ER', '医師'],
  ]);

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

  it('正しいPINでJWTトークンが払い出される', async () => {
    const importRes = await request(httpServer)
      .post('/api/admin/staffs/import?dryRun=false')
      .set(adminHeaders('auth-success-1'))
      .set('Content-Type', 'text/csv')
      .send(baseCsv);
    expect(importRes.status).toBe(201);
    expect(importRes.body).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          created: 1,
          skippedExisting: 0,
        }),
      }),
    );

    const loginRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '900100', pin: '0000' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toMatchObject({
      tokenType: 'Bearer',
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
    });
  });

  it('PIN誤りを5回繰り返すと手動解除までロックされる', async () => {
    const csv = buildCsv([
      ['名前(漢字)', '本部ID', '部署', '職種'],
      ['佐藤花子', '900101', 'RAD', '診療放射線技師'],
    ]);

    await request(httpServer)
      .post('/api/admin/staffs/import?dryRun=false')
      .set(adminHeaders('auth-lock-1'))
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await request(httpServer)
        .post('/api/auth/login')
        .send({ staffId: '900101', pin: '9999' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('invalid'),
          attemptsRemaining: expect.any(Number),
        }),
      );
    }

    const lockRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '900101', pin: '9999' });
    expect(lockRes.status).toBe(423);
    expect(lockRes.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('locked'),
        retryAfter: expect.any(String),
      }),
    );

    const afterLockRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '900101', pin: '0000' });
    expect(afterLockRes.status).toBe(423);
  });

  it('Refreshトークンはローテーションし再利用時には全セッションを失効させる', async () => {
    const csv = buildCsv([
      ['名前(漢字)', '本部ID', '部署', '職種'],
      ['高橋次郎', '900102', 'CARD', '看護師'],
    ]);

    await request(httpServer)
      .post('/api/admin/staffs/import?dryRun=false')
      .set(adminHeaders('auth-refresh-1'))
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(201);

    const loginRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '900102', pin: '0000' })
      .expect(200);

    const originalRefresh = loginRes.body.refreshToken;

    const refreshRes = await request(httpServer)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh })
      .expect(200);

    expect(refreshRes.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
    });
    expect(refreshRes.body.refreshToken).not.toBe(originalRefresh);

    await request(httpServer)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh })
      .expect(401);

    const reuseRes = await request(httpServer)
      .post('/api/auth/login')
      .send({ staffId: '900102', pin: '0000' });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('revoked'),
      }),
    );
  });
});
