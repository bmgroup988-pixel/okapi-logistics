import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

const settingPutSchema = z.object({ value: z.unknown() });
const contentPutSchema = z.object({
  fr: z.string().max(20_000).optional(),
  en: z.string().max(20_000).optional(),
  zh: z.string().max(20_000).optional(),
  sw: z.string().max(20_000).optional(),
  ln: z.string().max(20_000).optional(),
});

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /* ------------------------------------------------------------ public */
  @Public()
  @Get('public/branding')
  branding() {
    return this.settings.branding();
  }

  @Public()
  @Get('public/content')
  allContent(@Query('lang') lang = 'fr') {
    return this.settings.allContent(lang);
  }

  @Public()
  @Get('public/content/:key')
  content(@Param('key') key: string, @Query('lang') lang = 'fr') {
    return this.settings.content(key, lang);
  }

  /* ---------------------------------------------------- administration */
  @Get('admin/settings')
  @RequirePermissions('config:read')
  list(@Query('prefix') prefix?: string) {
    return this.settings.globalMap(prefix);
  }

  @Put('admin/settings/:key')
  @RequirePermissions('config:write')
  set(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(settingPutSchema)) body: z.infer<typeof settingPutSchema>,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.settings.setGlobal(key, body.value, user, req.requestId);
  }

  @Put('admin/content/:key')
  @RequirePermissions('config:write')
  upsertContent(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(contentPutSchema)) body: z.infer<typeof contentPutSchema>,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.settings.upsertContent(key, body, user, req.requestId);
  }
}
