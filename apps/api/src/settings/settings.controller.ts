import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from './settings.service';

const logoPresignSchema = z.object({ ext: z.enum(['jpg', 'png', 'webp', 'svg']).default('png') });

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
  constructor(
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

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

  /**
   * Logo de l'identité visuelle — objet public (préfixe `branding/`, lecture
   * anonyme autorisée côté MinIO/S3), pas de photo colis privée : URL stable
   * non signée, pas de ré-signature à prévoir côté front (docs/registre,
   * incident 2026-09-30 — le logo était stocké en base64 dans le réglage
   * lui-même, alourdissant chaque page de plusieurs centaines de Ko).
   */
  @Post('admin/settings/branding/logo-presign')
  @RequirePermissions('config:write')
  presignLogo(@Body(new ZodValidationPipe(logoPresignSchema)) body: z.infer<typeof logoPresignSchema>) {
    const key = `branding/logo-${randomUUID()}.${body.ext}`;
    const { url } = this.storage.presignPut(key, 300);
    return { uploadUrl: url, publicUrl: this.storage.publicUrl(key) };
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
