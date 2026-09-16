import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Event } from "@shared/schema";
import React, { useState, useEffect } from "react";
import { useCreateBooking } from "@/hooks/use-bookings";
import { Loader2, CreditCard, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

declare global {
  interface Window {
    PaystackPop: any;
  }
}

interface BookingModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

export function BookingModal({ event, isOpen, onClose }: BookingModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedTicketType, setSelectedTicketType] = useState<string>("");
  const { mutate: createBooking, isPending } = useCreateBooking();

  const ticketTypes = React.useMemo(() => {
    try {
      const types = JSON.parse(event.ticketTypes || '[]');
      if (types.length === 0) {
        return [{ name: "Regular", price: event.price, capacity: event.capacity, sold: 0 }];
      }
      return types;
    } catch (e) {
      return [{ name: "Regular", price: event.price, capacity: event.capacity, sold: 0 }];
    }
  }, [event]);

  useEffect(() => {
    if (ticketTypes.length > 0 && !selectedTicketType) {
      setSelectedTicketType(ticketTypes[0].name);
    }
  }, [ticketTypes, selectedTicketType]);

  const currentType = ticketTypes.find((t: any) => t.name === selectedTicketType) || ticketTypes[0];
  const price = currentType.price / 100;
  const total = price * quantity;

  useEffect(() => {
    // No-op: script is now in index.html for stability
  }, []);

  const handleBooking = () => {
    if (!email || !name) {
      alert("Please enter your name and email to proceed");
      return;
    }

    if (price === 0) {
      // Handle free ticket
      const bookingPayload = {
        eventId: event.id,
        quantity,
        totalAmount: 0,
        userId: "0",
        email: email.trim(),
        name: name.trim(),
        paymentReference: "FREE_" + Math.random().toString(36).substr(2, 9),
        ticketType: selectedTicketType
      };
      
    createBooking(bookingPayload, {
        onSuccess: () => {
          alert("Booking Successful! Check your email for your ticket.");
          window.location.reload(); // Refresh to show ticket in My Tickets
          onClose();
        },
        onError: (err: any) => alert(err.message)
      });
      return;
    }

    const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || (window as any).VITE_PAYSTACK_PUBLIC_KEY;
    const PaystackPop = (window as any).PaystackPop;
    
    if (!paystackKey || paystackKey === "UNDEFINED") {
      alert("Payment configuration is missing. Please ensure VITE_PAYSTACK_PUBLIC_KEY is set in your environment variables.");
      return;
    }
    
    if (!PaystackPop) {
      alert("Payment service is loading. Please wait a few seconds and try again.");
      return;
    }

    try {
      // Force blur any active element to prevent focus trap issues with Radix/Shadcn
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const handler = PaystackPop.setup({
        key: paystackKey,
        email: email,
        amount: Math.round(total * 100),
        currency: "NGN",
        // Force the iframe to a very high z-index via metadata if supported, 
        // but primarily we rely on the modal having a LOW z-index now.
        metadata: {
          custom_fields: [
            {
              display_name: "Is Test",
              variable_name: "is_test",
              value: "true",
            },
            {
              display_name: "Ticket Type",
              variable_name: "ticket_type",
              value: selectedTicketType
            }
          ],
        },
        callback: (response: any) => {
          if (response && (response.status === 'success' || response.reference)) {
             // Use local variables to ensure the correct values are captured in the closure
             const finalName = name.trim();
             const finalEmail = email.trim();
             
             const bookingPayload = {
               eventId: event.id,
               quantity,
               totalAmount: Math.round(currentType.price * quantity),
               userId: "0",
               email: finalEmail,
               name: finalName,
               paymentReference: response.reference,
               ticketType: selectedTicketType
             };
             
             console.log("Submitting booking with payload:", bookingPayload);
             
             createBooking(
              bookingPayload,
              {
                onSuccess: () => {
                  alert("Booking Successful! Check your email for your ticket.");
                  window.location.reload(); // Refresh to show ticket in My Tickets
                  onClose();
                },
                onError: (error: any) => {
                  console.error("Booking save error:", error);
                  alert(`Booking save failed: ${error.message || 'Unknown error'}. Your payment reference is ${response.reference}. Please contact support.`);
                }
              },
            );
          }
        },
        onClose: () => {
          console.log("Paystack closed");
        },
      });

      handler.openIframe();
    } catch (e) {
      console.error("Paystack error:", e);
      alert("An error occurred initializing payment. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="bg-card border border-white/10 text-white w-[95vw] sm:max-w-md p-0 overflow-hidden z-[50]"
        onPointerDownOutside={(e) => {
          if (document.querySelector('iframe[src*="paystack"]')) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (document.querySelector('iframe[src*="paystack"]')) {
            e.preventDefault();
          }
        }}
      >
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl sm:text-3xl font-display text-primary">
                Buy Your Ticket
              </DialogTitle>
              <DialogDescription className="text-base sm:text-lg text-white font-medium">
                {event.title}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="space-y-3">
                <label className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Select Ticket Type
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {ticketTypes.map((type: any) => (
                    <button
                      key={type.name}
                      onClick={() => setSelectedTicketType(type.name)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedTicketType === type.name
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{type.name}</span>
                        <span className="text-primary font-black">
                          {type.price === 0 ? "FREE" : `₦${(type.price / 100).toLocaleString()}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase mt-1">
                        {type.capacity ? `${type.capacity - (type.sold || 0)} available` : "Unlimited"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Your Full Name
                  </label>
                  <Input
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 sm:h-14 bg-background border-white/20 focus:border-primary text-white rounded-xl px-4 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 sm:h-14 bg-background border-white/20 focus:border-primary text-white rounded-xl px-4 text-base"
                  />
                  <p className="text-[10px] text-muted-foreground uppercase">
                    Your ticket will be sent to this email
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Number of Tickets
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="h-12 sm:h-14 text-lg sm:text-xl bg-background border-white/20 focus:border-primary text-white rounded-xl px-4 text-base"
                />
              </div>

              <div className="bg-secondary/20 rounded-2xl p-4 sm:p-6 space-y-3 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary">
                    Availability
                  </span>
                  <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    <Users className="w-3 h-3 text-primary" />
                    <span className="text-[10px] sm:text-xs font-bold text-white">
                      {event.capacity} spots left
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-muted-foreground">
                    One ticket price
                  </span>
                  <span className="font-bold text-white">
                    ₦{price.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-muted-foreground">
                    Number of tickets
                  </span>
                  <span className="font-bold text-white">x{quantity}</span>
                </div>
                <div className="border-t border-white/10 my-4 pt-4 flex justify-between font-black text-xl sm:text-2xl text-primary">
                  <span>Total Cost</span>
                  <span>₦{total.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleBooking}
                  disabled={isPending}
                  className="w-full h-16 sm:h-20 bg-primary text-background hover:bg-white font-black text-xl sm:text-2xl rounded-2xl shadow-xl transition-all active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 mr-3" />
                      Pay ₦{total.toLocaleString()} Now
                    </>
                  )}
                </Button>
                <span className="text-center text-xs sm:text-sm font-bold text-primary animate-pulse">
                  Click the button above to pay
                </span>
              </div>

              <p className="text-[10px] sm:text-sm text-center text-muted-foreground font-medium pb-4">
                Pay safely with your Card or Bank Transfer using Paystack.
                <br />
                Your ticket will be sent to you immediately after payment.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
