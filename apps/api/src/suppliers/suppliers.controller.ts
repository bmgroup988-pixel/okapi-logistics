import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import {
  supplierCreateSchema,
  supplierPortalActivateSchema,
  supplierUpdateSchema,
  type SupplierCreateInput,
  type SupplierPortalActivateInput,
  type SupplierUpdateInput,
} from '@okapi/shared';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SuppliersService } from './suppliers.service';

/** Gestion interne des fournisseurs — docs/11, §6.1. Réservé `supplier:manage`. */
@Controller('admin/suppliers')
@RequirePermissions('supplier:manage')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserType) {
    return this.suppliers.list(user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.get(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(supplierCreateSchema)) body: SupplierCreateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.suppliers.create(body, user, req.requestId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supplierUpdateSchema)) body: SupplierUpdateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.suppliers.update(id, body, user, req.requestId);
  }

  @Post(':id/activate-portal')
  activatePortal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supplierPortalActivateSchema)) body: SupplierPortalActivateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.suppliers.activatePortal(id, body, user, req.requestId);
  }
}
