import crypto from "crypto";
import {
  initializeTransaction,
  verifyTransaction,
  refundTransaction,
  verifyWebhookSignature,
  isPaystackConfigured,
  createSubaccount,
  initiateTransfer,
  createTransferRecipient,
  PaystackInitResult,
  PaystackVerification,
} from "./paystack";

// ── Gateway selection ────────────────────────────────────────────────────────
// Paystack is the primary gateway. When keys are absent (local dev, test mode
// without keys), the system falls back to the simulated gateway.

export type GatewayName = "paystack" | "simulated";

export function activeGateway(): GatewayName {
  if (isPaystackConfigured()) return "paystack";
  return "simulated";
}

export { isPaystackConfigured };

// ── Shared payment shapes ────────────────────────────────────────────────────

export interface InitPaymentInput {
  email: string;
  amountKobo: number;
  reference: string;
  name?: string;
  phone?: string;
  redirectUrl?: string;
  metadata: Record<string, unknown>;
  subaccountCode?: string;
  splitCode?: string;
}

export interface InitPaymentResult {
  gateway: GatewayName;
  authorizationUrl: string;
  accessCode: string | null;
  publicKey: string | null;
  reference: string;
}

export interface VerifyResult {
  status: "success" | "failed" | "abandoned" | "pending";
  amount: number; // kobo, always
  reference: string;
  currency?: string;
  paidAt?: string;
  transactionId?: string | null;
}

// ── Paystack Implementation ──────────────────────────────────────────────────

export function isPaystackSignatureValid(rawBody: string, signature: string | undefined): boolean {
  return verifyWebhookSignature(rawBody, signature);
}

export async function paystackInitialize(params: InitPaymentInput): Promise<InitPaymentResult> {
  const result = await initializeTransaction({
    email: params.email,
    amountKobo: params.amountKobo,
    reference: params.reference,
    metadata: params.metadata,
    subaccount: params.subaccountCode,
  });

  return {
    gateway: "paystack",
    authorizationUrl: result.authorizationUrl,
    accessCode: result.accessCode,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    reference: result.reference,
  };
}

export async function paystackVerify(reference: string): Promise<VerifyResult> {
  const v = await verifyTransaction(reference);
  return {
    status: v.status,
    amount: v.amount,
    reference: v.reference,
    currency: v.currency,
    paidAt: v.paidAt,
    transactionId: null,
  };
}

export async function paystackRefund(reference: string, amountKobo?: number): Promise<void> {
  return refundTransaction(reference, amountKobo);
}

// ── Gateway-neutral facade ───────────────────────────────────────────────────

export function initializePayment(params: InitPaymentInput): Promise<InitPaymentResult> {
  return paystackInitialize(params);
}

export function verifyPayment(reference: string): Promise<VerifyResult> {
  return paystackVerify(reference);
}

export async function refundPayment(input: {
  reference: string;
  gateway?: string | null;
  amountKobo?: number;
}): Promise<void> {
  return paystackRefund(input.reference, input.amountKobo);
}

// ── Payout Utilities ─────────────────────────────────────────────────────────
export { createSubaccount, initiateTransfer, createTransferRecipient };
