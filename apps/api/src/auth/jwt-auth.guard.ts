import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtError } from '../common/crypto.util';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators';
import { TokenService } from './token.service';

/** Authentifie chaque requête (sauf `@Public()`) et attache `req.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Jeton d’accès manquant' },
      });
    }

    try {
      const claims = this.tokens.verifyAccess(token);
      req.user = await this.auth.loadUserContext(claims.sub, claims.sid ?? null);
      return true;
    } catch (err) {
      if (err instanceof JwtError) {
        throw new UnauthorizedException({
          error: { code: 'UNAUTHENTICATED', message: 'Jeton d’accès invalide ou expiré' },
        });
      }
      throw err;
    }
  }
}
