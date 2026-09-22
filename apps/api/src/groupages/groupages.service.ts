import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  API_ERROR_CODES,
  composeGroupageCode,
  trackingPeriodKey,
  type GroupageAddParcelInput,
  type GroupageCreateInput,
} from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../sequences/sequence.service';

/**
 * Groupage — regroupe des colis (walk-in et/ou fournisseur) pour un même
 * trajet, pour le suivi logistique uniquement (colis par colis : parti ou
 * pas encore) — indépendant de la facturation, déjà réglée par colis à
 * l'enregistrement. Demande produit du 2026-09-22.
 */
@Injectable()
export class GroupagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequences: SequenceService,
  ) {}

  async list(user: CurrentUser, status?: string) {
    const where: Record<string, unknown> = {};
    if (!user.scope.isGlobal) where.originAgencyId = { in: user.scope.agencyIds };
    if (status) where.status = status;
    const rows = await this.prisma.groupage.findMany({
      where,
      include: { originAgency: { select: { name: true } } },
      orderBy: { openedAt: 'desc' },
    });
    return rows.map(toGroupageDto);
  }

  async get(id: string) {
    const row = await this.prisma.groupage.findUnique({
      where: { id },
      include: {
        originAgency: { select: { name: true } },
        parcels: {
          include: {
            destinationCity: { select: { code: true, nameKey: true } },
            supplier: { select: { code: true } },
            contacts: { where: { role: 'RECIPIENT' }, select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Groupage introuvable' } });
    }
    return {
      ...toGroupageDto(row),
      parcels: row.parcels.map((p) => ({
        id: p.id,
        trackingNumber: p.trackingNumber,
        status: p.status,
        destinationCityCode: p.destinationCity.code,
        destinationCityName: p.destinationCity.nameKey,
        weightKg: p.weightKg.toString(),
        recipientName: p.contacts[0]?.name ?? '',
        supplierCode: p.supplier?.code ?? null,
      })),
    };
  }

  async create(input: GroupageCreateInput, user: CurrentUser, requestId?: string | null) {
    const agency = await this.prisma.agency.findUnique({ where: { id: input.originAgencyId } });
    if (!agency) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: 'Agence introuvable' } });
    }
    const now = new Date();
    const seq = await this.sequences.next('groupage', 'ALL', trackingPeriodKey(now));
    const code = composeGroupageCode({ at: now, seq });
    const groupage = await this.prisma.groupage.create({
      data: {
        code,
        originAgencyId: input.originAgencyId,
        note: input.note ?? null,
        openedById: user.id,
      },
      include: { originAgency: { select: { name: true } } },
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'groupage',
      entityId: groupage.id,
      actorUserId: user.id,
      requestId,
      after: { code: groupage.code, originAgencyId: input.originAgencyId },
    });
    return toGroupageDto(groupage);
  }

  async addParcel(id: string, input: GroupageAddParcelInput, user: CurrentUser, requestId?: string | null) {
    await this.requireOpenGroupage(id);
    const parcel = await this.prisma.parcel.findUnique({
      where: { trackingNumber: input.trackingNumber.trim().toUpperCase() },
    });
    if (!parcel) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Colis introuvable' } });
    }
    if (parcel.status === 'ANNULE') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: 'Ce colis est annulé, il ne peut pas être groupé' },
      });
    }
    if (parcel.groupageId && parcel.groupageId !== id) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Ce colis appartient déjà à un autre groupage' },
      });
    }
    if (parcel.groupageId === id) {
      return this.get(id);
    }

    await this.prisma.$transaction([
      this.prisma.parcel.update({ where: { id: parcel.id }, data: { groupageId: id } }),
      this.prisma.groupage.update({
        where: { id },
        data: { parcelCount: { increment: 1 }, totalWeightKg: { increment: parcel.weightKg } },
      }),
    ]);
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'groupage',
      entityId: id,
      actorUserId: user.id,
      requestId,
      after: { addedParcel: parcel.trackingNumber },
    });
    return this.get(id);
  }

  async removeParcel(id: string, parcelId: string, user: CurrentUser, requestId?: string | null) {
    await this.requireOpenGroupage(id);
    const parcel = await this.prisma.parcel.findUnique({ where: { id: parcelId } });
    if (!parcel || parcel.groupageId !== id) {
      throw new NotFoundException({
        error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Colis introuvable dans ce groupage' },
      });
    }
    await this.prisma.$transaction([
      this.prisma.parcel.update({ where: { id: parcelId }, data: { groupageId: null } }),
      this.prisma.groupage.update({
        where: { id },
        data: { parcelCount: { decrement: 1 }, totalWeightKg: { decrement: parcel.weightKg } },
      }),
    ]);
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'groupage',
      entityId: id,
      actorUserId: user.id,
      requestId,
      after: { removedParcel: parcel.trackingNumber },
    });
    return this.get(id);
  }

  async close(id: string, user: CurrentUser, requestId?: string | null) {
    const groupage = await this.requireOpenGroupage(id);
    const parcelCount = await this.prisma.parcel.count({ where: { groupageId: id } });
    const updated = await this.prisma.groupage.update({
      where: { id },
      data: { status: 'CLOTURE', parcelCount, closedById: user.id, closedAt: new Date() },
      include: { originAgency: { select: { name: true } } },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'groupage',
      entityId: id,
      actorUserId: user.id,
      requestId,
      before: { status: groupage.status },
      after: { status: 'CLOTURE' },
    });
    return toGroupageDto(updated);
  }

  private async requireOpenGroupage(id: string) {
    const groupage = await this.prisma.groupage.findUnique({ where: { id } });
    if (!groupage) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Groupage introuvable' } });
    }
    if (groupage.status !== 'OUVERT') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: 'Ce groupage est clôturé ou annulé' },
      });
    }
    return groupage;
  }
}

function toGroupageDto(row: {
  id: string;
  code: string;
  status: string;
  originAgencyId: string;
  originAgency: { name: string };
  parcelCount: number;
  totalWeightKg: { toString(): string };
  note: string | null;
  openedAt: Date;
  closedAt: Date | null;
}) {
  return {
    id: row.id,
    code: row.code,
    status: row.status as 'OUVERT' | 'CLOTURE' | 'ANNULE',
    originAgencyId: row.originAgencyId,
    originAgencyName: row.originAgency.name,
    parcelCount: row.parcelCount,
    totalWeightKg: row.totalWeightKg.toString(),
    note: row.note,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}
