import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationTrigger } from '@prisma/client';
import { PARCEL_STATUS_LABELS, renderTemplate, resolveLocale } from '@okapi/shared';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Notifications — journalisation (EF-NOT-04). L'envoi effectif (Meta WhatsApp
 * Business API, Amazon SES, SMS) est assuré par un worker de file, branché à
 * l'étape 6. Ici on met en file (`status = FILE`).
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
      },
    });
    if (!parcel || !parcel.clientChannel) return;

    const recipientContact = parcel.contacts.find((c) => c.role === 'RECIPIENT');
    const recipient =
      parcel.clientChannel === 'EMAIL'
        ? recipientContact?.email
        : recipientContact?.phone;
    if (!recipient) {
      this.logger.warn(`Notification ${trigger} ignorée : destinataire manquant (${parcel.trackingNumber})`);
      return;
    }

    const locale = resolveLocale(parcel.clientLocale);
    const template = await this.prisma.notificationTemplate.findUnique({
      where: {
        trigger_channel_locale: { trigger, channel: parcel.clientChannel, locale },
      },
    });

    const trackingBase = this.config.get('PUBLIC_TRACKING_BASE_URL', { infer: true });
    const vars = {
      numero_suivi: parcel.trackingNumber,
      statut: PARCEL_STATUS_LABELS[locale][parcel.status] ?? parcel.status,
      ville_destination: parcel.destinationCity.code,
      ville_actuelle: parcel.destinationCity.code,
      lien_suivi: `${trackingBase}/${locale}/suivi/${parcel.trackingNumber}`,
      ...extraVars,
    };

    const body = template ? renderTemplate(template.body, vars) : JSON.stringify(vars);

    await this.prisma.notification.create({
      data: {
        parcelId,
        trigger,
        channel: parcel.clientChannel,
        templateId: template?.id ?? null,
        locale,
        recipient,
        subject: template?.subject ? renderTemplate(template.subject, vars) : null,
        bodyPreview: body.slice(0, 500),
        status: 'FILE',
      },
    });
  }
}
