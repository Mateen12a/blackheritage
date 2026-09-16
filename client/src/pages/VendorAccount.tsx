import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

/**
 * /vendor-signup now redirects to the unified VendorDashboard.
 * Kept as a route for backward compatibility with old links.
 */
export default function VendorAccount() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      setLocation(user ? "/vendor-dashboard" : "/auth?returnTo=/vendor-dashboard");
    }
  }, [isLoading, user, setLocation]);

  return null;
}
