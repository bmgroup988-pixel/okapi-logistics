import type {
  ParcelStatus,
  PaymentStatus,
  PaymentState,
  TransportMode,
  NotificationChannel,
} from './enums.js';
import type { Money } from './money.js';
import type { Locale } from './schemas.js';

/** Enveloppes de réponse et DTO de l'API REST `/api/v1`. */

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Paginated<T> {
  data: T[];
  page: PageMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
}

export const API_ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENCY_MISMATCH: 'IDEMPOTENCY_KEY_MISMATCH',
  FX_RATE_MISSING: 'FX_RATE_MISSING',
  TARIFF_MISSING: 'TARIFF_MISSING',
  INVALID_TRANSITION: 'INVALID_STATUS_TRANSITION',
  UNPAID_DELIVERY_BLOCKED: 'UNPAID_DELIVERY_BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/* ------------------------------- DTO internes ------------------------------- */

export interface ParcelSummaryDto {
  id: string;
  trackingNumber: string;
  status: ParcelStatus;
  paymentStatus: PaymentStatus;
  originCityCode: string;
  destinationCityCode: string;
  transportMode: TransportMode;
  weightKg: string;
  amountDue: Money;
  amountPaid: Money;
  balance: Money;
  createdAt: string;
}

export interface ParcelEventDto {
  id: string;
  status: ParcelStatus;
  locationLabel: string | null;
  note: string | null;
  visibleToClient: boolean;
  createdAt: string;
  createdByName: string | null;
}

export interface PaymentDto {
  id: string;
  amount: Money;
  amountInBillingCurrency: Money;
  amountReference: Money;
  fxRate: string;
  method: string;
  mobileMoneyProvider: string | null;
  externalRef: string | null;
  state: PaymentState;
  receivedAt: string;
  collectedByName: string | null;
}

export interface ParcelDetailDto extends ParcelSummaryDto {
  referenceCurrency: string;
  amountDueReference: Money;
  contentNature: string;
  declaredValue: Money;
  sender: ContactDto;
  recipient: ContactDto;
  clientChannel: NotificationChannel | null;
  clientLocale: Locale;
  events: ParcelEventDto[];
  photos: PhotoDto[];
  updatedAt: string;
}

export interface ContactDto {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  anonymized: boolean;
}

export interface PhotoDto {
  id: string;
  url: string; // URL signée temporaire
  isPrimary: boolean;
  takenAt: string;
  locked: boolean;
}

/* ------------------------------- DTO publics ------------------------------- */

/** Réponse de la page publique de suivi — aucune donnée personnelle directe (EF-SUI-04). */
export interface PublicTrackingDto {
  trackingNumber: string;
  status: ParcelStatus;
  /** libellé synthétique, sans montant */
  paymentState: 'PAID' | 'PARTIAL' | 'PENDING';
  destinationCityCode: string;
  destinationCityName: string;
  registeredAt: string;
  photoUrl: string | null;
  steps: Array<{
    status: ParcelStatus;
    locationLabel: string | null;
    at: string;
  }>;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MeDto {
  id: string;
  email: string;
  fullName: string;
  locale: Locale;
  roles: Array<{
    code: string;
    scopeCountryId: string | null;
    scopeAgencyId: string | null;
  }>;
  permissions: string[];
  mfaEnabled: boolean;
}
