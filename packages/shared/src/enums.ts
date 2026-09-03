/** Énumérations métier — miroir des types `ENUM` PostgreSQL (voir db/schema.sql). */

export const TRANSPORT_MODES = ['AIR', 'SEA'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const PARCEL_STATUSES = [
  'ENREGISTRE',
  'EN_TRANSIT',
  'ARRIVE',
  'LIVRE',
  'ANNULE',
  'RETOURNE',
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

export const PAYMENT_STATUSES = ['IMPAYE', 'PARTIEL', 'PAYE'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PARCEL_CONTACT_ROLES = ['SENDER', 'RECIPIENT'] as const;
export type ParcelContactRole = (typeof PARCEL_CONTACT_ROLES)[number];

export const PAYMENT_METHODS = ['MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'CASH'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MOBILE_MONEY_PROVIDERS = ['MPESA', 'ORANGE_MONEY', 'AIRTEL_MONEY'] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

export const PAYMENT_STATES = ['EN_ATTENTE', 'CONFIRME', 'ECHOUE', 'REMBOURSE'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const DOCUMENT_TYPES = [
  'LABEL',
  'REGISTRATION_RECEIPT',
  'PAYMENT_RECEIPT',
  'INVOICE',
  'CREDIT_NOTE',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const FX_RATE_SOURCES = ['MANUAL', 'API'] as const;
export type FxRateSource = (typeof FX_RATE_SOURCES)[number];

export const NOTIFICATION_CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['FILE', 'ENVOYE', 'LIVRE', 'ECHEC'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_TRIGGERS = [
  'STATUS_CHANGE',
  'PAYMENT_RECEIVED',
  'UNPAID_ON_ARRIVAL',
  'DUNNING_REMINDER',
  'DELIVERED',
] as const;
export type NotificationTrigger = (typeof NOTIFICATION_TRIGGERS)[number];

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGIN_FAILED',
  'TRANSITION',
  'REFUND',
  'EXPORT',
  'CONFIG_CHANGE',
  'GDPR_ACCESS',
  'GDPR_ERASURE',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ERASURE_STATUSES = ['RECU', 'EN_COURS', 'TERMINE', 'REFUSE'] as const;
export type ErasureStatus = (typeof ERASURE_STATUSES)[number];

export const SETTING_SCOPES = ['GLOBAL', 'COUNTRY', 'AGENCY'] as const;
export type SettingScope = (typeof SETTING_SCOPES)[number];

export const ROLE_CODES = ['AGENT_FRET', 'ADMIN_DAF', 'SUPER_ADMIN'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

/** Transitions de statut colis autorisées — RG-07. */
export const PARCEL_STATUS_FLOW: Record<ParcelStatus, ParcelStatus[]> = {
  ENREGISTRE: ['EN_TRANSIT', 'ANNULE'],
  EN_TRANSIT: ['ARRIVE', 'RETOURNE'],
  ARRIVE: ['LIVRE', 'RETOURNE'],
  RETOURNE: ['ARRIVE'],
  LIVRE: [],
  ANNULE: [],
};

export function canTransition(from: ParcelStatus, to: ParcelStatus): boolean {
  return PARCEL_STATUS_FLOW[from].includes(to);
}
