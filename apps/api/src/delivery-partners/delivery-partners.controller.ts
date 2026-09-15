import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import {
  cityCreateSchema,
  cityUpdateSchema,
  deliveryPartnerUpsertSchema,
  partnerTariffCreateSchema,
  type CityCreateInput,
  type CityUpdateInput,
  type DeliveryPartnerUpsertInput,
  type PartnerTariffCreateInput,
} from '@okapi/shared';
import type { Request } from 'express';
import { z } from 'zod';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DeliveryPartnersService } from './delivery-partners.service';

const cityIdQuery = z.object({ cityId: z.string().uuid().optional() });

/**
 * Administration du réseau — villes (couverture HUB/PARTNER/PLANNED),
 * partenaires de livraison et leurs tarifs — addendum 08, §1.6.
 * Toute la surface est réservée `city:write` (SUPER_ADMIN par défaut),
 * conformément au choix de l'addendum.
 */
@Controller('admin')
export class DeliveryPartnersController {
  constructor(private readonly partners: DeliveryPartnersService) {}

  @Get('cities')
  @RequirePermissions('city:write')
  listCities() {
    return this.partners.listCities();
  }

  @Post('cities')
  @RequirePermissions('city:write')
  createCity(
    @Body(new ZodValidationPipe(cityCreateSchema)) body: CityCreateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.partners.createCity(body, user, req.requestId);
  }

  @Patch('cities/:id')
  @RequirePermissions('city:write')
  updateCity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(cityUpdateSchema)) body: CityUpdateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.partners.updateCity(id, body, user, req.requestId);
  }

  @Get('delivery-partners')
  @RequirePermissions('city:write')
  listDeliveryPartners(@Query(new ZodValidationPipe(cityIdQuery)) q: z.infer<typeof cityIdQuery>) {
    return this.partners.listDeliveryPartners(q.cityId);
  }

  @Post('delivery-partners')
  @RequirePermissions('city:write')
  createDeliveryPartner(
    @Body(new ZodValidationPipe(deliveryPartnerUpsertSchema)) body: DeliveryPartnerUpsertInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.partners.upsertDeliveryPartner(body, user, undefined, req.requestId);
  }

  @Patch('delivery-partners/:id')
  @RequirePermissions('city:write')
  updateDeliveryPartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(deliveryPartnerUpsertSchema)) body: DeliveryPartnerUpsertInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.partners.upsertDeliveryPartner(body, user, id, req.requestId);
  }

  @Get('delivery-partners/:id/tariffs')
  @RequirePermissions('city:write')
  listPartnerTariffs(@Param('id', ParseUUIDPipe) id: string) {
    return this.partners.listPartnerTariffs(id);
  }

  @Post('delivery-partners/:id/tariffs')
  @RequirePermissions('city:write')
  createPartnerTariff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(partnerTariffCreateSchema)) body: PartnerTariffCreateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.partners.createPartnerTariff(id, body, user, req.requestId);
  }
}
