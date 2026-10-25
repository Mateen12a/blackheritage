import mongoose from "mongoose";
import { PayoutModel, PlatformSettingModel, User, WithdrawalModel } from "./models";
import {
  createTransferRecipient,
  getBalanceKobo,
  initiateTransfer,
  transferFeeKobo,
  verifyTransfer,
} from "./paystack";

/**
 * Organizer wallet: instant payouts.
 *
 * With instant payouts on, ticket money collects in the platform's Paystack
 * balance and each sale adds an 'organizer_payout' row to the ledger. The
 * organizer's available balance is the sum of their 'due' rows. A withdrawal
 * claims those rows ('processing'), sends one Paystack transfer, and settles
 * them when Paystack confirms. A failed or reversed transfer puts the rows
 * back to 'due', so money can never vanish between the ledger and the bank.
 */

/**
 * When Paystack has settled a sale into the balance: the next weekday after
 * the sale (Lagos time), from midday. Paystack does not settle at weekends,
 * so a Friday sale becomes withdrawable on Monday. Withdrawals only ever
 * draw on settled money, so they never fail for want of balance.
 */
export function settledAt(saleAt: Date): Date {
  const LAGOS_MS = 60 * 60 * 1000; // UTC+1, no daylight saving
  const local = new Date(new Date(saleAt).getTime() + LAGOS_MS);
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 12, 0, 0));
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return new Date(d.getTime() - LAGOS_MS);
}

async function dueRows(organizerId: string) {
  const rows = await PayoutModel.find({ organizerId: String(organizerId), kind: "organizer_payout", status: "due" })
    .select("amount createdAt")
    .lean();
  const settings: any = await PlatformSettingModel.findOne({ key: "platform" }).lean();
  // Same-day on: nothing waits for settlement; the balance check in
  // withdraw() is what keeps a payout from going out unfunded.
  const now = settings?.sameDayWithdrawals ? Infinity : Date.now();
  const ready = (rows as any[]).filter((r) => settledAt(r.createdAt).getTime() <= now);
  const settling = (rows as any[]).filter((r) => settledAt(r.createdAt).getTime() > now);
  const sum = (xs: any[]) => xs.reduce((n, r) => n + Number(r.amount || 0), 0);
  const nextAt = settling.length
    ? new Date(Math.min(...settling.map((r) => settledAt(r.createdAt).getTime())))
    : null;
  return { ready, readyKobo: sum(ready), settlingKobo: sum(settling), nextAt };
}

/** Smallest amount worth a transfer: ₦100 must land after the fee. */
const MIN_NET_KOBO = 10000;

export async function instantPayoutsOn(): Promise<boolean> {
  const settings = await PlatformSettingModel.findOne({ key: "platform" }).lean();
  return Boolean((settings as any)?.instantPayouts);
}

export class WalletError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Apply Paystack's final word on a transfer. Idempotent: webhooks retry and
 * the reconcile pass may race them, so only a 'processing' withdrawal moves.
 */
export async function applyTransferOutcome(
  reference: string,
  outcome: "success" | "failed" | "reversed",
  reason?: string,
): Promise<void> {
  const w: any = await WithdrawalModel.findOneAndUpdate(
    { reference, status: "processing" },
    { $set: { status: outcome, failureReason: outcome === "success" ? null : reason || null, completedAt: new Date() } },
    { new: true },
  );
  if (!w) return;
  if (outcome === "success") {
    await PayoutModel.updateMany(
      { withdrawalId: w._id, status: "processing" },
      { $set: { status: "settled", note: `Withdrawn to bank · ${reference}` } },
    );
  } else {
    await PayoutModel.updateMany(
      { withdrawalId: w._id, status: "processing" },
      { $set: { status: "due", withdrawalId: null, note: `Returned to wallet: transfer ${outcome}` } },
    );
  }
}

/**
 * Ask Paystack about withdrawals still marked processing. Covers a webhook
 * that never arrived (local development, or a dropped delivery).
 */
export async function reconcileWithdrawals(organizerId: string): Promise<void> {
  const stale = await WithdrawalModel.find({
    organizerId,
    status: "processing",
    createdAt: { $lt: new Date(Date.now() - 20 * 1000) },
  }).lean();
  for (const w of stale as any[]) {
    try {
      const t = await verifyTransfer(w.reference);
      if (t.status === "success") await applyTransferOutcome(w.reference, "success");
      else if (t.status === "failed" || t.status === "reversed" || t.status === "abandoned") {
        await applyTransferOutcome(w.reference, t.status === "reversed" ? "reversed" : "failed", t.reason);
      }
    } catch (err: any) {
      // Not found means the transfer never reached Paystack: give the money back.
      if (/not found/i.test(String(err?.message)) && Date.now() - new Date(w.createdAt).getTime() > 10 * 60 * 1000) {
        await applyTransferOutcome(w.reference, "failed", "Transfer was not created");
      }
    }
  }
}

export async function walletSummary(organizerId: string) {
  await reconcileWithdrawals(organizerId).catch(() => {});
  const rows = await PayoutModel.aggregate([
    { $match: { organizerId: String(organizerId), kind: "organizer_payout" } },
    { $group: { _id: "$status", total: { $sum: "$amount" } } },
  ]);
  const by = (s: string) => rows.find((r: any) => r._id === s)?.total || 0;
  const due = await dueRows(organizerId);
  const recent = await WithdrawalModel.find({ organizerId: String(organizerId) })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();
  const available = due.readyKobo;
  return {
    availableKobo: available,
    settlingKobo: due.settlingKobo,
    settlesAt: due.nextAt,
    processingKobo: by("processing"),
    heldKobo: by("pending_verification"),
    paidKobo: by("settled"),
    // What a full withdrawal would land, so the button can say it up front.
    withdrawFeeKobo: available > 0 ? transferFeeKobo(available) : 0,
    withdrawals: (recent as any[]).map((w) => ({
      id: String(w._id),
      amountKobo: w.amountKobo,
      feeKobo: w.feeKobo,
      netKobo: w.netKobo,
      status: w.status,
      failureReason: w.failureReason || null,
      bank: w.bank,
      createdAt: w.createdAt,
      completedAt: w.completedAt,
    })),
  };
}

/**
 * Withdraw the organizer's whole available balance to their linked bank.
 */
export async function withdraw(organizerId: string, requestedBy: string) {
  if (!(await instantPayoutsOn())) {
    throw new WalletError(400, "Instant withdrawals are not switched on yet. Use Request payout instead.");
  }
  const organizer: any = await User.findById(organizerId);
  if (!organizer) throw new WalletError(404, "We could not find your account.");
  if (!organizer.isVerified) {
    throw new WalletError(400, "Verify your identity in Settings first. Withdrawals are open to verified organizers only.");
  }
  const bank = organizer.bankDetails || {};
  if (!bank.accountNumber || !bank.bankCode) {
    throw new WalletError(400, "Link your bank account in Settings first.");
  }

  // Older bank links predate transfer recipients: create one on the spot.
  let recipientCode: string | null = bank.recipientCode || null;
  if (!recipientCode) {
    try {
      const r = await createTransferRecipient({
        name: bank.accountName || organizer.displayName || organizer.username,
        accountNumber: bank.accountNumber,
        bankCode: bank.bankCode,
      });
      recipientCode = r.recipientCode;
      await User.updateOne({ _id: organizer._id }, { $set: { "bankDetails.recipientCode": recipientCode } });
    } catch (err: any) {
      throw new WalletError(409, "We could not set up transfers to your bank. Re-save your bank account in Settings and try again.");
    }
  }

  // Claim every available row in one step. Two taps at once each claim a
  // disjoint set (or nothing), so the same naira can never leave twice.
  const withdrawalId = new mongoose.Types.ObjectId();
  const { ready, settlingKobo } = await dueRows(organizerId);
  if (ready.length === 0 && settlingKobo > 0) {
    throw new WalletError(400, "Today's sales are still settling. They become available to withdraw from the next working day.");
  }
  await PayoutModel.updateMany(
    { _id: { $in: ready.map((r: any) => r._id) }, status: "due" },
    { $set: { status: "processing", withdrawalId } },
  );
  const claimed = await PayoutModel.find({ withdrawalId, status: "processing" }).select("amount").lean();
  const amountKobo = claimed.reduce((n: number, r: any) => n + Number(r.amount || 0), 0);
  const release = async (note: string) => {
    await PayoutModel.updateMany(
      { withdrawalId, status: "processing" },
      { $set: { status: "due", withdrawalId: null, note } },
    );
  };

  if (amountKobo <= 0) throw new WalletError(400, "Nothing is available to withdraw yet.");
  const feeKobo = transferFeeKobo(amountKobo);
  const netKobo = amountKobo - feeKobo;
  if (netKobo < MIN_NET_KOBO) {
    await release("Below the withdrawal minimum");
    throw new WalletError(400, "The minimum withdrawal is ₦100 after the transfer fee.");
  }

  // The platform can only send what Paystack holds. Short balance means
  // recent sales have not settled into it yet: say so, keep the money safe.
  let balance = 0;
  try {
    balance = await getBalanceKobo();
  } catch {
    await release("Balance check failed");
    throw new WalletError(409, "Withdrawals are briefly unavailable. Your balance is safe; try again in a few minutes.");
  }
  if (balance < netKobo) {
    await release("Platform balance settling");
    notifyTeam(
      `Withdrawal blocked: Paystack balance ₦${(balance / 100).toLocaleString("en-NG")} is below ₦${(netKobo / 100).toLocaleString("en-NG")} requested by ${organizer.displayName || organizer.username}. Top up the Paystack balance.`,
    );
    throw new WalletError(409, "Your money is safe, but today's sales are still settling. Try again in a few hours; we've been notified.");
  }

  const reference = `bhwd_${String(withdrawalId)}`;
  await WithdrawalModel.create({
    _id: withdrawalId,
    organizerId: String(organizerId),
    amountKobo,
    feeKobo,
    netKobo,
    reference,
    status: "processing",
    bank: { bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName },
    requestedBy,
  });

  try {
    const t = await initiateTransfer({
      amountKobo: netKobo,
      recipientCode,
      reason: `Black Heritage payout · ${organizer.displayName || organizer.username}`,
      reference,
    });
    await WithdrawalModel.updateOne({ _id: withdrawalId }, { $set: { transferCode: t.transferCode } });
    if (t.status === "success") {
      await applyTransferOutcome(reference, "success");
    } else if (t.status === "otp") {
      // Transfer OTP on: Paystack holds the transfer until someone approves it
      // with the OTP in the dashboard. That is manual approval. The rows stay
      // 'processing' (never handed back, or an approval later would pay
      // twice) and the transfer.success webhook settles them.
      notifyTeam(
        `Approve a withdrawal: ₦${(netKobo / 100).toLocaleString("en-NG")} to ${organizer.displayName || organizer.username} (${bank.bankName} ${bank.accountNumber}). Paystack → Transfers → finalize with the OTP. To make withdrawals instant, turn off transfer OTP in Paystack → Settings → Preferences.`,
      );
    }
  } catch (err: any) {
    if (err instanceof WalletError) throw err;
    const reason = String(err?.message || "Transfer failed").slice(0, 200);
    // Before handing the money back, ask Paystack whether the transfer
    // exists after all (a timeout can hide an accepted transfer). Only a
    // transfer Paystack has no record of, or one it failed, is returned.
    let exists = false;
    try {
      const t = await verifyTransfer(reference);
      exists = !["failed", "reversed", "abandoned"].includes(t.status);
      if (t.status === "success") await applyTransferOutcome(reference, "success");
    } catch { /* not found: it never started */ }
    if (exists) {
      return WithdrawalModel.findById(withdrawalId).lean();
    }
    await applyTransferOutcome(reference, "failed", reason);
    notifyTeam(`Withdrawal transfer failed for ${organizer.displayName || organizer.username}: ${reason}`);
    throw new WalletError(409, "The transfer did not go through. Your balance is back in your wallet, and our team has been told why.");
  }

  return WithdrawalModel.findById(withdrawalId).lean();
}

function notifyTeam(message: string) {
  void (async () => {
    try {
      const admins = await User.find({ role: "admin" }, { email: 1 }).lean();
      const to = Array.from(new Set([process.env.PAYOUT_NOTIFY_EMAIL, ...admins.map((a: any) => a.email)].filter(Boolean))) as string[];
      if (!to.length) return console.warn("[wallet]", message);
      const { sendTeamNoticeEmail } = await import("./emails");
      await sendTeamNoticeEmail(to, "Payout needs attention", [message]);
    } catch (err: any) {
      console.warn("[wallet] team notice failed:", err?.message, "|", message);
    }
  })();
}
