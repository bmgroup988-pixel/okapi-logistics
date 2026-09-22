import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import {
  groupageAddParcelSchema,
  groupageCreateSchema,
  type GroupageAddParcelInput,
  type GroupageCreateInput,
} from '@okapi/shared';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GroupagesService } from './groupages.service';

/** Groupage de colis pour le suivi de transit — réservé `groupage:manage`. */
@Controller('groupages')
@RequirePermissions('groupage:manage')
export class GroupagesController {
  constructor(private readonly groupages: GroupagesService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserType, @Query('status') status?: string) {
    return this.groupages.list(user, status);
  }

  // Doit précéder `:id` pour ne pas être capturée par ce paramètre de route.
  @Get('parcels/available')
  listAvailableParcels() {
    return this.groupages.listAvailableParcels();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupages.get(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(groupageCreateSchema)) body: GroupageCreateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.groupages.create(body, user, req.requestId);
  }

  @Post(':id/parcels')
  addParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(groupageAddParcelSchema)) body: GroupageAddParcelInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.groupages.addParcel(id, body, user, req.requestId);
  }

  @Delete(':id/parcels/:parcelId')
  removeParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.groupages.removeParcel(id, parcelId, user, req.requestId);
  }

  @Post(':id/close')
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType, @Req() req: Request) {
    return this.groupages.close(id, user, req.requestId);
  }
}
