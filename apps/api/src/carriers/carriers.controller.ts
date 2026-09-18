import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { carrierUpsertSchema, type CarrierUpsertInput } from '@okapi/shared';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CarriersService } from './carriers.service';

/** Gestion des compagnies de transport — réservé au super-admin (carrier:manage). */
@Controller('admin/carriers')
@RequirePermissions('carrier:manage')
export class CarriersController {
  constructor(private readonly carriers: CarriersService) {}

  @Get()
  list() {
    return this.carriers.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(carrierUpsertSchema)) body: CarrierUpsertInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.carriers.create(body, user, req.requestId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(carrierUpsertSchema)) body: CarrierUpsertInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.carriers.update(id, body, user, req.requestId);
  }
}
