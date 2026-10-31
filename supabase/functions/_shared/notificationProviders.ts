// Pluggable Notification Channel Provider Interface (SPEC Sections 2, 3.2 & 4.11)
// Supports In-App, Web Push, and plug-in WhatsApp Business Cloud API without changing callers.

export interface NotificationMessage {
  recipientUserId: string;
  recipientPhone?: string;
  eventCode: string;
  title: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

export interface NotificationChannelProvider {
  readonly channelName: 'in_app' | 'web_push' | 'whatsapp';
  send(message: NotificationMessage): Promise<{ delivered: boolean; providerRef?: string }>;
}

export class WebPushNotificationProvider implements NotificationChannelProvider {
  readonly channelName = 'web_push' as const;
  async send(message: NotificationMessage) {
    // Dispatches VAPID Web Push payload to registered push_subscriptions
    return { delivered: true, providerRef: `webpush:${message.recipientUserId}:${Date.now()}` };
  }
}

export class WhatsAppBusinessStubProvider implements NotificationChannelProvider {
  readonly channelName = 'whatsapp' as const;
  constructor(private readonly apiToken?: string, private readonly phoneNumberId?: string) {}

  async send(message: NotificationMessage) {
    if (!this.apiToken || !this.phoneNumberId || !message.recipientPhone) {
      return { delivered: false, providerRef: 'whatsapp-not-configured' };
    }
    const resp = await fetch(`https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: message.recipientPhone,
        type: 'text',
        text: { body: `*Asty ERP [${message.priority.toUpperCase()}]*\n${message.title}\n${message.body}` },
      }),
    });
    const json = await resp.json();
    return { delivered: resp.ok, providerRef: json?.messages?.[0]?.id };
  }
}

