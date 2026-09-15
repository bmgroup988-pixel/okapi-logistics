import { z } from 'zod';
import { paymentCreateSchema } from '@okapi/shared';

/**
 * Alias REST dédiés agent — /agent/parcels/:id/{arrival,hand-to-partner,deliver}.
 * Complète (sans le remplacer) l'endpoint générique POST /parcels/:id/transition.
 * Voir parcel-delivery.service.ts pour la délégation vers ParcelsService /
 * PaymentsService, et docs/09-addendum-extension-reseau-permissions.md §4.
 */

export const parcelArrivalSchema = z.object({
  note: z.string().max(500).optional(),
  locationCityId: z.string().uuid().optional(),
  locationLabel: z.string().max(160).optional(),
});
export type ParcelArrivalInput = z.infer<typeof parcelArrivalSchema>;

export const parcelHandedToPartnerSchema = z.object({
  deliveryPartnerId: z.string().uuid(),
  note: z.string().max(500).optional(),
});
export type ParcelHandedToPartnerInput = z.infer<typeof parcelHandedToPartnerSchema>;

export const parcelDeliverSchema = z.object({
  note: z.string().max(500).optional(),
  /** justification obligatoire pour livrer avec un solde impayé — RG-08 */
  unpaidOverrideReason: z.string().max(500).optional(),
  /**
   * Encaissement optionnel joint à la livraison (§4.2 de l'addendum). Reprend
   * exactement `paymentCreateSchema` (packages/shared) — omis si le solde est
   * déjà réglé (paiements antérieurs) ou si l'agent utilise séparément
   * POST /parcels/:id/payments.
   */
  payment: paymentCreateSchema.optional(),
});
export type ParcelDeliverInput = z.infer<typeof parcelDeliverSchema>;
