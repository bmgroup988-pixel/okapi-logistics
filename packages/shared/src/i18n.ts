import type { Locale } from './schemas.js';
import type { NotificationChannel, NotificationTrigger } from './enums.js';

export const LOCALES: Locale[] = ['fr', 'en', 'zh'];
export const DEFAULT_LOCALE: Locale = 'fr';

export function resolveLocale(input: string | undefined | null): Locale {
  const v = (input ?? '').slice(0, 2).toLowerCase();
  return (LOCALES as string[]).includes(v) ? (v as Locale) : DEFAULT_LOCALE;
}

/**
 * Modèles de notification par défaut (EF-NOT-03). Variables : {{numero_suivi}},
 * {{statut}}, {{ville_destination}}, {{ville_actuelle}}, {{lien_suivi}},
 * {{solde}}, {{devise}}. Éditables ensuite via la configuration (W-SAD-06).
 */
export const DEFAULT_NOTIFICATION_TEMPLATES: Record<
  NotificationTrigger,
  Record<Locale, { subject?: string; body: string }>
> = {
  STATUS_CHANGE: {
    fr: {
      subject: 'Okapi Logistics — colis {{numero_suivi}}',
      body: 'Bonjour, votre colis {{numero_suivi}} est maintenant « {{statut}} ». Suivi : {{lien_suivi}}',
    },
    en: {
      subject: 'Okapi Logistics — parcel {{numero_suivi}}',
      body: 'Hello, your parcel {{numero_suivi}} is now "{{statut}}". Track it: {{lien_suivi}}',
    },
    zh: {
      subject: 'Okapi Logistics — 包裹 {{numero_suivi}}',
      body: '您好，您的包裹 {{numero_suivi}} 当前状态为“{{statut}}”。查询：{{lien_suivi}}',
    },
  },
  PAYMENT_RECEIVED: {
    fr: {
      subject: 'Okapi Logistics — paiement reçu',
      body: 'Nous avons bien reçu un paiement pour le colis {{numero_suivi}}. Suivi : {{lien_suivi}}',
    },
    en: {
      subject: 'Okapi Logistics — payment received',
      body: 'We received a payment for parcel {{numero_suivi}}. Track it: {{lien_suivi}}',
    },
    zh: {
      subject: 'Okapi Logistics — 已收到付款',
      body: '我们已收到包裹 {{numero_suivi}} 的付款。查询：{{lien_suivi}}',
    },
  },
  UNPAID_ON_ARRIVAL: {
    fr: {
      subject: 'Okapi Logistics — solde à régler',
      body: 'Votre colis {{numero_suivi}} est arrivé à {{ville_destination}}. Un solde reste à régler avant la livraison. Suivi : {{lien_suivi}}',
    },
    en: {
      subject: 'Okapi Logistics — balance due',
      body: 'Your parcel {{numero_suivi}} has arrived in {{ville_destination}}. A balance is due before delivery. Track it: {{lien_suivi}}',
    },
    zh: {
      subject: 'Okapi Logistics — 待付余款',
      body: '您的包裹 {{numero_suivi}} 已到达 {{ville_destination}}。提货前需结清余款。查询：{{lien_suivi}}',
    },
  },
  DUNNING_REMINDER: {
    fr: {
      subject: 'Okapi Logistics — rappel de paiement',
      body: 'Rappel : le colis {{numero_suivi}} ne pourra être livré qu’une fois le solde réglé. Suivi : {{lien_suivi}}',
    },
    en: {
      subject: 'Okapi Logistics — payment reminder',
      body: 'Reminder: parcel {{numero_suivi}} can only be delivered once the balance is paid. Track it: {{lien_suivi}}',
    },
    zh: {
      subject: 'Okapi Logistics — 付款提醒',
      body: '提醒：包裹 {{numero_suivi}} 需结清余款后方可派送。查询：{{lien_suivi}}',
    },
  },
  DELIVERED: {
    fr: {
      subject: 'Okapi Logistics — colis livré',
      body: 'Votre colis {{numero_suivi}} a été livré. Merci d’avoir choisi Okapi Logistics.',
    },
    en: {
      subject: 'Okapi Logistics — parcel delivered',
      body: 'Your parcel {{numero_suivi}} has been delivered. Thank you for choosing Okapi Logistics.',
    },
    zh: {
      subject: 'Okapi Logistics — 包裹已送达',
      body: '您的包裹 {{numero_suivi}} 已送达。感谢您选择 Okapi Logistics。',
    },
  },
};

/** Rendu minimal d'un gabarit `{{var}}` -> valeur. */
export function renderTemplate(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`,
  );
}

/** Libellés de statut colis pour le client, par langue. */
export const PARCEL_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    ENREGISTRE: 'Enregistré',
    EN_TRANSIT: 'En transit',
    ARRIVE: 'Arrivé',
    LIVRE: 'Livré',
    ANNULE: 'Annulé',
    RETOURNE: 'Retourné',
  },
  en: {
    ENREGISTRE: 'Registered',
    EN_TRANSIT: 'In transit',
    ARRIVE: 'Arrived',
    LIVRE: 'Delivered',
    ANNULE: 'Cancelled',
    RETOURNE: 'Returned',
  },
  zh: {
    ENREGISTRE: '已登记',
    EN_TRANSIT: '运输中',
    ARRIVE: '已到达',
    LIVRE: '已送达',
    ANNULE: '已取消',
    RETOURNE: '已退回',
  },
};

export type { NotificationChannel };
