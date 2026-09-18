import { Injectable, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES, type CarrierUpsertInput } from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { PrismaService } from '../prisma/prisma.service';

/** Compagnies de transport sous-traitées — gestion réservée au super-admin. */
@Injectable()
export class CarriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.carrier.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toDto);
  }

  async create(input: CarrierUpsertInput, user: CurrentUser, requestId?: string | null) {
    const carrier = await this.prisma.carrier.create({
      data: {
        name: input.name,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        isActive: input.isActive,
        createdById: user.id,
      },
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'carrier',
      entityId: carrier.id,
      actorUserId: user.id,
      requestId,
      after: { name: carrier.name },
    });
    return toDto(carrier);
  }

  async update(id: string, input: CarrierUpsertInput, user: CurrentUser, requestId?: string | null) {
    const before = await this.prisma.carrier.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Compagnie introuvable' } });
    }
    const carrier = await this.prisma.carrier.update({
      where: { id },
      data: {
        name: input.name,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        isActive: input.isActive,
      },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'carrier',
      entityId: id,
      actorUserId: user.id,
      requestId,
      before: { name: before.name, isActive: before.isActive },
      after: { name: carrier.name, isActive: carrier.isActive },
    });
    return toDto(carrier);
  }
}

function toDto(row: {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
}) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    isActive: row.isActive,
  };
}
