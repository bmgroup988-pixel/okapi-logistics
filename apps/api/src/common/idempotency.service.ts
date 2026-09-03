import { ConflictException, Injectable } from '@nestjs/common';
import { API_ERROR_CODES } from '@okapi/shared';
import { sha256Hex } from './crypto.util';
import { PrismaService } from '../prisma/prisma.service';

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotence des créations (colis, paiements) — RG-12. Absorbe les doubles
 * soumissions dues aux réseaux d'agence instables.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(method: string, path: string, body: unknown): string {
    return sha256Hex(`${method} ${path} ${JSON.stringify(body ?? null)}`);
  }

  /**
   * Rejoue la réponse si la même clé + empreinte est déjà connue ; lève 409 si
   * la clé est réutilisée avec un corps différent ; sinon exécute `producer` et
   * mémorise la réponse.
   */
  async execute<T>(
    key: string | undefined,
    userId: string | null,
    fingerprint: string,
    producer: () => Promise<{ status: number; body: T }>,
  ): Promise<{ status: number; body: T; replayed: boolean }> {
    if (!key) {
      const r = await producer();
      return { ...r, replayed: false };
    }

    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new ConflictException({
          error: {
            code: API_ERROR_CODES.IDEMPOTENCY_MISMATCH,
            message: 'La clé d’idempotence a déjà été utilisée avec une requête différente',
          },
        });
      }
      return {
        status: existing.responseStatus ?? 200,
        body: (existing.responseSnapshot ?? null) as T,
        replayed: true,
      };
    }

    const result = await producer();
    await this.prisma.idempotencyKey
      .create({
        data: {
          key,
          userId,
          requestFingerprint: fingerprint,
          responseStatus: result.status,
          responseSnapshot: result.body as object,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      })
      .catch(() => undefined); // course : une autre requête a déjà enregistré
    return { ...result, replayed: false };
  }
}
