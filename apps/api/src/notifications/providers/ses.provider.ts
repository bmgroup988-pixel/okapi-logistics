import { Logger } from '@nestjs/common';
import { signAwsRequest } from './aws-sigv4-header';
import type { NotificationProvider, OutgoingMessage, SendResult } from './notification-provider.interface';

export interface SesConfig {
  region: string;
  accessKey: string;
  secretKey: string;
  fromEmail: string;
}

/**
 * Amazon SES v2 — API SendEmail appelée en HTTP direct, signée SigV4 « en-
 * tête » (voir aws-sigv4-header.ts). Pas de aws-sdk, cohérent avec le choix
 * déjà fait pour le stockage objet (storage/sigv4.ts).
 * Réf. https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html
 */
export class SesEmailProvider implements NotificationProvider {
  readonly name = 'ses';
  private readonly logger = new Logger('NotificationProvider:ses');

  constructor(private readonly config: SesConfig) {}

  async send(message: OutgoingMessage): Promise<SendResult> {
    const url = `https://email.${this.config.region}.amazonaws.com/v2/email/outbound-emails`;
    const body = JSON.stringify({
      FromEmailAddress: this.config.fromEmail,
      Destination: { ToAddresses: [message.recipient] },
      Content: {
        Simple: {
          Subject: { Data: message.subject ?? 'Okapi Logistics', Charset: 'UTF-8' },
          Body: { Text: { Data: message.body, Charset: 'UTF-8' } },
        },
      },
    });

    const { headers } = signAwsRequest({
      method: 'POST',
      url,
      region: this.config.region,
      service: 'ses',
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      body,
    });

    const res = await fetch(url, { method: 'POST', headers, body });
    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`Échec envoi SES (${res.status}) : ${text}`);
      throw new Error(`SES ${res.status} : ${text.slice(0, 300)}`);
    }
    const json = JSON.parse(text) as { MessageId?: string };
    return { providerMessageId: json.MessageId ?? 'unknown' };
  }
}
