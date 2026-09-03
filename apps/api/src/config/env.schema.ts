import { z } from 'zod';

/** Validation de l'environnement au démarrage (@nestjs/config `validate`). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  PUBLIC_TRACKING_BASE_URL: z.string().url().default('http://localhost:3001'),
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:5173'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  REFERENCE_CURRENCY: z.string().length(3).default('USD'),
  FX_PROVIDER: z.string().default('exchangerate.host'),
  FX_API_BASE: z.string().url().default('https://api.exchangerate.host'),
  FX_API_KEY: z.string().optional(),
  FX_STALE_HOURS: z.coerce.number().int().positive().default(36),

  JWT_ACCESS_SECRET: z.string().min(8).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(8).default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),

  DEFAULT_LOCALE: z.enum(['fr', 'en', 'zh']).default('fr'),
  TRACKING_SEQUENCE_SCOPE: z.enum(['DESTINATION_CITY', 'GLOBAL']).default('DESTINATION_CITY'),
  CONTACT_EMAIL: z.string().default('contact.gokapi@gmail.com'),
  SEED_PASSWORD: z.string().default('OkapiDev!2026'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration d'environnement invalide :\n${details}`);
  }
  return parsed.data;
}
