import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  API_ERROR_CODES,
  generateSupplierCode,
  type SupplierCreateInput,
  type SupplierPortalActivateInput,
  type SupplierUpdateInput,
} from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { PasswordService } from '../auth/password.service';
import { randomTokenB64Url } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CODE_ATTEMPTS = 5;

/** Gestion interne des fournisseurs (création, activation du portail) — docs/11, §6.1. */
@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
  ) {}

  async list(user: CurrentUser) {
    const where = user.scope.isGlobal ? {} : { countryId: { in: user.scope.countryIds } };
    const rows = await this.prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map(toSupplierDto);
  }

  async get(id: string) {
    const row = await this.prisma.supplier.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Fournisseur introuvable' } });
    }
    return toSupplierDto(row);
  }

  async create(input: SupplierCreateInput, user: CurrentUser, requestId?: string | null) {
    const [country, agency, currency] = await Promise.all([
      this.prisma.country.findUnique({ where: { id: input.countryId } }),
      this.prisma.agency.findUnique({ where: { id: input.defaultAgencyId } }),
      this.prisma.currency.findUnique({ where: { code: input.billingCurrency } }),
    ]);
    if (!country) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: 'Pays introuvable' } });
    }
    if (!agency) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: 'Agence introuvable' } });
    }
    if (!currency || !currency.isActive) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: `Devise inactive : ${input.billingCurrency}` },
      });
    }

    const code = await this.generateUniqueCode();
    const supplier = await this.prisma.supplier.create({
      data: {
        code,
        name: input.name,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        address: input.address ?? null,
        countryId: input.countryId,
        defaultAgencyId: input.defaultAgencyId,
        billingCurrency: input.billingCurrency,
        createdById: user.id,
      },
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'supplier',
      entityId: supplier.id,
      actorUserId: user.id,
      requestId,
      after: { code: supplier.code, name: supplier.name },
    });
    return toSupplierDto(supplier);
  }

  async update(id: string, input: SupplierUpdateInput, user: CurrentUser, requestId?: string | null) {
    const before = await this.prisma.supplier.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Fournisseur introuvable' } });
    }
    if (input.billingCurrency) {
      const currency = await this.prisma.currency.findUnique({ where: { code: input.billingCurrency } });
      if (!currency || !currency.isActive) {
        throw new BadRequestException({
          error: { code: API_ERROR_CODES.VALIDATION, message: `Devise inactive : ${input.billingCurrency}` },
        });
      }
    }
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        contactName: input.contactName === undefined ? undefined : input.contactName,
        contactPhone: input.contactPhone === undefined ? undefined : input.contactPhone,
        contactEmail: input.contactEmail === undefined ? undefined : input.contactEmail,
        address: input.address === undefined ? undefined : input.address,
        billingCurrency: input.billingCurrency ?? undefined,
        isActive: input.isActive ?? undefined,
      },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'supplier',
      entityId: id,
      actorUserId: user.id,
      requestId,
      before: { name: before.name, isActive: before.isActive },
      after: { name: supplier.name, isActive: supplier.isActive },
    });
    return toSupplierDto(supplier);
  }

  /**
   * Crée le compte de connexion du portail fournisseur et l'assigne au rôle
   * FOURNISSEUR, scopé à ce fournisseur — docs/11, §5/§6.1. Le mot de passe
   * temporaire n'est retourné qu'une seule fois, jamais journalisé.
   */
  async activatePortal(
    id: string,
    input: SupplierPortalActivateInput,
    user: CurrentUser,
    requestId?: string | null,
  ): Promise<{ email: string; temporaryPassword: string }> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Fournisseur introuvable' } });
    }
    if (supplier.userId) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Le portail est déjà activé pour ce fournisseur' },
      });
    }
    const existingEmail = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Cette adresse email est déjà utilisée' },
      });
    }
    const role = await this.prisma.role.findUnique({ where: { code: 'FOURNISSEUR' } });
    if (!role) {
      throw new BadRequestException({
        error: {
          code: API_ERROR_CODES.VALIDATION,
          message: "Rôle FOURNISSEUR introuvable — relancer le seed de référence (db:seed:prod)",
        },
      });
    }

    const temporaryPassword = randomTokenB64Url(18);
    const passwordHash = await this.passwords.hash(temporaryPassword);

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.user.create({
        data: { email: input.email, fullName: input.fullName, passwordHash, defaultLocale: 'fr' },
      });
      await tx.userRole.create({
        data: { userId: account.id, roleId: role.id, scopeSupplierId: supplier.id, createdById: user.id },
      });
      await tx.supplier.update({ where: { id: supplier.id }, data: { userId: account.id } });
    });

    await this.audit.record({
      action: 'CREATE',
      entityType: 'supplier_portal_account',
      entityId: supplier.id,
      actorUserId: user.id,
      requestId,
      after: { email: input.email },
    });

    return { email: input.email, temporaryPassword };
  }

  private async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      const code = generateSupplierCode();
      const exists = await this.prisma.supplier.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new BadRequestException({
      error: { code: API_ERROR_CODES.CONFLICT, message: "Impossible de générer un code fournisseur unique" },
    });
  }
}

function toSupplierDto(row: {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  countryId: string;
  defaultAgencyId: string;
  billingCurrency: string;
  userId: string | null;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    address: row.address,
    countryId: row.countryId,
    defaultAgencyId: row.defaultAgencyId,
    billingCurrency: row.billingCurrency,
    portalActivated: row.userId !== null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
