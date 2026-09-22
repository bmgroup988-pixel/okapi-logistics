import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import {
  supplierInvoiceSendEmailSchema,
  supplierPortalParcelCreateSchema,
  type SupplierInvoiceSendEmailInput,
  type SupplierPortalParcelCreateInput,
} from '@okapi/shared';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SupplierPortalService } from './supplier-portal.service';

/** Portail fournisseur en libre-service — docs/11, §6.2. Isolation par scopeSupplierId. */
@Controller('supplier-portal')
export class SupplierPortalController {
  constructor(private readonly portal: SupplierPortalService) {}

  @Get('shipments')
  @RequirePermissions('shipment:read')
  listShipments(@CurrentUser() user: CurrentUserType) {
    return this.portal.listShipments(user);
  }

  @Post('shipments')
  @RequirePermissions('shipment:create')
  openShipment(@CurrentUser() user: CurrentUserType, @Req() req: Request) {
    return this.portal.openShipment(user, req.requestId);
  }

  @Get('shipments/:id')
  @RequirePermissions('shipment:read')
  getShipment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType) {
    return this.portal.getShipmentDetail(id, user);
  }

  @Post('shipments/:id/parcels')
  @RequirePermissions('supplier-parcel:create')
  addParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supplierPortalParcelCreateSchema)) body: SupplierPortalParcelCreateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.addParcel(id, body, user, req.requestId);
  }

  @Delete('shipments/:id/parcels/:parcelId')
  @RequirePermissions('supplier-parcel:create')
  removeParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.removeParcel(id, parcelId, user, req.requestId);
  }

  @Post('shipments/:id/close')
  @RequirePermissions('shipment:close')
  closeShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.portal.closeShipment(id, user, req.requestId);
  }

  @Get('invoices')
  @RequirePermissions('supplier-invoice:read')
  listInvoices(@CurrentUser() user: CurrentUserType) {
    return this.portal.listInvoices(user);
  }

  @Get('invoices/:id')
  @RequirePermissions('supplier-invoice:read')
  getInvoice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType) {
    return this.portal.getInvoiceDetail(id, user);
  }

  @Get('invoices/:id/pdf')
  @RequirePermissions('supplier-invoice:read')
  getInvoicePdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType) {
    return this.portal.getInvoicePdfUrl(id, user);
  }

  @Post('invoices/:id/send-email')
  @RequirePermissions('supplier-invoice:read')
  async sendInvoiceEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supplierInvoiceSendEmailSchema)) body: SupplierInvoiceSendEmailInput,
    @CurrentUser() user: CurrentUserType,
  ) {
    await this.portal.sendInvoiceEmail(id, body.recipientEmail, user);
    return { sent: true };
  }
}
