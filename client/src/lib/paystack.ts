/**
 * Paystack's inline script, loaded on demand. It used to sit in index.html,
 * so every page view paid for it; now the booking dialog starts the download
 * when it opens and checkout waits for it only if it is not there yet.
 */
let loading: Promise<any> | null = null;

export function loadPaystack(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).PaystackPop) return Promise.resolve((window as any).PaystackPop);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve((window as any).PaystackPop || null);
    // A blocked or failed script falls back to the hosted payment page.
    script.onerror = () => { loading = null; resolve(null); };
    document.head.appendChild(script);
  });
  return loading;
}
