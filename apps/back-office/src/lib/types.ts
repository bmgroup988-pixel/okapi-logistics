export interface Money {
  amount: string;
  currency: string;
}

export interface ParcelSummary {
  id: string;
  trackingNumber: string;
  status: string;
  paymentStatus: string;
  originCityCode: string;
  destinationCityCode: string;
  transportMode: string;
  weightKg: string;
  amountDue: Money;
  amountPaid: Money;
  balance: Money;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: { total: number; page: number; limit: number; pages: number };
}

export interface ParcelEvent {
  id: string;
  status: string;
  locationLabel: string | null;
  note: string | null;
  visibleToClient: boolean;
  createdAt: string;
  createdByName: string | null;
}

export interface Contact {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  anonymized: boolean;
}

export interface Photo {
  id: string;
  url: string;
  isPrimary: boolean;
  takenAt: string;
  locked: boolean;
}

export interface ParcelDetail extends ParcelSummary {
  referenceCurrency: string;
  amountDueReference: Money;
  contentNature: string;
  declaredValue: Money;
  sender: Contact;
  recipient: Contact;
  clientChannel: string | null;
  clientLocale: string;
  events: ParcelEvent[];
  photos: Photo[];
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: Money;
  amountInBillingCurrency: Money;
  amountReference: Money;
  fxRate: string;
  method: string;
  mobileMoneyProvider: string | null;
  externalRef: string | null;
  state: string;
  receivedAt: string;
  collectedByName: string | null;
}

export interface DocumentItem {
  id: string;
  type: string;
  number: string | null;
  generatedAt: string;
  url: string;
}

export interface City {
  id: string;
  code: string;
  countryId: string;
}
