import type { Permission } from '@okapi/shared';

/** Contexte du compte connecté, attaché à `req.user` par le JwtAuthGuard. */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  locale: string;
  roleCodes: string[];
  permissions: Set<Permission>;
  mfaEnabled: boolean;
  /** Périmètre de données — RG-10 / ENF-SEC-04. */
  scope: {
    /** true pour SUPER_ADMIN : aucune restriction pays/agence sur les lectures. */
    isGlobal: boolean;
    countryIds: string[];
    agencyIds: string[];
    /** Fournisseur(s) rattaché(s) — rôle FOURNISSEUR uniquement (docs/11 §5). */
    supplierIds: string[];
  };
  sessionId: string | null;
}

export function hasPermission(user: CurrentUser, permission: Permission): boolean {
  return user.permissions.has(permission);
}
