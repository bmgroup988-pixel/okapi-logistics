import { Logger } from '@nestjs/common';
import type { NotificationProvider, OutgoingMessage, SendResult } from './notification-provider.interface';

export interface WhatsappConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
}

/**
 * Meta WhatsApp Business Cloud API — message texte libre.
 * Limite connue (Meta) : un message texte libre ne peut être envoyé que
 * dans la fenêtre de session client de 24 h ; hors fenêtre, Meta exige un
 * *template* pré-approuvé (docs/08 §5 — à finaliser lors de l'approbation
 * des templates par pays, hors code).
 * Réf. https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
export class WhatsappProvider implements NotificationProvider {
  readonly name = 'whatsapp';
  private readonly logger = new Logger('NotificationProvider:whatsapp');

  constructor(private readonly config: WhatsappConfig) {}

  async send(message: OutgoingMessage): Promise<SendResult> {
    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: message.recipient.replace(/[^\d]/g, ''),
        type: 'text',
        text: { body: message.body, preview_url: false },
      }),
    });
    const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok || !json.messages?.[0]?.id) {
      const err = json.error?.message ?? `HTTP ${res.status}`;
      this.logger.error(`Échec envoi WhatsApp : ${err}`);
      throw new Error(`WhatsApp : ${err}`);
    }
    return { providerMessageId: json.messages[0].id };
  }
}
