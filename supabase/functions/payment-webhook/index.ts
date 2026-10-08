/**
 * payment-webhook
 * ─────────────────────────────────────────────────────────────
 * Receives a payment provider's callback and settles the invoice.
 *
 * This is the only path by which access is restored, and it is deliberately
 * narrow: verify the signature, then call mark_invoice_paid(). No amounts are
 * trusted from the caller — the invoice already carries its own amount, and
 * the RPC reads it from there. A forged callback cannot invent a payment for
 * an invoice that does not exist, nor change what it costs.
 *
 * Deploy with JWT verification OFF — an external provider has no Supabase JWT.
 * The HMAC signature is the authentication.
 *
 *   supabase functions deploy payment-webhook --no-verify-jwt
 *
 * Provider swap: Flutterwave and Paystack both send an HMAC of the raw body in
 * a header (verif-hash / x-paystack-signature), and Stripe uses a timestamped
 * signature. Replace `signatureOf()` with the provider's scheme; the rest of
 * the flow is unchanged.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** HMAC-SHA256 of the raw body, hex encoded. */
async function signatureOf(raw: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Length-safe, constant-time comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SECRET) return json({ error: 'Webhook secret is not configured' }, 500);

  // Verify against the *raw* body — parsing first would change the bytes.
  const raw = await req.text();
  const provided = req.headers.get('x-skoulhub-signature') ?? '';
  if (!safeEqual(await signatureOf(raw), provided)) {
    // Deliberately terse: do not tell a forger which part was wrong.
    return json({ error: 'Invalid signature' }, 401);
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'Malformed JSON' }, 400); }

  // Provider-agnostic field names; no amount is read from the caller.
  const invoiceId = String(payload.invoice_id ?? payload.tx_ref ?? payload.reference ?? '');
  if (!invoiceId) return json({ error: 'invoice_id is required' }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Idempotent in the database, so a provider retrying is harmless.
  const { data, error } = await supabase.rpc('mark_invoice_paid', {
    p_invoice: invoiceId,
    p_method: (payload.method as string) ?? 'Online payment',
    p_reference: (payload.reference as string) ?? (payload.tx_ref as string) ?? null,
  });

  if (error) {
    // A provider retries on 5xx, which is what we want for a transient failure.
    return json({ error: error.message }, error.code === 'P0002' ? 404 : 500);
  }

  return json({ ok: true, invoice: data?.id ?? invoiceId, status: data?.status ?? 'paid' });
});
