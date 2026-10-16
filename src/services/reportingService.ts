/**
 * AuraPOS - Reporting & Analytics Service
 * Conforming to Phase 7:
 * - Multi-dimensional sales filtering (date, terminal, employee, category)
 * - Daily and hourly sales distributions
 * - Product performance, COGS, and gross profit margin analysis
 * - Payment method breakdowns and transaction shares
 * - Refund analytics and cash shift discrepancy audits
 * - RFC 4180 CSV export and printable End-of-Day Z-Report formatting
 */

import { Sale, Product, Category, Employee } from '../types/pos.ts';
import {
  ReportFilterOptions,
  DailySalesPoint,
  HourlySalesPoint,
  ProductPerformanceItem,
  PaymentMethodMetric,
  RefundMetric,
  CashDiscrepancyReport,
  ComprehensiveFinancialReport
} from '../types/reporting.ts';
import { Currency } from '../utils/currency.ts';

export class ReportingService {
  /**
   * Filter sales by date range, terminal, cashier, and product category
   */
  static filterSales(
    sales: Sale[],
    filters: ReportFilterOptions,
    products: Product[] = []
  ): Sale[] {
    const now = new Date();

    return sales.filter(sale => {
      const saleDate = new Date(sale.createdAt);

      // 1. Date Range Filtering
      if (filters.dateRange === 'today') {
        if (
          saleDate.getDate() !== now.getDate() ||
          saleDate.getMonth() !== now.getMonth() ||
          saleDate.getFullYear() !== now.getFullYear()
        ) {
          return false;
        }
      } else if (filters.dateRange === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        if (
          saleDate.getDate() !== yest.getDate() ||
          saleDate.getMonth() !== yest.getMonth() ||
          saleDate.getFullYear() !== yest.getFullYear()
        ) {
          return false;
        }
      } else if (filters.dateRange === '7days') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (saleDate < weekAgo) return false;
      } else if (filters.dateRange === '30days') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (saleDate < monthAgo) return false;
      } else if (filters.dateRange === 'this_month') {
        if (
          saleDate.getMonth() !== now.getMonth() ||
          saleDate.getFullYear() !== now.getFullYear()
        ) {
          return false;
        }
      } else if (filters.dateRange === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (saleDate < lastMonth || saleDate >= thisMonth) return false;
      } else if (filters.dateRange === 'custom') {
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (saleDate < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (saleDate > end) return false;
        }
      }

      // 2. Terminal Filtering
      if (filters.terminalId && (sale as any).terminalId && (sale as any).terminalId !== filters.terminalId) {
        return false;
      }

      // 3. Employee Filtering
      if (filters.employeeId && sale.employeeId !== filters.employeeId) {
        return false;
      }

      // 4. Category Filtering
      if (filters.categoryId && filters.categoryId !== 'cat_all') {
        const hasCategoryItem = sale.items.some(item => {
          const prod = products.find(p => p.id === item.productId);
          return prod && prod.categoryId === filters.categoryId;
        });
        if (!hasCategoryItem) return false;
      }

      return true;
    });
  }

  /**
   * Generate comprehensive financial report
   */
  static generateFinancialReport(
    sales: Sale[],
    products: Product[],
    categories: Category[],
    employees: Employee[],
    shifts: any[] = [],
    filters: ReportFilterOptions
  ): ComprehensiveFinancialReport {
    const filteredSales = this.filterSales(sales, filters, products);
    const completedSales = filteredSales.filter(s => s.status !== 'refunded');

    // 1. Core Financial Aggregations
    const grossSalesCents = filteredSales.reduce((acc, s) => acc + Currency.toCents(s.subtotal), 0);
    const discountsCents = filteredSales.reduce((acc, s) => acc + Currency.toCents(s.discountAmount), 0);
    const taxesCents = filteredSales.reduce((acc, s) => acc + Currency.toCents(s.taxAmount), 0);

    const netSalesCents = completedSales.reduce(
      (acc, s) => acc + Math.max(0, Currency.toCents(s.subtotal) - Currency.toCents(s.discountAmount)),
      0
    );

    const grossSales = Currency.toDollars(grossSalesCents);
    const netSales = Currency.toDollars(netSalesCents);
    const totalDiscounts = Currency.toDollars(discountsCents);
    const totalTaxes = Currency.toDollars(taxesCents);
    const totalOrders = filteredSales.length;
    const averageBasket = totalOrders > 0 ? Currency.toDollars(Math.round(netSalesCents / totalOrders)) : 0;

    // 2. COGS & Gross Profit
    let cogsCents = 0;
    completedSales.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cost = prod ? prod.cost : 0;
        cogsCents += Currency.toCents(cost * item.quantity);
      });
    });

    const totalCostOfGoodsSold = Currency.toDollars(cogsCents);
    const totalGrossProfit = Currency.toDollars(Math.max(0, netSalesCents - cogsCents));
    const grossProfitMarginPct = netSales > 0 ? Math.round((totalGrossProfit / netSales) * 1000) / 10 : 0;

    // 3. Daily Sales Trends
    const dailyMap = new Map<string, { grossCents: number; netCents: number; taxCents: number; discCents: number; count: number }>();
    filteredSales.forEach(s => {
      const dayKey = s.createdAt.substring(0, 10);
      const cur = dailyMap.get(dayKey) || { grossCents: 0, netCents: 0, taxCents: 0, discCents: 0, count: 0 };
      cur.grossCents += Currency.toCents(s.subtotal);
      if (s.status !== 'refunded') {
        cur.netCents += Math.max(0, Currency.toCents(s.subtotal) - Currency.toCents(s.discountAmount));
      }
      cur.taxCents += Currency.toCents(s.taxAmount);
      cur.discCents += Currency.toCents(s.discountAmount);
      cur.count += 1;
      dailyMap.set(dayKey, cur);
    });

    const dailyTrends: DailySalesPoint[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        formattedDate: new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        grossSales: Currency.toDollars(d.grossCents),
        netSales: Currency.toDollars(d.netCents),
        totalTax: Currency.toDollars(d.taxCents),
        totalDiscount: Currency.toDollars(d.discCents),
        ordersCount: d.count,
        averageBasket: d.count > 0 ? Currency.toDollars(Math.round(d.netCents / d.count)) : 0
      }));

    // 4. Hourly Sales Distribution (0 - 23)
    const hourlyMap = new Array(24).fill(0).map((_, h) => ({ hour: h, grossCents: 0, count: 0 }));
    filteredSales.forEach(s => {
      const hour = new Date(s.createdAt).getHours();
      if (hour >= 0 && hour < 24) {
        hourlyMap[hour].grossCents += Currency.toCents(s.subtotal);
        hourlyMap[hour].count += 1;
      }
    });

    const hourlyTrends: HourlySalesPoint[] = hourlyMap.map(h => ({
      hour: h.hour,
      label: `${String(h.hour).padStart(2, '0')}:00 - ${String(h.hour + 1).padStart(2, '0')}:00`,
      grossSales: Currency.toDollars(h.grossCents),
      ordersCount: h.count
    }));

    // 5. Product Performance & Margins
    const prodMap = new Map<string, { name: string; sku: string; catId: string; units: number; grossCents: number; costCents: number }>();
    completedSales.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cur = prodMap.get(item.productId) || {
          name: item.productName,
          sku: prod?.sku || '',
          catId: prod?.categoryId || '',
          units: 0,
          grossCents: 0,
          costCents: 0
        };
        cur.units += item.quantity;
        cur.grossCents += Currency.toCents(item.lineTotal);
        cur.costCents += Currency.toCents((prod?.cost || 0) * item.quantity);
        prodMap.set(item.productId, cur);
      });
    });

    const productPerformance: ProductPerformanceItem[] = Array.from(prodMap.entries()).map(([pId, p]) => {
      const gross = Currency.toDollars(p.grossCents);
      const cost = Currency.toDollars(p.costCents);
      const profit = Currency.toDollars(Math.max(0, p.grossCents - p.costCents));
      const margin = gross > 0 ? Math.round((profit / gross) * 1000) / 10 : 0;
      const cat = categories.find(c => c.id === p.catId);

      return {
        productId: pId,
        name: p.name,
        sku: p.sku,
        categoryName: cat?.name || 'Uncategorized',
        unitsSold: p.units,
        grossSales: gross,
        totalCost: cost,
        grossProfit: profit,
        profitMarginPct: margin
      };
    });

    const topProducts = [...productPerformance].sort((a, b) => b.grossSales - a.grossSales).slice(0, 10);
    const worstProducts = [...productPerformance].sort((a, b) => a.grossSales - b.grossSales).slice(0, 5);

    // 6. Category Breakdown
    const catMap = new Map<string, { name: string; revenueCents: number; units: number }>();
    categories.forEach(c => {
      if (c.id !== 'cat_all' && c.id !== 'cat_fav') {
        catMap.set(c.id, { name: c.name, revenueCents: 0, units: 0 });
      }
    });

    completedSales.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod && catMap.has(prod.categoryId)) {
          const c = catMap.get(prod.categoryId)!;
          c.revenueCents += Currency.toCents(item.lineTotal);
          c.units += item.quantity;
        }
      });
    });

    const totalCatRevenueCents = Array.from(catMap.values()).reduce((acc, c) => acc + c.revenueCents, 0);
    const categoryBreakdown = Array.from(catMap.entries())
      .map(([cId, c]) => ({
        categoryId: cId,
        name: c.name,
        revenue: Currency.toDollars(c.revenueCents),
        unitsSold: c.units,
        percentage: totalCatRevenueCents > 0 ? Math.round((c.revenueCents / totalCatRevenueCents) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 7. Payment Breakdown
    const payMap = new Map<string, { amountCents: number; count: number }>();
    filteredSales.forEach(s => {
      s.payments.forEach(p => {
        const method = p.method.toLowerCase();
        const cur = payMap.get(method) || { amountCents: 0, count: 0 };
        cur.amountCents += Currency.toCents(p.amount);
        cur.count += 1;
        payMap.set(method, cur);
      });
    });

    const totalPayCents = Array.from(payMap.values()).reduce((acc, p) => acc + p.amountCents, 0);
    const paymentBreakdown: PaymentMethodMetric[] = Array.from(payMap.entries()).map(([method, p]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      amount: Currency.toDollars(p.amountCents),
      transactionCount: p.count,
      percentageShare: totalPayCents > 0 ? Math.round((p.amountCents / totalPayCents) * 1000) / 10 : 0
    })).sort((a, b) => b.amount - a.amount);

    // 8. Refund Analytics
    const refundedSales = filteredSales.filter(s => s.status === 'refunded' || s.status === 'partially_refunded');
    const totalRefundedCents = refundedSales.reduce((acc, s) => acc + Currency.toCents(s.total), 0);
    const refundReasonsMap: Record<string, { count: number; amount: number }> = {};

    refundedSales.forEach(s => {
      const reason = s.notes || 'Customer Request';
      if (!refundReasonsMap[reason]) {
        refundReasonsMap[reason] = { count: 0, amount: 0 };
      }
      refundReasonsMap[reason].count += 1;
      refundReasonsMap[reason].amount += s.total;
    });

    const refundMetrics: RefundMetric = {
      totalRefundedAmount: Currency.toDollars(totalRefundedCents),
      refundCount: refundedSales.length,
      refundRatePct: totalOrders > 0 ? Math.round((refundedSales.length / totalOrders) * 1000) / 10 : 0,
      byReason: refundReasonsMap
    };

    // 9. Cash Discrepancy Audits
    const cashDiscrepancies: CashDiscrepancyReport[] = (shifts || []).map(shift => {
      const expected = shift.expectedCash ?? (shift.openingFloat + (shift.cashSales || 0));
      const actual = shift.actualCash ?? (shift.closingCash || expected);
      const discrepancy = actual - expected;
      let status: 'balanced' | 'over' | 'short' = 'balanced';
      if (discrepancy > 0.05) status = 'over';
      else if (discrepancy < -0.05) status = 'short';

      return {
        shiftId: shift.id || `shift_${Date.now()}`,
        terminalId: shift.terminalId || 'terminal_main',
        terminalName: shift.terminalName || 'Primary POS Terminal',
        employeeId: shift.employeeId || '',
        employeeName: shift.employeeName || 'Staff Member',
        openedAt: shift.openedAt || shift.createdAt || new Date().toISOString(),
        closedAt: shift.closedAt,
        openingFloat: shift.openingFloat || 0,
        cashSales: shift.cashSales || 0,
        cashRefunds: shift.cashRefunds || 0,
        payIns: shift.payIns || 0,
        payOuts: shift.payOuts || 0,
        expectedCash: expected,
        actualCash: actual,
        discrepancy,
        status
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      filters,
      grossSales,
      netSales,
      totalDiscounts,
      totalTaxes,
      totalCostOfGoodsSold,
      totalGrossProfit,
      grossProfitMarginPct,
      totalOrders,
      averageBasket,
      dailyTrends,
      hourlyTrends,
      topProducts,
      worstProducts,
      categoryBreakdown,
      paymentBreakdown,
      refundMetrics,
      cashDiscrepancies
    };
  }

  /**
   * RFC 4180-compliant CSV Export for Financial Report
   */
  static generateFinancialCsv(report: ComprehensiveFinancialReport): string {
    const lines: string[] = [
      'AuraPOS — Executive Financial & Sales Report',
      `Generated:,"${report.generatedAt}"`,
      `Date Range Filter:,"${report.filters.dateRange.toUpperCase()}"`,
      '',
      'KEY FINANCIAL METRICS,Value (USD)',
      `Gross Sales,${report.grossSales.toFixed(2)}`,
      `Net Sales,${report.netSales.toFixed(2)}`,
      `Total Discounts,${report.totalDiscounts.toFixed(2)}`,
      `Total Taxes Collected,${report.totalTaxes.toFixed(2)}`,
      `Cost of Goods Sold (COGS),${report.totalCostOfGoodsSold.toFixed(2)}`,
      `Gross Profit,${report.totalGrossProfit.toFixed(2)}`,
      `Gross Profit Margin %,${report.grossProfitMarginPct}%`,
      `Total Completed Tickets,${report.totalOrders}`,
      `Average Basket Size,${report.averageBasket.toFixed(2)}`,
      '',
      'DAILY SALES PERFORMANCE',
      'Date,Gross Sales,Net Sales,Taxes,Discounts,Tickets,Avg Basket',
      ...report.dailyTrends.map(
        d => `"${d.date}",${d.grossSales.toFixed(2)},${d.netSales.toFixed(2)},${d.totalTax.toFixed(2)},${d.totalDiscount.toFixed(2)},${d.ordersCount},${d.averageBasket.toFixed(2)}`
      ),
      '',
      'PRODUCT PERFORMANCE RANKING',
      'Product Name,SKU,Category,Units Sold,Gross Sales,COGS,Gross Profit,Margin %',
      ...report.topProducts.map(
        p => `"${p.name}","${p.sku}","${p.categoryName}",${p.unitsSold},${p.grossSales.toFixed(2)},${p.totalCost.toFixed(2)},${p.grossProfit.toFixed(2)},${p.profitMarginPct}%`
      ),
      '',
      'PAYMENT METHODS DISTRIBUTION',
      'Payment Method,Amount,Transactions,Share %',
      ...report.paymentBreakdown.map(
        p => `"${p.method}",${p.amount.toFixed(2)},${p.transactionCount},${p.percentageShare}%`
      ),
      '',
      'CASH SHIFT DISCREPANCY AUDIT',
      'Terminal,Cashier,Opened At,Expected Cash,Actual Cash,Variance,Status',
      ...report.cashDiscrepancies.map(
        c => `"${c.terminalName}","${c.employeeName}","${c.openedAt}",${c.expectedCash.toFixed(2)},${c.actualCash.toFixed(2)},${c.discrepancy.toFixed(2)},"${c.status.toUpperCase()}"`
      )
    ];

    return lines.join('\r\n');
  }

  /**
   * End-of-Day Printable Z-Report (Formatted for thermal POS printer or print dialog)
   */
  static formatEndOfDayZReport(report: ComprehensiveFinancialReport, storeName: string = 'AuraPOS Store'): string {
    const divider = '------------------------------------------';
    const lines: string[] = [
      `             ${storeName.toUpperCase()}             `,
      '         END-OF-DAY FINANCIAL Z-REPORT         ',
      divider,
      `Report Date:   ${new Date().toLocaleDateString()}`,
      `Generated At:  ${new Date().toLocaleTimeString()}`,
      `Period:        ${report.filters.dateRange.toUpperCase()}`,
      divider,
      'FINANCIAL SUMMARY:',
      `  Gross Sales:       $${report.grossSales.toFixed(2).padStart(12)}`,
      `  Discounts:        -$${report.totalDiscounts.toFixed(2).padStart(12)}`,
      `  Taxes:             $${report.totalTaxes.toFixed(2).padStart(12)}`,
      `  Net Sales:         $${report.netSales.toFixed(2).padStart(12)}`,
      `  COGS:              $${report.totalCostOfGoodsSold.toFixed(2).padStart(12)}`,
      `  Gross Profit:      $${report.totalGrossProfit.toFixed(2).padStart(12)} (${report.grossProfitMarginPct}%)`,
      `  Total Tickets:     ${String(report.totalOrders).padStart(14)}`,
      `  Average Basket:    $${report.averageBasket.toFixed(2).padStart(12)}`,
      divider,
      'PAYMENT TENDER BREAKDOWN:',
      ...report.paymentBreakdown.map(
        p => `  ${(p.method + ':').padEnd(18)} $${p.amount.toFixed(2).padStart(10)} (${p.percentageShare}%)`
      ),
      divider,
      'REFUNDS & REVERSALS:',
      `  Total Refunded:    $${report.refundMetrics.totalRefundedAmount.toFixed(2).padStart(12)}`,
      `  Refund Tickets:    ${String(report.refundMetrics.refundCount).padStart(14)} (${report.refundMetrics.refundRatePct}%)`,
      divider,
      'CASH DRAWER RECONCILIATION:',
      ...report.cashDiscrepancies.map(
        c => `  ${c.terminalName}: Exp $${c.expectedCash.toFixed(2)} | Act $${c.actualCash.toFixed(2)} | Diff $${c.discrepancy.toFixed(2)} [${c.status.toUpperCase()}]`
      ),
      divider,
      '             *** END OF REPORT ***            '
    ];

    return lines.join('\n');
  }
}
