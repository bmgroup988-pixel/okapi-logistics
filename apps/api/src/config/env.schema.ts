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

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('eu-west-par'),
  S3_BUCKET: z.string().default('okapi-photos'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  S3_PUBLIC_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  S3_CLIENT_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  REFERENCE_CURRENCY: z.string().length(3).default('USD'),
  FX_PROVIDER: z.string().default('exchangerate.host'),
  FX_API_BASE: z.string().url().default('https://api.exchangerate.host'),
  FX_API_KEY: z.string().optional(),
  FX_STALE_HOURS: z.coerce.number().int().positive().default(36),

  JWT_ACCESS_SECRET: z.string().min(8).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(8).default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),

  DEFAULT_LOCALE: z.enum(['fr', 'en', 'zh', 'sw', 'ln']).default('fr'),
  TRACKING_SEQUENCE_SCOPE: z.enum(['DESTINATION_CITY', 'GLOBAL']).default('DESTINATION_CITY'),
  CONTACT_EMAIL: z.string().default('contact.gokapi@gmail.com'),
  SEED_PASSWORD: z.string().default('OkapiDev!2026'),

  // ------------------------------------------------------- Notifications
  // Tous optionnels : tant qu'un fournisseur n'est pas configuré (clé
  // absente), le canal correspondant retombe sur le fournisseur "console"
  // (journalisation locale, aucun envoi réel) — voir notifications/providers.
  NOTIFICATIONS_DISPATCH_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  NOTIFICATIONS_DISPATCH_BATCH_SIZE: z.coerce.number().int().positive().default(20),
  NOTIFICATIONS_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // Amazon SES v2 (e-mail) — signature AWS SigV4 maison, pas de aws-sdk.
  SES_REGION: z.string().optional(),
  SES_ACCESS_KEY: z.string().optional(),
  SES_SECRET_KEY: z.string().optional(),
  SES_FROM_EMAIL: z.string().optional(),

  // Meta WhatsApp Business Cloud API.
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),

  // Passerelle SMS générique (Africa's Talking, Twilio, Vonage, ...) —
  // interchangeable sans changer le code appelant (NotificationProvider).
  SMS_GATEWAY_URL: z.string().url().default('https://api.africastalking.com/version1/messaging'),
  SMS_GATEWAY_USERNAME: z.string().optional(),
  SMS_GATEWAY_API_KEY: z.string().optional(),
  SMS_GATEWAY_SENDER_ID: z.string().optional(),
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
