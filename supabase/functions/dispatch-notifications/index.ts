// Supabase Edge Function: dispatch-notifications
// Resolves position-based recipients (SPEC 3.2) and dispatches In-App + Web Push + optional WhatsApp.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  WebPushNotificationProvider,
  WhatsAppBusinessStubProvider,
} from '../_shared/notificationProviders.ts';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { eventCode, siteId, titleKey, bodyKey, params, priority = 'normal' } = await req.json();

    const { data: rule } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('event_code', eventCode)
      .eq('is_active', true)
      .single();

    if (!rule) {
      return Response.json({ dispatched: 0, reason: 'No active notification rule' });
    }

    const { data: holders } = await supabase
      .from('user_positions')
      .select('user_id, position_id, profiles!inner(id, phone, is_active)')
      .in('position_id', rule.recipient_position_ids)
      .eq('is_active', true);

    const webPush = new WebPushNotificationProvider();
    const whatsApp = new WhatsAppBusinessStubProvider(
      Deno.env.get('WHATSAPP_ACCESS_TOKEN'),
      Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
    );

    let count = 0;
    for (const h of holders ?? []) {
      await supabase.from('notifications').insert({
        user_id: h.user_id,
        position_id: h.position_id,
        site_id: siteId ?? null,
        event_code: eventCode,
        title_key: titleKey,
        body_key: bodyKey,
        params: params ?? {},
        priority,
      });

      if (rule.channels.includes('web_push')) {
        await webPush.send({
          recipientUserId: h.user_id,
          eventCode,
          title: titleKey,
          body: bodyKey,
          priority,
        });
      }
      if (rule.channels.includes('whatsapp')) {
        await whatsApp.send({
          recipientUserId: h.user_id,
          recipientPhone: (h as { profiles?: { phone?: string } }).profiles?.phone,
          eventCode,
          title: titleKey,
          body: bodyKey,
          priority,
        });
      }
      count++;
    }

    return Response.json({ dispatched: count, eventCode });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
});

