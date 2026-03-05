import { z } from 'zod';
import { NextResponse } from 'next/server';

// Reusable schemas
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Helper to validate request body and return error response if invalid
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation error', details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

// Helper to validate query params
export function validateQuery<T>(schema: z.ZodSchema<T>, params: URLSearchParams):
  { success: true; data: T } | { success: false; response: NextResponse } {
  const obj = Object.fromEntries(params.entries());
  const result = schema.safeParse(obj);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid query parameters', details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
