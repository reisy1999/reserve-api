// src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import bodyParser from 'body-parser';
import { AppModule } from './app.module';
import { configureApp } from './app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(
    bodyParser.text({ type: ['text/plain', 'text/csv', 'application/csv'] }),
  );
  configureApp(app);
  await app.listen(3000);
  const logger = new Logger('Bootstrap');
  logger.log('🚀 Server is running on http://localhost:3000');
}
void bootstrap();
