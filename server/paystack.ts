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
  currency?: string;
  gatewayResponse?: string;
}

/**
 * Initialize a Paystack transaction with a SERVER-computed amount.
 * The client never sends money figures; it only receives the payment URL.
 * Optionally supports subaccount split payments.
 */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata: Record<string, unknown>;
  subaccount?: string;
  transactionChargeKobo?: number;
}): Promise<PaystackInitResult> {
  const payload: Record<string, any> = {
    email: params.email,
    amount: params.amountKobo,
    reference: params.reference,
    currency: "NGN",
    metadata: params.metadata,
  };

  // If organizer has a Paystack subaccount configured, direct split to them
  if (params.subaccount) {
    payload.subaccount = params.subaccount;
    if (params.transactionChargeKobo !== undefined) {
      payload.transaction_charge = params.transactionChargeKobo;
    }
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
    data?: {
      status: string;
      amount: number;
      reference: string;
      paid_at?: string;
      currency?: string;
      gateway_response?: string;
    };
  };

  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack verify failed (${res.status})`);
  }

  const raw = body.data.status;
  const status: PaystackVerification["status"] =
    raw === "success"
      ? "success"
      : raw === "failed"
      ? "failed"
      : raw === "abandoned"
      ? "abandoned"
      : "pending";

  return {
    status,
    amount: body.data.amount,
    reference: body.data.reference,
    paidAt: body.data.paid_at,
    currency: body.data.currency,
    gatewayResponse: body.data.gateway_response,
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
    const a = Buffer.from(hash, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
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

// ── Payout Mechanisms (Subaccounts with Split or Collect & Transfer) ─────────

/**
 * Create a subaccount for an organizer on Paystack.
 * Enables automated split payments on ticket purchase: platform fee stays in
 * platform account, remaining amount settles directly into organizer's bank.
 */
export async function createSubaccount(params: {
  businessName: string;
  settlementBank: string; // Bank code (e.g. "058" for GTBank)
  accountNumber: string;
  percentageCharge: number; // Platform fee percentage (e.g. 6.0)
  description?: string;
}): Promise<{ subaccountCode: string; id: number }> {
  const res = await fetch(`${PAYSTACK_BASE}/subaccount`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: params.businessName,
      settlement_bank: params.settlementBank,
      account_number: params.accountNumber,
      percentage_charge: params.percentageCharge,
      description: params.description || `Subaccount for ${params.businessName}`,
    }),
  });

  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { subaccount_code: string; id: number };
  };

  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack subaccount creation failed (${res.status})`);
  }

  return {
    subaccountCode: body.data.subaccount_code,
    id: body.data.id,
  };
}

/**
 * Create a transfer recipient for direct payout transfers.
 */
export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<{ recipientCode: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });

  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { recipient_code: string };
  };

  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack recipient creation failed (${res.status})`);
  }

  return { recipientCode: body.data.recipient_code };
}

/**
 * Initiate an outbound transfer to an organizer's transfer recipient.
 */
export async function initiateTransfer(params: {
  amountKobo: number;
  recipientCode: string;
  reason: string;
  reference?: string;
}): Promise<{ transferCode: string; status: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reason: params.reason,
      reference: params.reference,
    }),
  });

  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { transfer_code: string; status: string };
  };

  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack transfer failed (${res.status})`);
  }

  return {
    transferCode: body.data.transfer_code,
    status: body.data.status,
  };
}
