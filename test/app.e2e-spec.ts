import request from 'supertest';
import {
  closeTestApp,
  initTestApp,
  resetDatabase,
  seedBaselineData,
  type TestAppContext,
} from './e2e/support/test-helpers';

describe('Application bootstrap (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await initTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    await seedBaselineData(ctx.dataSource);
  });

  afterAll(async () => {
    await closeTestApp(ctx?.app);
  });

  it('returns seeded reservation types from public endpoint', async () => {
    const response = await request(ctx.httpServer)
      .get('/api/reservation-types')
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Baseline Vaccination',
          active: true,
        }),
      ]),
    );
  });
});
