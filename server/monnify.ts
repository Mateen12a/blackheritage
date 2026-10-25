import crypto from "crypto";

/**
 * Monnify, used only to pay organizers (disbursements). Ticket checkout stays
 * on Paystack; withdrawals are sent from the Monnify wallet.
 *
 * Env: MONNIFY_API_KEY, MONNIFY_SECRET_KEY, MONNIFY_WALLET_ACCOUNT (the wallet
 * account number from the Disbursements page), MONNIFY_MODE=live|sandbox
 * (sandbox unless set to live).
 */

const base = () =>
  process.env.MONNIFY_MODE === "live" ? "https://api.monnify.com" : "https://sandbox.monnify.com";

export function isMonnifyConfigured(): boolean {
  return Boolean(process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY && process.env.MONNIFY_WALLET_ACCOUNT);
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`).toString("base64");
  const res = await fetch(`${base()}/api/v1/auth/login`, { method: "POST", headers: { Authorization: `Basic ${basic}` } });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body?.requestSuccessful || !body?.responseBody?.accessToken) {
    throw new Error(body?.responseMessage || `Monnify login failed (${res.status})`);
  }
  token = {
    value: body.responseBody.accessToken,
    expiresAt: Date.now() + Number(body.responseBody.expiresIn || 3000) * 1000,
  };
  return token.value;
}

async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const res = await fetch(`${base()}${path}`, {
    method: init.method || "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body?.requestSuccessful === false) {
    const err: any = new Error(body?.responseMessage || `Monnify request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body.responseBody;
}

/** The Monnify wallet's available balance, in kobo. */
export async function monnifyBalanceKobo(): Promise<number> {
  const r = await call(`/api/v2/disbursements/wallet-balance?accountNumber=${encodeURIComponent(process.env.MONNIFY_WALLET_ACCOUNT!)}`);
  return Math.round(Number(r?.availableBalance ?? r?.ledgerBalance ?? 0) * 100);
}

let banks: { list: { code: string; name: string }[]; at: number } | null = null;

const norm = (s: string) =>
  String(s || "").toLowerCase().replace(/\b(plc|limited|ltd|bank|microfinance|mfb|nigeria)\b/g, "").replace(/[^a-z0-9]/g, "");

/**
 * Monnify's code for an organizer's bank. Bank links were saved with
 * Paystack's codes; most match, but microfinance banks (Moniepoint, OPay,
 * Kuda) can differ, so an unknown code falls back to matching the name.
 */
export async function monnifyBankCode(code: string, name: string): Promise<string> {
  if (!banks || Date.now() - banks.at > 24 * 60 * 60 * 1000) {
    const list = await call("/api/v1/banks");
    banks = { list: (list || []).map((b: any) => ({ code: String(b.code), name: String(b.name) })), at: Date.now() };
  }
  if (banks.list.some((b) => b.code === code)) return code;
  const n = norm(name);
  const hit = banks.list.find((b) => norm(b.name) === n) || banks.list.find((b) => n && (norm(b.name).includes(n) || n.includes(norm(b.name))));
  if (!hit) throw new Error(`Monnify does not list the bank "${name}"`);
  return hit.code;
}

export interface MonnifyTransferResult {
  status: "success" | "processing" | "failed" | "reversed";
  raw: string;
}

const mapStatus = (s: string): MonnifyTransferResult["status"] => {
  const v = String(s || "").toUpperCase();
  if (v === "SUCCESS") return "success";
  if (v === "FAILED" || v === "EXPIRED") return "failed";
  if (v === "REVERSED") return "reversed";
  return "processing"; // PENDING, IN_PROGRESS, PENDING_AUTHORIZATION, OTP_EMAIL_DISPATCH_*
};

export async function monnifyTransfer(p: {
  amountKobo: number;
  reference: string;
  narration: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}): Promise<MonnifyTransferResult> {
  const destinationBankCode = await monnifyBankCode(p.bankCode, p.bankName);
  const r = await call("/api/v2/disbursements/single", {
    method: "POST",
    body: {
      amount: Number((p.amountKobo / 100).toFixed(2)),
      reference: p.reference,
      narration: p.narration.slice(0, 100),
      destinationBankCode,
      destinationAccountNumber: p.accountNumber,
      destinationAccountName: p.accountName,
      currency: "NGN",
      sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT,
    },
  });
  return { status: mapStatus(r?.status), raw: String(r?.status || "") };
}

export async function monnifyTransferStatus(reference: string): Promise<MonnifyTransferResult> {
  const r = await call(`/api/v2/disbursements/single/summary?reference=${encodeURIComponent(reference)}`);
  return { status: mapStatus(r?.status), raw: String(r?.status || "") };
}

/** Webhooks are signed: HMAC-SHA512 of the raw body with the secret key. */
export function isMonnifySignatureValid(rawBody: string, signature: string | undefined): boolean {
  if (!signature || !process.env.MONNIFY_SECRET_KEY) return false;
  const expected = crypto.createHmac("sha512", process.env.MONNIFY_SECRET_KEY).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
