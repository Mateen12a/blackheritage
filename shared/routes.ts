import { z } from 'zod';
import {
  insertEventSchema, insertBookingSchema, insertVendorSchema, events, bookings, vendors,
  bookingInitiateSchema, bookingFinalizeSchema, promoCreateSchema, manualTicketSchema,
  scanRequestSchema, scanOverrideSchema, scanSyncSchema, teamCreateSchema, platformSettingsSchema,
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events',
      responses: {
        200: z.array(z.custom<typeof events.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/events/:id',
      responses: {
        200: z.custom<typeof events.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/events',
      input: insertEventSchema,
      responses: {
        201: z.custom<typeof events.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/events/:id',
      input: insertEventSchema.partial(),
      responses: {
        200: z.custom<typeof events.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/admin/stats',
      responses: {
        200: z.object({
          totalEvents: z.number(),
          totalTicketsSold: z.number(),
          totalRevenue: z.number(),
        }),
      },
    },
  },
  bookings: {
    create: {
      method: 'POST' as const,
      path: '/api/bookings',
      input: insertBookingSchema,
      responses: {
        201: z.custom<typeof bookings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    listByEvent: {
      method: 'GET' as const,
      path: '/api/events/:id/bookings',
      responses: {
        200: z.array(z.custom<typeof bookings.$inferSelect & { user: any }>()),
      },
    },
    search: {
      method: 'GET' as const,
      path: '/api/bookings/search',
      responses: {
        200: z.array(z.custom<typeof bookings.$inferSelect & { event: typeof events.$inferSelect }>()),
      },
    },
  },
  vendors: {
    list: {
      method: 'GET' as const,
      path: '/api/vendors',
      responses: {
        200: z.array(z.custom<typeof vendors.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/vendors/:id',
      responses: {
        200: z.custom<typeof vendors.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vendors',
      input: insertVendorSchema,
      responses: {
        201: z.custom<typeof vendors.$inferSelect>(),
        400: errorSchemas.validation,
        403: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/vendors/:id',
      input: insertVendorSchema.partial(),
      responses: {
        200: z.custom<typeof vendors.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  payments: {
    createIntent: {
      method: 'POST' as const,
      path: '/api/payments/intent',
      input: z.object({ amount: z.number() }),
      responses: {
        200: z.object({ clientSecret: z.string() }),
      },
    },
  },
  bookingInitiate: {
    method: 'POST' as const,
    path: '/api/bookings/initiate',
    input: bookingInitiateSchema,
  },
  bookingFinalize: {
    method: 'POST' as const,
    path: '/api/bookings/finalize',
    input: bookingFinalizeSchema,
  },
  promos: {
    list: { method: 'GET' as const, path: '/api/events/:id/promos' },
    create: { method: 'POST' as const, path: '/api/events/:id/promos', input: promoCreateSchema },
    delete: { method: 'DELETE' as const, path: '/api/promos/:promoId' },
  },
  team: {
    list: { method: 'GET' as const, path: '/api/team' },
    create: { method: 'POST' as const, path: '/api/team', input: teamCreateSchema },
    delete: { method: 'DELETE' as const, path: '/api/team/:userId' },
  },
  manualTickets: {
    method: 'POST' as const,
    path: '/api/events/:id/manual-tickets',
    input: manualTicketSchema,
  },
  attendeeExport: {
    method: 'GET' as const,
    path: '/api/events/:id/attendees.csv',
  },
  refund: {
    method: 'POST' as const,
    path: '/api/bookings/:id/refund',
  },
  scanVerify: {
    method: 'POST' as const,
    path: '/api/verify',
    input: scanRequestSchema,
  },
  scanOverride: {
    method: 'POST' as const,
    path: '/api/verify/override',
    input: scanOverrideSchema,
  },
  scanSync: {
    method: 'POST' as const,
    path: '/api/verify/sync',
    input: scanSyncSchema,
  },
  payouts: {
    list: { method: 'GET' as const, path: '/api/payouts' },
    settle: { method: 'POST' as const, path: '/api/payouts/:payoutId/settle' },
  },
  platformSettings: {
    method: 'GET' as const,
    path: '/api/platform/settings',
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type EventResponse = z.infer<typeof api.events.get.responses[200]>;
export type BookingResponse = z.infer<typeof api.bookings.create.responses[201]>;
