import crypto from "crypto";
import { User as UserModel } from "./models";

/**
 * Referral program plumbing. Every account gets a code at signup; links are
 * /r/<code>. The code only survives until registration completes: the new
 * user stores the inviter's id, so code renames never break attribution.
 */

/** Unambiguous alphabet, 8 chars: no 0/O or 1/I confusion when read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Ensure every user has a referral code. Self-healing: called from the seed
 * on boot so accounts created before the program existed get codes too.
 */
export async function ensureReferralCodes(): Promise<void> {
  const missing = await UserModel.find({ referralCode: { $exists: false } })
    .limit(1000)
    .select("_id")
    .lean();
  for (const u of missing) {
    let code = generateReferralCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await UserModel.updateOne({ _id: u._id }, { $set: { referralCode: code } });
        break;
      } catch {
        // 11000: code collision, roll a fresh one
        code = generateReferralCode();
      }
    }
  }
}

export async function findUserIdByCode(code: string): Promise<string | null> {
  const u = await UserModel.findOne({ referralCode: code.toUpperCase().trim() })
    .select("_id")
    .lean();
  return u ? String(u._id) : null;
}
