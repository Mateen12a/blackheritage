import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Event, PartnerPackage, PartnerSettings, PartnerType } from "@shared/schema";
import { useMemo, useState } from "react";
import { Loader2, ArrowLeft, CheckCircle2, Building2, Store, Mic2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface BusinessModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

type Step = "type" | "package" | "details" | "done";

export { PARTNER_COPY, partnerSettingsOf } from "@/lib/partner";
import { PARTNER_COPY, partnerSettingsOf } from "@/lib/partner";

const priceLabel = (pk: PartnerPackage) =>
  typeof pk.priceKobo === "number" && pk.priceKobo > 0 ? `₦${(pk.priceKobo / 100).toLocaleString("en-NG")}` : "Price on request";

export function BusinessModal({ event, isOpen, onClose }: BusinessModalProps) {
  const { toast } = useToast();
  const settings = useMemo(() => partnerSettingsOf(event), [event]);
  const onlyType = settings.types.length === 1 ? settings.types[0] : null;
  const firstStep = (t: PartnerType | null): Step =>
    !t ? "type" : settings.packages.some((p) => p.type === t) ? "package" : "details";

  const [type, setType] = useState<PartnerType | null>(onlyType);
  const [step, setStep] = useState<Step>(firstStep(onlyType));
  const [selectedPackage, setSelectedPackage] = useState<PartnerPackage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ businessName: "", contactPerson: "", phoneNumber: "", email: "", description: "" });

  const packages = settings.packages.filter((p) => p.type === type);
  const copy = type ? PARTNER_COPY[type] : null;

  const chooseType = (t: PartnerType) => {
    setType(t);
    setSelectedPackage(null);
    setStep(firstStep(t));
  };

  const back = () => {
    if (step === "details" && packages.length > 0) setStep("package");
    else if (!onlyType) setStep("type");
  };
  const canGoBack = (step === "package" && !onlyType) || (step === "details" && (packages.length > 0 || !onlyType));

  // Applications go to the organizer, not to a generic inbox: the row is
  // stored against their event and they get an email with the details. The
  // server prices it from the organizer's own package list.
  const submitApplication = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${event.id}/business-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, packageName: selectedPackage?.name || "", ...formData }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not send the application. Try again.");
      }
      setStep("done");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Application not sent", description: err?.message || "Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setType(onlyType);
    setStep(firstStep(onlyType));
    setSelectedPackage(null);
    setFormData({ businessName: "", contactPerson: "", phoneNumber: "", email: "", description: "" });
    onClose();
  };

  const title =
    step === "type" ? "Work with this event"
      : step === "package" ? `Choose a ${copy?.label.toLowerCase()} option`
        : step === "details" ? "Your details"
          : "Application sent";

  const inputCls = "h-12 bg-surface-2 border-hairline text-ink focus-visible:border-gold focus-visible:ring-0 rounded-md";

  return (
    <Dialog open={isOpen} onOpenChange={reset}>
      <DialogContent className="bg-surface border-hairline text-ink w-[95vw] sm:max-w-lg p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-2">
                {canGoBack && (
                  <button onClick={back} aria-label="Back" className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <DialogTitle className="text-xl sm:text-2xl font-display font-bold text-ink">{title}</DialogTitle>
              </div>
              {step !== "done" && (
                <DialogDescription className="text-xs text-muted-ink mt-1">
                  {event.title}. The organizer reviews every application and replies directly.
                </DialogDescription>
              )}
            </DialogHeader>

            {step === "type" && (
              <div className="grid grid-cols-1 gap-3">
                {settings.types.map((t) => {
                  const c = PARTNER_COPY[t];
                  const Icon = c.icon;
                  return (
                    <button
                      key={t}
                      onClick={() => chooseType(t)}
                      className="press flex items-center gap-4 p-4 bg-surface-2/50 border border-hairline rounded-md hover:border-gold/50 hover:bg-surface-2 transition-colors text-left"
                    >
                      <span className="w-11 h-11 shrink-0 rounded-md bg-surface-2 border border-hairline flex items-center justify-center text-gold">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span>
                        <span className="block text-base font-display font-bold text-ink">{c.label}</span>
                        <span className="block text-xs text-muted-ink">{c.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === "package" && (
              <div className="space-y-3">
                {packages.map((pk) => (
                  <button
                    key={pk.name}
                    onClick={() => { setSelectedPackage(pk); setStep("details"); }}
                    className="press w-full p-4 bg-surface-2/50 border border-hairline rounded-md hover:border-gold/50 hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-base font-display font-bold text-ink">{pk.name}</span>
                      <span className="font-display text-gold font-bold shrink-0">{priceLabel(pk)}</span>
                    </span>
                    {pk.details && <span className="mt-1.5 block text-xs text-muted-ink leading-relaxed">{pk.details}</span>}
                  </button>
                ))}
              </div>
            )}

            {step === "details" && copy && (
              <div className="space-y-4">
                {selectedPackage && (
                  <p className="text-xs text-muted-ink rounded-md border border-hairline bg-surface-2/60 px-3 py-2">
                    <span className="text-ink font-medium">{selectedPackage.name}</span> · {priceLabel(selectedPackage)}
                  </p>
                )}
                <div className="space-y-2">
                  <label className="eyebrow">{copy.nameLabel}</label>
                  <Input placeholder={copy.namePlaceholder} value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="eyebrow">Contact person</label>
                    <Input placeholder="Full name" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className="eyebrow">Phone / WhatsApp</label>
                    <Input inputMode="tel" placeholder="080..." value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="eyebrow">Email (optional)</label>
                  <Input type="email" placeholder="email@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className="eyebrow">{copy.aboutLabel}</label>
                  <Textarea placeholder="A few lines is enough" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-surface-2 border-hairline text-ink focus-visible:border-gold focus-visible:ring-0 resize-none h-24 rounded-md" />
                </div>
                <Button
                  onClick={submitApplication}
                  disabled={submitting || !formData.businessName || !formData.contactPerson || !formData.phoneNumber || !formData.description}
                  className="press w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : "Send application"}
                </Button>
              </div>
            )}

            {step === "done" && (
              <div className="py-6 text-center space-y-5">
                <div className="w-14 h-14 rounded-md bg-surface-2 border border-hairline flex items-center justify-center text-gold mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <p className="text-muted-ink text-sm px-2">
                  <strong className="text-ink">{formData.businessName}</strong> is with the organizer of {event.title}. They will reach you on {formData.phoneNumber}.
                </p>
                <Button onClick={reset} className="press w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">Close</Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
