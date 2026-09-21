import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return key;
}

export interface PaystackInitResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackVerification {
  status: "success" | "failed" | "abandoned" | "pending";
  amount: number; // kobo
  reference: string;
  paidAt?: string;
}

/**
 * Initialize a Paystack transaction with a SERVER-computed amount.
 * The client never sends money figures; it only receives the payment URL.
 */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata: Record<string, unknown>;
}): Promise<PaystackInitResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      currency: "NGN",
      metadata: params.metadata,
    }),
  });
  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };
  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack initialize failed (${res.status})`);
  }
  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
  };
}

/**
 * Verify a transaction directly with Paystack. This is the source of truth;
 * client callbacks are never trusted.
 */
export async function verifyTransaction(reference: string): Promise<PaystackVerification> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { status: string; amount: number; reference: string; paid_at?: string };
  };
  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack verify failed (${res.status})`);
  }
  const raw = body.data.status;
  const status: PaystackVerification["status"] =
    raw === "success" ? "success" : raw === "failed" ? "failed" : raw === "abandoned" ? "abandoned" : "pending";
  return {
    status,
    amount: body.data.amount,
    reference: body.data.reference,
    paidAt: body.data.paid_at,
  };
}

/**
 * Refund a transaction in full or partially (amount in kobo).
 */
export async function refundTransaction(reference: string, amountKobo?: number): Promise<void> {
  const res = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: reference, ...(amountKobo ? { amount: amountKobo } : {}) }),
  });
  const body = (await res.json()) as { status: boolean; message?: string };
  if (!res.ok || !body.status) {
    throw new Error(body.message || `Paystack refund failed (${res.status})`);
  }
}

/**
 * Validate a Paystack webhook signature: HMAC SHA512 of the raw body with the
 * secret key, compared against the x-paystack-signature header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return false;
  const hash = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Dev-mode toggle: when Paystack keys are absent the booking flow uses a
 * simulated gateway. Production (keys present) always goes through Paystack.
 */
export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}
