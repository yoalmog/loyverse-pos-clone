/**
 * AuraPOS - Reporting & Analytics Domain Types
 * Conforming to Phase 7:
 * - Multi-dimensional sales reporting (date, terminal, employee, category)
 * - Daily and hourly sales aggregations
 * - Product performance ranking and gross profit margins
 * - Payment method breakdowns and transaction shares
 * - Refund analytics and cash discrepancy audits
 * - Financial CSV and printable Z-Report generation
 */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'this_month'
  | 'last_month'
  | 'custom'
  | 'all';

export interface ReportFilterOptions {
  dateRange: DateRangePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  terminalId?: string; // Specific terminal ID or undefined for all
  employeeId?: string; // Specific cashier ID or undefined for all
  categoryId?: string; // Specific category ID or undefined for all
}

export interface DailySalesPoint {
  date: string; // YYYY-MM-DD
  formattedDate: string;
  grossSales: number;
  netSales: number;
  totalTax: number;
  totalDiscount: number;
  ordersCount: number;
  averageBasket: number;
}

export interface HourlySalesPoint {
  hour: number; // 0 - 23
  label: string; // e.g. "14:00 - 15:00"
  grossSales: number;
  ordersCount: number;
}

export interface ProductPerformanceItem {
  productId: string;
  name: string;
  sku: string;
  categoryName: string;
  unitsSold: number;
  grossSales: number;
  totalCost: number;
  grossProfit: number;
  profitMarginPct: number;
}

export interface PaymentMethodMetric {
  method: string;
  amount: number;
  transactionCount: number;
  percentageShare: number;
}

export interface RefundMetric {
  totalRefundedAmount: number;
  refundCount: number;
  refundRatePct: number; // Percentage of total sales that were refunded
  byReason: Record<string, { count: number; amount: number }>;
}

export interface CashDiscrepancyReport {
  shiftId: string;
  terminalId: string;
  terminalName: string;
  employeeId: string;
  employeeName: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashSales: number;
  cashRefunds: number;
  payIns: number;
  payOuts: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number; // actualCash - expectedCash (positive = over, negative = short)
  status: 'balanced' | 'over' | 'short';
}

export interface ComprehensiveFinancialReport {
  generatedAt: string;
  filters: ReportFilterOptions;
  grossSales: number;
  netSales: number;
  totalDiscounts: number;
  totalTaxes: number;
  totalCostOfGoodsSold: number;
  totalGrossProfit: number;
  grossProfitMarginPct: number;
  totalOrders: number;
  averageBasket: number;
  dailyTrends: DailySalesPoint[];
  hourlyTrends: HourlySalesPoint[];
  topProducts: ProductPerformanceItem[];
  worstProducts: ProductPerformanceItem[];
  categoryBreakdown: Array<{ categoryId: string; name: string; revenue: number; unitsSold: number; percentage: number }>;
  paymentBreakdown: PaymentMethodMetric[];
  refundMetrics: RefundMetric;
  cashDiscrepancies: CashDiscrepancyReport[];
}
