import crypto from "crypto";

// ── Gateway selection ────────────────────────────────────────────────────────
// One interface, two gateways. Flutterwave wins when its keys are present;
// Paystack is the fallback so nothing breaks mid-migration. No keys at all
// means the dev simulation path (instant fulfill, no money moves).

export type GatewayName = "flutterwave" | "paystack" | "simulated";

export function activeGateway(): GatewayName {
  if (isFlutterwaveConfigured()) return "flutterwave";
  if (isPaystackConfigured()) return "paystack";
  return "simulated";
}

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function isFlutterwaveConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY);
}

// ── Shared shapes ────────────────────────────────────────────────────────────

export interface InitPaymentInput {
  email: string;
  amountKobo: number;
  reference: string;
  name?: string;
  phone?: string;
  redirectUrl?: string;
  metadata: Record<string, unknown>;
}

export interface InitPaymentResult {
  gateway: GatewayName;
  authorizationUrl: string;
  accessCode: string | null;
  publicKey: string | null;
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amount: number; // kobo, always
  reference: string;
  paidAt?: string;
  /** Gateway's numeric transaction id; Flutterwave refunds need it. */
  transactionId?: string | null;
}

// ── Flutterwave ──────────────────────────────────────────────────────────────
// Docs: developer.flutterwave.com. Amounts are in major units (naira), which
// this module converts at its boundary so the rest of the system keeps kobo.

const FLW_BASE = "https://api.flutterwave.com/v3";

function flwSecret(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY or FLW_SECRET_KEY is not configured");
  return key;
}

export function isFlutterwaveSignatureValid(rawBody: string, signature: string | undefined): boolean {
  const hash = process.env.FLUTTERWAVE_WEBHOOK_HASH || process.env.FLW_WEBHOOK_HASH || process.env.FLW_SECRET_HASH;
  if (!hash || !signature) return false;
  // Flutterwave sends the secret hash directly in the verif-hash request header
  if (signature === hash) return true;
  // Fallback: HMAC-SHA256 comparison if hash was passed as digest
  try {
    const expected = crypto.createHmac("sha256", hash).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  } catch {
    // ignore
  }
  return false;
}

export async function flwInitialize(params: InitPaymentInput): Promise<InitPaymentResult> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${flwSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: params.reference,
      amount: params.amountKobo / 100, // naira; Flutterwave takes major units
      currency: "NGN",
      redirect_url: params.redirectUrl,
      customer: {
        email: params.email,
        name: params.name || undefined,
        phonenumber: params.phone || undefined,
      },
      customizations: {
        title: "Black Heritage Events",
        description: "Event ticket payment",
      },
      meta: params.metadata,
    }),
  });
  const body = (await res.json()) as {
    status: string;
    message?: string;
    data?: { link: string };
  };
  if (!res.ok || body.status !== "success" || !body.data?.link) {
    throw new Error(body.message || `Flutterwave initialize failed (${res.status})`);
  }
  return {
    gateway: "flutterwave",
    authorizationUrl: body.data.link,
    accessCode: null,
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || process.env.FLW_PUBLIC_KEY || null,
  };
}

/**
 * Verify a Flutterwave transaction by reference. Server-side verification is
 * the source of truth; the redirect back to the site is never trusted.
 * The v3 /verify_by_reference endpoint does not need the transaction id.
 */
export async function flwVerify(reference: string): Promise<VerifyResult> {
  const res = await fetch(
    `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${flwSecret()}` } },
  );
  const body = (await res.json()) as {
    status: string;
    message?: string;
    data?: {
      status: string;
      amount: number; // major units
      currency?: string;
      tx_ref: string;
      created_at?: string;
      id?: number;
    };
  };
  if (!res.ok || body.status !== "success" || !body.data) {
    throw new Error(body.message || `Flutterwave verify failed (${res.status})`);
  }
  const d = body.data;
  const currency = (d.currency || "NGN").toUpperCase();
  if (currency !== "NGN") {
    throw new Error(`Unexpected currency on ${reference}: ${currency}`);
  }
  return {
    status: d.status === "successful" ? "success" : d.status === "pending" ? "pending" : "failed",
    amount: Math.round(d.amount * 100), // to kobo
    reference: d.tx_ref,
    paidAt: d.created_at,
    transactionId: d.id != null ? String(d.id) : null,
  };
}

export async function flwRefund(transactionId: number): Promise<void> {
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${flwSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const body = (await res.json()) as { status: string; message?: string };
  if (!res.ok || body.status !== "success") {
    throw new Error(body.message || `Flutterwave refund failed (${res.status})`);
  }
}

// ── Paystack (existing behavior, unchanged semantics) ────────────────────────

const PAYSTACK_BASE = "https://api.paystack.co";

function paystackSecret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

export function isPaystackSignatureValid(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function paystackInitialize(params: InitPaymentInput): Promise<InitPaymentResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
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
    gateway: "paystack",
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
  };
}

export async function paystackVerify(reference: string): Promise<VerifyResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecret()}` },
  });
  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { status: string; amount: number; reference: string; paid_at?: string };
  };
  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack verify failed (${res.status})`);
  }
  const d = body.data;
  return {
    status: (["success", "failed", "abandoned", "pending"].includes(d.status) ? d.status : "pending") as VerifyResult["status"],
    amount: d.amount,
    reference: d.reference,
    paidAt: d.paid_at,
  };
}

export async function paystackRefund(reference: string): Promise<void> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: reference }),
  });
  const body = (await res.json()) as { status: boolean; message?: string };
  if (!res.ok || !body.status) {
    throw new Error(body.message || `Paystack refund failed (${res.status})`);
  }
}

// ── Gateway-neutral facade: routes talk only to these five ───────────────────

export function initializePayment(params: InitPaymentInput): Promise<InitPaymentResult> {
  return activeGateway() === "flutterwave" ? flwInitialize(params) : paystackInitialize(params);
}

export function verifyPayment(reference: string): Promise<VerifyResult> {
  return activeGateway() === "flutterwave" ? flwVerify(reference) : paystackVerify(reference);
}

export async function refundPayment(input: { reference: string; gateway?: string | null; transactionId?: number | null }): Promise<void> {
  if ((input.gateway || activeGateway()) === "flutterwave") {
    if (!input.transactionId) {
      throw new Error("Flutterwave refunds need the gateway transaction id stored on the booking");
    }
    return flwRefund(input.transactionId);
  }
  return paystackRefund(input.reference);
}
