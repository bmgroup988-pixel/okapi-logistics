import { Injectable, NotFoundException } from '@nestjs/common';
import { resolveLocale } from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async globalMap(prefix?: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.setting.findMany({ where: { scope: 'GLOBAL', scopeId: null } });
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      if (!prefix || r.key.startsWith(prefix)) out[r.key] = r.value;
    }
    return out;
  }

  /** Sous-ensemble public : identité visuelle + coordonnées + réseaux + slogans. */
  async branding() {
    const map = await this.globalMap();
    return {
      brand: {
        navy: map['brand.navy'] ?? '#170655',
        orange: map['brand.orange'] ?? '#E47911',
        turquoise: map['brand.turquoise'] ?? '#1CA9C9',
        anthracite: map['brand.anthracite'] ?? '#2E3138',
        bg: map['brand.bg'] ?? '#F4F4F7',
        surface: map['brand.surface'] ?? '#FFFFFF',
        ink: map['brand.ink'] ?? '#23222C',
        mute: map['brand.mute'] ?? '#6A6976',
        line: map['brand.line'] ?? '#E0E0E7',
        ok: map['brand.ok'] ?? '#1F9D57',
        warn: map['brand.warn'] ?? '#C07700',
        err: map['brand.err'] ?? '#C0392B',
      },
      logoUrl: map['branding.logoUrl'] ?? null,
      contactEmail: map['contact.email'] ?? 'contact.gokapi@gmail.com',
      contactPhone: map['contact.phone'] ?? null,
      contactWhatsapp: map['contact.whatsapp'] ?? null,
      website: map['contact.website'] ?? null,
      social: {
        facebook: map['social.facebook'] ?? null,
        instagram: map['social.instagram'] ?? null,
        tiktok: map['social.tiktok'] ?? null,
        x: map['social.x'] ?? null,
      },
      slogans: {
        fr: map['footer.slogan.fr'] ?? 'Le futur du commerce africain',
        en: map['footer.slogan.en'] ?? 'The future of African trade',
        zh: map['footer.slogan.zh'] ?? '非洲贸易的未来',
      },
      locales: map['i18n.locales'] ?? ['fr', 'en', 'zh'],
    };
  }

  async setGlobal(key: string, value: unknown, user: CurrentUser, requestId?: string | null) {
    const existing = await this.prisma.setting.findFirst({
      where: { scope: 'GLOBAL', scopeId: null, key },
    });
    const before = existing?.value ?? null;
    const row = existing
      ? await this.prisma.setting.update({
          where: { id: existing.id },
          data: { value: value as object, updatedById: user.id },
        })
      : await this.prisma.setting.create({
          data: { scope: 'GLOBAL', scopeId: null, key, value: value as object, updatedById: user.id },
        });
    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'setting',
      entityId: row.id,
      actorUserId: user.id,
      requestId,
      before: { key, value: before },
      after: { key, value },
    });
    return { key: row.key };
  }

  async content(key: string, lang: string) {
    const locale = resolveLocale(lang);
    const block = await this.prisma.contentBlock.findUnique({
      where: { key },
      include: { translations: true },
    });
    if (!block) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Bloc inconnu' } });
    const translation =
      block.translations.find((t) => t.locale === locale) ??
      block.translations.find((t) => t.locale === 'fr') ??
      block.translations[0];
    return { key, locale, value: translation?.value ?? '' };
  }

  async allContent(lang: string) {
    const locale = resolveLocale(lang);
    const blocks = await this.prisma.contentBlock.findMany({ include: { translations: true } });
    const out: Record<string, string> = {};
    for (const b of blocks) {
      const t =
        b.translations.find((x) => x.locale === locale) ??
        b.translations.find((x) => x.locale === 'fr') ??
        b.translations[0];
      out[b.key] = t?.value ?? '';
    }
    return { locale, content: out };
  }

  async upsertContent(
    key: string,
    values: Partial<Record<'fr' | 'en' | 'zh', string>>,
    user: CurrentUser,
    requestId?: string | null,
  ) {
    const block = await this.prisma.contentBlock.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
    for (const [locale, value] of Object.entries(values)) {
      if (value == null) continue;
      const existing = await this.prisma.contentTranslation.findFirst({
        where: { contentBlockId: block.id, locale },
      });
      if (existing) {
        await this.prisma.contentTranslation.update({
          where: { id: existing.id },
          data: { value, updatedById: user.id },
        });
      } else {
        await this.prisma.contentTranslation.create({
          data: { contentBlockId: block.id, locale, value, updatedById: user.id },
        });
      }
    }
    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'content_block',
      entityId: block.id,
      actorUserId: user.id,
      requestId,
      after: { key, locales: Object.keys(values) },
    });
    return { key };
  }
}
