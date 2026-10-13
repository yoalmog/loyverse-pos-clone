export interface Store {
  id: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency_code: string;
  currency_symbol: string;
  tax_rate: number;
  tax_name: string;
  tax_type: 'INCLUDED' | 'ADDED';
  receipt_header?: string;
  receipt_footer?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  pin: string;
  active: boolean;
}

export interface Product {
  id: string;
  category_id?: string | null;
  name: string;
  description?: string;
  price: number; // in cents
  cost: number; // in cents
  sku?: string;
  barcode?: string;
  color?: string;
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  active: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variation_id?: string | null;
  product_name: string;
  variation_name?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_amount: number;
  total: number;
}

export interface Order {
  id: string;
  receipt_number: string;
  shift_id?: string | null;
  user_id: string;
  customer_id?: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  status: 'COMPLETED' | 'SAVED' | 'REFUNDED' | 'CANCELLED';
  created_at: string;
}

export interface SyncQueueEvent {
  id: string;
  idempotencyKey: string;
  deviceId: string;
  eventType: 'CHECKOUT' | 'CASH_MOVEMENT' | 'REFUND';
  payload: any;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  errorMessage?: string | null;
  createdAt: string;
  syncedAt?: string | null;
}
