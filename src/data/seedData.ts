/**
 * Optional Development Seed Data (Strictly opt-in only)
 * Conforming to Section 19: "If developers need seed data for development,
 * keep it completely separate from production behavior. Use an explicit
 * development-only seed mechanism. Never automatically seed demo data in production."
 */

import { Product, Customer, Category } from '../types/pos.ts';

export const SAMPLE_DEVELOPER_CATEGORIES: Category[] = [
  {
    id: 'cat_coffee',
    storeId: 'store_aura_main',
    name: 'Coffee & Espresso',
    iconName: 'Coffee',
    color: '#92400E',
    sortOrder: 1,
    active: true
  },
  {
    id: 'cat_bakery',
    storeId: 'store_aura_main',
    name: 'Fresh Bakery',
    iconName: 'Croissant',
    color: '#D97706',
    sortOrder: 2,
    active: true
  }
];

export const SAMPLE_DEVELOPER_PRODUCTS: Product[] = [
  {
    id: 'prod_espresso',
    storeId: 'store_aura_main',
    categoryId: 'cat_coffee',
    name: 'Single Origin Espresso',
    sku: 'COF-ESP-01',
    barcode: '891000101',
    price: 3.5,
    cost: 0.65,
    trackInventory: true,
    stock: 120,
    lowStockThreshold: 20,
    unit: 'cup',
    color: '#78350F',
    isFavorite: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const SAMPLE_DEVELOPER_CUSTOMERS: Customer[] = [
  {
    id: 'cust_sample',
    storeId: 'store_aura_main',
    firstName: 'Jordan',
    lastName: 'Taylor',
    email: 'jordan.taylor@example.com',
    phone: '(555) 234-5678',
    loyaltyPoints: 50,
    lifetimePoints: 50,
    totalSpent: 42.5,
    totalOrders: 4,
    lastPurchaseDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
