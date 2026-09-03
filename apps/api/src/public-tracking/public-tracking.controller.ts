import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  API_ERROR_CODES,
  isValidTrackingNumber,
  type PublicTrackingDto,
} from '@okapi/shared';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/**
 * Surface publique de suivi — EF-SUI-02/03/04. Aucune donnée personnelle directe,
 * aucun montant. Débit limité (anti-abus EF-SUI-05).
 */
@Controller('public/parcels')
@Public()
@Throttle({ default: { ttl: 60_000, limit: 30 } })
export class PublicTrackingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get(':trackingNumber')
  async track(@Param('trackingNumber') raw: string): Promise<PublicTrackingDto> {
    const trackingNumber = raw.trim().toUpperCase();
    if (!isValidTrackingNumber(trackingNumber)) {
      // message identique à « inconnu » (anti-énumération)
      throw new NotFoundException({
        error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Aucun colis avec ce numéro' },
      });
    }
    const parcel = await this.prisma.parcel.findUnique({
      where: { trackingNumber },
      include: {
        destinationCity: true,
        photos: { where: { isPrimary: true }, take: 1 },
        events: {
          where: { visibleToClient: true },
          orderBy: { createdAt: 'asc' },
          include: { locationCity: true },
        },
      },
    });
    if (!parcel) {
      throw new NotFoundException({
        error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Aucun colis avec ce numéro' },
      });
    }

    const primary = parcel.photos[0];
    const paymentState =
      parcel.paymentStatus === 'PAYE' ? 'PAID' : parcel.paymentStatus === 'PARTIEL' ? 'PARTIAL' : 'PENDING';

    return {
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      paymentState,
      destinationCityCode: parcel.destinationCity.code,
      registeredAt: parcel.createdAt.toISOString(),
      photoUrl: primary?.storageKey
        ? this.storage.presignGet(primary.storageKey, 'client').url
        : null,
      steps: parcel.events.map((e) => ({
        status: e.status,
        locationLabel: e.locationLabel ?? e.locationCity?.code ?? null,
        at: e.createdAt.toISOString(),
      })),
    };
  }

  @Get(':trackingNumber/photo')
  async photo(@Param('trackingNumber') raw: string, @Res() res: Response): Promise<void> {
    const trackingNumber = raw.trim().toUpperCase();
    const parcel = await this.prisma.parcel.findUnique({
      where: { trackingNumber },
      include: { photos: { where: { isPrimary: true }, take: 1 } },
    });
    const key = parcel?.photos[0]?.storageKey;
    if (!key) {
      res.status(404).json({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Photo indisponible' } });
      return;
    }
    res.redirect(302, this.storage.presignGet(key, 'client').url);
  }
}
