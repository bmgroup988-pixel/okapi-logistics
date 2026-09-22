import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import {
  supplierPortalParcelCreateSchema,
  type SupplierPortalParcelCreateInput,
} from '@okapi/shared';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SupplierPortalService } from './supplier-portal.service';

/**
 * Enregistrement de colis pour un fournisseur, effectué par le personnel
 * interne (agent fret, DAF) à sa place — cas d'un fournisseur qui dépose ses
 * colis physiquement à l'agence sans utiliser lui-même le portail. Mêmes
 * actions que le portail self-service (`SupplierPortalController`), mais le
 * fournisseur est choisi explicitement par l'agent plutôt que déduit de son
 * propre compte. Distinct de `/admin/suppliers` (gestion des comptes
 * fournisseurs, réservée `supplier:manage`). Permission dédiée
 * `supplier-shipment:staff` (jamais accordée au rôle FOURNISSEUR) — même si
 * un compte fournisseur se retrouvait mal configuré avec des permissions
 * internes, il ne pourrait pas atteindre ces routes.
 */
@Controller('staff/suppliers')
@RequirePermissions('supplier-shipment:staff')
export class SupplierShipmentsStaffController {
  constructor(private readonly portal: SupplierPortalService) {}

  @Get()
  listSuppliers(@CurrentUser() user: CurrentUserType) {
    return this.portal.listSuppliersForStaff(user);
  }

  @Get(':supplierId/shipments')
  listShipments(@Param('supplierId', ParseUUIDPipe) supplierId: string, @CurrentUser() user: CurrentUserType) {
    return this.portal.listShipmentsForStaff(supplierId, user);
  }

  @Post(':supplierId/shipments')
  openShipment(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.openShipmentForStaff(supplierId, user, req.requestId);
  }

  @Get(':supplierId/shipments/:shipmentId')
  getShipment(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.portal.getShipmentDetailForStaff(supplierId, shipmentId, user);
  }

  @Post(':supplierId/shipments/:shipmentId/parcels')
  addParcel(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body(new ZodValidationPipe(supplierPortalParcelCreateSchema)) body: SupplierPortalParcelCreateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.addParcelForStaff(supplierId, shipmentId, body, user, req.requestId);
  }

  @Delete(':supplierId/shipments/:shipmentId/parcels/:parcelId')
  removeParcel(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.removeParcelForStaff(supplierId, shipmentId, parcelId, user, req.requestId);
  }

  @Post(':supplierId/shipments/:shipmentId/close')
  closeShipment(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.closeShipmentForStaff(supplierId, shipmentId, user, req.requestId);
  }
}
