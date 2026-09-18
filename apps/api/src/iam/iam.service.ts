import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/api-response';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import type { CurrentUser } from '../auth/current-user';
import { randomTokenB64Url } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import type { RoleAssignInput, UserCreateInput, UserUpdateInput } from './iam.schemas';

@Injectable()
export class IamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(page: number, limit: number, q?: string) {
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { fullName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(
      rows.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        locale: u.defaultLocale,
        isActive: u.isActive,
        mfaEnabled: u.totpEnabled,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        roles: u.roles.map((r) => ({
          id: r.id,
          code: r.role.code,
          scopeCountryId: r.scopeCountryId,
          scopeAgencyId: r.scopeAgencyId,
        })),
      })),
      total,
      page,
      limit,
    );
  }

  async create(input: UserCreateInput, actor: CurrentUser, requestId?: string | null) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) {
      throw new BadRequestException({
        error: { code: 'CONFLICT', message: 'Un compte existe déjà avec cet e-mail' },
      });
    }
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        phone: input.phone ?? null,
        defaultLocale: input.locale,
        passwordHash: await this.passwords.hash(input.password),
        createdById: actor.id,
      },
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'user',
      entityId: user.id,
      actorUserId: actor.id,
      requestId,
      after: { email: user.email, fullName: user.fullName },
    });
    return { id: user.id, email: user.email };
  }

  async update(
    id: string,
    input: UserUpdateInput,
    actor: CurrentUser,
    requestId?: string | null,
  ) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Utilisateur introuvable' } });
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: input.fullName ?? undefined,
        phone: input.phone === undefined ? undefined : input.phone,
        defaultLocale: input.locale ?? undefined,
        isActive: input.isActive ?? undefined,
        updatedById: actor.id,
      },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'user',
      entityId: id,
      actorUserId: actor.id,
      requestId,
      before: { fullName: before.fullName, isActive: before.isActive, locale: before.defaultLocale },
      after: { fullName: user.fullName, isActive: user.isActive, locale: user.defaultLocale },
    });
    return { id: user.id };
  }

  async assignRole(
    userId: string,
    input: RoleAssignInput,
    actor: CurrentUser,
    requestId?: string | null,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Utilisateur introuvable' } });
    const role = await this.prisma.role.findUnique({ where: { code: input.roleCode } });
    if (!role) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Rôle inconnu' } });

    const scopeCountryId = input.scopeCountryId ?? null;
    const scopeAgencyId = input.scopeAgencyId ?? null;
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id, scopeCountryId, scopeAgencyId },
    });
    const grant =
      existing ??
      (await this.prisma.userRole.create({
        data: { userId, roleId: role.id, scopeCountryId, scopeAgencyId, createdById: actor.id },
      }));
    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'user_role',
      entityId: grant.id,
      actorUserId: actor.id,
      requestId,
      after: {
        userId,
        roleCode: input.roleCode,
        scopeCountryId: input.scopeCountryId ?? null,
        scopeAgencyId: input.scopeAgencyId ?? null,
      },
    });
    return { id: grant.id };
  }

  async revokeRole(userId: string, userRoleId: string, actor: CurrentUser, requestId?: string | null) {
    const grant = await this.prisma.userRole.findUnique({ where: { id: userRoleId } });
    if (!grant || grant.userId !== userId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Attribution introuvable' } });
    }
    await this.prisma.userRole.delete({ where: { id: userRoleId } });
    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'user_role',
      entityId: userRoleId,
      actorUserId: actor.id,
      requestId,
      before: { userId, roleId: grant.roleId },
    });
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur en oubli/perte — génère un
   * mot de passe temporaire, retourné une seule fois à l'admin pour
   * transmission par un canal sûr (même pattern que l'activation du portail
   * fournisseur, docs/11 §6.1).
   */
  async resetPassword(
    userId: string,
    actor: CurrentUser,
    requestId?: string | null,
  ): Promise<{ temporaryPassword: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Utilisateur introuvable' } });
    const temporaryPassword = randomTokenB64Url(18);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(temporaryPassword) },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      actorUserId: actor.id,
      requestId,
      after: { passwordReset: true },
    });
    return { temporaryPassword };
  }

  async resetMfa(userId: string, actor: CurrentUser, requestId?: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Utilisateur introuvable' } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecretEnc: null },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      actorUserId: actor.id,
      requestId,
      after: { totpReset: true },
    });
  }
}
