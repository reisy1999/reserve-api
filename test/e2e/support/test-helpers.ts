import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import argon2 from 'argon2';
import { AppModule } from '../../../src/app.module';
import { ReservationType } from '../../../src/reservation-type/entities/reservation-type.entity';
import { Department } from '../../../src/department/entities/department.entity';
import { Staff } from '../../../src/staff/entities/staff.entity';
import { configureApp } from '../../../src/app.config';

export interface TestAppContext {
  app: INestApplication;
  httpServer: any;
  dataSource: DataSource;
}

function ensureTestEnvDefaults(): void {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.DB_TYPE = process.env.DB_TYPE ?? 'mysql';
  process.env.DB_HOST = process.env.DB_HOST ?? '127.0.0.1';
  process.env.DB_PORT = process.env.DB_PORT ?? '3306';
  process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'reserve_user';
  process.env.DB_PASSWORD =
    process.env.DB_PASSWORD ?? 'reserve_password_change_me';
  process.env.DB_DATABASE = process.env.DB_DATABASE ?? 'reserve_db';
  process.env.DB_SYNCHRONIZE = process.env.DB_SYNCHRONIZE ?? 'true';
  process.env.DB_LOGGING = process.env.DB_LOGGING ?? 'false';
  process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'test-admin-token';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '900s';
  process.env.REFRESH_SECRET =
    process.env.REFRESH_SECRET ?? 'test-refresh-secret';
  process.env.REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN ?? '30d';
  process.env.REFRESH_ROTATE = process.env.REFRESH_ROTATE ?? 'true';
  process.env.SECURITY_PIN_PEPPER =
    process.env.SECURITY_PIN_PEPPER ??
    Buffer.from('test-pepper').toString('base64');
}

export async function initTestApp(): Promise<TestAppContext> {
  ensureTestEnvDefaults();
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);

  // Initialize app before getting server
  await app.init();

  const dataSource = app.get<DataSource>(getDataSourceToken());

  return {
    app,
    httpServer: app.getHttpServer(),
    dataSource,
  };
}

export async function resetDatabase(dataSource: DataSource): Promise<void> {
  if (!dataSource || !dataSource.isInitialized) {
    return;
  }
  const driverType = dataSource.options.type;
  if (driverType === 'sqlite') {
    await dataSource.query('PRAGMA foreign_keys = OFF');
    for (const entity of dataSource.entityMetadatas) {
      const repository = dataSource.getRepository(entity.target as never);
      await repository.clear();
    }
    await dataSource.query('PRAGMA foreign_keys = ON');
    return;
  }

  if (driverType === 'mysql') {
    const options = dataSource.options;
    const databaseName = options.database;
    if (!databaseName) {
      throw new Error('MySQL database name is not configured.');
    }

    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = await dataSource.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [databaseName],
    );

    for (const { TABLE_NAME } of tables) {
      await dataSource.query(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    return;
  }

  throw new Error(`Unsupported database driver: ${driverType as string}`);
}

export async function seedBaselineData(dataSource: DataSource): Promise<void> {
  const departmentRepo = dataSource.getRepository(Department);
  const reservationTypeRepo = dataSource.getRepository(ReservationType);
  const staffRepo = dataSource.getRepository(Staff);

  // Seed all departments used in tests
  const departmentIds = ['DEFAULT', 'ER', 'RAD', 'VAC', 'CARD'];
  const departments: Department[] = [];

  for (const id of departmentIds) {
    let dept = await departmentRepo.findOne({ where: { id } });
    if (!dept) {
      dept = departmentRepo.create({
        id,
        name: `${id} Department`,
        active: true,
      });
      dept = await departmentRepo.save(dept);
    }
    departments.push(dept);
  }

  const defaultDepartment = departments[0];

  const existingType = await reservationTypeRepo.findOne({
    where: { name: 'Baseline Vaccination' },
  });
  if (!existingType) {
    const baselineReservationType = reservationTypeRepo.create({
      name: 'Baseline Vaccination',
      description: 'Seeded reservation type for smoke tests',
      active: true,
    });
    await reservationTypeRepo.save(baselineReservationType);
  }

  const seedStaffId = 'seed-user-001';
  const existingStaff = await staffRepo.findOne({
    where: { staffId: seedStaffId },
  });
  if (!existingStaff) {
    const pepperEnv = process.env.SECURITY_PIN_PEPPER ?? '';
    let pepper: string;
    try {
      pepper = Buffer.from(pepperEnv, 'base64').toString('utf8');
    } catch {
      pepper = pepperEnv;
    }
    const pinHash = await argon2.hash('0000' + pepper, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 64 * 1024,
      parallelism: 1,
    });

    const now = new Date();
    const seedStaff = staffRepo.create({
      staffId: seedStaffId,
      emrPatientId: null,
      familyName: 'Seed',
      givenName: 'User',
      familyNameKana: null,
      givenNameKana: null,
      jobTitle: 'Tester',
      department: defaultDepartment,
      departmentId: defaultDepartment.id,
      dateOfBirth: '1990-01-01',
      sexCode: '1',
      pinHash,
      pinRetryCount: 0,
      pinLockedUntil: null,
      pinUpdatedAt: now,
      pinVersion: 1,
      pinMustChange: false,
      version: 0,
      status: 'active',
      role: 'STAFF',
      lastLoginAt: null,
    });

    await staffRepo.save(seedStaff);
  }
}

export async function closeTestApp(
  app: INestApplication | undefined | null,
): Promise<void> {
  if (!app) return;
  await app.close();
}

export function buildCsv(rows: string[][]): string {
  return rows.map((cells) => cells.join(',')).join('\n');
}

export function adminHeaders(idempotencyKey: string): Record<string, string> {
  return {
    'X-Admin-Token': process.env.ADMIN_TOKEN ?? 'test-admin-token',
    'Idempotency-Key': idempotencyKey,
  };
}
