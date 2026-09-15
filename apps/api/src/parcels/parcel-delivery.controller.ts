import { Body, Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ParcelDeliveryService } from './parcel-delivery.service';
import {
  parcelArrivalSchema,
  parcelDeliverSchema,
  parcelHandedToPartnerSchema,
  type ParcelArrivalInput,
  type ParcelDeliverInput,
  type ParcelHandedToPartnerInput,
} from './parcel-delivery.schemas';

/**
 * Alias REST dédiés agent — addendum 08 §4 / docs/09 (guide d'intégration
 * complémentaire). Ces routes délèguent à la logique déjà en place dans
 * ParcelsService/PaymentsService (voir parcel-delivery.service.ts) ; l'endpoint
 * générique POST /parcels/:id/transition reste disponible et fait exactement
 * la même chose pour ARRIVE / HANDED_TO_PARTNER / LIVRE.
 */
@Controller('agent/parcels')
export class ParcelDeliveryController {
  constructor(private readonly parcelDelivery: ParcelDeliveryService) {}

  @Post(':id/arrival')
  @RequirePermissions('parcel:arrival:confirm')
  confirmArrival(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(parcelArrivalSchema)) body: ParcelArrivalInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.parcelDelivery.confirmArrival(id, body, user, req.requestId);
  }

  @Post(':id/hand-to-partner')
  @RequirePermissions('parcel:arrival:confirm')
  handToPartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(parcelHandedToPartnerSchema)) body: ParcelHandedToPartnerInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.parcelDelivery.handToPartner(id, body, user, req.requestId);
  }

  @Post(':id/deliver')
  @RequirePermissions('parcel:deliver:confirm')
  confirmDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(parcelDeliverSchema)) body: ParcelDeliverInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.parcelDelivery.confirmDelivery(id, body, user, req.requestId);
  }
}
