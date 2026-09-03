import { BadRequestException, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { tariffUpsertSchema } from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { PrismaService } from '../prisma/prisma.service';

type TariffUpsertInput = z.infer<typeof tariffUpsertSchema>;

@Injectable()
export class TariffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(params: { destinationCityId?: string; corridorId?: string; mode?: 'AIR' | 'SEA' }) {
    const rows = await this.prisma.tariff.findMany({
      where: {
        destinationCityId: params.destinationCityId,
        corridorId: params.corridorId,
        mode: params.mode,
      },
      include: { destinationCity: true, originCity: true, corridor: true },
      orderBy: [{ validFrom: 'desc' }],
    });
    return rows.map((t) => ({
      id: t.id,
      destinationCityCode: t.destinationCity?.code ?? null,
      originCityCode: t.originCity?.code ?? null,
      corridorId: t.corridorId,
      mode: t.mode,
      currency: t.currency,
      pricePerKg: t.pricePerKg.toString(),
      fixedFee: t.fixedFee.toString(),
      minCharge: t.minCharge.toString(),
      adValoremEnabled: t.adValoremEnabled,
      adValoremRate: t.adValoremRate.toString(),
      overrideMin: t.overrideMin.toString(),
      overrideMax: t.overrideMax.toString(),
      validFrom: t.validFrom.toISOString().slice(0, 10),
      validTo: t.validTo ? t.validTo.toISOString().slice(0, 10) : null,
    }));
  }

  /**
   * Crée une nouvelle version datée du tarif. La version précédente (même cible +
   * mode, `validTo` NULL) est clôturée à la veille de `validFrom`. Pas de
   * chevauchement (garanti aussi par la contrainte EXCLUDE en base).
   */
  async upsert(input: TariffUpsertInput, user: CurrentUser, requestId?: string | null) {
    const currency = await this.prisma.currency.findUnique({ where: { code: input.currency } });
    if (!currency || !currency.isActive) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: `Devise inactive : ${input.currency}` },
      });
    }
    const validFrom = input.validFrom ? new Date(input.validFrom) : new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.tariff.findFirst({
        where: {
          mode: input.mode,
          corridorId: input.corridorId ?? undefined,
          destinationCityId: input.destinationCityId,
          originCityId: input.originCityId ?? null,
          validTo: null,
        },
        orderBy: { validFrom: 'desc' },
      });
      if (previous) {
        const closeAt = new Date(validFrom.getTime() - 24 * 3600 * 1000);
        await tx.tariff.update({ where: { id: previous.id }, data: { validTo: closeAt } });
      }
      return tx.tariff.create({
        data: {
          corridorId: input.corridorId ?? null,
          originCityId: input.originCityId ?? null,
          destinationCityId: input.destinationCityId,
          mode: input.mode,
          currency: input.currency,
          pricePerKg: input.pricePerKg,
          fixedFee: input.fixedFee,
          minCharge: input.minCharge,
          adValoremEnabled: input.adValoremEnabled,
          adValoremRate: input.adValoremRate,
          overrideMin: input.overrideMin,
          overrideMax: input.overrideMax,
          validFrom,
          createdById: user.id,
        },
      });
    });

    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'tariff',
      entityId: result.id,
      actorUserId: user.id,
      requestId,
      after: {
        destinationCityId: input.destinationCityId,
        mode: input.mode,
        pricePerKg: input.pricePerKg,
        currency: input.currency,
        validFrom: validFrom.toISOString().slice(0, 10),
      },
    });
    return { id: result.id };
  }
}
