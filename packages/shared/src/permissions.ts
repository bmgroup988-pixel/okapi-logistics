import type { RoleCode } from './enums.js';

/** Permissions nommées (RBAC) — ENF-SEC-04. Voir docs/03 §5. */

export const PERMISSIONS = [
  'parcel:create',
  'parcel:read',
  'parcel:update',
  'parcel:transition',
  /** Confirme l'arrivée physique au hub/agence de destination — addendum 08, §4.1. */
  'parcel:arrival:confirm',
  /** Confirme le retrait client + encaissement — addendum 08, §4.2. */
  'parcel:deliver:confirm',
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
  /** Villes + partenaires de livraison + tarifs partenaires — addendum 08, §1.6. */
  'city:write',
  'currency:write',
  'user:manage',
  'audit:read',
  'gdpr:manage',
  /** Réconciliation des commissions partenaires — addendum 08, §5.5. */
  'settlement:read',
  'settlement:write',
  /** Gestion interne des fournisseurs (création, activation du portail) — docs/11. */
  'supplier:manage',
  /** Gestion des compagnies de transport sous-traitées — réservé super-admin. */
  'carrier:manage',
  /** Portail fournisseur — docs/11, §5/§6.2. */
  'shipment:create',
  'shipment:read',
  'shipment:close',
  'supplier-parcel:create',
  'supplier-invoice:read',
  /** Groupage de colis (walk-in et/ou fournisseur) pour le suivi de transit — hors facturation. */
  'groupage:manage',
  /**
   * Enregistrement de colis pour un fournisseur explicitement choisi, par le
   * personnel interne (agent fret, DAF) agissant à sa place — distinct de
   * `shipment:*`/`supplier-parcel:create` (self-service, réservé au compte
   * FOURNISSEUR concerné) pour qu'aucun compte fournisseur ne puisse jamais
   * atteindre cet outil interne, même par erreur de configuration de rôle.
   */
  'supplier-shipment:staff',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Attribution par défaut rôle -> permissions (peuplée par migration/seed). */
export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  AGENT_FRET: [
    'parcel:create',
    'parcel:read',
    'parcel:transition',
    'parcel:arrival:confirm',
    'parcel:deliver:confirm',
    'parcel:cancel',
    'parcel:photo:write',
    'payment:create',
    'payment:confirm',
    'document:read',
    'tariff:read',
    'fx:read',
    'config:read',
    'groupage:manage',
    // Enregistrement de colis pour un fournisseur qui dépose physiquement à
    // l'agence sans utiliser lui-même le portail — fournisseur choisi
    // explicitement (pas d'auto-facturation : simple enregistrement).
    // Permission dédiée, distincte de shipment:*/supplier-parcel:create
    // (self-service FOURNISSEUR) pour qu'un compte fournisseur ne puisse
    // jamais atteindre cet outil interne.
    'supplier-shipment:staff',
  ],
  ADMIN_DAF: [
    // Secours : le DAF peut enregistrer un colis si les agents sont
    // indisponibles ou en cas de bug bloquant côté agent (demande produit).
    'parcel:create',
    'parcel:photo:write',
    'parcel:read',
    'parcel:transition',
    'parcel:arrival:confirm',
    'parcel:deliver:confirm',
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
    'settlement:read',
    'settlement:write',
    'supplier:manage',
    'groupage:manage',
    'supplier-shipment:staff',
  ],
  SUPER_ADMIN: [...PERMISSIONS],
  /** Compte externe (portail self-service) — jamais de permission interne. */
  FOURNISSEUR: [
    'shipment:create',
    'shipment:read',
    // Verrouillé le 2026-09-22 — décision produit : le fournisseur n'a droit
    // qu'à ouvrir et consulter ses expéditions/factures, pas à ajouter des
    // colis ni à clôturer (déclenche la facturation définitive, irréversible
    // — voir SupplierPortalService.closeShipment) ; c'est le personnel
    // interne qui enregistre les colis et clôture pour lui (staff/suppliers,
    // voir SupplierShipmentsStaffController). Ne PAS supprimer
    // 'supplier-parcel:create'/'shipment:close' de PERMISSIONS ni le code
    // associé (SupplierPortalController.addParcel/removeParcel/closeShipment)
    // — réactivables ici d'une ligne si le besoin revient.
    // 'shipment:close',
    // 'supplier-parcel:create',
    'supplier-invoice:read',
  ],
};

export function permissionsForRoles(roles: RoleCode[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) out.add(p);
  return out;
}
