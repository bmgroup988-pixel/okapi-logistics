import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { BillingModule } from './billing/billing.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { buildConfig } from './config/configuration';
import { validateEnv, type Env } from './config/env.schema';
import { FxModule } from './fx/fx.module';
import { HealthModule } from './health/health.module';
import { IamModule } from './iam/iam.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ParcelsModule } from './parcels/parcels.module';
import { PaymentsModule } from './payments/payments.module';
import { PricingModule } from './pricing/pricing.module';
import { PublicTrackingModule } from './public-tracking/public-tracking.module';
import { ReferenceModule } from './reference/reference.module';
import { PrismaModule } from './prisma/prisma.module';
import { SequenceModule } from './sequences/sequence.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { TariffsModule } from './tariffs/tariffs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [() => ({ app: buildConfig(validateEnv(process.env)) })],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
        return { throttlers: [{ ttl: 60_000, limit: isProd ? 120 : 1_000 }] };
      },
    }),
    PrismaModule,
    CommonModule,
    AuditModule,
    SequenceModule,
    FxModule,
    PricingModule,
    StorageModule,
    NotificationsModule,
    BillingModule,
    AuthModule,
    IamModule,
    SettingsModule,
    TariffsModule,
    ParcelsModule,
    PaymentsModule,
    PublicTrackingModule,
    ReferenceModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
