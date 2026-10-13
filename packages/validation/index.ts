import { z } from 'zod';

export const CheckoutPayloadSchema = z.object({
  idempotencyKey: z.string().nullable().optional(),
  shiftId: z.string().nullable().optional(),
  userId: z.string().min(1, 'ID de cajero es obligatorio'),
  customerId: z.string().nullable().optional(),
  diningOptionId: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variationId: z.string().nullable().optional(),
    productName: z.string(),
    variationName: z.string().nullable().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    discountAmount: z.number().nonnegative().optional(),
    selectedModifiers: z.array(z.any()).default([]),
    note: z.string().optional(),
  })).min(1, 'El pedido debe tener al menos un producto'),
  overallDiscountId: z.string().nullable().optional(),
  overallDiscountAmount: z.number().nonnegative().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'WALLET', 'OTHER']),
  cashTendered: z.number().nonnegative().optional(),
  referenceNumber: z.string().nullable().optional(),
  ticketName: z.string().nullable().optional(),
  orderNote: z.string().nullable().optional(),
});

export const SyncBatchSchema = z.object({
  events: z.array(z.object({
    id: z.string(),
    idempotencyKey: z.string().min(1),
    deviceId: z.string().min(1),
    eventType: z.enum(['CHECKOUT', 'CASH_MOVEMENT', 'REFUND']),
    payload: z.any(),
  })).min(1),
});
