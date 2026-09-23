import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@okapi/shared';
import type { CurrentUser as CurrentUserType } from './current-user';

export const IS_PUBLIC_KEY = 'okapi:isPublic';
export const PERMISSIONS_KEY = 'okapi:permissions';
export const MFA_EXEMPT_KEY = 'okapi:mfaExempt';

/** Route accessible sans authentification (surface publique de suivi). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Exige toutes les permissions listées — vérifié par PermissionsGuard. */
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

/**
 * Route joignable même quand la MFA est obligatoire pour le rôle mais pas
 * encore configurée — réservé aux routes nécessaires pour la mettre en place
 * (enrôlement/vérification TOTP, /me, changement de mot de passe, logout).
 * Voir MfaEnforcementGuard.
 */
export const MfaExempt = () => SetMetadata(MFA_EXEMPT_KEY, true);

/** Injecte le compte connecté : `@CurrentUser() user: CurrentUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserType => {
    return ctx.switchToHttp().getRequest().user as CurrentUserType;
  },
);
