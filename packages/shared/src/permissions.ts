import type { RoleCode } from './enums.js';

/** Permissions nommées (RBAC) — ENF-SEC-04. Voir docs/03 §5. */

export const PERMISSIONS = [
  'parcel:create',
  'parcel:read',
  'parcel:update',
  'parcel:transition',
  'parcel:cancel',
  'parcel:photo:write',
  'payment:create',
  'payment:confirm',
  'payment:refund',
  'document:read',
  'report:read',
  'report:export',
  'tariff:read',
  'tariff:write',
  'fx:read',
  'fx:write',
  'config:read',
  'config:write',
  'city:write',
  'currency:write',
  'user:manage',
  'audit:read',
  'gdpr:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Attribution par défaut rôle -> permissions (peuplée par migration/seed). */
export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  AGENT_FRET: [
    'parcel:create',
    'parcel:read',
    'parcel:update',
    'parcel:transition',
    'parcel:cancel',
    'parcel:photo:write',
    'payment:create',
    'payment:confirm',
    'document:read',
    'tariff:read',
    'fx:read',
    'config:read',
  ],
  ADMIN_DAF: [
    'parcel:read',
    'parcel:transition',
    'payment:confirm',
    'payment:refund',
    'document:read',
    'report:read',
    'report:export',
    'tariff:read',
    'tariff:write',
    'fx:read',
    'fx:write',
    'config:read',
    'audit:read',
  ],
  SUPER_ADMIN: [...PERMISSIONS],
};

export function permissionsForRoles(roles: RoleCode[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) out.add(p);
  return out;
}
