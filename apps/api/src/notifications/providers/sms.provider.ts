import { Logger } from '@nestjs/common';
import type { NotificationProvider, OutgoingMessage, SendResult } from './notification-provider.interface';

export interface SmsConfig {
  url: string;
  username: string;
  apiKey: string;
  senderId?: string;
}

/**
 * Passerelle SMS — implémentation de référence au format Africa's Talking
 * (recommandé : bonne couverture Bénin/RDC/Nigeria, cf. docs/08 §5). Pour
 * changer de fournisseur (Twilio, Vonage, agrégateur local), remplacer ce
 * seul fichier : le reste du système ne connaît que `NotificationProvider`
 * (send(message) -> { providerMessageId }), jamais le format spécifique
 * d'un fournisseur.
 * Réf. https://developers.africastalking.com/docs/sms/sending/bulk
 */
export class SmsProvider implements NotificationProvider {
  readonly name = 'sms';
  private readonly logger = new Logger('NotificationProvider:sms');

  constructor(private readonly config: SmsConfig) {}

  async send(message: OutgoingMessage): Promise<SendResult> {
    const body = new URLSearchParams({
      username: this.config.username,
      to: message.recipient,
      message: message.body,
      ...(this.config.senderId ? { from: this.config.senderId } : {}),
    });

    const res = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        apikey: this.config.apiKey,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: body.toString(),
    });

    const json = (await res.json()) as {
      SMSMessageData?: { Recipients?: Array<{ messageId: string; status: string }> };
    };
    const recipient = json.SMSMessageData?.Recipients?.[0];
    if (!res.ok || !recipient || !/success/i.test(recipient.status)) {
      const err = recipient?.status ?? `HTTP ${res.status}`;
      this.logger.error(`Échec envoi SMS : ${err}`);
      throw new Error(`SMS : ${err}`);
    }
    return { providerMessageId: recipient.messageId };
  }
}
