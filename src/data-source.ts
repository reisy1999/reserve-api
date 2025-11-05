import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables from .env.dev for local development
dotenv.config({ path: '.env.dev' });

const dbType = (process.env.DB_TYPE || 'mysql') as 'mysql' | 'mariadb';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || process.env.MYSQL_USER || 'reserve_user',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'reserve_password',
  database: process.env.DB_DATABASE || process.env.MYSQL_DATABASE || 'reserve_db',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, // Never use synchronize in migrations
  logging: process.env.DB_LOGGING === 'true',
  charset: 'utf8mb4',
  timezone: '+09:00',
});
