import { Injectable, Logger } from '@nestjs/common';
import type { AuditAction } from '@okapi/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  requestId?: string | null;
}

/** Journal d'audit des actions sensibles — ENF-SEC-06. Append-only. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          actorUserId: entry.actorUserId ?? null,
          actorLabel: entry.actorLabel ?? null,
          before: sanitize(entry.before),
          after: sanitize(entry.after),
          ip: entry.ip ?? null,
          requestId: entry.requestId ?? null,
        },
      });
    } catch (err) {
      // Le journal d'audit ne doit jamais faire échouer l'opération métier.
      this.logger.error(`Échec d'écriture du journal d'audit (${entry.action} ${entry.entityType})`, err as Error);
    }
  }
}

/** Expurge les données personnelles évidentes avant journalisation. */
const REDACT_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'totpSecret',
  'totpSecretEnc',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'idDocumentRef',
]);

function sanitize(value: unknown): any {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k) ? '[REDACTED]' : sanitize(v);
    }
    return out;
  }
  return value;
}
