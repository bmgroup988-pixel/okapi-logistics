import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@okapi/shared';
import type { Request } from 'express';
import type { CurrentUser } from './current-user';
import { hasPermission } from './current-user';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';

/** Vérifie les permissions nommées exigées par `@RequirePermissions(...)`. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user as CurrentUser | undefined;
    if (!user) return false;

    const missing = required.filter((p) => !hasPermission(user, p));
    if (missing.length > 0) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: `Permission requise : ${missing.join(', ')}`,
        },
      });
    }
    return true;
  }
}
