import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NotificationProvider, OutgoingMessage, SendResult } from './notification-provider.interface';

/**
 * Fournisseur de repli — aucun compte fournisseur requis. Journalise le
 * message et simule un envoi réussi, pour que le reste du système (statuts,
 * historique) se comporte identiquement en développement et une fois de
 * vrais fournisseurs branchés.
 */
export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = 'console';
  private readonly logger = new Logger('NotificationProvider:console');

  async send(message: OutgoingMessage): Promise<SendResult> {
    this.logger.log(
      `[SIMULÉ] à ${message.recipient}${message.subject ? ` — ${message.subject}` : ''} :\n${message.body}`,
    );
    return { providerMessageId: `console-${randomUUID()}` };
  }
}
