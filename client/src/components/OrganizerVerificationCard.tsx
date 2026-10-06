import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubmitVerification, VerificationInput } from "@/hooks/use-account";
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
import { Loader2, ShieldCheck, BadgeCheck, Clock, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function OrganizerVerificationCard() {
  const { user } = useAuth();
  const submitVerification = useSubmitVerification();
  const { toast } = useToast();

  const isVerified = Boolean(user?.isVerified);
  const status = user?.verificationStatus || (isVerified ? "verified" : "unverified");
  const details = user?.verificationDetails;

  const [businessName, setBusinessName] = useState(details?.businessName || user?.displayName || "");
  const [cacNumber, setCacNumber] = useState(details?.cacNumber || "");
  const [idType, setIdType] = useState(details?.idType || "NIN");
  const [idNumber, setIdNumber] = useState(details?.idNumber || "");
  const [bvnLast4, setBvnLast4] = useState(details?.bvnLast4 || "");
  const [phone, setPhone] = useState(details?.phone || user?.phone || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim()) {
      toast({ title: "Name required", description: "Provide your registered business or legal name.", variant: "destructive" });
      return;
    }
    if (!phone.trim()) {
      toast({ title: "Phone number required", description: "Provide a Nigerian contact phone number.", variant: "destructive" });
      return;
    }
    if (!cacNumber.trim() && !idNumber.trim() && !bvnLast4.trim()) {
      toast({
        title: "Credential required",
        description: "Provide at least one verification credential (CAC number, National ID/NIN, or last 4 digits of BVN).",
        variant: "destructive",
      });
      return;
    }

    const payload: VerificationInput = {
      businessName: businessName.trim(),
      phone: phone.trim(),
      cacNumber: cacNumber.trim() || undefined,
      idType,
      idNumber: idNumber.trim() || undefined,
      bvnLast4: bvnLast4.trim() || undefined,
    };

    submitVerification.mutate(payload);
  };

  return (
    <Card className="border-hairline bg-surface" id="verification">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-ink flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-gold" />
              Organizer Identity & Verification
            </CardTitle>
            <CardDescription className="mt-1">
              Nigerian regulatory compliance requires identity verification before ticket payouts can be released.
            </CardDescription>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
              isVerified
                ? "text-gold bg-gold/10 border-gold/30"
                : status === "pending"
                ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-muted-ink bg-surface-2 border-hairline"
            }`}
          >
            {isVerified ? (
              <>
                <BadgeCheck className="w-3.5 h-3.5 text-gold" />
                Verified Organizer
              </>
            ) : status === "pending" ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Under Review
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-muted-ink" />
                Unverified
              </>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* State 1: Verified */}
        {isVerified && (
          <div className="rounded-md border border-gold/30 bg-gold/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <BadgeCheck className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink text-sm">Account Verified</p>
                <p className="text-xs text-muted-ink mt-0.5">
                  Your identity has been verified. All ticket sales split automatically into your linked Paystack settlement account on a T+1 schedule.
                </p>
                {details?.businessName && (
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-ink font-mono flex-wrap">
                    <span className="text-ink font-semibold">{details.businessName}</span>
                    {details.cacNumber && (
                      <>
                        <span>&middot;</span>
                        <span>RC: {details.cacNumber}</span>
                      </>
                    )}
                    {details.phone && (
                      <>
                        <span>&middot;</span>
                        <span>{details.phone}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* State 2: Pending Review */}
        {!isVerified && status === "pending" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300 text-sm">Verification Submitted & Under Review</p>
                <p className="text-xs text-amber-200/90 mt-1">
                  We received your verification submission for <strong>{details?.businessName || businessName}</strong>. Our compliance team verifies details within 24 hours.
                </p>
                <p className="text-xs text-amber-200/80 mt-2">
                  <strong>Escrow Protection:</strong> Attendees can continue purchasing tickets for your events without interruption. All revenues are safely held in platform escrow and will disburse to your bank account upon verification.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* State 3: Unverified Notice & Verification Form */}
        {!isVerified && status !== "pending" && (
          <>
            <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">Verification is required before payout release. </span>
                To prevent fraud and comply with Nigerian financial regulations, organizers must submit proof of identity or business registration before funds can be transferred. Ticket sales will proceed normally while revenue is secured in escrow.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="business-name">Business / Legal Name</Label>
                  <Input
                    id="business-name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Mainland Entertainment Ltd"
                    className="border-hairline bg-background text-ink"
                    required
                  />
                  <p className="text-[11px] text-muted-ink">
                    Name registered with CAC or matching your bank account.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cac-number">CAC RC / Business Number (Optional)</Label>
                  <Input
                    id="cac-number"
                    value={cacNumber}
                    onChange={(e) => setCacNumber(e.target.value)}
                    placeholder="e.g. RC-1849204 or BN-3948291"
                    className="font-mono border-hairline bg-background text-ink"
                  />
                  <p className="text-[11px] text-muted-ink">
                    For registered companies and business enterprises.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="id-type">Identity Document Type</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger id="id-type" className="border-hairline bg-background text-ink">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-hairline text-ink">
                      <SelectItem value="NIN">National Identity Number (NIN)</SelectItem>
                      <SelectItem value="BVN">BVN (Last 4 Digits Only)</SelectItem>
                      <SelectItem value="DRIVERS_LICENSE">Driver's License</SelectItem>
                      <SelectItem value="VOTERS_CARD">Voter's Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {idType === "BVN" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="bvn-last4">BVN (Last 4 Digits)</Label>
                    <Input
                      id="bvn-last4"
                      value={bvnLast4}
                      onChange={(e) => setBvnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="•••• 4821"
                      maxLength={4}
                      className="font-mono border-hairline bg-background text-ink"
                    />
                    <p className="text-[11px] text-muted-ink">We never ask for your full BVN.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="id-number">ID / Document Number</Label>
                    <Input
                      id="id-number"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="11-digit NIN or Document No."
                      className="font-mono border-hairline bg-background text-ink"
                    />
                    <p className="text-[11px] text-muted-ink">Government-issued document number.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="contact-phone">Contact Phone Number</Label>
                  <Input
                    id="contact-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08012345678"
                    className="font-mono border-hairline bg-background text-ink"
                    required
                  />
                  <p className="text-[11px] text-muted-ink">Direct phone line for verification SMS.</p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-muted-ink">
                  Data is processed strictly for compliance under NDPR and Nigerian banking standards.
                </p>
                <Button
                  type="submit"
                  disabled={submitVerification.isPending || !businessName.trim() || !phone.trim()}
                  className="bg-primary text-primary-foreground hover:bg-gold-soft press"
                >
                  {submitVerification.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit for Verification
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
