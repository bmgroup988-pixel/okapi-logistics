import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtSign, jwtVerify, JwtError } from '../common/crypto.util';
import type { Env } from '../config/env.schema';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  sid: string; // id de session (refresh)
}

@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get accessTtl(): number {
    return Number(this.config.get('JWT_ACCESS_TTL', { infer: true }));
  }
  get refreshTtl(): number {
    return Number(this.config.get('JWT_REFRESH_TTL', { infer: true }));
  }

  signAccess(claims: AccessTokenClaims): string {
    return jwtSign(claims, this.config.get('JWT_ACCESS_SECRET', { infer: true }), this.accessTtl);
  }

  verifyAccess(token: string): AccessTokenClaims {
    try {
      return jwtVerify<AccessTokenClaims>(
        token,
        this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      );
    } catch (e) {
      throw e instanceof JwtError ? e : new JwtError('jeton invalide');
    }
  }
}
