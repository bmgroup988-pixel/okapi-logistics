import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationTrigger } from '@prisma/client';
import { PARCEL_STATUS_LABELS, renderTemplate, resolveLocale } from '@okapi/shared';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Notifications — journalisation (EF-NOT-04) et mise en file (`status =
 * FILE`). L'envoi effectif (Meta WhatsApp Business API, Amazon SES, SMS) est
 * assuré par `NotificationDispatchService`, qui reprend les lignes `FILE`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async enqueueForParcel(
    parcelId: string,
    trigger: NotificationTrigger,
    extraVars: Record<string, string | number> = {},
  ): Promise<void> {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
      include: {
        contacts: true,
        destinationCity: true,
        supplier: true,
      },
    });
    if (!parcel) return;

    const locale = resolveLocale(parcel.clientLocale);
    const trackingBase = this.config.get('PUBLIC_TRACKING_BASE_URL', { infer: true });
    const vars = {
      numero_suivi: parcel.trackingNumber,
      statut: PARCEL_STATUS_LABELS[locale][parcel.status] ?? parcel.status,
      ville_destination: parcel.destinationCity.code,
      ville_actuelle: parcel.destinationCity.code,
      lien_suivi: `${trackingBase}/${locale}/suivi/${parcel.trackingNumber}`,
      ...extraVars,
    };

    if (parcel.clientChannel) {
      const recipientContact = parcel.contacts.find((c) => c.role === 'RECIPIENT');
      const recipient =
        parcel.clientChannel === 'EMAIL' ? recipientContact?.email : recipientContact?.phone;
      if (!recipient) {
        this.logger.warn(`Notification ${trigger} ignorée : destinataire manquant (${parcel.trackingNumber})`);
      } else {
        await this.createNotification(parcelId, trigger, parcel.clientChannel, locale, recipient, vars);
      }
    }

    // Fournisseur d'une expédition groupée : notifié en plus du client final,
    // sur WhatsApp (canal principal des fournisseurs) — docs/11.
    if (parcel.supplier?.contactPhone) {
      await this.createNotification(
        parcelId,
        trigger,
        'WHATSAPP',
        'fr',
        parcel.supplier.contactPhone,
        vars,
      );
    }
  }

  private async createNotification(
    parcelId: string,
    trigger: NotificationTrigger,
    channel: 'SMS' | 'WHATSAPP' | 'EMAIL',
    locale: 'fr' | 'en' | 'zh' | 'sw' | 'ln',
    recipient: string,
    vars: Record<string, string | number>,
  ): Promise<void> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { trigger_channel_locale: { trigger, channel, locale } },
    });
    const body = template ? renderTemplate(template.body, vars) : JSON.stringify(vars);
    await this.prisma.notification.create({
      data: {
        parcelId,
        trigger,
        channel,
        templateId: template?.id ?? null,
        locale,
        recipient,
        subject: template?.subject ? renderTemplate(template.subject, vars) : null,
        // Seul contenu persisté (pas de colonne "corps complet" séparée) : le
        // dispatcher l'envoie tel quel. Plafonné large pour ne jamais tronquer
        // un message réel (SMS/WhatsApp ~ quelques centaines de caractères).
        bodyPreview: body.slice(0, 4000),
        status: 'FILE',
      },
    });
  }
}
