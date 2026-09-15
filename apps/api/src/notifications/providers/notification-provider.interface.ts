/**
 * Contrat commun à tout fournisseur d'envoi (e-mail, WhatsApp, SMS). Chaque
 * canal résout un fournisseur configuré (clés présentes) ou retombe sur
 * `ConsoleNotificationProvider` — jamais d'exception au démarrage faute de
 * clés, seulement une dégradation en mode journalisation locale.
 */
export interface OutgoingMessage {
  recipient: string; // e-mail, numéro E.164 (WhatsApp/SMS)
  subject?: string | null; // e-mail uniquement
  body: string;
}

export interface SendResult {
  providerMessageId: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: OutgoingMessage): Promise<SendResult>;
}
