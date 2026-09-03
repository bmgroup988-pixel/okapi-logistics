import type { Env } from './env.schema';

/** Vue typée de la configuration, injectable via `ConfigService<AppConfig>`. */
export interface AppConfig {
  env: Env['NODE_ENV'];
  port: number;
  apiBaseUrl: string;
  publicTrackingBaseUrl: string;
  corsOrigins: string[];
  database: { url: string };
  redis: { url: string };
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle: boolean;
    internalTtlSeconds: number;
    clientTtlSeconds: number;
  };
  fx: {
    referenceCurrency: string;
    provider: string;
    apiBase: string;
    apiKey?: string;
    staleHours: number;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  defaultLocale: Env['DEFAULT_LOCALE'];
  trackingSequenceScope: Env['TRACKING_SEQUENCE_SCOPE'];
  contactEmail: string;
}

export function buildConfig(env: Env): AppConfig {
  return {
    env: env.NODE_ENV,
    port: env.API_PORT,
    apiBaseUrl: env.API_BASE_URL,
    publicTrackingBaseUrl: env.PUBLIC_TRACKING_BASE_URL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    storage: {
      endpoint: env.S3_ENDPOINT.replace(/\/+$/, ''),
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      internalTtlSeconds: env.S3_PUBLIC_URL_TTL_SECONDS,
      clientTtlSeconds: env.S3_CLIENT_URL_TTL_SECONDS,
    },
    fx: {
      referenceCurrency: env.REFERENCE_CURRENCY,
      provider: env.FX_PROVIDER,
      apiBase: env.FX_API_BASE,
      apiKey: env.FX_API_KEY,
      staleHours: env.FX_STALE_HOURS,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    defaultLocale: env.DEFAULT_LOCALE,
    trackingSequenceScope: env.TRACKING_SEQUENCE_SCOPE,
    contactEmail: env.CONTACT_EMAIL,
  };
}
