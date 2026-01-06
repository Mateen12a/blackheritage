import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Event } from "@shared/schema";
import { useState } from "react";
import { Loader2, ArrowLeft, CheckCircle2, Building2, Store } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BusinessModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function BusinessModal({ event, isOpen, onClose }: BusinessModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<"sponsor" | "vendor" | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [formData, setFormData] = useState({
    businessName: "",
    contactPerson: "",
    phoneNumber: "",
    email: "",
    description: "",
  });

  const sponsorPackages = [
    { name: "Gold Sponsor", price: 250000, benefits: ["Logo on main stage", "4 VIP tickets", "Social media mention"] },
    { name: "Silver Sponsor", price: 100000, benefits: ["Logo on flyers", "2 VIP tickets", "Event shoutout"] },
  ];

  const vendorPackages = [
    { name: "Food Vendor", price: 50000, benefits: ["3x3m space", "Power supply", "2 vendor passes"] },
    { name: "Drinks/Snacks", price: 30000, benefits: ["2x2m space", "1 vendor pass", "Cooling space"] },
  ];

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const reset = () => {
    setStep(1);
    setType(null);
    setSelectedPackage(null);
    setFormData({
      businessName: "",
      contactPerson: "",
      phoneNumber: "",
      email: "",
      description: "",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={reset}>
      <DialogContent className="bg-card border border-white/10 text-white w-[95vw] sm:max-w-lg p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                {step > 1 && step < 4 && (
                  <button onClick={handleBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <DialogTitle className="text-xl sm:text-2xl font-display text-primary">
                  {step === 1 ? "Partner With Us" : step === 2 ? `Choose ${type === 'sponsor' ? 'Sponsorship' : 'Spot'}` : step === 3 ? "Your Details" : "Success!"}
                </DialogTitle>
              </div>
              {step < 4 && (
                <DialogDescription className="text-muted-foreground text-sm">
                  Step {step} of 3
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="py-2">
              {step === 1 && (
                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => { setType("sponsor"); handleNext(); }}
                    className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-secondary/20 border border-white/5 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all text-center sm:text-left group"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Building2 className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-1">Sponsor</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">Promote your brand to our audience</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => { setType("vendor"); handleNext(); }}
                    className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-secondary/20 border border-white/5 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all text-center sm:text-left group"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Store className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-1">Vendor</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">Sell your products or food at the event</p>
                    </div>
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 pr-2 custom-scrollbar">
                  {(type === "sponsor" ? sponsorPackages : vendorPackages).map((pkg) => (
                    <button
                      key={pkg.name}
                      onClick={() => { setSelectedPackage(pkg); handleNext(); }}
                      className="w-full p-4 sm:p-6 bg-secondary/20 border border-white/5 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4">
                        <h4 className="text-lg sm:text-xl font-bold text-white">{pkg.name}</h4>
                        <span className="text-primary font-black text-lg sm:text-xl">₦{pkg.price.toLocaleString()}</span>
                      </div>
                      <ul className="space-y-2">
                        {pkg.benefits.map((benefit: string) => (
                          <li key={benefit} className="flex items-center gap-2 text-xs sm:text-sm text-white/70">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white">Business Name</label>
                    <Input 
                      placeholder="e.g. Kola's Kitchen" 
                      value={formData.businessName}
                      onChange={e => setFormData({...formData, businessName: e.target.value})}
                      className="h-12 bg-background border-white/10 text-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-white">Contact Person</label>
                      <Input 
                        placeholder="Full Name" 
                        value={formData.contactPerson}
                        onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                        className="h-12 bg-background border-white/10 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-white">Phone Number</label>
                      <Input 
                        placeholder="080..." 
                        value={formData.phoneNumber}
                        onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                        className="h-12 bg-background border-white/10 text-base"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white">Email (Optional)</label>
                    <Input 
                      type="email"
                      placeholder="email@example.com" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="h-12 bg-background border-white/10 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white">What do you sell or promote?</label>
                    <Textarea 
                      placeholder="Short description..." 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="bg-background border-white/10 resize-none h-24 text-base"
                    />
                  </div>
                  <Button 
                    onClick={handleNext}
                    disabled={!formData.businessName || !formData.contactPerson || !formData.phoneNumber || !formData.description}
                    className="w-full h-14 sm:h-16 bg-primary text-background font-black text-lg sm:text-xl rounded-2xl mt-4"
                  >
                    Submit Application
                  </Button>
                </div>
              )}

              {step === 4 && (
                <div className="py-6 sm:py-10 text-center space-y-6 animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary mx-auto">
                    <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl sm:text-3xl font-display font-bold text-white">Application Sent!</h3>
                    <p className="text-muted-foreground text-base sm:text-lg px-2 sm:px-6">
                      We have received your details for <strong>{formData.businessName}</strong>. 
                      Our team will call you within 24 hours.
                    </p>
                  </div>
                  <Button onClick={reset} className="w-full h-14 sm:h-16 bg-white text-background font-black text-lg sm:text-xl rounded-2xl">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
