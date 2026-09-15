import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import {
  partnerSettlementGenerateSchema,
  partnerSettlementListQuerySchema,
  partnerSettlementUpdateSchema,
  type PartnerSettlementGenerateInput,
  type PartnerSettlementUpdateInput,
} from '@okapi/shared';
import type { Request } from 'express';
import { z } from 'zod';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PartnerSettlementsService } from './partner-settlements.service';

/** Réconciliation des commissions partenaires — addendum 08, §5.5. */
@Controller('admin/partner-settlements')
export class PartnerSettlementsController {
  constructor(private readonly settlements: PartnerSettlementsService) {}

  @Get()
  @RequirePermissions('settlement:read')
  list(
    @Query(new ZodValidationPipe(partnerSettlementListQuerySchema))
    q: z.infer<typeof partnerSettlementListQuerySchema>,
  ) {
    return this.settlements.list(q);
  }

  @Post('generate')
  @RequirePermissions('settlement:write')
  generate(
    @Body(new ZodValidationPipe(partnerSettlementGenerateSchema)) body: PartnerSettlementGenerateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.settlements.generate(body, user, req.requestId);
  }

  @Get(':id')
  @RequirePermissions('settlement:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlements.get(id);
  }

  @Patch(':id')
  @RequirePermissions('settlement:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(partnerSettlementUpdateSchema)) body: PartnerSettlementUpdateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.settlements.update(id, body, user, req.requestId);
  }
}
