import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiError, SESSION_EXPIRED_MESSAGE, errorFromResponse } from "./errors";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // errorFromResponse reads the body safely (JSON, plain text, or nothing)
    // and falls back to plain language for the status.
    throw await errorFromResponse(res);
  }
}

// Same-origin API in dev/preview (vite proxies /api → localhost:3001);
// production can override with VITE_API_URL. See vite.config.ts proxy.
const BASE_URL = import.meta.env.VITE_API_URL || "";

// Wake up the backend immediately when this file is loaded
fetch(`${BASE_URL}/api/health`).catch(() => {
  // Silent fail: this is only a warm-up ping, nothing to report to the user.
});

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const isExternal = url.startsWith("http");
  const fullUrl = isExternal ? url : `${BASE_URL}${url}`;
  
  const res = await fetch(fullUrl, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    return res;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const isExternal = url.startsWith("http");
    const fullUrl = isExternal ? url : `${BASE_URL}${url}`;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null as any;
      }
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
