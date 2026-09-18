/** Énumérations métier — miroir des types `ENUM` PostgreSQL (voir db/schema.sql). */

export const TRANSPORT_MODES = ['AIR', 'SEA'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const PARCEL_STATUSES = [
  'ENREGISTRE',
  'EN_TRANSIT',
  'ARRIVE',
  'HANDED_TO_PARTNER',
  'LIVRE',
  'ANNULE',
  'RETOURNE',
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

/** Couverture réseau d'une ville — addendum 08, §1.2. */
export const CITY_STATUSES = ['HUB', 'PARTNER', 'PLANNED'] as const;
export type CityStatus = (typeof CITY_STATUSES)[number];

/** Mode de rémunération d'un partenaire de livraison — addendum 08, §5.3. */
export const SETTLEMENT_MODES = ['PER_KG', 'PERCENT_COLLECTED'] as const;
export type SettlementMode = (typeof SETTLEMENT_MODES)[number];

/** Cycle de vie d'un règlement partenaire — addendum 08, §5.4. */
export const SETTLEMENT_STATUSES = ['DRAFT', 'VALIDATED', 'PAID'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

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

export const ROLE_CODES = ['AGENT_FRET', 'ADMIN_DAF', 'SUPER_ADMIN', 'FOURNISSEUR'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

/** Cycle de vie d'une expédition fournisseur — docs/11, §2.2. */
export const SHIPMENT_STATUSES = ['OUVERTE', 'CLOTUREE', 'ANNULEE'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/**
 * Transitions de statut colis autorisées — RG-07.
 * Étendu par l'addendum 08 (§3.2) : `ARRIVE -> HANDED_TO_PARTNER` couvre la
 * remise à un partenaire de livraison tiers pour une ville `PARTNER` ;
 * `HANDED_TO_PARTNER -> LIVRE|RETOURNE` couvre son issue.
 */
export const PARCEL_STATUS_FLOW: Record<ParcelStatus, ParcelStatus[]> = {
  ENREGISTRE: ['EN_TRANSIT', 'ANNULE'],
  EN_TRANSIT: ['ARRIVE', 'RETOURNE'],
  ARRIVE: ['LIVRE', 'HANDED_TO_PARTNER', 'RETOURNE'],
  HANDED_TO_PARTNER: ['LIVRE', 'RETOURNE'],
  RETOURNE: ['ARRIVE'],
  LIVRE: [],
  ANNULE: [],
};

export function canTransition(from: ParcelStatus, to: ParcelStatus): boolean {
  return PARCEL_STATUS_FLOW[from].includes(to);
}
