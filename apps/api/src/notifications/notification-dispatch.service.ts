import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationChannel } from '@prisma/client';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { ConsoleNotificationProvider } from './providers/console.provider';
import type { NotificationProvider } from './providers/notification-provider.interface';
import { SesEmailProvider } from './providers/ses.provider';
import { SmsProvider } from './providers/sms.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

/**
 * Worker d'envoi — reprend les notifications `FILE` (mises en file par
 * NotificationsService.enqueueForParcel) et tente leur envoi réel via le
 * fournisseur configuré pour le canal, ou `console` (journalisation locale)
 * si aucune clé n'est présente. Poll simple par intervalle plutôt qu'une
 * file dédiée (Redis n'est pas encore branché à un worker — voir
 * REDIS_URL) : suffisant pour le volume v1, à remplacer par une vraie file
 * si le débit l'exige.
 */
@Injectable()
export class NotificationDispatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatchService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly providers: Record<NotificationChannel, NotificationProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.providers = {
      EMAIL: this.buildEmailProvider(),
      WHATSAPP: this.buildWhatsappProvider(),
      SMS: this.buildSmsProvider(),
    };
    for (const [channel, provider] of Object.entries(this.providers)) {
      this.logger.log(`Canal ${channel} → fournisseur « ${provider.name} »`);
    }
  }

  /**
   * Envoi immédiat, synchrone, hors file — pour une action déclenchée
   * explicitement par un utilisateur (ex. « Envoyer par email » sur une
   * facture fournisseur), pas pour un déclencheur automatique lié à un colis
   * (voir NotificationsService.enqueueForParcel pour ce cas-là). Réutilise
   * le même fournisseur EMAIL déjà configuré (SES ou console en repli).
   */
  async sendEmailNow(recipient: string, subject: string, body: string): Promise<void> {
    await this.providers.EMAIL.send({ recipient, subject, body });
  }

  onModuleInit(): void {
    const interval = this.config.get('NOTIFICATIONS_DISPATCH_INTERVAL_MS', { infer: true });
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private buildEmailProvider(): NotificationProvider {
    const region = this.config.get('SES_REGION', { infer: true });
    const accessKey = this.config.get('SES_ACCESS_KEY', { infer: true });
    const secretKey = this.config.get('SES_SECRET_KEY', { infer: true });
    const fromEmail = this.config.get('SES_FROM_EMAIL', { infer: true });
    if (region && accessKey && secretKey && fromEmail) {
      return new SesEmailProvider({ region, accessKey, secretKey, fromEmail });
    }
    return new ConsoleNotificationProvider();
  }

  private buildWhatsappProvider(): NotificationProvider {
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID', { infer: true });
    const accessToken = this.config.get('WHATSAPP_ACCESS_TOKEN', { infer: true });
    const apiVersion = this.config.get('WHATSAPP_API_VERSION', { infer: true });
    if (phoneNumberId && accessToken) {
      return new WhatsappProvider({ phoneNumberId, accessToken, apiVersion });
    }
    return new ConsoleNotificationProvider();
  }

  private buildSmsProvider(): NotificationProvider {
    const url = this.config.get('SMS_GATEWAY_URL', { infer: true });
    const username = this.config.get('SMS_GATEWAY_USERNAME', { infer: true });
    const apiKey = this.config.get('SMS_GATEWAY_API_KEY', { infer: true });
    const senderId = this.config.get('SMS_GATEWAY_SENDER_ID', { infer: true });
    if (username && apiKey) {
      return new SmsProvider({ url, username, apiKey, senderId });
    }
    return new ConsoleNotificationProvider();
  }

  private async tick(): Promise<void> {
    if (this.running) return; // évite le chevauchement si un lot prend plus longtemps que l'intervalle
    this.running = true;
    try {
      const batchSize = this.config.get('NOTIFICATIONS_DISPATCH_BATCH_SIZE', { infer: true });
      const due = await this.prisma.notification.findMany({
        where: {
          status: 'FILE',
          OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });
      for (const n of due) {
        await this.dispatchOne(n.id);
      }
    } catch (err) {
      this.logger.error(`Erreur lors du cycle d'envoi des notifications : ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async dispatchOne(id: string): Promise<void> {
    // Remarque : une seule instance API en v1 (pas de file/verrou distribué
    // branché — REDIS_URL n'est pas encore utilisé). Un second réplica de
    // l'API pourrait retraiter la même ligne ; à corriger (statut
    // intermédiaire « EN_COURS » ou verrou) avant toute mise à l'échelle
    // horizontale du dispatcher.
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.status !== 'FILE') return;
    const provider = this.providers[notification.channel];
    const maxAttempts = this.config.get('NOTIFICATIONS_MAX_ATTEMPTS', { infer: true });

    try {
      const result = await provider.send({
        recipient: notification.recipient,
        subject: notification.subject,
        body: notification.bodyPreview ?? '',
      });
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'ENVOYE',
          provider: provider.name,
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      });
    } catch (err) {
      const attempts = notification.attempts + 1;
      const exhausted = attempts >= maxAttempts;
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: exhausted ? 'ECHEC' : 'FILE',
          attempts,
          error: (err as Error).message.slice(0, 500),
          provider: provider.name,
          // Repli exponentiel simple (1 min, 2 min, 4 min, ...) avant réessai.
          scheduledFor: exhausted ? null : new Date(Date.now() + 60_000 * 2 ** (attempts - 1)),
        },
      });
      this.logger.warn(
        `Échec notification ${id} (${notification.channel}, tentative ${attempts}${exhausted ? ', abandon' : ''}) : ${(err as Error).message}`,
      );
    }
  }
}
