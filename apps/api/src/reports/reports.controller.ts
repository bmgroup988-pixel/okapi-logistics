import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { ReportsService } from './reports.service';

@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** État financier (facturé / encaissé / impayé) et état des colis, par agence et global — W-ADM-01. */
  @Get('financial-status')
  @RequirePermissions('report:read')
  financialStatus(
    @Query('periodStart') periodStart: string | undefined,
    @Query('periodEnd') periodEnd: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.reports.financialStatus({ periodStart, periodEnd }, user);
  }
}
