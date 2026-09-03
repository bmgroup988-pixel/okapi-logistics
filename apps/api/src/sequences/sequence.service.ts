import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Compteurs séquentiels atomiques — RG-01 / RG-09.
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` : incrément atomique sans
 * verrou applicatif, sûr en concurrence.
 */
@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(
    scopeType: string,
    scopeKey: string,
    period: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<Array<{ last_value: bigint }>>`
      INSERT INTO sequences (scope_type, scope_key, period, last_value, updated_at)
      VALUES (${scopeType}, ${scopeKey}, ${period}, 1, now())
      ON CONFLICT (scope_type, scope_key, period)
      DO UPDATE SET last_value = sequences.last_value + 1, updated_at = now()
      RETURNING last_value
    `;
    return Number(rows[0]!.last_value);
  }
}
