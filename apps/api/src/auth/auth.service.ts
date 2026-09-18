import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  permissionsForRoles,
  ROLE_CODES,
  type MeDto,
  type AuthTokensDto,
  type Locale,
  type RoleCode,
} from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import {
  decryptSecret,
  encryptSecret,
  generateBase32Secret,
  randomTokenB64Url,
  sha256Hex,
  totpAuthUri,
  totpVerify,
} from '../common/crypto.util';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from './current-user';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get masterKey(): string {
    return this.config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  /* ------------------------------------------------------------------ login */
  async login(
    email: string,
    password: string,
    otp: string | undefined,
    ctx: LoginContext,
  ): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const genericFail = new UnauthorizedException({
      error: { code: 'UNAUTHENTICATED', message: 'Identifiants invalides' },
    });

    if (!user || !user.isActive || user.deletedAt) {
      await this.audit.record({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        actorLabel: email,
        ip: ctx.ip,
        requestId: ctx.requestId,
      });
      throw genericFail;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Compte temporairement verrouillé' },
      });
    }

    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil:
            failed >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCK_MINUTES * 60_000)
              : null,
        },
      });
      await this.audit.record({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        actorLabel: email,
        ip: ctx.ip,
        requestId: ctx.requestId,
      });
      throw genericFail;
    }

    if (user.totpEnabled) {
      if (!otp) {
        throw new UnauthorizedException({
          error: { code: 'MFA_REQUIRED', message: 'Code de vérification en deux étapes requis' },
        });
      }
      const secret = user.totpSecretEnc ? decryptSecret(user.totpSecretEnc, this.masterKey) : '';
      if (!secret || !totpVerify(secret, otp)) {
        await this.audit.record({
          action: 'LOGIN_FAILED',
          entityType: 'user',
          entityId: user.id,
          actorLabel: `${email} (OTP)`,
          ip: ctx.ip,
          requestId: ctx.requestId,
        });
        throw genericFail;
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const session = await this.issueSession(user.id, user.email, ctx);
    await this.audit.record({
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return session;
  }

  /* ---------------------------------------------------------------- refresh */
  async refresh(rawRefreshToken: string, ctx: LoginContext): Promise<AuthTokensDto> {
    const hash = sha256Hex(rawRefreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Session invalide ou expirée' },
      });
    }

    // rotation à usage unique
    const next = await this.issueSession(session.userId, session.user.email, ctx);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return next;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const hash = sha256Hex(rawRefreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(
    userId: string,
    email: string,
    ctx: LoginContext,
  ): Promise<AuthTokensDto> {
    const raw = randomTokenB64Url(48);
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: sha256Hex(raw),
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtl * 1000),
      },
    });
    return {
      accessToken: this.tokens.signAccess({ sub: userId, email, sid: session.id }),
      refreshToken: raw,
      expiresIn: this.tokens.accessTtl,
    };
  }

  /* ---------------------------------------------------- contexte utilisateur */
  async loadUserContext(userId: string, sessionId: string | null): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Compte introuvable ou désactivé' },
      });
    }

    const roleCodes = user.roles.map((r) => r.role.code);
    const validRoleCodes = roleCodes.filter((c): c is RoleCode =>
      (ROLE_CODES as readonly string[]).includes(c),
    );
    // Rôles "non scopés par défaut" (pays/agence) traités comme globaux —
    // AGENT_FRET et FOURNISSEUR sont toujours explicitement scopés (agence,
    // resp. fournisseur), jamais globaux par absence de scope (docs/11 §5).
    const isGlobal =
      roleCodes.includes('SUPER_ADMIN') ||
      user.roles.some(
        (r) =>
          r.role.code !== 'AGENT_FRET' &&
          r.role.code !== 'FOURNISSEUR' &&
          !r.scopeCountryId &&
          !r.scopeAgencyId,
      );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      locale: user.defaultLocale,
      roleCodes,
      permissions: permissionsForRoles(validRoleCodes),
      scope: {
        isGlobal,
        countryIds: unique(user.roles.map((r) => r.scopeCountryId).filter(Boolean) as string[]),
        agencyIds: unique(user.roles.map((r) => r.scopeAgencyId).filter(Boolean) as string[]),
        supplierIds: unique(
          user.roles.map((r) => r.scopeSupplierId).filter(Boolean) as string[],
        ),
      },
      sessionId,
    };
  }

  async me(user: CurrentUser): Promise<MeDto> {
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
    return {
      id: full.id,
      email: full.email,
      fullName: full.fullName,
      locale: (full.defaultLocale as Locale) ?? 'fr',
      roles: full.roles.map((r) => ({
        code: r.role.code,
        scopeCountryId: r.scopeCountryId,
        scopeAgencyId: r.scopeAgencyId,
        scopeSupplierId: r.scopeSupplierId,
      })),
      permissions: [...user.permissions],
      mfaEnabled: full.totpEnabled,
    };
  }

  /** Changement de mot de passe par l'utilisateur lui-même — exige l'actuel. */
  async changePassword(user: CurrentUser, currentPassword: string, newPassword: string): Promise<void> {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const ok = await this.passwords.verify(row.passwordHash, currentPassword);
    if (!ok) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Mot de passe actuel incorrect' },
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      after: { passwordChanged: true },
    });
  }

  /* ---------------------------------------------------------------- MFA / TOTP */
  async mfaEnroll(user: CurrentUser): Promise<{ secret: string; otpauthUri: string }> {
    const secret = generateBase32Secret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecretEnc: encryptSecret(secret, this.masterKey), totpEnabled: false },
    });
    return { secret, otpauthUri: totpAuthUri(secret, user.email) };
  }

  async mfaVerify(user: CurrentUser, otp: string): Promise<void> {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!row.totpSecretEnc) {
      throw new ForbiddenException({
        error: { code: 'CONFLICT', message: 'Aucun secret MFA en cours d’enrôlement' },
      });
    }
    const secret = decryptSecret(row.totpSecretEnc, this.masterKey);
    if (!totpVerify(secret, otp)) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Code invalide' },
      });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      after: { totpEnabled: true },
    });
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
