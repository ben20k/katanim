import { supabase } from './supabase';

// Fire-and-forget email notification through the send-order-email Edge Function (Resend).
// Email failure never blocks the user's action.
export async function notify(orderId, event) {
  try {
    const { error } = await supabase.functions.invoke('send-order-email', {
      body: { order_id: orderId, event },
    });
    if (error) console.warn('Email notification failed:', error.message);
  } catch (e) {
    console.warn('Email notification failed:', e);
  }
}
