import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildConfig } from './config/configuration';
import { validateEnv } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = buildConfig(validateEnv(process.env));

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableShutdownHooks();

  // rend ConfigService disponible hors DI si besoin (scripts)
  void app.get(ConfigService);

  await app.listen(config.port);
  new Logger('Bootstrap').log(
    `API Okapi Logistics prête sur ${config.apiBaseUrl}/api/v1 (env: ${config.env})`,
  );
}

bootstrap().catch((err) => {
  console.error('Échec du démarrage de l’API :', err);
  process.exit(1);
});
