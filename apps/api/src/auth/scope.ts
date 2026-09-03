import type { Prisma } from '@prisma/client';
import type { CurrentUser } from './current-user';

/**
 * Filtres de périmètre (RG-10). Un compte non global ne voit que les colis /
 * paiements de ses agences ou de ses pays.
 */
export function parcelScopeWhere(user: CurrentUser): Prisma.ParcelWhereInput {
  if (user.scope.isGlobal) return {};
  const or: Prisma.ParcelWhereInput[] = [];
  if (user.scope.agencyIds.length) or.push({ registrationAgencyId: { in: user.scope.agencyIds } });
  if (user.scope.countryIds.length) or.push({ countryId: { in: user.scope.countryIds } });
  // aucun périmètre défini -> ne voit rien
  return or.length ? { OR: or } : { id: '00000000-0000-0000-0000-000000000000' };
}

export function paymentScopeWhere(user: CurrentUser): Prisma.PaymentWhereInput {
  if (user.scope.isGlobal) return {};
  const or: Prisma.PaymentWhereInput[] = [];
  if (user.scope.agencyIds.length) or.push({ agencyId: { in: user.scope.agencyIds } });
  if (user.scope.countryIds.length) or.push({ countryId: { in: user.scope.countryIds } });
  return or.length ? { OR: or } : { id: '00000000-0000-0000-0000-000000000000' };
}

export function canActOnAgency(user: CurrentUser, agencyId: string): boolean {
  return user.scope.isGlobal || user.scope.agencyIds.includes(agencyId);
}

/** Agence par défaut pour une création (agent mono-agence). */
export function defaultAgencyId(user: CurrentUser): string | null {
  return user.scope.agencyIds.length === 1 ? user.scope.agencyIds[0]! : null;
}
