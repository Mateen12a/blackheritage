import { z } from 'zod';
import { insertEventSchema, insertBookingSchema, events, bookings } from './schema';

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
