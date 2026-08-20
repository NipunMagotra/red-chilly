import { z } from 'zod'

/**
 * Strict Runtime Validation Schemas for DineScan Server Actions & API Boundaries.
 * Guards against malformed inputs, SQL injections, oversized payloads, and invalid enums.
 */

export const VerifyPinSchema = z.object({
  locationIdentifier: z
    .string()
    .trim()
    .min(1, 'Location identifier is required')
    .max(64, 'Location identifier exceeds maximum length')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Location identifier contains invalid characters'),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Stay PIN must be exactly 4 numeric digits'),
})

export const OrderItemInputSchema = z.object({
  menuItemId: z
    .string()
    .trim()
    .min(1, 'Menu item ID is required')
    .max(64, 'Menu item ID exceeds maximum length')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Menu item ID contains invalid characters'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(50, 'Quantity cannot exceed 50 per item'),
  notes: z
    .string()
    .max(200, 'Item notes cannot exceed 200 characters')
    .optional(),
})

export const AppendOrderSchema = z.object({
  items: z
    .array(OrderItemInputSchema)
    .min(1, 'At least one menu item is required')
    .max(30, 'Cannot order more than 30 distinct items per round'),
  specialInstructions: z
    .string()
    .max(500, 'Special instructions cannot exceed 500 characters')
    .optional(),
  idempotencyKey: z
    .string()
    .max(128, 'Idempotency key exceeds maximum length')
    .optional(),
})

export const CheckInGuestSchema = z.object({
  locationIdentifier: z
    .string()
    .trim()
    .min(1, 'Location identifier is required')
    .max(64, 'Location identifier exceeds maximum length')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Location identifier contains invalid characters'),
  guestName: z
    .string()
    .trim()
    .min(1, 'Guest name is required')
    .max(100, 'Guest name cannot exceed 100 characters'),
  customPin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits')
    .optional(),
})

export const VoidItemSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(1, 'Session ID is required')
    .max(128, 'Session ID exceeds maximum length'),
  roundId: z
    .string()
    .trim()
    .min(1, 'Round ID is required')
    .max(128, 'Round ID exceeds maximum length'),
  itemId: z
    .string()
    .trim()
    .min(1, 'Item ID is required')
    .max(128, 'Item ID exceeds maximum length'),
  reason: z
    .string()
    .max(300, 'Void reason cannot exceed 300 characters')
    .optional(),
})

export const SettleTabSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(1, 'Session ID is required')
    .max(128, 'Session ID exceeds maximum length'),
  paymentMethod: z.enum(['room_folio', 'credit_card', 'cash'], {
    message: 'Invalid payment method. Allowed: room_folio, credit_card, cash',
  }),
  staffNote: z
    .string()
    .max(500, 'Staff note cannot exceed 500 characters')
    .optional(),
})

export const StaffLoginSchema = z.object({
  passcode: z
    .string()
    .trim()
    .min(1, 'Passcode is required')
    .max(100, 'Passcode exceeds maximum length'),
  targetPropertyId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
})

export const SessionLookupSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(1)
    .max(128),
})
