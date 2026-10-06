import crypto from "crypto";
import mongoose from "mongoose";

const PAYSTACK_BASE = "https://api.paystack.co";

export function isTestMode(): boolean {
  // Production safeguard: If NODE_ENV is production, live keys are strictly mandatory.
  if (process.env.NODE_ENV === "production") return false;
  // If explicitly requested live mode via PAYSTACK_MODE or PAYSTACK_FORCE_LIVE:
  if (process.env.PAYSTACK_MODE === "live" || process.env.PAYSTACK_FORCE_LIVE === "true") return false;
  // If MongoDB URI is set and points to production (no _dev or _verify), strictly force live keys:
  const mongo = process.env.MONGODB_URI || "";
  if (mongo && !mongo.includes("_dev") && !mongo.includes("_verify")) return false;
  // If Mongoose is connected to a live database name (no _dev or _verify):
  try {
    const dbName = mongoose?.connection?.name || "";
    if (dbName && !dbName.endsWith("_dev") && !dbName.endsWith("_verify")) {
      return false;
    }
  } catch {
    // ignore
  }

  if (process.env.PAYSTACK_MODE === "test") return true;
  return Boolean(process.env.PAYSTACK_TEST_SECRET_KEY);
}

export function secretKey(): string {
  const useTest = isTestMode();
  if (!useTest) {
    const liveKey = process.env.PAYSTACK_SECRET_KEY;
    if (liveKey) return liveKey;
    if (process.env.PAYSTACK_TEST_SECRET_KEY) {
      console.warn("[paystack] WARNING: Operating in live mode but PAYSTACK_SECRET_KEY is missing; falling back to PAYSTACK_TEST_SECRET_KEY.");
      return process.env.PAYSTACK_TEST_SECRET_KEY;
    }
    throw new Error("PAYSTACK_SECRET_KEY is not configured for live production mode");
  }
  const testKey = process.env.PAYSTACK_TEST_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;
  if (!testKey) {
    throw new Error("Paystack secret key is not configured");
  }
  return testKey;
}

export function publicKey(): string | null {
  const useTest = isTestMode();
  if (!useTest) {
    return process.env.PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_TEST_PUBLIC_KEY || null;
  }
  return process.env.PAYSTACK_TEST_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || null;
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
  const activeKey = secretKey();
  const testKey = process.env.PAYSTACK_TEST_SECRET_KEY;
  const liveKey = process.env.PAYSTACK_SECRET_KEY;

  const keysToTry = Array.from(new Set([activeKey, testKey, liveKey].filter(Boolean))) as string[];
  for (const key of keysToTry) {
    try {
      const hash = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
      const a = Buffer.from(hash, "utf8");
      const b = Buffer.from(signature, "utf8");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Dev-mode toggle: when Paystack keys are absent the booking flow uses a
 * simulated gateway. Production (keys present) always goes through Paystack.
 */
export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY);
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
 * Update an existing subaccount on Paystack.
 */
export async function updateSubaccount(
  subaccountCode: string,
  params: {
    businessName?: string;
    settlementBank?: string;
    accountNumber?: string;
    percentageCharge?: number;
    description?: string;
  },
): Promise<{ subaccountCode: string; id: number }> {
  const payload: Record<string, any> = {};
  if (params.businessName) payload.business_name = params.businessName;
  if (params.settlementBank) payload.settlement_bank = params.settlementBank;
  if (params.accountNumber) payload.account_number = params.accountNumber;
  if (params.percentageCharge !== undefined) payload.percentage_charge = params.percentageCharge;
  if (params.description) payload.description = params.description;

  const res = await fetch(`${PAYSTACK_BASE}/subaccount/${encodeURIComponent(subaccountCode)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { subaccount_code: string; id: number };
  };

  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Paystack subaccount update failed (${res.status})`);
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

/**
 * Resolve a Nigerian NUBAN account number against a bank code via Paystack.
 * Used for live verification before linking settlement bank accounts.
 */
export async function resolveAccountNumber(params: {
  accountNumber: string;
  bankCode: string;
}): Promise<{ accountNumber: string; accountName: string }> {
  const res = await fetch(
    `${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
      },
    },
  );

  const body = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { account_number: string; account_name: string };
  };

  if (!res.ok || !body.status || !body.data) {
    throw new Error(body.message || `Could not resolve bank account (${res.status})`);
  }

  return {
    accountNumber: body.data.account_number,
    accountName: body.data.account_name,
  };
}
