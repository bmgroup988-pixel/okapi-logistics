import { z } from 'zod';
import {
  TRANSPORT_MODES,
  PAYMENT_METHODS,
  MOBILE_MONEY_PROVIDERS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGERS,
  CITY_STATUSES,
  SETTLEMENT_MODES,
} from './enums.js';

/** Schémas de validation partagés front / back (Zod). */

const decimalString = (opts?: { min?: number }) =>
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'nombre décimal attendu (chaîne)')
    .refine((v) => opts?.min === undefined || Number(v) >= opts.min, {
      message: `doit être >= ${opts?.min}`,
    });

const positiveDecimalString = z.string().regex(/^\d+(\.\d+)?$/, 'nombre décimal positif attendu');
const weightString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'poids en kg, max 2 décimales');
const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'code ISO 4217 (3 lettres majuscules)');
const uuid = z.string().uuid();

export const localeSchema = z.enum(['fr', 'en', 'zh', 'sw', 'ln']);
export type Locale = z.infer<typeof localeSchema>;

export const moneyInputSchema = z.object({
  amount: decimalString({ min: 0 }),
  currency: currencyCode,
});

export const contactSchema = z.object({
  name: z.string().min(1).max(160),
  phone: z.string().min(3).max(32).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  cityLabel: z.string().max(160).optional().nullable(),
  countryLabel: z.string().max(160).optional().nullable(),
  idDocumentRef: z.string().max(120).optional().nullable(),
});

export const consentSchema = z.object({
  given: z.literal(true),
  textVersion: z.string().min(1).max(64),
});

export const parcelCreateSchema = z.object({
  sender: contactSchema,
  recipient: contactSchema,
  originCityId: uuid,
  destinationCityId: uuid,
  /**
   * Agence d'enregistrement explicite — requise pour un compte sans agence
   * unique par défaut (ex. DAF national, secours en cas d'indisponibilité
   * des agents). Ignorée si le compte a déjà une agence unique.
   */
  registrationAgencyId: uuid.optional().nullable(),
  /**
   * Partenaire de livraison choisi pour une destination `PARTNER` — addendum
   * 08, §1.4. Optionnel : à défaut, le partenaire `isPreferred` actif de la
   * ville est retenu automatiquement ; requis explicitement s'il en existe
   * plusieurs sans préféré.
   */
  deliveryPartnerId: uuid.optional().nullable(),
  /**
   * Agence de destination choisie pour une destination `HUB`. Optionnel : à
   * défaut, l'unique agence active de la ville est retenue automatiquement ;
   * requis explicitement s'il en existe plusieurs (même logique que
   * `deliveryPartnerId` pour les villes `PARTNER`).
   */
  destinationAgencyId: uuid.optional().nullable(),
  transportMode: z.enum(TRANSPORT_MODES),
  weightKg: weightString,
  contentNature: z.string().min(1).max(500),
  declaredValue: moneyInputSchema.optional(),
  billingCurrency: currencyCode.optional(),
  pricingOverridePct: decimalString().optional(),
  clientChannel: z.enum(NOTIFICATION_CHANNELS).optional().nullable(),
  clientLocale: localeSchema.default('fr'),
  consent: consentSchema,
});
export type ParcelCreateInput = z.infer<typeof parcelCreateSchema>;

export const parcelUpdateSchema = parcelCreateSchema
  .pick({
    sender: true,
    recipient: true,
    contentNature: true,
    declaredValue: true,
    weightKg: true,
    clientChannel: true,
    clientLocale: true,
  })
  .partial();
export type ParcelUpdateInput = z.infer<typeof parcelUpdateSchema>;

export const parcelTransitionSchema = z
  .object({
    to: z.enum(['EN_TRANSIT', 'ARRIVE', 'HANDED_TO_PARTNER', 'LIVRE', 'RETOURNE']),
    locationCityId: uuid.optional().nullable(),
    /** Lieu/pays de transit en texte libre — modifiable à chaque transition. */
    locationLabel: z.string().max(160).optional().nullable(),
    note: z.string().max(1000).optional().nullable(),
    visibleToClient: z.boolean().default(true),
    /** justification obligatoire pour livrer avec un solde impayé — RG-08 */
    unpaidOverrideReason: z.string().max(500).optional().nullable(),
    /**
     * Partenaire de livraison retenu pour la remise — requis pour
     * `to: 'HANDED_TO_PARTNER'`, permet à l'agent de corriger le partenaire
     * choisi à la création si la zone du destinataire l'exige (addendum 08,
     * §1.4).
     */
    deliveryPartnerId: uuid.optional().nullable(),
    /** Compagnie de transport choisie pour l'expédition (typiquement à EN_TRANSIT). */
    carrierId: uuid.optional().nullable(),
    /**
     * Date/heure réelle de l'événement, si différente du moment de la
     * saisie (ex. expédition enregistrée après coup) — défaut : maintenant.
     */
    occurredAt: z.string().datetime().optional(),
  })
  .refine((d) => d.to !== 'HANDED_TO_PARTNER' || !!d.deliveryPartnerId, {
    message: 'deliveryPartnerId est requis pour remettre le colis à un partenaire',
    path: ['deliveryPartnerId'],
  });
export type ParcelTransitionInput = z.infer<typeof parcelTransitionSchema>;

export const parcelCancelSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const paymentCreateSchema = z
  .object({
    amount: positiveDecimalString,
    currency: currencyCode,
    method: z.enum(PAYMENT_METHODS),
    mobileMoneyProvider: z.enum(MOBILE_MONEY_PROVIDERS).optional().nullable(),
    externalRef: z.string().max(200).optional().nullable(),
    receivedAt: z.string().datetime().optional(),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((d) => d.method !== 'MOBILE_MONEY' || !!d.mobileMoneyProvider, {
    message: 'mobileMoneyProvider est requis pour un paiement MOBILE_MONEY',
    path: ['mobileMoneyProvider'],
  });
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const paymentRefundSchema = z.object({
  amount: positiveDecimalString.optional(),
  reason: z.string().min(3).max(500),
});

export const photoConfirmSchema = z.object({
  storageKey: z.string().min(1).max(400),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'empreinte SHA-256 hexadécimale'),
  bytes: z.number().int().positive(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  isPrimary: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const manualRateSchema = z.object({
  baseCurrency: currencyCode,
  /** 1 baseCurrency = rate (devise de référence) */
  rate: positiveDecimalString,
  effectiveFrom: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

export const tariffUpsertSchema = z.object({
  corridorId: uuid.optional().nullable(),
  // `originCityId` absent/null = tarif « toutes origines » vers cette destination
  // (2e palier de résolution — pricing.service.ts). `destinationCityId` seul
  // suffit donc déjà à définir une cible valide ; pas de refine supplémentaire.
  originCityId: uuid.optional().nullable(),
  destinationCityId: uuid,
  mode: z.enum(TRANSPORT_MODES),
  currency: currencyCode,
  pricePerKg: positiveDecimalString,
  fixedFee: positiveDecimalString.default('0'),
  minCharge: positiveDecimalString.default('0'),
  adValoremEnabled: z.boolean().default(false),
  adValoremRate: positiveDecimalString.default('0'),
  overrideMin: decimalString().default('-0.15'),
  overrideMax: decimalString().default('0.15'),
  validFrom: z.string().date().optional(),
});

export const quoteRequestSchema = z.object({
  originCityId: uuid,
  destinationCityId: uuid,
  mode: z.enum(TRANSPORT_MODES),
  weightKg: weightString,
  declaredValue: moneyInputSchema.optional(),
  billingCurrency: currencyCode.optional(),
});

export const notificationTemplateSchema = z.object({
  trigger: z.enum(NOTIFICATION_TRIGGERS),
  channel: z.enum(NOTIFICATION_CHANNELS),
  locale: localeSchema,
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(4000),
  isActive: z.boolean().default(true),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(64).optional(),
});

export const parcelListQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  destinationCityId: uuid.optional(),
  agencyId: uuid.optional(),
  countryId: uuid.optional(),
  transportMode: z.enum(TRANSPORT_MODES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().max(120).optional(),
});

/* ------------------------------------------------------------------------ */
/* Addendum 08 — réseau (26 provinces), partenaires de livraison, règlements */
/* ------------------------------------------------------------------------ */

export const cityCreateSchema = z.object({
  code: z.string().regex(/^[A-Z]{3}$/, 'code à 3 lettres majuscules (IATA de préférence)'),
  nameKey: z.string().min(1).max(120),
  countryId: uuid,
  timezone: z.string().min(1).max(64),
  status: z.enum(CITY_STATUSES).default('PLANNED'),
  isOrigin: z.boolean().default(true),
  isDestination: z.boolean().default(true),
});
export type CityCreateInput = z.infer<typeof cityCreateSchema>;

export const cityUpdateSchema = z.object({
  status: z.enum(CITY_STATUSES).optional(),
  nameKey: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(64).optional(),
  isOrigin: z.boolean().optional(),
  isDestination: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type CityUpdateInput = z.infer<typeof cityUpdateSchema>;

export const deliveryPartnerUpsertSchema = z.object({
  cityId: uuid,
  name: z.string().min(1).max(200),
  coverageZone: z.string().max(300).optional().nullable(),
  contactName: z.string().max(160).optional().nullable(),
  contactPhone: z.string().max(32).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable(),
  commissionPct: decimalString().optional().nullable(),
  settlementMode: z.enum(SETTLEMENT_MODES).default('PER_KG'),
  reliabilityNote: z.string().max(500).optional().nullable(),
  isPreferred: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type DeliveryPartnerUpsertInput = z.infer<typeof deliveryPartnerUpsertSchema>;

export const partnerTariffCreateSchema = z.object({
  pricePerKg: positiveDecimalString,
  currency: currencyCode,
  minWeightKg: weightString.optional().nullable(),
  effectiveFrom: z.string().date().optional(),
});
export type PartnerTariffCreateInput = z.infer<typeof partnerTariffCreateSchema>;

export const partnerSettlementGenerateSchema = z.object({
  deliveryPartnerId: uuid,
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
});
export type PartnerSettlementGenerateInput = z.infer<typeof partnerSettlementGenerateSchema>;

export const partnerSettlementUpdateSchema = z.object({
  status: z.enum(['VALIDATED', 'PAID']),
  paymentReference: z.string().max(200).optional().nullable(),
});
export type PartnerSettlementUpdateInput = z.infer<typeof partnerSettlementUpdateSchema>;

export const partnerSettlementListQuerySchema = z.object({
  deliveryPartnerId: uuid.optional(),
  periodStart: z.string().date().optional(),
  periodEnd: z.string().date().optional(),
});

/* ------------------------------------------------------------------------ */
/* Module fournisseurs — expéditions groupées, facturation consolidée (docs/11) */
/* ------------------------------------------------------------------------ */

export const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(160).optional().nullable(),
  contactPhone: z.string().max(32).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  countryId: uuid,
  defaultAgencyId: uuid,
  billingCurrency: currencyCode,
});
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;

export const supplierUpdateSchema = supplierCreateSchema
  .omit({ countryId: true, defaultAgencyId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

export const supplierPortalActivateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(160),
});
export type SupplierPortalActivateInput = z.infer<typeof supplierPortalActivateSchema>;

export const groupageCreateSchema = z.object({
  destinationAgencyId: uuid,
  note: z.string().max(500).optional().nullable(),
});
export type GroupageCreateInput = z.infer<typeof groupageCreateSchema>;

export const groupageAddParcelSchema = z.object({
  parcelId: uuid,
});
export type GroupageAddParcelInput = z.infer<typeof groupageAddParcelSchema>;

export const carrierUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(160).optional().nullable(),
  contactPhone: z.string().max(32).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CarrierUpsertInput = z.infer<typeof carrierUpsertSchema>;

/** Ajout d'un colis (un client final) à une expédition ouverte — docs/11 §2.3/§6.2. */
export const supplierPortalParcelCreateSchema = z.object({
  recipientName: z.string().min(1).max(160),
  recipientPhone: z.string().min(3).max(32).optional().nullable(),
  destinationCityId: uuid,
  transportMode: z.enum(TRANSPORT_MODES).default('AIR'),
  weightKg: weightString,
  /** Montant dû pour ce colis, dans la devise de facturation du fournisseur. */
  amount: positiveDecimalString,
  contentNature: z.string().min(1).max(500).default('Colis fournisseur'),
});
export type SupplierPortalParcelCreateInput = z.infer<typeof supplierPortalParcelCreateSchema>;

/** Envoi d'une facture fournisseur par e-mail — à défaut, l'e-mail de contact du fournisseur. */
export const supplierInvoiceSendEmailSchema = z.object({
  recipientEmail: z.string().email().optional(),
});
export type SupplierInvoiceSendEmailInput = z.infer<typeof supplierInvoiceSendEmailSchema>;
