import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  parcelCancelSchema,
  parcelCreateSchema,
  parcelListQuerySchema,
  parcelTransitionSchema,
  parcelUpdateSchema,
  photoConfirmSchema,
  type ParcelCreateInput,
  type ParcelTransitionInput,
  type ParcelUpdateInput,
} from '@okapi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ParcelsService } from './parcels.service';

@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcels: ParcelsService) {}

  @Post()
  @RequirePermissions('parcel:create')
  async create(
    @Body(new ZodValidationPipe(parcelCreateSchema)) body: ParcelCreateInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.parcels.create(body, user, {
      idempotencyKey,
      requestId: req.requestId,
      path: req.path,
    });
    res.status(result.status);
    if (result.replayed) res.setHeader('idempotent-replayed', 'true');
    return result.body;
  }

  @Get()
  @RequirePermissions('parcel:read')
  list(
    @Query(new ZodValidationPipe(parcelListQuerySchema)) query: z.infer<typeof parcelListQuerySchema>,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.parcels.list(query, user);
  }

  @Get(':id')
  @RequirePermissions('parcel:read')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType) {
    return this.parcels.get(id, user);
  }

  @Get(':id/events')
  @RequirePermissions('parcel:read')
  events(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType) {
    return this.parcels.events(id, user);
  }

  @Patch(':id')
  @RequirePermissions('parcel:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(parcelUpdateSchema)) body: ParcelUpdateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.parcels.update(id, body, user, req.requestId);
  }

  // Permission vérifiée dynamiquement dans le service selon `body.to` —
  // parcel:arrival:confirm (ARRIVE), parcel:deliver:confirm (LIVRE),
  // parcel:transition pour les autres étapes — addendum 08, §4.1/§4.2/§4.4.
  @Post(':id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(parcelTransitionSchema)) body: ParcelTransitionInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.parcels.transition(id, body, user, req.requestId);
  }

  @Post(':id/cancel')
  @RequirePermissions('parcel:cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(parcelCancelSchema)) body: z.infer<typeof parcelCancelSchema>,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.parcels.cancel(id, body.reason, user, req.requestId);
  }

  @Post(':id/photos/presign')
  @RequirePermissions('parcel:photo:write')
  presignPhoto(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType) {
    return this.parcels.presignPhoto(id, user);
  }

  @Post(':id/photos')
  @RequirePermissions('parcel:photo:write')
  confirmPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(photoConfirmSchema)) body: z.infer<typeof photoConfirmSchema>,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.parcels.confirmPhoto(id, body, user, req.requestId);
  }

  @Get(':id/photos')
  @RequirePermissions('parcel:read')
  listPhotos(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserType) {
    return this.parcels.listPhotos(id, user, 'internal');
  }
}
