import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MFA_REQUIRED_ROLES } from '@okapi/shared';
import type { Request } from 'express';
import type { CurrentUser } from './current-user';
import { IS_PUBLIC_KEY, MFA_EXEMPT_KEY } from './decorators';

/**
 * Bloque l'accès à tout endpoint non exempté tant qu'un compte à rôle
 * SUPER_ADMIN/ADMIN_DAF n'a pas activé la double authentification —
 * décision produit 2026-09-23, MFA_REQUIRED_ROLES (docs/07 §sécurité).
 */
@Injectable()
export class MfaEnforcementGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isExempt = this.reflector.getAllAndOverride<boolean>(MFA_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isExempt) return true;

    const user = context.switchToHttp().getRequest<Request>().user as CurrentUser | undefined;
    if (!user) return true; // JwtAuthGuard gère déjà l'absence d'authentification

    const requiresMfa = user.roleCodes.some((code) =>
      (MFA_REQUIRED_ROLES as string[]).includes(code),
    );
    if (requiresMfa && !user.mfaEnabled) {
      throw new ForbiddenException({
        error: {
          code: 'MFA_SETUP_REQUIRED',
          message: 'Double authentification obligatoire pour ce rôle — configurez-la avant de continuer.',
        },
      });
    }
    return true;
  }
}
