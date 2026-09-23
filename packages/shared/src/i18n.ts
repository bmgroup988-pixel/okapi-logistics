import type { Locale } from './schemas.js';
import type { NotificationChannel, NotificationTrigger } from './enums.js';

export const LOCALES: Locale[] = ['fr', 'en', 'zh', 'sw', 'ln'];
export const DEFAULT_LOCALE: Locale = 'fr';

export function resolveLocale(input: string | undefined | null): Locale {
  const v = (input ?? '').slice(0, 2).toLowerCase();
  return (LOCALES as string[]).includes(v) ? (v as Locale) : DEFAULT_LOCALE;
}

/**
 * Modèles de notification par défaut (EF-NOT-03). Variables : {{numero_suivi}},
 * {{statut}}, {{ville_destination}}, {{ville_actuelle}}, {{lien_suivi}},
 * {{delai_recuperation}}, {{solde}}, {{devise}}. Éditables ensuite via la
 * configuration (W-SAD-06).
 */
export const DEFAULT_NOTIFICATION_TEMPLATES: Record<
  NotificationTrigger,
  Record<Locale, { subject?: string; body: string }>
> = {
  STATUS_CHANGE: {
    fr: {
      subject: 'Okapi Logistics — colis {{numero_suivi}}',
      body: 'Bonjour, votre colis {{numero_suivi}} est maintenant « {{statut}} ».{{delai_recuperation}} Suivi : {{lien_suivi}}',
    },
    en: {
      subject: 'Okapi Logistics — parcel {{numero_suivi}}',
      body: 'Hello, your parcel {{numero_suivi}} is now "{{statut}}".{{delai_recuperation}} Track it: {{lien_suivi}}',
    },
    zh: {
      subject: 'Okapi Logistics — 包裹 {{numero_suivi}}',
      body: '您好，您的包裹 {{numero_suivi}} 当前状态为"{{statut}}"。{{delai_recuperation}} 查询：{{lien_suivi}}',
    },
    sw: {
      subject: 'Okapi Logistics — mzigo {{numero_suivi}}',
      body: 'Habari, mzigo wako {{numero_suivi}} sasa uko katika hali « {{statut}} ».{{delai_recuperation}} Fuatilia: {{lien_suivi}}',
    },
    ln: {
      subject: 'Okapi Logistics — kolo {{numero_suivi}}',
      body: 'Mbote, kolo na yo {{numero_suivi}} ezali sikoyo na etat « {{statut}} ».{{delai_recuperation}} Landá yango: {{lien_suivi}}',
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
    sw: {
      subject: 'Okapi Logistics — malipo yamepokelewa',
      body: 'Tumepokea malipo kwa mzigo {{numero_suivi}}. Fuatilia: {{lien_suivi}}',
    },
    ln: {
      subject: 'Okapi Logistics — nde yozwami',
      body: 'Tozwi nde mpo na kolo {{numero_suivi}}. Landá yango: {{lien_suivi}}',
    },
  },
  UNPAID_ON_ARRIVAL: {
    fr: {
      subject: 'Okapi Logistics — solde à régler',
      body: 'Votre colis {{numero_suivi}} est arrivé à {{ville_destination}}. Un solde reste à régler avant la livraison.{{delai_recuperation}} Suivi : {{lien_suivi}}',
    },
    en: {
      subject: 'Okapi Logistics — balance due',
      body: 'Your parcel {{numero_suivi}} has arrived in {{ville_destination}}. A balance is due before delivery.{{delai_recuperation}} Track it: {{lien_suivi}}',
    },
    zh: {
      subject: 'Okapi Logistics — 待付余款',
      body: '您的包裹 {{numero_suivi}} 已到达 {{ville_destination}}。提货前需结清余款。{{delai_recuperation}} 查询：{{lien_suivi}}',
    },
    sw: {
      subject: 'Okapi Logistics — salio la kulipa',
      body: 'Mzigo wako {{numero_suivi}} umefika {{ville_destination}}. Bado kuna salio la kulipa kabla ya kupokea mzigo.{{delai_recuperation}} Fuatilia: {{lien_suivi}}',
    },
    ln: {
      subject: 'Okapi Logistics — mbongo etikali',
      body: 'Kolo na yo {{numero_suivi}} ekomi na {{ville_destination}}. Mbongo mosusu etikali ete ofuta liboso ya kozwa yango.{{delai_recuperation}} Landá yango: {{lien_suivi}}',
    },
  },
  DUNNING_REMINDER: {
    fr: {
      subject: 'Okapi Logistics — rappel de paiement',
      body: 'Rappel : le colis {{numero_suivi}} ne pourra être livré qu’une fois le solde réglé.{{delai_recuperation}} Suivi : {{lien_suivi}}',
    },
    en: {
      subject: 'Okapi Logistics — payment reminder',
      body: 'Reminder: parcel {{numero_suivi}} can only be delivered once the balance is paid.{{delai_recuperation}} Track it: {{lien_suivi}}',
    },
    zh: {
      subject: 'Okapi Logistics — 付款提醒',
      body: '提醒：包裹 {{numero_suivi}} 需结清余款后方可派送。{{delai_recuperation}} 查询：{{lien_suivi}}',
    },
    sw: {
      subject: 'Okapi Logistics — ukumbusho wa malipo',
      body: 'Ukumbusho: mzigo {{numero_suivi}} utatolewa tu baada ya salio kulipwa.{{delai_recuperation}} Fuatilia: {{lien_suivi}}',
    },
    ln: {
      subject: 'Okapi Logistics — souvenance ya nde',
      body: 'Souvenance: kolo {{numero_suivi}} ekopesama kaka soki mbongo etikali efuti.{{delai_recuperation}} Landá yango: {{lien_suivi}}',
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
    sw: {
      subject: 'Okapi Logistics — mzigo umetolewa',
      body: 'Mzigo wako {{numero_suivi}} umetolewa. Asante kwa kuchagua Okapi Logistics.',
    },
    ln: {
      subject: 'Okapi Logistics — kolo epesami',
      body: 'Kolo na yo {{numero_suivi}} epesami. Melesi mpo na kopona Okapi Logistics.',
    },
  },
};

/**
 * Rappel du délai de récupération (72h / 3 jours max après arrivée à
 * l'agence) — injecté dans {{delai_recuperation}} uniquement quand le colis
 * vient d'arriver (voir NotificationsService.enqueueForParcel). Espace de
 * tête, pas d'espace de fin (le gabarit fournit déjà l'espacement autour).
 */
export const PICKUP_DEADLINE_REMINDER: Record<Locale, string> = {
  fr: ' Merci de le récupérer sous 72h (3 jours) maximum.',
  en: ' Please collect it within 72h (3 days) maximum.',
  zh: ' 请在72小时（3天）内取件。',
  sw: ' Tafadhali chukua mzigo ndani ya saa 72 (siku 3) zaidi.',
  ln: ' Bondeli kozwa kolo na kati ya ngonga 72 (mikolo 3) mingi.',
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
  sw: {
    ENREGISTRE: 'Imesajiliwa',
    EN_TRANSIT: 'Njiani',
    ARRIVE: 'Imefika',
    LIVRE: 'Imetolewa',
    ANNULE: 'Imefutwa',
    RETOURNE: 'Imerudishwa',
  },
  ln: {
    ENREGISTRE: 'Ekomami',
    EN_TRANSIT: 'Na nzela',
    ARRIVE: 'Ekomi',
    LIVRE: 'Epesami',
    ANNULE: 'Elongolami',
    RETOURNE: 'Ezongisami',
  },
};

export type { NotificationChannel };
