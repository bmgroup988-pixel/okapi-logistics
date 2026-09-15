import { ForbiddenException, Injectable } from '@nestjs/common';
import { API_ERROR_CODES } from '@okapi/shared';
import { hasPermission, type CurrentUser } from '../auth/current-user';
import { PaymentsService } from '../payments/payments.service';
import { ParcelsService } from './parcels.service';
import type {
  ParcelArrivalInput,
  ParcelDeliverInput,
  ParcelHandedToPartnerInput,
} from './parcel-delivery.schemas';

/**
 * Alias REST dédiés agent (guide d'intégration complémentaire — voir
 * docs/09-addendum-extension-reseau-permissions.md §4). Ces trois méthodes ne
 * réécrivent AUCUNE logique métier : elles délèguent entièrement à
 * `ParcelsService.transition()` (permission dynamique déjà vérifiée en plus
 * par `@RequirePermissions` au niveau de la route ici, contrôle de périmètre
 * agence, machine à états `PARCEL_STATUS_FLOW`, journal d'audit,
 * notifications) et à `PaymentsService.create()` (conversion FX, imputation
 * agence/collecteur, trigger de recalcul du solde). Rien n'écrit directement
 * dans Prisma ici — l'endpoint générique `POST /parcels/:id/transition` fait
 * exactement la même chose pour ARRIVE / HANDED_TO_PARTNER / LIVRE et reste
 * disponible en parallèle.
 */
@Injectable()
export class ParcelDeliveryService {
  constructor(
    private readonly parcels: ParcelsService,
    private readonly payments: PaymentsService,
  ) {}

  /** §4.1 — parcel:arrival:confirm */
  async confirmArrival(
    id: string,
    input: ParcelArrivalInput,
    user: CurrentUser,
    requestId: string | null | undefined,
  ) {
    return this.parcels.transition(
      id,
      {
        to: 'ARRIVE',
        note: input.note ?? null,
        locationCityId: input.locationCityId ?? null,
        locationLabel: input.locationLabel ?? null,
        visibleToClient: true,
        unpaidOverrideReason: null,
        deliveryPartnerId: null,
      },
      user,
      requestId,
    );
  }

  /** §4.3 — remise à un partenaire (ville PARTNER) */
  async handToPartner(
    id: string,
    input: ParcelHandedToPartnerInput,
    user: CurrentUser,
    requestId: string | null | undefined,
  ) {
    return this.parcels.transition(
      id,
      {
        to: 'HANDED_TO_PARTNER',
        deliveryPartnerId: input.deliveryPartnerId,
        note: input.note ?? null,
        locationCityId: null,
        locationLabel: null,
        visibleToClient: true,
        unpaidOverrideReason: null,
      },
      user,
      requestId,
    );
  }

  /** §4.2 — parcel:deliver:confirm (+ payment:create si encaissement joint) */
  async confirmDelivery(
    id: string,
    input: ParcelDeliverInput,
    user: CurrentUser,
    requestId: string | null | undefined,
  ) {
    let payment: Awaited<ReturnType<PaymentsService['create']>> | null = null;

    if (input.payment) {
      // L'encaissement lié à la livraison exige `payment:create`, en plus de
      // `parcel:deliver:confirm` déjà vérifié par le contrôleur — un agent
      // sans droit d'encaissement peut confirmer l'arrivée mais pas finaliser
      // une livraison avec paiement (addendum 08, §4.2).
      if (!hasPermission(user, 'payment:create')) {
        throw new ForbiddenException({
          error: { code: API_ERROR_CODES.FORBIDDEN, message: 'Permission requise : payment:create' },
        });
      }
      payment = await this.payments.create(id, input.payment, user, {
        requestId: requestId ?? null,
        path: `/parcels/${id}/payments`,
      });
    }

    const parcel = await this.parcels.transition(
      id,
      {
        to: 'LIVRE',
        note: input.note ?? null,
        unpaidOverrideReason: input.unpaidOverrideReason ?? null,
        locationCityId: null,
        locationLabel: null,
        visibleToClient: true,
        deliveryPartnerId: null,
      },
      user,
      requestId,
    );

    return { parcel, payment: payment?.body ?? null };
  }
}
