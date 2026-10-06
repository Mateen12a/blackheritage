import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBanks, useUpdateBankAccount, BankItem } from "@/hooks/use-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Landmark, CheckCircle2, AlertCircle, Clock, ShieldCheck, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BankAccountSettings() {
  const { user } = useAuth();
  const { data: banks, isLoading: banksLoading } = useBanks();
  const updateBank = useUpdateBankAccount();
  const { toast } = useToast();

  const currentBank = user?.bankDetails;
  const isVerified = Boolean(user?.isVerified);

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedSuccess, setResolvedSuccess] = useState(false);

  useEffect(() => {
    if (currentBank) {
      setBankCode(currentBank.bankCode || "");
      setBankName(currentBank.bankName || "");
      setAccountNumber(currentBank.accountNumber || "");
      setAccountName(currentBank.accountName || "");
    }
  }, [currentBank]);

  const handleBankChange = (code: string) => {
    setBankCode(code);
    const selected = banks?.find((b) => b.code === code);
    if (selected) {
      setBankName(selected.name);
    }
    setResolvedSuccess(false);
  };

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numeric characters, up to 10 digits (Nigerian NUBAN)
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(val);
    setResolvedSuccess(false);
  };

  const resolveAccount = async () => {
    if (!bankCode) {
      toast({ title: "Select a bank", description: "Choose your settlement bank first.", variant: "destructive" });
      return;
    }
    if (accountNumber.length !== 10) {
      toast({ title: "Invalid account number", description: "Enter a valid 10-digit NUBAN account number.", variant: "destructive" });
      return;
    }

    setResolving(true);
    try {
      const res = await fetch(`/api/account/bank/resolve?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Could not resolve bank account details.");
      }
      if (data?.accountName) {
        setAccountName(data.accountName);
        setResolvedSuccess(true);
        toast({ title: "Account resolved", description: `Verified account holder: ${data.accountName}` });
      }
    } catch (err: any) {
      setResolvedSuccess(false);
      toast({
        title: "Could not resolve account name",
        description: err.message || "Please check your bank selection and account number, or type the name manually.",
        variant: "destructive",
      });
    } finally {
      setResolving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountNumber.length !== 10) {
      toast({ title: "10-digit account required", description: "Enter a valid 10-digit NUBAN account number.", variant: "destructive" });
      return;
    }
    if (!bankCode) {
      toast({ title: "Bank required", description: "Select your settlement bank.", variant: "destructive" });
      return;
    }
    if (!accountName.trim()) {
      toast({ title: "Account holder name required", description: "Enter the registered name on the account.", variant: "destructive" });
      return;
    }

    updateBank.mutate({
      accountNumber,
      bankCode,
      bankName: bankName || "Bank",
      accountName: accountName.trim(),
    });
  };

  const hasLinkedBank = Boolean(currentBank?.accountNumber && currentBank?.bankName);
  const isDirty =
    accountNumber !== (currentBank?.accountNumber || "") ||
    bankCode !== (currentBank?.bankCode || "") ||
    accountName !== (currentBank?.accountName || "");

  return (
    <Card className="border-hairline bg-surface" id="bank">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-ink flex items-center gap-2">
              <Landmark className="w-5 h-5 text-gold" />
              Settlement Bank Account
            </CardTitle>
            <CardDescription className="mt-1">
              Link your Nigerian bank account for automated ticket revenue payouts.
            </CardDescription>
          </div>
          {hasLinkedBank && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                isVerified
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              {isVerified ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Split Payouts Active
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  Verification Required
                </>
              )}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Settlement Account Overview */}
        {hasLinkedBank && (
          <div className="rounded-md border border-hairline bg-surface-2 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-ink font-semibold">Active Settlement Destination</p>
                <p className="text-base font-semibold text-ink mt-0.5">{currentBank?.bankName}</p>
                <p className="font-mono text-sm text-muted-ink">
                  •••• {currentBank?.accountNumber?.slice(-4)} &middot; {currentBank?.accountName}
                </p>
              </div>
              {currentBank?.subaccountCode && (
                <span className="text-[11px] font-mono text-muted-ink bg-background border border-hairline px-2 py-0.5 rounded">
                  {currentBank.subaccountCode}
                </span>
              )}
            </div>

            {/* Verification Status Warning / Banner */}
            {!isVerified ? (
              <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">Identity verification required before payout disbursement. </span>
                  Your bank details are saved, but payouts cannot be released until your organizer account is verified. Ticket sales remain active and funds are safely held in platform escrow.
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-300">Automated Paystack Split Active. </span>
                  Ticket revenues settle directly into this account on a T+1 schedule after each sale, with the 6% platform commission retained.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bank Details Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settlement-bank">Settlement Bank</Label>
              <Select value={bankCode} onValueChange={handleBankChange} disabled={banksLoading || updateBank.isPending}>
                <SelectTrigger id="settlement-bank" className="border-hairline bg-background text-ink">
                  <SelectValue placeholder={banksLoading ? "Loading Nigerian banks…" : "Select your bank"} />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-surface border-hairline text-ink">
                  {(banks || []).map((b: BankItem) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-number">10-Digit NUBAN Account Number</Label>
              <div className="flex gap-2">
                <Input
                  id="account-number"
                  value={accountNumber}
                  onChange={handleAccountNumberChange}
                  placeholder="0123456789"
                  maxLength={10}
                  className="font-mono border-hairline bg-background text-ink"
                  disabled={updateBank.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resolveAccount}
                  disabled={resolving || accountNumber.length !== 10 || !bankCode}
                  className="border-hairline shrink-0 px-3 text-xs"
                >
                  {resolving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Verify
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="account-name">Account Holder Name</Label>
              {resolvedSuccess && (
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Bank verified
                </span>
              )}
            </div>
            <Input
              id="account-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Tunde Balogun or Company Limited"
              className="border-hairline bg-background text-ink"
              disabled={updateBank.isPending}
            />
            <p className="text-xs text-muted-ink">
              Must match the name on your corporate or individual bank account registered with the bank.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-ink">
              Powered by Paystack split settlement &middot; T+1 deposit schedule
            </p>
            <Button
              type="submit"
              disabled={updateBank.isPending || accountNumber.length !== 10 || !bankCode || !accountName.trim() || (!isDirty && hasLinkedBank)}
              className="bg-primary text-primary-foreground hover:bg-gold-soft press"
            >
              {updateBank.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {hasLinkedBank ? "Update Settlement Account" : "Link Settlement Account"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
