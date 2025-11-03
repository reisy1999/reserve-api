import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReservationsModule } from './reservations/reservations.module';
import { StaffModule } from './staff/staff.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { SecurityModule } from './security/security.module';
import { ReservationTypeModule } from './reservation-type/reservation-type.module';

function buildTypeOrmConfig(): Parameters<typeof TypeOrmModule.forRoot>[0] {
  const isTestEnv = process.env.NODE_ENV === 'test';
  const configuredType = (process.env.DB_TYPE ?? '').toLowerCase();
  const useSqliteForTests =
    isTestEnv && configuredType !== 'mysql' && configuredType !== 'mariadb';

  if (useSqliteForTests) {
    return {
      // Local/unit tests: SQLite for speed and isolation
      type: 'sqlite',
      database: `test-${process.env.JEST_WORKER_ID ?? '0'}.sqlite`,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      dropSchema: true,
      logging: false,
    };
  }

  const dbType = (configuredType || 'mysql') as 'mysql' | 'mariadb';

  return {
    // Default / E2E / production-style runs: MySQL family
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'reserve_user',
    password: process.env.DB_PASSWORD || 'reserve_password_change_me',
    database: process.env.DB_DATABASE || 'reserve_db',
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    charset: 'utf8mb4',
    timezone: '+09:00',
  };
}

@Module({
  imports: [
    SecurityModule,
    TypeOrmModule.forRoot(buildTypeOrmConfig()),
    AuthModule,
    StaffModule,
    ReservationsModule,
    AdminModule,
    ReservationTypeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        bodyParser.text({
          type: ['text/plain', 'text/csv', 'application/csv'],
        }),
      )
      .forRoutes('*');
  }
}
