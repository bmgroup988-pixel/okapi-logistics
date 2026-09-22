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
 * fournisseurs, réservée `supplier:manage`).
 */
@Controller('staff/suppliers')
export class SupplierShipmentsStaffController {
  constructor(private readonly portal: SupplierPortalService) {}

  @Get()
  @RequirePermissions('shipment:read')
  listSuppliers(@CurrentUser() user: CurrentUserType) {
    return this.portal.listSuppliersForStaff(user);
  }

  @Get(':supplierId/shipments')
  @RequirePermissions('shipment:read')
  listShipments(@Param('supplierId', ParseUUIDPipe) supplierId: string, @CurrentUser() user: CurrentUserType) {
    return this.portal.listShipmentsForStaff(supplierId, user);
  }

  @Post(':supplierId/shipments')
  @RequirePermissions('shipment:create')
  openShipment(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.openShipmentForStaff(supplierId, user, req.requestId);
  }

  @Get(':supplierId/shipments/:shipmentId')
  @RequirePermissions('shipment:read')
  getShipment(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.portal.getShipmentDetailForStaff(supplierId, shipmentId, user);
  }

  @Post(':supplierId/shipments/:shipmentId/parcels')
  @RequirePermissions('supplier-parcel:create')
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
  @RequirePermissions('supplier-parcel:create')
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
  @RequirePermissions('shipment:close')
  closeShipment(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.closeShipmentForStaff(supplierId, shipmentId, user, req.requestId);
  }
}
